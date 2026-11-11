# Contexto de la app web · GAB Aplicaciones aéreas

Última verificación local: **9 de noviembre de 2026, 17:04 UTC**.

Este documento resume el proyecto para retomarlo o compartir su contexto técnico. **No contiene contraseñas, claves API, llaves privadas ni sesiones de WhatsApp.**

## 1. Dónde está la aplicación

**Carpeta raíz en esta computadora:**

```text
C:\Users\User\OneDrive\Documents\Proyecto predeterminado
```

| Componente            | Carpeta                                                             |
| --------------------- | ------------------------------------------------------------------- |
| Frontend React        | `C:\Users\User\OneDrive\Documents\Proyecto predeterminado\frontend` |
| Backend Express       | `C:\Users\User\OneDrive\Documents\Proyecto predeterminado\backend`  |
| Comandos auxiliares   | `C:\Users\User\OneDrive\Documents\Proyecto predeterminado\scripts`  |
| Documentación general | `README.md`, dentro de la raíz                                      |
| Este contexto         | `CONTEXTO_APP_WEB.md`, dentro de la raíz                            |

**La app de solicitudes es local; no se ha desplegado en el VPS.** El VPS donde está Evolution/WhatsApp es otro componente, no la ubicación del código de esta app.

### Direcciones locales

- App en desarrollo: **http://127.0.0.1:5173**.
- Backend: **http://127.0.0.1:3001**.
- Salud del backend: **http://127.0.0.1:3001/api/health**.
- Compilación servida desde Express: **http://127.0.0.1:3001**, al usar `npm run local`.

En la última consulta, frontend y backend respondieron HTTP 200 y PostgreSQL estaba conectado. Estos datos describen esa comprobación, no garantizan que los procesos sigan encendidos después de reiniciar la computadora.

## 2. Qué hace la app

Permite registrar solicitudes de aplicación aérea agrícola, consultar sus datos, controlar estados con permisos y generar un borrador de orden de compra de servicio —OCM— exclusivamente en Odoo STAG, después de aprobar la solicitud.

La interfaz tiene dos pestañas:

1. **Nueva solicitud**: captura del servicio.
2. **Solicitudes de aplicación aérea**: consulta del historial permitido al usuario.

La segunda pestaña ya no se llama «Mis solicitudes». **Ese cambio de nombre no modificó los permisos de consulta:** el perfil solicitante sigue limitado a sus propias solicitudes.

## 3. Tecnologías y arquitectura

- **Frontend:** React, Vite, Tailwind CSS, componentes y estilos del tema GAB, Lucide y SweetAlert2.
- **Backend:** Node.js y Express con JavaScript, organizado en controladores, servicios, modelos, repositorios, rutas e integraciones.
- **Base de datos:** PostgreSQL 17 en Docker local.
- **Integraciones:** Odoo para catálogos y OCM; WhatsApp/Evolution está en preparación, no integrado todavía con las aprobaciones reales.
- **Sin Python.**
- Node.js 22 para el proyecto local. Los scripts experimentales de botones requieren al menos Node.js 22.13.

### Instalaciones independientes

`backend/` y `frontend/` conservan cada uno su propio `package.json`, `package-lock.json` y `node_modules/`. No hay workspaces ni dependencias compartidas en la raíz. Los comandos de la raíz coordinan ambas aplicaciones.

No reintroducir el instalador recursivo, un `postinstall` que vuelva a ejecutar npm ni un `node_modules` compartido.

### Estructura principal

