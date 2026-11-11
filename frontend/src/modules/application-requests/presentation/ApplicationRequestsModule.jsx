import { useState } from 'react';
import { getGabThemeStyle } from '../../../shared/theme/theme.js';
import {
  confirmSaved,
  showError,
  confirmStagingPurchase,
  confirmStagingPurchaseSaved,
  confirmRequestStatus,
  confirmApprovalRequest,
  confirmApprovalRequested,
  confirmSupplierRegistration,
  confirmSupplierRegistered,
} from '../../../shared/feedback/alerts.js';
import { filterRequests } from '../domain/request.js';
import { useRequests } from './hooks/useRequests.js';
import { useCurrentUser, useGuardedAction, useLinkedRequest } from './hooks/useModuleHelpers.js';
import RequestForm from './components/RequestForm.jsx';
import RequestHistory from './components/RequestHistory.jsx';
import RequestDetail from './components/RequestDetail.jsx';
import SupplierRegistration from './components/SupplierRegistration.jsx';
import { CapturePanel, ModuleHeader, ServiceAlert } from './components/ModuleChrome.jsx';
import '../../../shared/theme/fonts.js';

// Dos vistas separadas: 'capture' (quien llena la solicitud) y 'review' (quien valida).
export default function ApplicationRequestsModule({ useCases, theme = 'light', view = 'capture' }) {
  const state = useRequests(useCases);
  const reviewing = view === 'review';
  const user = useCurrentUser(useCases);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todas');
  const [showSupplierRegistration, setShowSupplierRegistration] = useState(false);
  const visible = filterRequests(state.rows, { status: filter, query });

  async function openDetail(id) {
    try {
      await state.openDetail(id);
    } catch (error) {
      await showError(error.message);
    }
  }
  useLinkedRequest((id) => reviewing && openDetail(id));

  async function register(body) {
    const created = await state.register(body);
    await confirmSaved(created.folio, created.approvalNotice === true);
    return created;
  }
  // Verificar una OCM pendiente no pide confirmación: no crea nada nuevo.
  const [creatingPurchase, createPurchaseOrder] = useGuardedAction({
    confirm: (request) => request.purchaseOrder?.canVerify || confirmStagingPurchase(request),
    run: async (request) => {
      const result = await state.createPurchaseOrder(request.id);
      await confirmStagingPurchaseSaved(result.purchaseOrder);
    },
  });
  const [changingStatus, changeStatus] = useGuardedAction({
    confirm: confirmRequestStatus,
    run: (request, status) => state.changeStatus(request.id, status),
  });
  const [requestingApproval, requestApproval] = useGuardedAction({
    confirm: confirmApprovalRequest,
    run: async (request) => confirmApprovalRequested(await useCases.requestApproval(request.id)),
  });
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
      <ModuleHeader reviewing={reviewing} user={user} />
      {state.error && (
        <ServiceAlert error={state.error} loading={state.loading} onRetry={state.reloadHistory} />
      )}
      {reviewing ? (
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
      ) : (
        <CapturePanel>
          <RequestForm
            connected={state.connected}
            catalog={state.catalog}
            catalogLoading={state.catalogLoading}
            catalogError={state.catalogError}
            reloadCatalog={() => state.reloadCatalog(true)}
            onSave={register}
            onAddSupplier={() => setShowSupplierRegistration(true)}
          />
        </CapturePanel>
      )}
      {state.detail && (
        <RequestDetail
          data={state.detail}
          onClose={state.closeDetail}
          onCreatePurchase={createPurchaseOrder}
          creatingPurchase={creatingPurchase}
          onChangeStatus={changeStatus}
          changingStatus={changingStatus}
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
