import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('render React del detalle y las altas restringidas', async (t) => {
  const server = await createServer({
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const { default: RequestDetail } = await server.ssrLoadModule(
      '/src/modules/application-requests/presentation/components/RequestDetail.jsx',
    );
    const data = {
      folio: 'AA-PRUEBA',
      status: 'Solicitada',
      requested_date: '2026-11-03',
      hectares: 1,
      attachments: [],
      supplier_name: 'Proveedor de prueba',
      supplier_vat: 'TST010101AB1',
      permissions: { canApprove: false, canCancel: false },
      purchaseOrder: { enabled: true, status: 'none', stage: 'approval' },
    };
    const renderDetail = (changes = {}) =>
      renderToStaticMarkup(
        React.createElement(RequestDetail, {
          data: { ...data, ...changes },
          onClose() {},
          onChangeStatus() {},
          onRequestApproval() {},
        }),
      );
    const button = (html, label) =>
      [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
        .map((match) => match[0])
        .find((element) => element.includes(label));

    await t.test(
      'Solicitada explica que falta autorizar y no ofrece decisiones al solicitante',
      () => {
        const html = renderDetail();
        assert.match(html, /Primero debe autorizarse la solicitud/);
        assert.ok(!button(html, 'Aprobar solicitud'));
        assert.ok(!button(html, 'Subir remisión'), 'sin autorizar no se suben remisiones');
        assert.ok(!html.includes('Generar OCM'), 'la OCM ya no se genera desde el detalle');
        assert.match(html, /TST010101AB1/);
      },
    );

    await t.test(
      'la receta y la tarifa pendiente se ven en el detalle; solo quien autoriza tarifas decide',
      () => {
        const pending = {
          rate_per_hectare: 450,
          authorized_rate: 400,
          rate_authorization: 'Pendiente',
          products: [{ odoo_product_id: 9, name: 'Fungicida X', uom: 'L', dose_per_hectare: 1.5 }],
        };
        const html = renderDetail(pending);
        assert.match(html, /Receta de aplicación/);
        assert.match(html, /Fungicida X/);
        assert.match(html, /1\.5 L \/ ha/);
        assert.match(html, /espera autorización/);
        assert.ok(!button(html, 'Guardar tarifa'), 'sin permiso no se corrige la tarifa');
        const editable = renderToStaticMarkup(
          React.createElement(RequestDetail, {
            data: {
              ...data,
              status: 'Aprobada',
              rate_per_hectare: 400,
              authorized_rate: 400,
              permissions: { canEditRate: true },
            },
            onClose() {},
            onCorrectRate() {},
          }),
        );
        assert.match(editable, /Corregir tarifa/);
        assert.ok(button(editable, 'Guardar tarifa'));
        assert.ok(!button(html, 'Autorizar tarifa'));
        const decider = renderToStaticMarkup(
          React.createElement(RequestDetail, {
            data: { ...data, ...pending, permissions: { canDecideRate: true } },
            onClose() {},
            onDecideRate() {},
          }),
        );
        assert.ok(button(decider, 'Autorizar tarifa'));
        assert.ok(button(decider, 'Rechazar tarifa'));
      },
    );

    await t.test('las remisiones se suben y se validan según los permisos del backend', () => {
      const remission = {
        id: 'r1',
        remission_number: 'R-1045',
        hectares: 1,
        review_status: 'Pendiente',
        uploaded_by: 'José Manuel Valencia',
        original_name: 'r.pdf',
      };
      const render = (permissions, attachments = [remission]) =>
        renderToStaticMarkup(
          React.createElement(RequestDetail, {
            data: {
              ...data,
              status: 'Aprobada',
              attachments,
              permissions,
              purchaseOrder: { ...data.purchaseOrder, stage: 'review' },
            },
            onClose() {},
            onUploadRemission() {},
            onReviewRemission() {},
          }),
        );
      const uploader = render({ canUploadRemission: true }, []);
      assert.match(uploader, /Sin remisión validada no se crea la OCM/);
      assert.ok(button(uploader, 'Subir remisión'));
      assert.ok(!button(uploader, 'Validar'));
      const reviewer = render({ canReviewRemission: true });
      assert.match(reviewer, /R-1045/);
      assert.ok(button(reviewer, 'Validar'));
      assert.ok(button(reviewer, 'Rechazar'));
      assert.ok(!button(reviewer, 'Subir remisión'));
      const validated = render({ canReviewRemission: true }, [
        { ...remission, review_status: 'Validada' },
      ]);
      assert.ok(!button(validated, 'Validar'), 'una remisión ya revisada no se vuelve a decidir');
    });

    await t.test('la OCM creada conserva su enlace a STAG', () => {
      const existing = renderDetail({
        purchaseOrder: {
          ...data.purchaseOrder,
          stage: 'created',
          status: 'created',
          url: 'https://gab-stag-123.dev.odoo.com/web#id=123',
          reference: 'OCM-PRUEBA',
        },
      });
      assert.match(existing, /Ver OCM en STAG/);
      assert.match(existing, /OCM-PRUEBA creada en STAG/);
    });

    await t.test('los controles privilegiados dependen de los permisos del backend', async () => {
      const approval = renderDetail({ permissions: { canApprove: true, canCancel: true } });
      assert.ok(button(approval, 'Aprobar solicitud'));
      assert.ok(!button(renderDetail(), 'Reenviar aviso por WhatsApp'));
      const notice = renderDetail({ permissions: { canRequestApproval: true } });
      assert.ok(button(notice, 'Reenviar aviso por WhatsApp'));
      assert.ok(!button(notice, 'Reenviar aviso por WhatsApp').includes('disabled=""'));
      assert.ok(!button(notice, 'Aprobar solicitud'), 'pedir aviso no habilita aprobar');
      const { default: RequestForm } = await server.ssrLoadModule(
        '/src/modules/application-requests/presentation/components/RequestForm.jsx',
      );
      const renderForm = (canRegister) =>
        renderToStaticMarkup(
          React.createElement(RequestForm, {
            connected: true,
            catalogLoading: false,
            catalog: { supplierPermissions: { canRegister } },
            onAddSupplier() {},
            onSave() {},
            reloadCatalog() {},
          }),
        );
      assert.ok(!button(renderForm(false), 'Registrar proveedor'));
      assert.ok(button(renderForm(true), 'Registrar proveedor'));
    });

    await t.test('la lista de validación muestra tarjetas con folio, lote y acción', async () => {
      const { default: RequestHistory } = await server.ssrLoadModule(
        '/src/modules/application-requests/presentation/components/RequestHistory.jsx',
      );
      const rows = [
        {
          id: 'request-test-2',
          folio: 'AA-00002',
          lot: 'C12',
          ranch: 'CABORCA',
          crop: 'PAPA',
          hectares: 30,
          priority: 'Normal',
          status: 'Solicitada',
          requested_date: '2026-11-12',
          cycle_name: '26.27',
          estimated_subtotal: 12000,
        },
        {
          id: 'request-test-1',
          folio: 'AA-00001',
          lot: 'VARGAS',
          ranch: 'LM',
          crop: 'PAPA',
          hectares: 18,
          priority: 'Alta',
          status: 'Aprobada',
          requested_date: '2026-11-12',
          cycle_name: '26.27',
          treatment: 'Aplicación de prueba',
        },
      ];
      const html = renderToStaticMarkup(
        React.createElement(RequestHistory, {
          rows,
          visible: rows,
          loading: false,
          error: '',
          filter: 'Solicitada',
          query: '',
          setFilter() {},
          setQuery() {},
          onRefresh() {},
          onOpen() {},
        }),
      );
      assert.ok(html.includes('Solicitudes de aplicación aérea'));
      const cards = [...html.matchAll(/<article data-card="solicitud"[\s\S]*?<\/article>/g)].map(
        (match) => match[0],
      );
      assert.equal(cards.length, 2);
      for (const [index, card] of cards.entries()) {
        assert.ok(card.includes(rows[index].folio));
        assert.ok(card.includes(rows[index].lot));
        assert.ok(card.includes(rows[index].status));
        assert.ok(card.includes('Fecha requerida'));
        assert.ok(card.includes(`${rows[index].hectares} ha`));
        assert.ok(card.includes(`Ver detalle de ${rows[index].folio}`));
        assert.ok(!card.includes('$$'));
      }
      assert.match(cards[0], /En espera de autorización[\s\S]*Revisar/);
      assert.ok(cards[1].includes('Prioridad alta'));
      assert.ok(cards[1].includes('Aplicación de prueba'));
    });
  } finally {
    await server.close();
  }
});

test('la dirección decide la vista: /validar para el gestor, lo demás para captura', async () => {
  const { viewFromPath } = await import('../src/modules/application-requests/presentation/view.js');
  assert.equal(viewFromPath('/validar'), 'review');
  assert.equal(viewFromPath('/validar/'), 'review');
  assert.equal(viewFromPath('/'), 'capture');
  assert.equal(viewFromPath('/validarx'), 'capture');
  assert.equal(viewFromPath('/otra/validar'), 'capture');
});