```text
Proyecto predeterminado/
├── backend/
│   ├── database/                 # Esquema SQL y preparación de PostgreSQL
│   ├── scripts/                  # Administración de PostgreSQL local
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── integrations/odoo/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── routes/
│   │   └── services/
│   ├── tests/                    # Unitarias e integración aislada
│   └── storage/                  # Adjuntos y respaldos, no código público
├── frontend/
│   ├── src/app/
│   ├── src/modules/application-requests/
│   │   ├── application/          # Casos de uso y puertos
│   │   ├── domain/               # Reglas y validación
│   │   ├── infrastructure/       # Repositorio HTTP
│   │   └── presentation/         # Componentes, hooks y estilos
│   ├── src/shared/
│   └── tests/                    # Pruebas de render de React
├── scripts/
│   ├── run-project.mjs
│   └── evolution-buttons/        # Preparación experimental separada
├── compose.yaml
├── package.json
├── README.md
└── CONTEXTO_APP_WEB.md
```

## 4. Cómo arrancarla

Se necesita Docker Desktop con motor Linux y Node.js. **Conservar el archivo privado `backend/.env` existente; no sustituir sus credenciales.**

Desde PowerShell, en la raíz:

```powershell
cd "C:\Users\User\OneDrive\Documents\Proyecto predeterminado"
npm.cmd run db:up
npm.cmd run dev
```

Solo si faltan las dependencias:

```powershell
npm.cmd --prefix backend ci --workspaces=false
npm.cmd --prefix frontend ci --workspaces=false
```

También se pueden arrancar por separado, en dos terminales:

```powershell
npm.cmd run dev:server
```

```powershell
npm.cmd run dev:client
```

Comandos adicionales:

| Comando                            | Función                                                 |
| ---------------------------------- | ------------------------------------------------------- |
| `npm run db:status`                | Comprueba PostgreSQL local                              |
| `npm run db:stop`                  | Detiene PostgreSQL sin borrar datos                     |
| `npm run build`                    | Compila el frontend                                     |
| `npm run local`                    | Compila y sirve la app desde Express en el puerto 3001  |
| `npm test`                         | Ejecuta las pruebas de backend y frontend               |
| `npm --prefix backend run test:db` | Prueba de integración transaccional contra Docker local |
| `npm run format:check`             | Comprueba el formato del código                         |

El backend normal no se reinicia automáticamente al editarlo. Existe `npm --prefix backend run dev:watch`, pero no debe usarse para interrumpir capturas en curso. No arrancar dos procesos distintos en el mismo puerto.

## 5. PostgreSQL y conservación de datos

| Dato                  | Valor                                  |
| --------------------- | -------------------------------------- |
| Contenedor            | `gab-fumigaciones-local-postgres-1`    |
| Imagen                | PostgreSQL 17 Alpine                   |
| Host y puerto         | `127.0.0.1:5434`                       |
| Base                  | `fumigaciones_pruebas`                 |
| Usuario de aplicación | `fumigaciones_app`, sin superusuario   |
| Volumen persistente   | `gab-fumigaciones-local_postgres_data` |
| Esquema               | `backend/database/schema.sql`          |
| Helper de Docker      | `backend/scripts/postgres-local.mjs`   |

El usuario eligió **empezar con una base local vacía** en lugar de migrar las solicitudes del VPS, que no estaba accesible. La base remota se conservó intacta. Las solicitudes locales posteriores son reales; no se reconstruyeron capturas antiguas a partir de ejemplos.

**No borrar el volumen ni usar `docker compose down -v`.** No reiniciar la numeración ni reemplazar registros existentes para introducir filtros o cambios de interfaz.

### Datos observados en la última consulta

| Folio local | Estado     | OCM vinculada     |
| ----------- | ---------- | ----------------- |
| `AA-00001`  | Solicitada | `P20494`, en STAG |
| `AA-00002`  | Solicitada | Sin vínculo       |
| `AA-00003`  | Solicitada | Sin vínculo       |

La OCM `P20494` ya existía antes de introducir la obligación de aprobar. Se conservó su vínculo y el estado original de `AA-00001`; **no se aprobó retroactivamente ni se recreó la compra**. La regla actual bloquea nuevas OCM sin aprobación, pero permite abrir o verificar vínculos anteriores sin duplicarlos.

La `AA-00001` local no debe confundirse con folios de la antigua base del VPS, que no se migraron.

