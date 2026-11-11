# Aprobación por WhatsApp · revisión de n8n y propuesta

> **Decisión del 9-nov-2026 (noche):** WhatsApp solo **avisa**. El aprobador recibe el link de la solicitud y un PDF con todo el detalle, y aprueba o rechaza **en la app**. No hay `/aprobar`, códigos ni botones, y WF64 no se modificó. Las secciones 1 a 4 quedan como antecedente; lo vigente está en la sección 5.

Revisión hecha el 9 de noviembre de 2026, **solo lectura**. No se modificó ningún workflow, webhook ni configuración de n8n o Evolution. Este archivo no contiene claves.

## 1. Workflow conectado a AgricolaBot

| Dato       | Valor                                                                       |
| ---------- | --------------------------------------------------------------------------- |
| Workflow   | **Work Flow 64 · Entrada WhatsApp AgricolaBot** (id `5P3hlbGQdscMFP2J`)     |
| Estado     | Activo, 61 nodos                                                            |
| Disparador | `POST /webhook/wa-bot-consulta`, evento `MESSAGES_UPSERT` de Evolution      |
| Función    | Enrutador: comandos `/…` a sus sub-flujos; el resto va al agente «Bot Odoo» |
| Respuestas | Por el sub-flujo WF53 «Notificar WhatsApp» (id `8512Oj0s7LaIe1dX`)          |

### Cómo enruta

1. **Filtrar entrada** (Code): descarta todo lo que no sea `messages.upsert`, los mensajes propios (`fromMe`), los grupos «solo envío» y, en grupos, lo que no mencione o responda al bot. Normaliza comandos a `/comando`.
2. Cadena de nodos IF: `/inicio → /quincenal → /fonacot → /impuestos → /resicos → /cuadernillo → /ocm-combustible → /pagos-resicos → /polizas-sacti → /sconciliar → /sacti → /finanzas`.
3. Cada comando tiene un nodo «Preparar» (decide `autorizado`, arma la respuesta) y un IF «¿Autorizado?».
4. Lo que no es comando cae en **Bot Odoo** (agente de IA).

### Hallazgos relevantes para la aprobación

| #   | Hallazgo                                                                                                                                                                                                                   | Consecuencia                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | «Filtrar entrada» solo lee `conversation`, `extendedTextMessage.text` y pies de documento. Una respuesta de botón (`buttonsResponseMessage` / `templateButtonReplyMessage`) llega sin texto y **se descarta en silencio**. | Las pruebas de botones no pudieron disparar nada. Si se habilitan botones hay que leer `selectedButtonId` explícitamente.          |
| 2   | Todo texto que no es comando llega al agente de IA.                                                                                                                                                                        | «Sí», «apruebo AA-00002» o un emoji **acabarían en la IA**. La aprobación debe ser un comando explícito que nunca pase a Bot Odoo. |
| 3   | El webhook no valida el token que manda Evolution (la ficha dice «sin autenticación»). Cualquiera que conozca la URL puede inyectar un mensaje con cualquier remitente.                                                    | Para aprobar no basta con el número del remitente que llega al webhook; el backend debe validar por su cuenta.                     |
| 4   | Los datos de ejecución guardan el cuerpo completo del webhook, incluida la `apikey` de Evolution y el token del encabezado, en texto plano.                                                                                | Cualquiera con acceso a las ejecuciones de n8n ve esas claves. Conviene rotarlas y ocultarlas en las ejecuciones.                  |
| 5   | Las autorizaciones son listas de últimos 10 dígitos dentro del código (y varias quedaron «sin lista blanca»).                                                                                                              | Para aprobar se necesita una lista blanca real, mantenida en el backend, no en el nodo.                                            |
| 6   | Solo se conservan 2 ejecuciones (ambas de hoy, 9-nov). Las pruebas de botones y texto anteriores **ya no están**. Una fue filtrada (sin salida); la otra, el texto «Probando flujo temporal», llegó a Bot Odoo.            | No hay evidencia en n8n de cómo llegó la respuesta de botón.                                                                       |
| 7   | Existe el workflow inactivo **«TEMP lectura VPS (Claude 9-nov) - borrar»** (id `FD78c8dFWQknwTiA`).                                                                                                                        | Quedó de la sesión anterior; falta borrarlo con autorización.                                                                      |

