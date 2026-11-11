-- Catálogos normalizados: referencias verificadas contra Odoo, sin nombres libres.
CREATE TABLE IF NOT EXISTS aerial_suppliers (
  odoo_partner_id integer PRIMARY KEY CHECK (odoo_partner_id > 0),
  name text NOT NULL
);
-- La autorización es local: nunca se crean etiquetas ni se editan contactos en Odoo.
ALTER TABLE aerial_suppliers ADD COLUMN IF NOT EXISTS authorized boolean NOT NULL DEFAULT false;
ALTER TABLE aerial_suppliers ADD COLUMN IF NOT EXISTS vat text NOT NULL DEFAULT '';
ALTER TABLE aerial_suppliers ADD COLUMN IF NOT EXISTS reference text NOT NULL DEFAULT '';
ALTER TABLE aerial_suppliers ADD COLUMN IF NOT EXISTS registered_at timestamptz;
ALTER TABLE aerial_suppliers ADD COLUMN IF NOT EXISTS registered_by text;
ALTER TABLE aerial_suppliers ADD COLUMN IF NOT EXISTS registration_source text;
CREATE UNIQUE INDEX IF NOT EXISTS aerial_suppliers_authorized_vat_uidx
  ON aerial_suppliers(upper(vat)) WHERE authorized AND vat <> '';
CREATE UNIQUE INDEX IF NOT EXISTS aerial_suppliers_authorized_reference_uidx
  ON aerial_suppliers(upper(reference)) WHERE authorized AND reference <> '';
CREATE TABLE IF NOT EXISTS aerial_supplier_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  odoo_partner_id integer NOT NULL REFERENCES aerial_suppliers(odoo_partner_id),
  actor text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Selección inicial explícita del usuario, verificada en Odoo en solo lectura.
-- Una segunda aplicación del esquema no cambia altas, bajas ni fechas existentes.
WITH registered AS (
  INSERT INTO aerial_suppliers
    (odoo_partner_id,name,vat,reference,authorized,registered_at,registered_by,registration_source)
  VALUES
    (9305,'SELMAN EDUARDO FLORES MAGAÑA','FOMS900106IE1','',true,now(),'Selección inicial autorizada','initial'),
    (15537,'OSCAR JAVIER RODRIGUEZ LOAIZA','ROLO571226J24','',true,now(),'Selección inicial autorizada','initial'),
    (8647,'FUMIGACIONES AEREAS BUENTELLO','FAB060306L94','',true,now(),'Selección inicial autorizada','initial'),
    (17305,'AGRASAMA','AGR151101U56','',true,now(),'Selección inicial autorizada','initial')
  ON CONFLICT (odoo_partner_id) DO UPDATE SET
    vat=EXCLUDED.vat, reference=EXCLUDED.reference, authorized=EXCLUDED.authorized,
    registered_at=EXCLUDED.registered_at, registered_by=EXCLUDED.registered_by,
    registration_source=EXCLUDED.registration_source
  WHERE aerial_suppliers.registered_at IS NULL
  RETURNING odoo_partner_id
)
INSERT INTO aerial_supplier_events(odoo_partner_id,actor,description)
  SELECT odoo_partner_id,'Selección inicial autorizada','Proveedor autorizado en el directorio local inicial'
  FROM registered;