### Tablas

- `aerial_requests`: solicitudes y datos normalizados, instantánea del catálogo y clave idempotente.
- `aerial_suppliers`: proveedores y autorización local.
- `aerial_supplier_events`: auditoría de altas de proveedores.
- `aerial_application_periods`: periodos de aplicación.
- `aerial_executions`: ejecución del servicio.
- `aerial_attachments`: metadatos de adjuntos.
- `aerial_events`: auditoría interna de solicitudes y estados.
- `aerial_purchase_links`: reserva, verificación y vínculo único de OCM en STAG.

Los adjuntos físicos se guardan en `backend/storage/uploads/`; los respaldos locales, en `backend/storage/backups/`. Ambos deben considerarse junto con la base al respaldar. `backend/.docker/source-database.json` conserva una conexión anterior privada: **no es un respaldo completo de las solicitudes remotas**.

## 6. Formulario e historial ya implementados

- Selección encadenada **ciclo → zona → predio/lote → cultivo**, basada en relaciones reales de Odoo.
- Fecha requerida, hectáreas parciales o lote completo, proveedor autorizado, periodo de aplicación y tarifa MXN/ha.
- Descripción de la aplicación opcional; prioridad Normal/Alta y observaciones.
- Subtotal estimado = hectáreas × tarifa, sin impuestos; no es costo ejecutado ni una compra confirmada.
- Validación en frontend y backend; no se confía en nombres o importes calculados enviados desde el navegador.
- Guardado idempotente: reintentar la misma captura con su clave devuelve el mismo registro, sin duplicar folios.
- Detalle de solicitud, vínculo de OCM, consulta de remisiones y exportación Excel según permisos.
- En móvil/tablet hasta 860 px, **tarjetas expandibles**, cerradas inicialmente: muestran folio, lote y estado. Tocar/clicar o usar Enter/Espacio expande y contrae los datos. El botón «Ver detalle» queda dentro.
- En escritorio se conserva la tabla con buscador y filtro de estados.
- La captura se conserva al cambiar de pestaña, no al cerrar o recargar la página.

### Requisitos visuales que deben conservarse

- Formulario compacto y controles aptos para móvil, con tema GAB.
- Sin login visible, sidebar, layout global ni sección de seguimiento/auditoría visible.
- No mostrar UUID ni IDs técnicos de Odoo en la interfaz. Sí mostrar folio y RFC/referencia del proveedor.
- SweetAlert para confirmaciones y errores breves; evitar diálogos nativos del navegador.
- Tema de referencia: `frontend/src/shared/theme/tema-calidad-gab.json`.

La infraestructura de ejecución y carga de adjuntos existe en el backend; **no hay una pantalla operativa completa de ejecución ni una autenticación real terminada**. No presentar esos pendientes como funcionalidades productivas ya listas.

## 7. Proveedores autorizados

La clasificación vive **únicamente en PostgreSQL de esta app**. No se crean etiquetas ni se modifican contactos en Odoo de producción.

| Proveedor                     | RFC             |
| ----------------------------- | --------------- |
| SELMAN EDUARDO FLORES MAGAÑA  | `FOMS900106IE1` |
| OSCAR JAVIER RODRIGUEZ LOAIZA | `ROLO571226J24` |
| FUMIGACIONES AEREAS BUENTELLO | `FAB060306L94`  |
| AGRASAMA                      | `AGR151101U56`  |

AGRASAMA fue incluido por decisión explícita del usuario y se utiliza en `AA-00001`. No quitarlo ni modificar esa solicitud por no haber encontrado fumigaciones en su historial de compras consultado.

El formulario solo recibe los proveedores autorizados localmente y activos en Odoo, no los aproximadamente 2,105 proveedores del catálogo general consultado inicialmente.

Las altas futuras buscan un proveedor ya existente en Odoo, muestran RFC/referencia, requieren confirmación y registran responsable y fecha local. Las altas manuales muestran **Nuevo durante 30 días**; las cuatro altas iniciales no se presentan como nuevas. Se impiden duplicados por contacto, RFC o referencia.

