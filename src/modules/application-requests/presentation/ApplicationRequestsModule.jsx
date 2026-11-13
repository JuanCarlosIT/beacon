import { useCallback, useState } from 'react';
import { getGabThemeStyle } from '../../../shared/theme/theme.js';
import {
  confirmSaved,
  showError,
  confirmRequestStatus,
  confirmApprovalRequest,
  confirmApprovalRequested,
  confirmRateCorrected,
  confirmRateCorrection,
  confirmRateDecision,
  confirmRemissionReview,
  confirmRemissionUploaded,
  confirmSupplierRegistration,
  confirmSupplierRegistered,
} from '../../../shared/feedback/alerts.js';
import { saveDownload } from '../../../shared/files/saveDownload.js';
import { filterRequests } from '../domain/request.js';
import { useRequests } from './hooks/useRequests.js';
import {
  readUrlParam,
  useCurrentUser,
  useGuardedAction,
  useLinkedRequest,
  writeUrlParam,
} from './hooks/useModuleHelpers.js';
import RequestForm from './components/RequestForm.jsx';
import RequestHistory from './components/RequestHistory.jsx';
import RequestDetail from './components/RequestDetail.jsx';
import PurchaseBoard from './components/PurchaseBoard.jsx';
import SupplierRegistration from './components/SupplierRegistration.jsx';
import {
  CapturePanel,
  ModuleHeader,
  ServiceAlert,
  TabPanel,
  Tabs,
} from './components/ModuleChrome.jsx';
import '../../../shared/theme/fonts.js';

// Qué muestra cada vista. 'capture': quien captura (lo suyo queda autorizado) y valida las
// remisiones. 'review': el gestor, que sube las remisiones y arma la OCM con las validadas.
const VIEW_PARTS = {
  capture: {
    form: true,
    history: true,
    formNote: 'Lo que guardes queda autorizado',
    tabs: ['Nueva solicitud', 'Historial'],
  },
  review: { board: true, history: true, filter: 'Aprobada', tabs: ['OCM', 'Historial'] },
};
// Cada vista tiene dos pestañas: la de trabajo (formulario o tablero) y la de solicitudes.
const WORK_TAB = 0;
const HISTORY_TAB = 1;
// Nombre de cada pestaña en la dirección (?pestana=…), para volver a ella al recargar.
const TAB_NAMES = ['inicio', 'historial'];

// Pestaña al abrir: la de la dirección; con una solicitud en el link, el historial; si no, el
// gestor empieza en el historial (ahí sube remisiones) y quien captura, en el formulario.
function initialTab(parts) {
  const named = TAB_NAMES.indexOf(readUrlParam('pestana'));
  if (named >= 0) return named;
  if (readUrlParam('solicitud')) return HISTORY_TAB;
  return parts.board ? HISTORY_TAB : WORK_TAB;
}

