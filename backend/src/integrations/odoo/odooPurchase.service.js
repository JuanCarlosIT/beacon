import { HttpError } from '../../errors/HttpError.js';
import { requestFolio } from '../../models/request.model.js';
import { stagingOdooClient } from './odooStaging.client.js';

export const purchaseOrigin = (id) => `GAB-AA:${id}`;

const REQUIRED_HEADER_FIELDS = [
  'gab_ocm_bool',
  'gab_ocm_purchase_type',
  'gab_ocm_reason',
  'gab_ocm_rq_user_id_to_use',
  'gab_ocm_zone_id',
  'application_period',
];
const REQUIRED_LINE_FIELDS = ['plot_id', 'cycle_id', 'has_to_apply'];
const ORDER_CHECK_FIELDS = [
  'id',
  'name',
  'state',
  'gab_ocm_bool',
  'origin',
  'partner_id',
  'company_id',
  'currency_id',
  'application_period',
  'order_line',
];
const LINE_CHECK_FIELDS = [
  'product_id',
  'product_uom',
  'product_qty',
  'price_unit',
  'plot_id',
  'cycle_id',
  'has_to_apply',
  'display_type',
];

// ---------- Validaciones de la captura y del esquema de STAG ----------

const hasCompleteCapture = (row, snapshot) =>
  ['supplier', 'zone', 'plot', 'crop', 'cycle'].every((key) => snapshot?.[key]?.name) &&
  Boolean(row.application_period_code) &&
  Number(row.hectares) > 0 &&
  Number(row.rate_per_hectare) > 0;

const hasStagingSchema = ({ fields, lineFields, defaults }) =>
  REQUIRED_HEADER_FIELDS.every((name) => fields[name]) &&
  REQUIRED_LINE_FIELDS.every((name) => lineFields[name]) &&
  Number.isInteger(defaults.company_id) &&
  Number.isInteger(defaults.picking_type_id);

const offersPeriod = (fields, code) =>
  Boolean(fields.application_period.selection?.some(([value]) => value === code));

const hasPurchaseUnit = (product) =>
  Array.isArray(product.uom_po_id) && Number.isInteger(product.uom_po_id[0]);

// ---------- Dominios de búsqueda ----------

// Proveedor por RFC; si no hay, por referencia; si no, por nombre.
const supplierKey = ({ vat, reference, name }) =>
  (vat && ['vat', '=', vat]) || (reference && ['ref', '=', reference]) || ['name', '=', name];

const companyScope = (companyId) => [['company_id', 'in', [false, companyId]]];
const byName = (name) => [['name', '=', name]];

// ---------- Armado del borrador ----------

const dateOnly = (value) => value?.toISOString?.().slice(0, 10) || String(value).slice(0, 10);
const odooNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const lineDescription = (row, snapshot, folio) =>
  [
    `Solicitud ${folio} · Aplicación aérea`,
    `${snapshot.plot.name} · ${snapshot.crop.name} · Ciclo ${snapshot.cycle.name}`,
    `${row.hectares} ha · ${row.rate_per_hectare} MXN/ha`,
    row.treatment,
    row.notes,
  ]
    .filter(Boolean)
    .join('\n');

function draftValues({ row, snapshot, refs, defaults, userId }) {
  const planned = `${dateOnly(row.requested_date)} 12:00:00`;
  const folio = requestFolio(row);
  const hectares = Number(row.hectares);
  return {
    partner_id: refs.supplier.id,
    company_id: defaults.company_id,
    currency_id: refs.currency.id,
    picking_type_id: defaults.picking_type_id,
    date_order: odooNow(),
    date_planned: planned,
    origin: purchaseOrigin(row.id),
    application_period: row.application_period_code,
    gab_ocm_zone_id: refs.zone.id,
    gab_ocm_bool: true,
    gab_ocm_purchase_type: 'Solicitud',
    gab_ocm_reason: `Solicitud de aplicación aérea ${folio} · ${snapshot.plot.name}`,
    gab_ocm_rq_user_id_to_use: userId,
    order_line: [
      [
        0,
        0,
        {
          name: lineDescription(row, snapshot, folio),
          product_id: refs.product.id,
          product_uom: refs.product.uom_po_id[0],
          product_qty: hectares,
          price_unit: Number(row.rate_per_hectare),
          date_planned: planned,
          plot_id: refs.plot.id,
          cycle_id: refs.cycle.id,
          has_to_apply: hectares,
        },
      ],
    ],
  };
}