Dar de alta exige administración con identidad verificada. La sesión ficticia actual no tiene ese permiso. Actualizar catálogos no autoriza automáticamente otros contactos y guardar una solicitud tampoco los incorpora al directorio.

## 8. Identidad, permisos y estados

Actualmente se utiliza una sesión implícita de **solicitante ficticio** cuando `IMPLICIT_DEMO_AUTH=true`. No es autenticación Odoo ni identidad válida de un aprobador. El modo implícito no se permite con `NODE_ENV=production`.

Todos los perfiles demo tienen `identityVerified=false`. No elevar ese indicador ni el rol desde el formulario para simular permisos reales.

| Estado/acción                   | Responsable previsto         | Condición                                    |
| ------------------------------- | ---------------------------- | -------------------------------------------- |
| Crear → Solicitada              | Solicitante o administración | Validación de captura y catálogos            |
| Solicitada → Aprobada           | Aprobador o administración   | Identidad verificada                         |
| Solicitada/Aprobada → Cancelada | Aprobador o administración   | Identidad verificada y transición permitida  |
| Aprobada → Realizada            | Operaciones o administración | Identidad verificada y registro de ejecución |
| Alta de proveedor               | Administración               | Identidad verificada                         |

**El aprobador real todavía no está designado.** Los perfiles ficticios no pueden aprobar, cancelar, registrar ejecuciones ni autorizar proveedores. Los controles de aprobación se muestran solo si el backend devuelve permisos válidos.

El backend guarda actor y fecha de los cambios en auditoría interna. Antes de producción hay que sustituir la identificación temporal por nombre por una identidad estable, roles reales y una sesión verificada, sin añadir necesariamente un login propio visible al módulo.

## 9. Odoo: producción solo lectura; compras únicamente STAG

| Entorno                                        | Uso                       |
| ---------------------------------------------- | ------------------------- |
| `https://grupo-gab.odoo.com`                   | Catálogos en solo lectura |
| `https://grupo-gab-stag-40778531.dev.odoo.com` | Borradores OCM de prueba  |
| Base STAG                                      | `grupo-gab-stag-40778531` |

### Reglas acordadas

1. Una nueva OCM requiere solicitud en **Aprobada**, datos completos y permiso para generarla.
2. **Aprobar no crea la OCM automáticamente.** Solo habilita «Generar OCM en STAG» y después se exige confirmación.
3. La OCM es un borrador (`draft`) de tipo Solicitud. No se confirma, autoriza o paga en Odoo ni se envían correos automáticos de creación.
4. La elegibilidad se valida en servicio y al reservar bajo bloqueo en PostgreSQL, no solo ocultando un botón.
5. Cada solicitud tiene una reserva/vínculo persistente para evitar duplicados. Un resultado incierto se verifica; no se reenvía automáticamente otra creación.
6. Se resuelven referencias de nuevo en STAG, sin copiar a ciegas IDs de producción. El proveedor se identifica por RFC/referencia y, solo para capturas antiguas, por nombre exacto y único.
7. Se releen cabecera y líneas tras crear. Si hay discrepancias o falla la verificación, se conserva el vínculo conocido y se pide revisión, no una segunda orden.
8. Abrir/verificar una OCM previa sigue permitido aunque el estado local ya no sea Aprobada. Verificar no crea otra compra.
9. Cancelar la solicitud local no cancela automáticamente una orden existente en Odoo.

La configuración y las credenciales están en el backend. Se rechazan destinos de producción, bases STAG que no coinciden con el host y redirecciones en el cliente de compras.

## 10. WhatsApp, Evolution y n8n: estado real

**La aprobación de solicitudes por WhatsApp todavía no está implementada ni habilitada.** El teléfono usado para pruebas no fue designado automáticamente como aprobador.

### Lo comprobado

