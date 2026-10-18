import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveApiUrl } from './api-client';

describe('API base URL', () => {
  it('uses the local API in development', () => {
    assert.equal(resolveApiUrl(undefined), 'http://localhost:4000');
    assert.equal(resolveApiUrl('  '), 'http://localhost:4000');
  });

  it('uses this site’s own /api path behind the production proxy', () => {
    assert.equal(resolveApiUrl('same-origin'), '');
    assert.equal(`${resolveApiUrl('same-origin')}/api/auth/me`, '/api/auth/me');
  });

  it('accepts an explicit API origin without a trailing slash', () => {
    assert.equal(resolveApiUrl('https://api.example.com/'), 'https://api.example.com');
  });
});