export default function ApplicationRequestsModule({ useCases, theme = 'light', view = 'capture' }) {
  const state = useRequests(useCases);
  const parts = VIEW_PARTS[view] ?? VIEW_PARTS.capture;
  const user = useCurrentUser(useCases);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(parts.filter ?? 'Todas');
  const [showSupplierRegistration, setShowSupplierRegistration] = useState(false);
  const visible = filterRequests(state.rows, { status: filter, query });

  const [tab, setTabState] = useState(() => initialTab(parts));
  function setTab(index) {
    setTabState(index);
    writeUrlParam('pestana', TAB_NAMES[index]);
  }

  // La solicitud abierta queda en la dirección: al recargar se vuelve a abrir.
  async function openDetail(id) {
    try {
      await state.openDetail(id);
      writeUrlParam('solicitud', id);
    } catch (error) {
      writeUrlParam('solicitud', null);
      await showError(error.message);
    }
  }
  // Estable entre renders: el detalle no vuelve a mover el foco en cada actualización.
  const closeRequest = state.closeDetail;
  const closeDetail = useCallback(() => {
    writeUrlParam('solicitud', null);
    closeRequest();
  }, [closeRequest]);
  // Al entrar con una solicitud en la dirección (link de WhatsApp o recarga) se abre sola.
  useLinkedRequest(openDetail);

  async function register(body) {
    const created = await state.register(body);
    await confirmSaved(created);
    return created;
  }
  const [changingStatus, changeStatus] = useGuardedAction({
    confirm: confirmRequestStatus,
    run: (request, status) => state.changeStatus(request.id, status),
  });
  const [decidingRate, decideRate] = useGuardedAction({
    confirm: confirmRateDecision,
    run: (request, decision) => state.decideRate(request.id, decision),
  });
  const [reviewingRemission, reviewRemission] = useGuardedAction({
    confirm: (request, remission, status) => confirmRemissionReview(remission, status),
    run: (request, remission, status) => state.reviewRemission(request.id, remission.id, status),
  });
  const [requestingApproval, requestApproval] = useGuardedAction({
    confirm: confirmApprovalRequest,
    run: async (request) => confirmApprovalRequested(await useCases.requestApproval(request.id)),
  });
  const [correctingRate, setCorrectingRate] = useState(false);
  // Devuelve true si se guardó (el campo se limpia) y false si se canceló o falló.
  async function correctRate(request, rate) {
    if (correctingRate || !(await confirmRateCorrection(request, rate))) return false;
    setCorrectingRate(true);
    try {
      await confirmRateCorrected(await state.correctRate(request.id, rate));
      return true;
    } catch (error) {
      await showError(error.message);
      return false;
    } finally {
      setCorrectingRate(false);
    }
  }
  const [uploading, setUploading] = useState(false);
  // Devuelve true si se subió (el formulario se limpia) y false si falló (conserva lo capturado).
  async function uploadRemission(request, remission) {
    if (uploading) return false;
    setUploading(true);
    try {
      await confirmRemissionUploaded(await state.uploadRemission(request.id, remission));
      return true;
    } catch (error) {
      await showError(error.message);
      return false;
    } finally {
      setUploading(false);
    }
  }
  async function openRecipeImage(file) {
    try {
      saveDownload(await useCases.downloadRecipeImage(file));
    } catch (error) {
      await showError(error.message);
    }
  }
  async function openRemission(remission) {
    try {
      saveDownload(await useCases.downloadRemission(remission));
    } catch (error) {
      await showError(error.message);
    }
  }
  // Sin useGuardedAction: el error lo muestra el propio diálogo de alta.
  async function registerSupplier(supplier) {
    if (!(await confirmSupplierRegistration(supplier))) return;
    const registered = await state.registerSupplier(supplier.id);
    setShowSupplierRegistration(false);
    await confirmSupplierRegistered(registered);
  }

  return (
    <section
      className="mx-auto box-border max-w-[1120px] bg-gab-bg px-6 py-8 font-sans text-gab-ink [font-synthesis:none] max-sm:px-3.5 max-sm:py-6"
      style={getGabThemeStyle(theme)}
      aria-label="Solicitudes de aplicación aérea"
    >
      <ModuleHeader view={view} user={user} />
      {state.error && (
        <ServiceAlert error={state.error} loading={state.loading} onRetry={state.reloadHistory} />
      )}
      <Tabs
        labels={parts.tabs}
        counts={[null, state.rows.length]}
        selected={tab}
        onSelect={setTab}
      />
      {/* Las dos pestañas siguen montadas: cambiar de una a otra no borra lo capturado. */}
      <TabPanel index={WORK_TAB} selected={tab}>
        {parts.board && <PurchaseBoard useCases={useCases} />}
        {parts.form && (
          <CapturePanel note={parts.formNote}>
            <RequestForm
              connected={state.connected}
              catalog={state.catalog}
              catalogLoading={state.catalogLoading}
              catalogError={state.catalogError}
              reloadCatalog={() => state.reloadCatalog(true)}
              onSave={register}
              onAddSupplier={() => setShowSupplierRegistration(true)}
              onLoadProducts={useCases.loadProductGroups}
              onReadRecipeImage={useCases.uploadRecipeImage}
            />
          </CapturePanel>
        )}
      </TabPanel>
      <TabPanel index={HISTORY_TAB} selected={tab}>
        <RequestHistory
          rows={state.rows}
          visible={visible}
          loading={state.loading}
          error={state.error}
          filter={filter}
          query={query}
          setFilter={setFilter}
          setQuery={setQuery}
          onRefresh={state.reloadHistory}
          onOpen={openDetail}
        />
      </TabPanel>
      {state.detail && (
        <RequestDetail
          data={state.detail}
          onClose={closeDetail}
          onChangeStatus={changeStatus}
          changingStatus={changingStatus || decidingRate}
          onDecideRate={decideRate}
          onCorrectRate={correctRate}
          onUploadRemission={uploadRemission}
          onReviewRemission={reviewRemission}
          onOpenRemission={openRemission}
          onOpenRecipeImage={openRecipeImage}
          onLoadRecipeImage={useCases.downloadRecipeImage}
          remissionsOnly={view === 'review'}
          remissionBusy={uploading || reviewingRemission || correctingRate}
          onRequestApproval={requestApproval}
          requestingApproval={requestingApproval}
        />
      )}
      {showSupplierRegistration && state.catalog?.supplierPermissions?.canRegister && (
        <SupplierRegistration
          onClose={() => setShowSupplierRegistration(false)}
          onSearch={useCases.supplierCandidates}
          onSave={registerSupplier}
        />
      )}
    </section>
  );
}
