import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUser } from '../src/shared/session/useLayoutUser.js';
import {
  viewFromPath,
  viewFromRole,
} from '../src/modules/application-requests/presentation/view.js';

test('el usuario de la app principal se acepta como texto o dentro de un objeto', () => {
  assert.equal(normalizeUser('  Luis.Salazar@Empresa.mx '), 'luis.salazar@empresa.mx');
  assert.equal(normalizeUser({ usuario: 'LUIS' }), 'luis');
  assert.equal(normalizeUser({ tipo: 'usuario', user: { email: 'A@B.mx', name: 'A' } }), 'a@b.mx');
  for (const empty of [null, undefined, '', '   ', {}, { name: 'Sin identificador' }])
    assert.equal(normalizeUser(empty), null);
  assert.equal(normalizeUser('x'.repeat(201)), null, 'un texto enorme no es un usuario');
});

test('con usuario de la app principal la vista sale de su perfil, no de la dirección', () => {
  assert.equal(viewFromRole('gestor'), 'review');
  for (const role of ['aprobador', 'admin', 'solicitante', undefined])
    assert.equal(viewFromRole(role), 'capture');
  assert.equal(viewFromPath('/validar'), 'review');
});
