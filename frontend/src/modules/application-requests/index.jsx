import { createRequestUseCases } from './application/request.use-cases.js';
import { requestApiRepository } from './infrastructure/requestApi.repository.js';
import ApplicationRequestsModule from './presentation/ApplicationRequestsModule.jsx';
import { viewFromPath } from './presentation/view.js';

const useCases = createRequestUseCases(requestApiRepository);

// Punto de composición: solo aquí se conectan infraestructura y casos de uso.
export default function ApplicationRequests(props) {
  return (
    <ApplicationRequestsModule
      view={viewFromPath(window.location.pathname)}
      {...props}
      useCases={useCases}
    />
  );
}
