import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createWhatsappApprovalRepository } from '../../src/repositories/whatsapp-approval.repository.js';
import { withIsolatedSchema } from './isolated-schema.js';

test('Docker: aprobadores y registro del aviso por WhatsApp, en un esquema aislado', () =>
  withIsolatedSchema(async ({ db, applySchema }) => {
    await applySchema(); // idempotente
    assert.equal(await db.approver.count(), 0, 'el esquema no da de alta aprobadores');

    const repo = createWhatsappApprovalRepository(db);
    const request = await db.request.create({
      data: {
        id: randomUUID(),
        requested_date: new Date('2026-11-10'),
        ranch: 'Zona prueba',
        lot: 'Lote prueba',
        crop: 'Cultivo prueba',
        hectares: 10,
        treatment: '',
        priority: 'Normal',
        requested_by: 'Solicitante prueba',
      },
    });

    assert.deepEqual(await repo.activeApprovers(), []);
    await assert.rejects(
      () => repo.addApprover('X', '123', 'Consola local'),
      (error) => error.status === 422,
    );
    const approver = await repo.addApprover('Aprobador Prueba', '5216681234567', 'Consola local');
    assert.equal(approver.phone_last10, '6681234567');
    assert.equal(typeof approver.id, 'string', 'el id (bigint) viaja como texto, igual que con pg');
    await assert.rejects(
      () => repo.addApprover('Otro', '6681234567', 'Consola local'),
      (error) => error.status === 409,
    );
    const other = await repo.addApprover('Segundo Aprobador', '6689999999', 'Consola local');
    assert.deepEqual(
      (await repo.activeApprovers()).map((a) => a.name),
      ['Aprobador Prueba', 'Segundo Aprobador'],
    );
    assert.equal((await repo.deactivateApprover(other.id)).active, false);
    assert.equal(await repo.deactivateApprover(other.id), null);
    assert.deepEqual(
      (await repo.activeApprovers()).map((a) => a.id),
      [approver.id],
    );
    // Tras desactivarlo, el teléfono puede volver a registrarse.
    await repo.addApprover('Segundo Aprobador', '6689999999', 'Consola local');
    assert.equal((await repo.listApprovers()).length, 3);

    await repo.recordNotice(request.id, 'Admin', ['Aprobador Prueba']);
    const events = await db.event.findMany({
      where: { request_id: request.id },
      select: { actor: true, description: true },
      orderBy: { id: 'asc' },
    });
    assert.deepEqual(events.at(-1), {
      actor: 'Admin',
      description: 'Aviso de aprobación por WhatsApp a Aprobador Prueba',
    });
    // Avisar no cambia la solicitud ni crea la OCM.
    assert.equal((await db.request.findUnique({ where: { id: request.id } })).status, 'Solicitada');
    assert.equal(await db.purchaseLink.count(), 0);
  }));