// ---------- Verificación de lo que quedó en STAG ----------

const relationIs = (relation, id) => relation?.[0] === id;
const near = (actual, wanted) =>
  Number.isFinite(Number(actual)) && Math.abs(Number(actual) - Number(wanted)) < 0.000001;

const orderMatches = (order, id, values) =>
  order?.id === id &&
  order.gab_ocm_bool === true &&
  order.state === 'draft' &&
  order.origin === values.origin &&
  relationIs(order.partner_id, values.partner_id) &&
  relationIs(order.company_id, values.company_id) &&
  relationIs(order.currency_id, values.currency_id) &&
  order.application_period === values.application_period;

const lineMatches = (line, expected) =>
  relationIs(line.product_id, expected.product_id) &&
  relationIs(line.product_uom, expected.product_uom) &&
  relationIs(line.plot_id, expected.plot_id) &&
  relationIs(line.cycle_id, expected.cycle_id) &&
  near(line.product_qty, expected.product_qty) &&
  near(line.price_unit, expected.price_unit) &&
  near(line.has_to_apply, expected.has_to_apply);

const uncertainCreation = () =>
  Object.assign(
    new HttpError(
      503,
      'No pudimos confirmar la OCM. Usa Verificar OCM antes de intentar otra creación.',
    ),
    { uncertain: true },
  );

