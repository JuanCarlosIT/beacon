import test from 'node:test';
import assert from 'node:assert/strict';
import { lanOrigins } from '../src/middleware/security.middleware.js';

test('acepta las IP privadas de esta PC y descarta loopback, VPN públicas e IPv6', () => {
  const interfaces = {
    Ethernet: [
      { family: 'IPv4', address: '192.168.1.172', internal: false },
      { family: 'IPv6', address: 'fe80::1', internal: false },
    ],
    Loopback: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
    'Radmin VPN': [{ family: 'IPv4', address: '26.214.230.139', internal: false }],
    WSL: [{ family: 'IPv4', address: '172.29.112.1', internal: false }],
    Oficina: [{ family: 'IPv4', address: '10.0.0.5', internal: false }],
    Publica: [{ family: 'IPv4', address: '172.40.0.1', internal: false }],
  };
  assert.deepEqual(lanOrigins(interfaces, 5173), [
    'http://192.168.1.172:5173',
    'http://aereas.192-168-1-172.sslip.io:5173',
    'http://172.29.112.1:5173',
    'http://aereas.172-29-112-1.sslip.io:5173',
    'http://10.0.0.5:5173',
    'http://aereas.10-0-0-5.sslip.io:5173',
  ]);
});
