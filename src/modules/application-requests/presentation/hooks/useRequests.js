import { useCallback, useEffect, useState } from 'react';

const OFFLINE_HISTORY = {
  connected: false,
  rows: [],
  error: 'Servicio no disponible. Intenta de nuevo.',
};

export function useRequests(useCases) {
  const [history, setHistory] = useState({ connected: false, rows: [], error: '' });
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [detail, setDetail] = useState(null);

  // Actualiza el detalle solo si sigue abierto el de esa solicitud.
  const updateDetail = (id, update) =>
    setDetail((current) => (current?.id === id ? update(current) : current));
  const refreshDetail = async (id) => {
    const fresh = await useCases.loadDetail(id);
    updateDetail(id, () => fresh);
  };

  async function reloadHistory() {
    setLoading(true);
    try {
      setHistory(await useCases.loadHistory());
    } catch {
      setHistory(OFFLINE_HISTORY);
    } finally {
      setLoading(false);
    }
  }
  async function reloadCatalog(refresh = false) {
    setCatalogLoading(true);
    setCatalogError('');
    try {
      setCatalog(await useCases.loadCatalogs(refresh));
    } catch (error) {
      setCatalog(null);
      setCatalogError(error.message);
    } finally {
      setCatalogLoading(false);
    }
  }
  async function register(input) {
    const created = await useCases.register(input);
    await reloadHistory();
    return created;
  }
  async function openDetail(id) {
    setDetail(await useCases.loadDetail(id));
  }
  async function changeStatus(id, status) {
    await useCases.changeStatus(id, status);
    await refreshDetail(id);
    await reloadHistory();
  }
  async function registerSupplier(id) {
    const supplier = await useCases.registerSupplier(id);
    await reloadCatalog();
    return supplier;
  }
  // Acción sobre una solicitud abierta: al terminar (bien o mal) se vuelve a leer del servidor.
  async function onRequest(id, action) {
    try {
      return await action();
    } finally {
      await refreshDetail(id).catch(() => {});
      await reloadHistory();
    }
  }
  const decideRate = (id, decision) => onRequest(id, () => useCases.decideRate(id, decision));
  const correctRate = (id, rate) => onRequest(id, () => useCases.correctRate(id, rate));
  const uploadRemission = (id, remission) =>
    onRequest(id, () => useCases.uploadRemission(id, remission));
  const reviewRemission = (id, remissionId, status) =>
    onRequest(id, () => useCases.reviewRemission(remissionId, status));
  // Estable entre renders: el detalle no vuelve a mover el foco en cada actualización.
  const closeDetail = useCallback(() => setDetail(null), []);

  useEffect(() => {
    reloadHistory();
    reloadCatalog();
  }, [useCases]);
  return {
    ...history,
    loading,
    catalog,
    catalogLoading,
    catalogError,
    detail,
    reloadHistory,
    reloadCatalog,
    register,
    openDetail,
    decideRate,
    correctRate,
    uploadRemission,
    reviewRemission,
    changeStatus,
    registerSupplier,
    closeDetail,
  };
}