CREATE TABLE IF NOT EXISTS aerial_application_periods (
  code text PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS aerial_requests (
  id uuid PRIMARY KEY,
  number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  requested_date date NOT NULL,
  ranch text NOT NULL,
  lot text NOT NULL,
  crop text NOT NULL,
  hectares numeric(12,2) NOT NULL CHECK (hectares > 0),
  treatment text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('Normal','Alta')),
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Solicitada' CHECK (status IN ('Solicitada','Aprobada','Realizada','Cancelada')),
  requested_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS aerial_executions (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE REFERENCES aerial_requests(id),
  execution_date date NOT NULL,
  hectares numeric(12,2) NOT NULL CHECK (hectares > 0),
  provider text NOT NULL,
  pilot text NOT NULL,
  cost numeric(14,2) NOT NULL CHECK (cost >= 0),
  notes text NOT NULL DEFAULT '',
  registered_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS aerial_attachments (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES aerial_requests(id),
  original_name text NOT NULL,
  stored_name text NOT NULL,
  mime_type text NOT NULL,
  size integer NOT NULL,
  uploaded_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS aerial_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES aerial_requests(id),
  actor text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Las solicitudes anteriores conservan sus textos originales.
ALTER TABLE aerial_requests ADD COLUMN IF NOT EXISTS odoo_plot_id integer;
ALTER TABLE aerial_requests ADD COLUMN IF NOT EXISTS odoo_plot_name_id integer;
ALTER TABLE aerial_requests ADD COLUMN IF NOT EXISTS odoo_zone_id integer;
ALTER TABLE aerial_requests ADD COLUMN IF NOT EXISTS odoo_crop_id integer;
ALTER TABLE aerial_requests ADD COLUMN IF NOT EXISTS odoo_cycle_id integer;
ALTER TABLE aerial_requests ADD COLUMN IF NOT EXISTS cycle_name text;
ALTER TABLE aerial_requests ADD COLUMN IF NOT EXISTS odoo_catalog_snapshot jsonb;
ALTER TABLE aerial_requests ADD COLUMN IF NOT EXISTS submission_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS aerial_requests_submission_key_uidx ON aerial_requests(submission_key);

-- Sin valores inventados para las solicitudes ya registradas.
ALTER TABLE aerial_requests ADD COLUMN IF NOT EXISTS odoo_supplier_id integer REFERENCES aerial_suppliers(odoo_partner_id);
ALTER TABLE aerial_requests ADD COLUMN IF NOT EXISTS application_period_code text REFERENCES aerial_application_periods(code);
ALTER TABLE aerial_requests ADD COLUMN IF NOT EXISTS rate_per_hectare numeric(12,2) CHECK (rate_per_hectare > 0 AND rate_per_hectare <= 100000000);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'aerial_requests_purchase_details_complete'
      AND conrelid = 'aerial_requests'::regclass
  ) THEN
    ALTER TABLE aerial_requests ADD CONSTRAINT aerial_requests_purchase_details_complete CHECK (
      (odoo_supplier_id IS NULL AND application_period_code IS NULL AND rate_per_hectare IS NULL)
      OR (odoo_supplier_id IS NOT NULL AND application_period_code IS NOT NULL AND rate_per_hectare IS NOT NULL)
    );
  END IF;
END $$;

-- Una sola OCM por solicitud, exclusivamente en STAG. La reserva evita dobles envíos.
CREATE TABLE IF NOT EXISTS aerial_purchase_links (
  request_id uuid PRIMARY KEY REFERENCES aerial_requests(id),
  environment text NOT NULL DEFAULT 'staging' CHECK (environment = 'staging'),
  database_name text NOT NULL CHECK (database_name ~* '(^|-)stag(ing)?(-|$)'),
  attempt_key uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('creating','uncertain','created')),
  order_id integer CHECK (order_id > 0),
  order_name text,
  review_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (database_name, order_id),
  CHECK ((status = 'created' AND order_id IS NOT NULL) OR (status <> 'created' AND order_id IS NULL))
);
ALTER TABLE aerial_purchase_links ADD COLUMN IF NOT EXISTS review_required boolean NOT NULL DEFAULT true;

-- Aprobación por WhatsApp. El aprobador se registra solo desde la consola local
-- (scripts/approvers.mjs); el esquema no da de alta a nadie.
CREATE TABLE IF NOT EXISTS aerial_approvers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (length(btrim(name)) >= 3),
  phone_last10 text NOT NULL CHECK (phone_last10 ~ '^[0-9]{10}$'),
  active boolean NOT NULL DEFAULT true,
  registered_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS aerial_approvers_active_phone_uidx
  ON aerial_approvers(phone_last10) WHERE active;

-- Código de un solo uso por solicitud y aprobador. Solo se guarda su hash.
CREATE TABLE IF NOT EXISTS aerial_approval_challenges (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES aerial_requests(id),
  approver_id bigint NOT NULL REFERENCES aerial_approvers(id),
  code_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','used','expired','revoked')),
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS aerial_approval_challenges_pending_uidx
  ON aerial_approval_challenges(request_id, approver_id) WHERE status = 'pending';

-- Cada mensaje de WhatsApp se procesa una sola vez (clave = id del mensaje).
CREATE TABLE IF NOT EXISTS aerial_whatsapp_decisions (
  message_id text PRIMARY KEY CHECK (length(message_id) BETWEEN 6 AND 128),
  request_id uuid REFERENCES aerial_requests(id),
  approver_id bigint REFERENCES aerial_approvers(id),
  sender_last10 text NOT NULL,
  command text NOT NULL,
  outcome text NOT NULL,
  reply text NOT NULL,
  received_at timestamptz NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
