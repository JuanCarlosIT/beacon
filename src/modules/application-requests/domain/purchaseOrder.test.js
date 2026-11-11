import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseOrderAction, purchaseOrderMessage } from './purchaseOrder.js';

test('el mensaje de la OCM sigue la prioridad de reglas', () => {
  const base = { enabled: true };
  const cases = [
    [
      { ...base, status: 'created', reference: 'P1', needsReview: true },
      'Solicitada',
      /P1 vinculada/,
    ],
    [{ ...base, status: 'created' }, 'Aprobada', /OCM creada en STAG/],
    [{ ...base, canVerify: true, canCreate: true }, 'Aprobada', /pendiente de verificar/],
    [{ ...base, canCreate: true }, 'Aprobada', /borrador de prueba/],
    [{ enabled: false, requiresApproval: true }, 'Solicitada', /no está habilitada/],
    [{ ...base, roleAllowed: false }, 'Aprobada', /no tiene permiso/],
    [{ ...base, requiresApproval: true }, 'Solicitada', /Pendiente de aprobación/],
    [base, 'Cancelada', /Solo una solicitud en estado Aprobada/],
    [base, 'Aprobada', /Se requieren proveedor/],
  ];
  for (const [purchase, status, expected] of cases)
    assert.match(purchaseOrderMessage(purchase, status), expected);
});

test('la acción es link con OCM, botón si se puede generar, nada en otro caso', () => {
  assert.equal(purchaseOrderAction({ url: 'https://x', canCreate: true }), 'link');
  assert.equal(purchaseOrderAction({ requiresApproval: true }), 'button');
  assert.equal(purchaseOrderAction({ canVerify: true }), 'button');
  assert.equal(purchaseOrderAction({}), null);
});