export function createOdooPurchaseService(client = stagingOdooClient) {
  const searchRead = (model, domain, kwargs) => client.read(model, 'search_read', [domain], kwargs);

  async function unique(model, domain, fields, label) {
    const rows = await searchRead(model, domain, { fields, limit: 2, order: 'id asc' });
    if (rows.length !== 1)
      throw new HttpError(
        422,
        `No se pudo identificar ${label} de forma única en STAG. Revisa su catálogo.`,
      );
    return rows[0];
  }

  const readSchema = async () => {
    const [userId, fields, lineFields, defaults] = await Promise.all([
      client.authenticate(),
      client.read('purchase.order', 'fields_get', [], { attributes: ['type', 'selection'] }),
      client.read('purchase.order.line', 'fields_get', [], { attributes: ['type'] }),
      client.read('purchase.order', 'default_get', [['company_id', 'picking_type_id']], {
        context: { default_gab_ocm_bool: true },
      }),
    ]);
    return { userId, fields, lineFields, defaults };
  };

  // Proveedor, zona, cultivo, ciclo, servicio OCM y moneda, cada uno debe ser único en STAG.
  async function findReferences(snapshot, companyId) {
    const company = companyScope(companyId);
    const [supplier, zone, crop, cycle, product, currency] = await Promise.all([
      unique(
        'res.partner',
        [
          supplierKey(snapshot.supplier),
          ['active', '=', true],
          ['supplier_rank', '>', 0],
          ...company,
        ],
        ['id', 'name', 'vat', 'ref'],
        'al proveedor',
      ),
      unique('account.zone', byName(snapshot.zone.name), ['id', 'name'], 'la zona'),
      unique('account.crop', byName(snapshot.crop.name), ['id', 'name'], 'el cultivo'),
      unique('account.cycle', byName(snapshot.cycle.name), ['id', 'name'], 'el ciclo'),
      unique(
        'product.product',
        [
          ['name', '=', 'OCM'],
          ['active', '=', true],
          ['purchase_ok', '=', true],
          ['type', '=', 'service'],
          ...company,
        ],
        ['id', 'name', 'uom_po_id'],
        'el servicio OCM',
      ),
      unique(
        'res.currency',
        [
          ['name', '=', 'MXN'],
          ['active', '=', true],
        ],
        ['id', 'name'],
        'la moneda MXN',
      ),
    ]);
    return { supplier, zone, crop, cycle, product, currency };
  }

  // Puede haber varios lotes con la misma zona, predio, cultivo y ciclo (p. ej. C3 de 60 y 29 ha).
  // Se usa el que se eligió al capturar, siempre que siga cumpliendo esos mismos datos.
  async function findPlot(row, snapshot, { zone, crop, cycle }) {
    const plotName = await unique(
      'account.plot_name',
      [...byName(snapshot.plot.name), ['zone_id', '=', zone.id]],
      ['id', 'name'],
      'el predio',
    );
    const plots = await searchRead(
      'account.plot',
      [
        ['type', '=', 'Lote'],
        ['zone_id', '=', zone.id],
        ['plot_name_id', '=', plotName.id],
        ['crop_id', '=', crop.id],
        ['cycle_id', '=', cycle.id],
      ],
      { fields: ['id', 'has'], limit: 20, order: 'id asc' },
    );
    const chosenId = row.odoo_plot_id ?? snapshot.record?.id;
    const chosen = chosenId == null ? null : plots.find((item) => item.id === Number(chosenId));
    const plot = chosen || (plots.length === 1 ? plots[0] : null);
    if (!plot)
      throw new HttpError(
        422,
        'No se pudo identificar el lote por ciclo de forma única en STAG. Revisa su catálogo.',
      );
    return plot;
  }

  const readOrder = async (id) =>
    (await client.read('purchase.order', 'read', [[id]], { fields: ORDER_CHECK_FIELDS }))[0];

  // Líneas de producto de la OCM (sin secciones ni notas).
  async function readItems(order) {
    if (!order?.order_line?.length) return [];
    const lines = await client.read('purchase.order.line', 'read', [order.order_line], {
      fields: LINE_CHECK_FIELDS,
    });
    return lines.filter((line) => !line.display_type);
  }

  const isVerified = (order, items, id, values) =>
    orderMatches(order, id, values) &&
    items.length === 1 &&
    lineMatches(items[0], values.order_line[0][2]);

  return {
    target: () => client.target(),

    async findExisting(id) {
      const orders = await searchRead(
        'purchase.order',
        [
          ['origin', '=', purchaseOrigin(id)],
          ['gab_ocm_bool', '=', true],
        ],
        { fields: ['id', 'name'], limit: 2, order: 'id asc' },
      );
      if (orders.length > 1)
        throw new HttpError(
          409,
          'Hay más de una OCM con esta referencia en STAG. Se requiere revisión manual.',
        );
      return orders[0] ? { ...orders[0], needsReview: true } : null;
    },

    async prepare(row) {
      const snapshot = row.odoo_catalog_snapshot;
      if (!hasCompleteCapture(row, snapshot))
        throw new HttpError(
          422,
          'Esta captura no tiene proveedor, periodo, tarifa y referencias completas.',
        );
      const schema = await readSchema();
      if (!hasStagingSchema(schema))
        throw new HttpError(503, 'Falta configurar el esquema de OCM en STAG.');
      if (!offersPeriod(schema.fields, row.application_period_code))
        throw new HttpError(422, 'El periodo elegido no está disponible en STAG.');
      const refs = await findReferences(snapshot, schema.defaults.company_id);
      const plot = await findPlot(row, snapshot, refs);
      if (Number(row.hectares) > Number(plot.has))
        throw new HttpError(422, 'La superficie solicitada supera la registrada en STAG.');
      if (!hasPurchaseUnit(refs.product))
        throw new HttpError(503, 'El servicio OCM no tiene unidad de compra configurada en STAG.');
      return draftValues({
        row,
        snapshot,
        refs: { ...refs, plot },
        defaults: schema.defaults,
        userId: schema.userId,
      });
    },

    async createDraft(values) {
      const id = await client.createDraft(values);
      if (!Number.isInteger(id) || id <= 0) throw uncertainCreation();
      // La creación ya está confirmada aunque falle la lectura de su folio.
      let name = null;
      try {
        const order = await readOrder(id);
        if (order?.id === id) name = order.name || null;
        const items = await readItems(order);
        return { id, name, needsReview: !isVerified(order, items, id, values) };
      } catch {
        return { id, name, needsReview: true };
      }
    },
  };
}

export const odooPurchaseService = createOdooPurchaseService();