- Bot: **AgricolaBot**, conectado mediante **Evolution 2.3.7 / WHATSAPP-BAILEYS**.
- Evolution está en el VPS; la app de solicitudes y su PostgreSQL siguen en esta computadora.
- Se envió una prueba de botones y una de texto al destinatario indicado por el usuario. El usuario confirmó el texto, pero no recibió el mensaje de botones.
- Un HTTP 201/PENDING de Evolution no se tomó como prueba de entrega o visualización.
- El usuario informó que AgricolaBot **ya está conectado a n8n**.
- No se modificaron workflows, webhooks, claves, sesiones ni configuración de n8n.
- Las pruebas salientes pudieron generar eventos en el workflow existente; **no se revisaron todavía esas ejecuciones**.
- Se entró al VPS por SSH únicamente para inspección de Docker, imagen, versión y volúmenes. No se actualizó ni reinició Evolution.

### Preparación local existente

Carpeta: `scripts/evolution-buttons/`.

Se preparó un backport experimental para botones de respuesta sobre el código oficial 2.3.7, sin instalar toda la versión preliminar 2.4. Se comprobaron los hashes y 177 fuentes contra la imagen exacta del VPS; la compilación completa y siete pruebas simuladas pasaron.

Imagen Docker experimental **solo local**:

```text
gab-evolution-buttons-test:2.3.7-71bb48220cd2
```

No se reemplazó la imagen del VPS, no se copió la sesión de AgricolaBot y no se arrancó una instancia WhatsApp conectada con esa imagen. **Su funcionamiento visual en WhatsApp real sigue pendiente.**

Los artefactos de preparación están en:

```text
C:\Users\User\AppData\Local\Temp\opencode\gab-evolution-buttons-2.3.7-cd800f29
```

Comandos opcionales de preparación; no despliegan en el VPS ni envían mensajes:

```powershell
npm run whatsapp:buttons:prepare
npm run whatsapp:buttons:test
npm run whatsapp:buttons:image
```

Consultar `scripts/evolution-buttons/README.md` para alcance, restricciones y validaciones pendientes.

### No confundir estas ubicaciones

| Ubicación                                                  | Contenido                                                   |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| `C:\Users\User\OneDrive\Documents\Proyecto predeterminado` | Código de la app web local                                  |
| `scripts/evolution-buttons/`                               | Herramientas locales de preparación experimental            |
| `/home/gabops/evolution-api` en el VPS                     | Despliegue existente de Evolution, no la app de solicitudes |

El despliegue de Evolution usa `docker-compose.yml` y `docker-compose.override.yml`, con contenedor `evolution-api` y volumen de instancias persistente. No sobrescribirlos ni asumir que `latest` seguirá apuntando a la imagen inspeccionada.

### Avance del 9 de noviembre de 2026

- Revisado en solo lectura el workflow de AgricolaBot: **WF64 «Entrada WhatsApp AgricolaBot»** (`5P3hlbGQdscMFP2J`). Hallazgos y propuesta en `docs/APROBACION_WHATSAPP.md`.
- Backend local listo y **apagado** (`N8N_APPROVALS_ENABLED=false`): aprobadores registrados por consola, códigos de un solo uso, aplicación idempotente de `/aprobar` y `/rechazar`, consulta periódica a n8n (la app consulta; n8n nunca llama a esta PC). Tablas creadas en la base local sin cambiar solicitudes, vínculos ni eventos.
- Botón «Pedir aprobación por WhatsApp» en el detalle: solo aparece con la función habilitada, estado Solicitada y perfil admin o solicitante (`permissions.canRequestApproval`). Confirma con SweetAlert y muestra a quién se envió y cuándo vence el código.
- Pendiente: designar aprobador, crear los webhooks en n8n con autorización y reiniciar el backend para cargar la ruta nueva.

### Decisión del 9 de noviembre de 2026 (noche): WhatsApp solo avisa

