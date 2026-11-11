import test from 'node:test';
import assert from 'node:assert/strict';
import { demoUserForView } from '../src/middleware/auth.middleware.js';

test('demo local: /validar usa al aprobador de prueba y lo demás al solicitante, sin identidad verificada', () => {
  const reviewer = demoUserForView('validar');
  const requester = demoUserForView('captura');
  assert.equal(reviewer.role, 'aprobador');
  assert.equal(requester.role, 'solicitante');
  assert.equal(demoUserForView(undefined).role, 'solicitante');
  assert.equal(demoUserForView('admin').role, 'solicitante');
  assert.equal(reviewer.identityVerified, false);
  assert.equal(requester.identityVerified, false);
});
