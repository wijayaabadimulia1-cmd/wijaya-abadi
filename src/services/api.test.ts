import assert from 'node:assert/strict';
import test from 'node:test';

import { api } from './api';

test('getSettings uses shared catalog order and preserves local site settings', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/settings')) {
      return new Response(JSON.stringify({
        name: 'Local site',
        catalogMotorOrder: ['local-motor'],
      }), { status: 200 });
    }
    if (url === '/api/catalog/order') {
      return new Response(JSON.stringify(['central-second', 'central-first']), { status: 200 });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const settings = await api.getSettings();
    assert.equal(settings.name, 'Local site');
    assert.deepEqual(settings.catalogMotorOrder, ['central-second', 'central-first']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