Al guardar una solicitud nueva se manda solo (en segundo plano; si falla, la solicitud queda guardada igual) al aprobador registrado, por AgricolaBot, un texto con el link `?solicitud=<id>` y un PDF con todo el detalle (proveedor, costo, OCM). La aprobación se hace solo en la app: no hay `/aprobar`, códigos ni botones, y WF64 no se tocó. En n8n queda WF81 `wEb3UEVPbGV1QKHO` con un solo webhook (`gab-aa-aprobacion/aviso`). El detalle está en `docs/APROBACION_WHATSAPP.md`, sección 5. La sección siguiente queda como antecedente.

### Vistas separadas (9-nov-2026)

Usuarios de prueba (solo DEMO LOCAL): la vista `/` usa a «María · Campo» (solicitante, ve solo sus solicitudes) y `/validar` a «Carlos · Supervisión» (aprobador, ve todas). El frontend manda el encabezado `X-GAB-Vista` y `implicitDemoSession` elige el usuario; ninguno tiene identidad verificada.

**DEMO_APROBAR=true** (en `backend/.env`, solo con IMPLICIT_DEMO_AUTH): el aprobador de prueba puede aprobar o cancelar desde `/validar`. La auditoría lo registra como «Carlos · Supervisión (prueba)». No cambia `identityVerified` (regla `canDecideRequest` + marca `demo`). Quitarlo cuando exista el login real.

`/` muestra solo la captura (formulario) y `/validar` solo la lista y el detalle para quien valida; el link de WhatsApp lleva a `/validar?solicitud=<id>`. Ojo: sin inicio de sesión real (IMPLICIT_DEMO_AUTH = solicitante) la separación es por dirección, no por permiso, y los botones Aprobar/Cancelar solo aparecen con DEMO_APROBAR o con identidad verificada.

### Siguiente paso acordado para WhatsApp

1. Obtener del usuario el enlace o JSON, sin secretos, del **workflow de n8n conectado a AgricolaBot**.
2. Revisar su trigger, filtros y ejecuciones de prueba antes de cambiar la integración. Trabajar sobre una copia desactivada cuando corresponda.
3. Conservar el webhook actual y no sustituir el flujo existente por otro endpoint sin acuerdo.
4. Validar los botones en un entorno/número de prueba independiente. Si se decide usar el servicio actual, hacen falta respaldo, plan de reversión y autorización explícita para intervenir y reiniciar; puede afectar otras instancias alojadas en ese Evolution.
5. Solo después diseñar la aprobación real: responsable/número previamente verificado, validación de webhook y solicitud, caducidad, confirmación, idempotencia y auditoría en backend. No interpretar «sí», emojis o decisiones de IA como aprobación.
6. Mantener la decisión de negocio: aprobar solo habilita la OCM manual en STAG.

Para que n8n llame a esta app desde el VPS hará falta una conexión segura al backend. `127.0.0.1` de esta computadora no es accesible directamente desde el VPS ni desde el teléfono. No publicar el prototipo sin resolver autenticación, HTTPS, sesiones y permisos.

## 11. Archivos clave para continuar