## 2. Restricción de red

La app y su PostgreSQL están en esta PC (`127.0.0.1`). n8n y Evolution están en el VPS y **no pueden llamar a la app**. Esta PC sí puede salir a internet hacia n8n.

Por eso se propone un modelo **de extracción (pull)**: la app avisa y luego consulta; n8n nunca llama a la app. No hace falta publicar la app ni abrir túneles.

## 3. Propuesta

```text
App local ──(1) POST webhook n8n "solicitud por aprobar"──▶ n8n (WF nuevo)
                                                              │ (2) WF53: mensaje al aprobador
                                                              ▼
                                         Aprobador escribe:  /aprobar AA-00002 7K4Q
                                                              │
                                     WF64 ──(3) rama nueva──▶ Data Table "aprobaciones_aa"
                                                              │   (decisión pendiente de aplicar)
App local ──(4) GET webhook n8n autenticado, cada 1 min ─────┘
   │
   └─(5) backend valida y aplica: Solicitada → Aprobada (o Cancelada), auditoría, marca como aplicada
```

### Reglas

- **Comando explícito**, no lenguaje natural: `/aprobar <folio> <código>` y `/rechazar <folio> <código>`. Si se habilitan botones, el `selectedButtonId` lleva lo mismo.
- **Código de un solo uso** por solicitud (4–6 caracteres), generado por el backend, guardado con hash y con **caducidad** (p. ej. 24 h). Así una inyección al webhook sin el código no aprueba nada.
- **Aprobador en el backend**: tabla nueva `aerial_approvers` (nombre, últimos 10 dígitos, activo). El backend compara el número de la decisión contra esa tabla; n8n solo transporta.
- **Idempotencia**: la decisión se aplica una vez; repetirla responde «ya estaba aprobada».
- **Auditoría**: `aerial_events` registra actor = aprobador designado, canal = WhatsApp, id del mensaje.
- **No cambia la regla de negocio**: aprobar solo habilita «Generar OCM en STAG»; nunca la crea.
- **En n8n**: la rama nueva va en una **copia desactivada de WF64** para probar; la rama nunca pasa a Bot Odoo; el webhook actual se conserva.

### Trabajo por pieza

| Pieza                                                                          | Dónde         | Estado                                             |
| ------------------------------------------------------------------------------ | ------------- | -------------------------------------------------- |
| Tabla `aerial_approvers` + códigos de aprobación                               | Backend local | **Hecho** (9-nov)                                  |
| Servicio que aplica decisiones (validación, caducidad, idempotencia) + pruebas | Backend local | **Hecho** (9-nov)                                  |
| Cliente que avisa y consulta n8n (desactivado por defecto)                     | Backend local | **Hecho** (9-nov), apagado                         |
| Botón «Pedir aprobación por WhatsApp» en el detalle                            | Frontend      | **Hecho** (9-nov); depende de `canRequestApproval` |
| WF nuevo «avisar aprobador» + webhook de consulta autenticado                  | n8n           | **Hecho**: WF81 `wEb3UEVPbGV1QKHO`, activo         |
| Rama `/aprobar` en WF64                                                        | n8n           | **Bloqueada**: falta autorización explícita        |
| Lectura de `buttonsResponseMessage`                                            | n8n           | Después de validar botones en número de prueba     |

## 4. Decisiones pendientes del usuario

