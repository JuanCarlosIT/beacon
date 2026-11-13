import { useEffect, useState } from 'react';
import { createRequestUseCases } from './application/request.use-cases.js';
import { requestApiRepository } from './infrastructure/requestApi.repository.js';
import ApplicationRequestsModule from './presentation/ApplicationRequestsModule.jsx';
import AccessGate from './presentation/components/AccessGate.jsx';
import { viewFromPath } from './presentation/view.js';
import { useLayoutTheme } from '../../shared/theme/useLayoutTheme.js';

const useCases = createRequestUseCases(requestApiRepository);

// 'checking' mientras se pregunta, 'locked' si la vista pide clave, 'open' si ya se puede entrar.
// Si no se puede preguntar (sin servicio), se entra: el módulo muestra su propio aviso.
function useAccess() {
  const [access, setAccess] = useState('checking');
  useEffect(() => {
    useCases
      .accessRequired()
      .then((required) => setAccess(required ? 'locked' : 'open'))
      .catch(() => setAccess('open'));
  }, []);
  return [access, () => setAccess('open')];
}

// Punto de composición: solo aquí se conectan infraestructura y casos de uso.
// El tema que pase el layout por props manda; si no pasa nada, se capta solo (URL, mensaje o localStorage).
export default function ApplicationRequests(props) {
  const layoutTheme = useLayoutTheme();
  const theme = props.theme ?? layoutTheme;
  const view = viewFromPath(window.location.pathname);
  const [access, open] = useAccess();
  if (access === 'checking') return null;
  if (access === 'locked')
    return <AccessGate view={view} theme={theme} onEnter={useCases.enterAccessKey} onOpen={open} />;
  return <ApplicationRequestsModule view={view} {...props} theme={theme} useCases={useCases} />;
}