| Archivo/carpeta                                                                              | Responsabilidad                               |
| -------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `frontend/src/modules/application-requests/presentation/ApplicationRequestsModule.jsx`       | Pestañas, acciones y composición del módulo   |
| `frontend/src/modules/application-requests/presentation/components/RequestForm.jsx`          | Formulario compacto                           |
| `frontend/src/modules/application-requests/presentation/components/RequestHistory.jsx`       | Tabla y tarjetas expandibles                  |
| `frontend/src/modules/application-requests/presentation/components/RequestDetail.jsx`        | Detalle, controles y OCM                      |
| `frontend/src/modules/application-requests/presentation/components/SupplierRegistration.jsx` | Alta restringida de proveedores               |
| `frontend/src/modules/application-requests/presentation/styles.css`                          | Estilos responsivos del módulo                |
| `frontend/src/modules/application-requests/application/`                                     | Casos de uso y puertos                        |
| `frontend/src/modules/application-requests/infrastructure/requestApi.repository.js`          | Acceso HTTP a la API                          |
| `frontend/tests/presentation.test.js`                                                        | Pruebas de render y permisos visibles         |
| `backend/src/app.js`, `backend/src/server.js`                                                | Express y arranque                            |
| `backend/src/services/request.service.js`                                                    | Captura, detalle y transiciones               |
| `backend/src/services/purchase-order.service.js`                                             | Elegibilidad, reserva y recuperación de OCM   |
| `backend/src/services/catalog.service.js`, `supplier.service.js`                             | Filtrado y altas locales                      |
| `backend/src/models/access.model.js`                                                         | Roles con identidad verificada                |
| `backend/src/models/request.validation.js`                                                   | Validación y transiciones permitidas          |
| `backend/src/repositories/`                                                                  | Persistencia y bloqueos transaccionales       |
| `backend/src/integrations/odoo/`                                                             | Catálogos y cliente/servicio STAG             |
| `backend/database/schema.sql`                                                                | Esquema idempotente y proveedores iniciales   |
| `backend/tests/integration/local-workflow.test.js`                                           | Integración aislada y revertida contra Docker |
| `scripts/evolution-buttons/README.md`                                                        | Estado y alcance del experimento de botones   |

### Endpoints principales

| Método y ruta                                          | Uso                                                  |
| ------------------------------------------------------ | ---------------------------------------------------- |
| `GET /api/health`                                      | Disponibilidad de base y STAG                        |
| `GET /api/auth/me`                                     | Sesión actual; actualmente demo                      |
| `GET /api/catalogs`                                    | Catálogos y proveedores autorizados                  |
| `GET /api/requests`                                    | Solicitudes según alcance del usuario                |
| `POST /api/requests`                                   | Registro idempotente                                 |
| `GET /api/requests/:id`                                | Detalle                                              |
| `PATCH /api/requests/:id/status`                       | Aprobación/cancelación con permisos                  |
| `POST /api/requests/:id/execution`                     | Registro de ejecución                                |
| `POST /api/requests/:id/purchase-order`                | Creación o reconciliación segura en STAG             |
| `POST /api/requests/:id/attachments`                   | Carga restringida de remisiones                      |
| `GET /api/reports/excel`                               | Exportación permitida al usuario                     |
| `GET /api/suppliers/candidates`, `POST /api/suppliers` | Búsqueda y alta local para administración verificada |

## 12. Pendientes y reglas para el siguiente trabajo

- Identidad real y aprobador designado: **pendientes**. No desbloquearlos dando permisos al usuario ficticio.
- Revisión del workflow n8n de AgricolaBot: **pendiente de recibirlo**.
- Recepción y respuesta de botones reales: **pendientes**. Compilar o pasar tests simulados no equivale a que WhatsApp los muestre.
- Aprobación WhatsApp → n8n → backend: **no implementada**; respetar la integración n8n existente.
- Despliegue público de la app: **no realizado**. Requiere seguridad, acceso HTTPS y conectividad adecuadas.
- No borrar solicitudes, folios, vínculos de compra, volúmenes, sesiones o cambios ajenos para hacer pasar pruebas.
- No modificar Odoo de producción. No confirmar compras ni activar generación automática de OCM al aprobar.
- Mantener las cuatro autorizaciones locales de proveedores y las solicitudes ya guardadas.
- Las pruebas de base deben usar esquema/transacción aislados y revertidos, sin consumir folios públicos.
- No incluir secretos de `backend/.env`, `backend/.docker/`, respaldos o accesos SSH en código, frontend, exportaciones o documentación compartida. Las credenciales facilitadas en la conversación no se reproducen en este archivo; conviene rotarlas mediante un canal seguro al terminar su uso.
- Durante estos trabajos no se hicieron commits ni pushes.

Para documentación de arranque, seguridad y límites adicionales, consultar también `README.md`.
