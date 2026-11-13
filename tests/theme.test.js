import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('el tema se capta del layout principal', async (t) => {
  const server = await createServer({
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const { normalizeTheme, getGabThemeStyle } = await server.ssrLoadModule(
      '/src/shared/theme/theme.js',
    );

    await t.test('acepta oscuro/claro en texto o mensaje', () => {
      assert.equal(normalizeTheme('oscuro'), 'dark');
      assert.equal(normalizeTheme(' DARK '), 'dark');
      assert.equal(normalizeTheme('claro'), 'light');
      assert.equal(normalizeTheme({ tipo: 'tema', tema: 'oscuro' }), 'dark');
      assert.equal(normalizeTheme({ type: 'theme', theme: 'light' }), 'light');
    });

    await t.test('ignora lo que no es un tema', () => {
      assert.equal(normalizeTheme('azul'), null);
      assert.equal(normalizeTheme(null), null);
      assert.equal(normalizeTheme({}), null);
    });

    await t.test('el oscuro cambia la paleta', () => {
      assert.equal(getGabThemeStyle('dark')['--gab-bg'], '#12181d');
      assert.equal(getGabThemeStyle('light')['--gab-bg'], '#f4f3ee');
    });
  } finally {
    await server.close();
  }
});
