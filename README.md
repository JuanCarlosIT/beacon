# GAB · Aplicaciones aéreas

Contexto del proyecto, ubicación exacta, estado y pendientes: **[CONTEXTO_APP_WEB.md](CONTEXTO_APP_WEB.md)**.

> **Repositorios (una rama por módulo, aquí `aplicaciones-aereas`):** este repo ([JuanCarlosIT/beacon](https://github.com/JuanCarlosIT/beacon)) guarda el frontend y la documentación. El backend vive en [JuanCarlosIT/beacon-backend](https://github.com/JuanCarlosIT/beacon-backend); para trabajar local, clónalo dentro de `backend/` con la misma rama:
> `git clone -b aplicaciones-aereas https://github.com/JuanCarlosIT/beacon-backend.git backend`

React + Tailwind CSS y Express con JavaScript. **`backend/` MVC** y **`frontend/` por módulos con arquitectura limpia**, con instalaciones npm independientes. No utiliza Python.

El módulo contiene solo **Nueva solicitud** y **Solicitudes de aplicación aérea**, sin login, sidebar ni layout global. El formulario es compacto; “¿Qué aplicación necesitas?” es opcional. Los catálogos se leen de Odoo y el historial usa tarjetas en móvil.

Cada aplicación tiene su propio `package.json`, `package-lock.json` y `node_modules/`. No se usan workspaces ni dependencias compartidas en la raíz.

## Iniciar desde la carpeta raíz

Requiere Node.js 22 y Docker Desktop con contenedores Linux.

Antes del primer arranque, crea `backend/.env` a partir de `backend/.env.example` y completa `DB_PASSWORD` y los accesos de Odoo. Si ya existe, conserva sus credenciales.

```powershell
npm --prefix backend install --workspaces=false
npm --prefix frontend install --workspaces=false
npm run db:up
npm run dev
```

La raíz no instala dependencias ni necesita `node_modules`; solo ejecuta los comandos de cada carpeta. Las instalaciones se hacen explícitamente en cada aplicación.

También puedes instalarlas y ejecutarlas por separado en dos terminales:

```powershell
cd backend
npm install
npm run dev
```

```powershell
cd frontend
npm install
npm run dev
```

Para reproducir exactamente las versiones instaladas, usa `npm --prefix backend ci` y `npm --prefix frontend ci`.

- Frontend: **http://127.0.0.1:5173**
- Backend: **http://127.0.0.1:3001**
- Configuración privada: **`backend/.env`**, conservada durante la reorganización. Nunca se comparte ni se versiona.

El backend de desarrollo no se reinicia automáticamente para no cortar guardados mientras se edita código. Para desarrollo con reinicios explícitos existe `npm --prefix backend run dev:watch`. Después de modificar el backend, reinicia su proceso manualmente cuando no haya capturas en curso.

Para una prueba local sin el aviso informativo de React DevTools, ejecuta `npm run local`: compila el frontend y lo sirve en **http://127.0.0.1:3001**. No cambia la autenticación temporal ni publica nada en internet.

Si falta ese archivo, copia `backend/.env.example` y completa sus valores localmente.

### PostgreSQL local en Docker

- Servicio propio: `gab-fumigaciones-local-postgres-1`, PostgreSQL 17, sin tocar otros contenedores.
- Solo escucha en `127.0.0.1:5434`; el volumen `gab-fumigaciones-local_postgres_data` conserva los datos al reiniciar.
- `npm run db:up` prepara secretos privados y levanta el servicio; `npm run db:status` comprueba la conexión y `npm run db:stop` lo detiene sin borrar el volumen.
- La aplicación usa `fumigaciones_app`, sin permisos de superusuario ni de crear bases/roles. Las contraseñas de Docker quedan en `backend/.docker/`, excluido del versionado; las credenciales Odoo no se introducen en el contenedor.
- En una instalación nueva, configura `DB_HOST=127.0.0.1`, `DB_PORT=5434`, `DB_NAME=fumigaciones_pruebas`, `DB_USER=fumigaciones_app` y `DB_PASSWORD` en `backend/.env`. El esquema se aplica al conectar el backend.
- Levantar Docker **no migra registros ni cambia la conexión existente**. Antes de trasladar una base, hay que obtener un respaldo de la fuente, restaurarlo, verificar registros/folios y después cambiar `DB_PORT` a `5434`. No reconstruyas capturas antiguas a partir de ejemplos ni borres el volumen para resolver errores.
- Este entorno se inició con una **base local vacía por decisión del usuario**. No se importaron las capturas del VPS; la base remota se conserva intacta. La configuración anterior de PostgreSQL se conserva de forma privada en `backend/.docker/source-database.json`.
- Respalda también `backend/storage/uploads/`. Los respaldos locales pueden guardarse en `backend/storage/backups/`, excluido del versionado. Nunca uses `docker compose down -v` si quieres conservar los datos.

### Acceso único a la base remota para migrar

Para extraer los datos existentes del VPS, mantén abierto temporalmente en otra ventana:

```powershell
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L 127.0.0.1:5433:127.0.0.1:5432 root@srv1933355.hstgr.cloud
```

El túnel usa la contraseña de SSH; `DB_PASSWORD` usa la del usuario PostgreSQL `fumigaciones_app`. Tras verificar la migración a Docker, el túnel ya no se necesita para usar la aplicación. La base remota se conserva sin borrarla ni reemplazarla.

## Usuarios temporales

Con `IMPLICIT_DEMO_AUTH=true` se usa un solicitante ficticio (`campo@gab.local`), sin login visible. **No es autenticación Odoo.** La opción se rechaza con `NODE_ENV=production`.

El solicitante solo consulta su historial, detalles, remisiones y Excel. La identificación por nombre es temporal: antes de integrar Odoo debe sustituirse por un identificador estable y una sesión verificada.

**El aprobador real se definirá después.** Todos los perfiles de prueba tienen `identityVerified=false`: ni siquiera los perfiles demo de administración/supervisión pueden aprobar, cancelar, registrar ejecuciones ni autorizar proveedores. No hay selector para elevar permisos desde la interfaz. Una futura integración de identidad deberá verificar al usuario en el servidor y asignar su rol; no basta con elegir un nombre o enviar un rol desde el navegador.

El backend conserva perfiles de prueba para administración, campo, supervisión y operaciones (`admin@gab.local`, `campo@gab.local`, `supervisor@gab.local`, `operador@gab.local`; contraseña temporal `DemoLocal2026!`). No hay selector de perfiles; en modo implícito siempre se usa campo. No introduzcas contraseñas reales de Odoo en estos accesos temporales.

## Catálogos de Odoo

- Configuración: `ODOO_URL`, `ODOO_DB`, `ODOO_USER`, `ODOO_API_KEY` en `backend/.env`; nunca se envían al navegador.
- Lectura exclusiva de `account.zone`, `account.plot_name`, `account.crop`, `account.cycle`, `account.plot` y los proveedores activos (`res.partner`, `supplier_rank > 0`).
- El formulario recibe **solo proveedores autorizados en PostgreSQL local**, no todos los contactos de Odoo. Selección inicial: **Selman Eduardo Flores Magaña**, **Óscar Javier Rodríguez Loaiza**, **Fumigaciones Aéreas Buentello** y **AGRASAMA**. La clasificación no usa ni modifica etiquetas/contactos en Odoo.
- Se muestran nombre y **RFC o referencia**; al seleccionar también se muestra la fecha de alta en esta aplicación, no la fecha de creación del contacto en Odoo. Las altas manuales llevan **Nuevo durante 30 días**; las cuatro altas iniciales no se presentan como nuevos proveedores.
- Registrar otro proveedor requiere **administración con identidad verificada**. El flujo busca contactos existentes y activos en Odoo, muestra su RFC/referencia y pide confirmación antes de autorizarlos localmente. No crea contactos. La fecha, responsable y evento se guardan en la misma transacción; se impiden duplicados por contacto, RFC o referencia. Mientras no haya identidad real, el alta no se muestra ni se permite desde la API.
- La lista local se comprueba en cada consulta y nuevamente bajo bloqueo al guardar: enviar un ID de proveedor no autorizado no sirve para incorporarlo automáticamente. Actualizar el catálogo no autoriza nuevos contactos. Las solicitudes existentes conservan su instantánea y sus reintentos idempotentes, aunque un proveedor deje de estar autorizado.
- El periodo de aplicación se lee de las opciones reales de `purchase.order.application_period` (actualmente Pre-siembra y Post-siembra). No se admiten proveedores ni periodos escritos libremente.
- Ciclo → zona → predio → cultivo se filtran por relaciones reales. No se inventa un catálogo de ranchos: el nombre disponible es **Zona**.
- Si hay varias referencias para una combinación, se exige elegir una explícitamente.
- Solo se ofrecen registros con relaciones y superficie completas y coherentes. Las omisiones se corrigen en Odoo, no en esta web.
- Caché de cinco minutos; actualizar catálogos solicita una lectura nueva. Odoo no depende del túnel PostgreSQL.
- Al guardar se verifican IDs y superficie en el backend; no se confía en nombres enviados desde el navegador. Se almacena una instantánea, nombres e IDs para trazabilidad.
- El campo histórico `ranch` conserva compatibilidad y contiene la zona en las capturas nuevas.

## Interfaz

- Listas con buscador, altura limitada y posicionamiento dentro del viewport del teléfono.
- Tarjetas expandibles para el historial hasta 860 px; cerradas muestran folio, lote y estado. Tocar/hacer clic en el encabezado (o usar Enter/Espacio) despliega los datos y el acceso a detalle; otro toque los contrae. La tabla de escritorio se conserva.
- Ayudas por toque o teclado; se cierran al tocar fuera o pulsar Escape.
- SweetAlert para limpiar y confirmar el registro, sin cuadros nativos con la dirección local.
- Botón de guardado con el SVG y animación proporcionados, adaptados al tema GAB y a movimiento reducido.
- La captura se conserva al cambiar de pestaña, pero no después de recargar o cerrar la página sin guardar.
- Fuente de verdad visual: `frontend/src/shared/theme/tema-calidad-gab.json`. Archivo en títulos, Instrument Sans en textos y JetBrains Mono en números, con fuentes locales.
- Integra `<ApplicationRequests theme="light" />` o `theme="dark"` desde el índice del módulo.

## OCM exclusivamente en STAG

- El detalle permite **Generar OCM en STAG** únicamente en estado **Aprobada**, con confirmación explícita. **Aprobar solo habilita el botón: no crea automáticamente la OCM.** La regla se valida en el servicio y al reservar bajo bloqueo en PostgreSQL, no solo en la interfaz. Solicitada, Cancelada y Realizada no generan órdenes nuevas.
- Se crea únicamente un borrador (`draft`) de tipo **Solicitud**; no se ejecutan confirmaciones, autorizaciones ni pagos en Odoo. La creación desactiva notificaciones automáticas de correo y suscripciones.
- Flujo de estados: **Solicitada** al capturar; **Aprobada/Cancelada** por aprobador o administración con identidad verificada; **Realizada** al registrar ejecución por operaciones o administración con identidad verificada. Cada cambio conserva actor y fecha en la auditoría interna. Como el responsable sigue pendiente, el solicitante de prueba no puede aprobarse sus propias solicitudes.
- Configuración separada en `backend/.env`: `ODOO_STAGING_OCM_ENABLED`, `ODOO_STAGING_URL`, `ODOO_STAGING_DB`, `ODOO_STAGING_USER`, `ODOO_STAGING_API_KEY`. No se usa Python ni se envían las claves al frontend. El indicador `ODOO_YOLO` no se utiliza.
- El destino debe ser HTTPS, una rama `stag`/`staging` de `*.dev.odoo.com` y coincidir con el nombre de la base. Un destino de producción se rechaza **antes de enviar solicitudes**; tampoco se siguen redirecciones HTTP. Los accesos `ODOO_*` originales siguen siendo solo de lectura.
- Las referencias de producción no se copian a ciegas: proveedor, zona, predio, cultivo, ciclo, lote, moneda y servicio OCM se resuelven nuevamente en STAG. El proveedor se identifica por RFC o referencia; para instantáneas antiguas sin identificador se conserva la búsqueda por nombre exacto y único. Si falta una referencia o hay coincidencias ambiguas, no se crea la OCM.
- Se usan los datos guardados y validados de la solicitud; el navegador no puede cambiar proveedor, hectáreas ni tarifa al generar la OCM. Los impuestos se dejan a las reglas de Odoo para el producto/proveedor de STAG.
- Tras crear se releen cabecera y líneas para comprobar proveedor, periodo, lote/ciclo, servicio, unidad, hectáreas, tarifa y estado borrador. Si no se pueden verificar o no coinciden, se conserva el ID real y se avisa que requiere revisión; nunca se crea otra orden para corregirlo.
- **Ver OCM en STAG** abre el formulario del `purchase.order` concreto en Odoo 17, con base e ID explícitos en la URL. El enlace se reconstruye desde el vínculo persistido al volver a abrir la solicitud, no desde datos enviados por el navegador ni desde el `web.base.url` de producción.
- `aerial_purchase_links` conserva la reserva y el vínculo por solicitud/base. Una respuesta perdida o una caída del servidor no dispara otra creación: **Verificar OCM en STAG** solo busca la referencia existente. Si no aparece, se requiere revisión manual antes de liberar una reserva; no se elimina ni confirma ninguna orden automáticamente.
- La regla de aprobación no borra ni cambia OCM previas: se conservan sus enlaces y la posibilidad de reconciliar reservas pendientes, incluso si el estado local ya no es Aprobada. Reconciliar nunca crea una segunda orden.
- Las solicitudes históricas sin proveedor, periodo o tarifa no generan OCM. El estado de la solicitud local no cambia ni equivale a aprobación de compra. Una creación en curso bloquea la cancelación local hasta terminar; cancelar después una solicitud no cancela automáticamente su OCM en Odoo. Para activar este flujo fuera de pruebas se requiere identidad real y revisión de permisos.

## WhatsApp: preparación experimental de botones

El diagnóstico de Evolution confirmó envío de texto, pero no la recepción del mensaje de botones con 2.3.7/Baileys. Hay una preparación local y separada en [`scripts/evolution-buttons/`](scripts/evolution-buttons/README.md): genera un parche de código público fijado por commit/hash y pruebas simuladas, sin modificar el VPS, copiar sesiones ni enviar mensajes. **No está aplicado ni validado todavía en WhatsApp real**; requiere acceso administrativo al despliegue y una prueba independiente antes de intervenir AgricolaBot. La aprobación de solicitudes por WhatsApp todavía no está implementada ni habilitada.

## Datos y límites

- Datos y metadatos: PostgreSQL. Fotos y PDF: **`backend/storage/uploads/`**, en esta computadora. Respalda ambos.
- Folio secuencial `AA-00001` y UUID independiente. Una ejecución por solicitud.
- Cada solicitud nueva requiere proveedor, periodo de aplicación y tarifa en MXN por hectárea, mayor que cero y con hasta dos decimales. El subtotal estimado es hectáreas × tarifa, sin impuestos; no es un costo ejecutado ni genera una orden de compra.
- Proveedores y periodos se almacenan en catálogos normalizados (`aerial_suppliers`, `aerial_application_periods`), con claves foráneas desde la solicitud. El backend valida las referencias con Odoo y conserva una instantánea de los valores elegidos. Los registros anteriores quedan sin estos datos, sin inventar valores ni modificar sus capturas.
- Cada captura usa una clave única: si se corta la respuesta y se reintenta sin cambiar los datos, el backend devuelve el registro ya creado en vez de duplicarlo. La clave se conserva mientras no se recargue la página ni se limpie la captura.
- Las acciones de aprobación/cancelación solo se muestran cuando la sesión verificada tiene permiso. Los endpoints de ejecución y carga de remisiones se conservan para futuros módulos; no se muestran al solicitante.
- Excel exporta todos los registros permitidos al usuario, no solo el filtro visible.
- El detalle y Excel muestran el folio, no los identificadores técnicos. El historial de auditoría se conserva solo en el backend, sin sección de seguimiento visible.
- Sesiones en memoria, permisos en backend, consultas parametrizadas, comprobación básica de firmas y límite de 10 MB por adjunto.
- No hay antivirus de adjuntos. No publiques este prototipo en internet sin autenticación real, sesiones persistentes, HTTPS, respaldos y revisión de seguridad.

## Verificación y formato

```powershell
npm test
npm run build
npm run format:check
# Integración opcional contra PostgreSQL Docker local, sin escribir en Odoo:
npm --prefix backend run test:db
```

`npm test` ejecuta las pruebas conservadas en cada aplicación. También puedes ejecutar `npm test` dentro de `backend/` o `frontend/`. `npm run format` aplica el formato común, usando Prettier instalado en el frontend.

`test:db` exige `127.0.0.1:5434/fumigaciones_pruebas`: crea un esquema temporal transaccional, verifica migración idempotente, proveedores, duplicados, permisos, aprobación, auditoría y OCM simulada; al terminar revierte todo y comprueba que solicitudes, vínculos y secuencia de folios públicos no cambiaron.

Para servir la compilación: `npm start`, en http://127.0.0.1:3001. No lo ejecutes simultáneamente con el backend de desarrollo.