1. **Quién aprueba** (nombre y número). Sin esto la función queda apagada.
2. Si se autoriza crear en n8n el WF nuevo y la copia desactivada de WF64.
3. Si se borra el workflow temporal `FD78c8dFWQknwTiA`.
4. Rotar la `apikey` de Evolution y el token del webhook, y ocultar datos sensibles en las ejecuciones.

## 5. Lo vigente: aviso por WhatsApp (sin aprobar desde el mensaje)

```text
Al guardar una solicitud nueva (automático; el botón «Reenviar aviso por WhatsApp» lo repite)
  → backend POST https://n8n…/webhook/gab-aa-aprobacion/aviso (X-GAB-Token)
  → WF81 valida el token → WF53 (AgricolaBot) manda al aprobador:
       texto con folio + link  http://aereas.localtest.me:5173/validar?solicitud=<id>
       PDF «Solicitud_AA-0000N.pdf» (datos, proveedor, costo, OCM, ejecución, adjuntos)
  → el aprobador entra a la app y aprueba o rechaza ahí
```

| Pieza                                              | Detalle                                                                                                                       |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/models/whatsapp-approval.model.js`            | `noticeText` (texto corto con link), `noticeHtml` (HTML que WF53 convierte en PDF), `requestLink`, `phoneLast10`.             |
| `src/repositories/whatsapp-approval.repository.js` | Aprobadores (`aerial_approvers`) y registro del aviso en `aerial_events`.                                                     |
| `src/services/whatsapp-approval.service.js`        | `sendNotice`: solo en estado Solicitada, con al menos un aprobador; el solicitante solo avisa de las suyas.                   |
| `src/integrations/n8n/n8nApproval.client.js`       | Solo `notify` (POST, 90 s, sin redirecciones). No hay consulta periódica.                                                     |
| `POST /api/requests/:id/approval-notice`           | Responde `{ folio, approvers }`.                                                                                              |
| Frontend                                           | Botón en el detalle; `?solicitud=<id>` abre ese detalle y limpia la dirección.                                                |
| n8n                                                | **WF81** `wEb3UEVPbGV1QKHO` (activo, solo el webhook `aviso`, no guarda ejecuciones exitosas). WF53 arma el PDF desde `html`. |

Configuración en `backend/.env`:

- `N8N_APPROVALS_ENABLED=true`;
- `N8N_APPROVALS_URL`;
- `N8N_APPROVALS_TOKEN`: 32 caracteres o más; WF81 guarda solo su SHA-256;
- `APP_PUBLIC_URL` (opcional): la dirección del link; por defecto `http://127.0.0.1:5173`.

**Link:** `APP_PUBLIC_URL=http://aereas.localtest.me:5173`. `localtest.me` es un dominio público que siempre resuelve a la propia PC (127.0.0.1), así que WhatsApp lo marca como link, a diferencia de `127.0.0.1`. Está permitido en Vite (`allowedHosts`) y en el origen del backend. Solo abre en esta PC; en el celular no abre, para eso está el PDF. Para abrirlo desde cualquier lado habría que publicar la app con dominio propio.

### Aprobadores (solo desde la consola de esta PC)

```powershell
cd "C:\Users\User\OneDrive\Documents\Proyecto predeterminado\backend"
npm.cmd run approvers -- list
npm.cmd run approvers -- add "Nombre Apellido" 6681234567
npm.cmd run approvers -- deactivate 1
```

Hoy está registrado #1 «Juan Carlos González (prueba)» (…8444). Hay que cambiarlo por el aprobador real.

### Restos sin uso

- Tablas `aerial_approval_challenges` y `aerial_whatsapp_decisions`: siguen en `schema.sql` y en la BD (no se borra nada), pero ya no se usan. Queda un código pendiente de AA-00002 sin efecto.
- Data Table de n8n `aa_aprobaciones_whatsapp` (`kfqJvXTJ8e61eZSf`): está vacía y sin uso; se puede borrar con autorización.
- Workflow temporal `FD78c8dFWQknwTiA`: sigue pendiente de borrar con autorización.
