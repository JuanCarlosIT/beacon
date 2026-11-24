import { useEffect, useState } from 'react';
import { createRequestUseCases } from './application/request.use-cases.js';
import { requestApiRepository } from './infrastructure/requestApi.repository.js';
import ApplicationRequestsModule from './presentation/ApplicationRequestsModule.jsx';
import AccessGate from './presentation/components/AccessGate.jsx';
import NoAccess from './presentation/components/NoAccess.jsx';
import { viewFromPath, viewFromRole } from './presentation/view.js';
import { useLayoutTheme } from '../../shared/theme/useLayoutTheme.js';
import { useLayoutUser } from '../../shared/session/useLayoutUser.js';
import { setAppUser } from '../../shared/http/httpClient.js';

const useCases = createRequestUseCases(requestApiRepository);

// Pregunta al servidor quién está usando el módulo. Se vuelve a preguntar si cambia el usuario
// de la app principal.
//   'checking' mientras se pregunta · 'locked' la vista pide clave · 'denied' el usuario de la app
//   principal no tiene perfil aquí · 'open' ya se puede entrar.
// Si no se puede preguntar (sin servicio), se entra: el módulo muestra su propio aviso.
function useAccess(appUser) {
  const [state, setState] = useState({ access: 'checking', role: null, for: undefined });
  useEffect(() => {
    let current = true;
    setAppUser(appUser);
    useCases
      .session()
      .then(({ user, accessRequired, unknownUser }) => {
        if (!current) return;
        const access = unknownUser ? 'denied' : accessRequired ? 'locked' : 'open';
        setState({ access, role: user?.role ?? null, for: appUser });
      })
      .catch(() => current && setState({ access: 'open', role: null, for: appUser }));
    return () => {
      current = false;
    };
  }, [appUser]);
  // Mientras llega la respuesta del usuario nuevo no se muestra lo del anterior.
  const settled = state.for === appUser ? state : { access: 'checking', role: null };
  return [settled, () => setState((previous) => ({ ...previous, access: 'open' }))];
}

// Punto de composición: solo aquí se conectan infraestructura y casos de uso.
// El tema y el usuario que pase la app principal por props mandan; si no pasa nada, se captan
// solos (mensaje o localStorage). Sin usuario de la app principal, la vista sale de la dirección.
export default function ApplicationRequests({ user, ...props }) {
  const layoutTheme = useLayoutTheme();
  const theme = props.theme ?? layoutTheme;
  const appUser = useLayoutUser(user);
  const [{ access, role }, open] = useAccess(appUser);
  const view = appUser && role ? viewFromRole(role) : viewFromPath(window.location.pathname);
  if (access === 'checking') return null;
  if (access === 'denied') return <NoAccess theme={theme} />;
  if (access === 'locked')
    return <AccessGate view={view} theme={theme} onEnter={useCases.enterAccessKey} onOpen={open} />;
  return (
    <ApplicationRequestsModule
      key={appUser ?? 'sin-usuario'}
      view={view}
      {...props}
      theme={theme}
      useCases={useCases}
    />
  );
}
