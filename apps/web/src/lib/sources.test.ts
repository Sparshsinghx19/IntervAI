import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { safeSourceLinks, SourcesDisclosure } from '../components/interview/SourcesDisclosure';
import { buildCreatePayload, researchNote, SetupState } from './adaptive-setup';

const SOURCES = [
  { id: 'S1', title: 'PostgreSQL: Index Types', url: 'https://www.postgresql.org/docs/current/indexes-types.html', domain: 'postgresql.org', retrievedAt: '2026-10-18T12:00:00.000Z' },
  { id: 'S2', title: 'Use The Index, Luke', url: 'https://use-the-index-luke.com/sql/anatomy', domain: 'use-the-index-luke.com' },
];

describe('Sources disclosure', () => {
  it('renders real sources as safe external links', () => {
    const html = renderToStaticMarkup(React.createElement(SourcesDisclosure, { sources: SOURCES }));
    assert.match(html, /<details/);
    assert.match(html, /Sources/);
    assert.match(html, /href="https:\/\/www\.postgresql\.org\/docs\/current\/indexes-types\.html"/);
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener noreferrer nofollow"/);
    assert.match(html, /opens in a new tab/);
    assert.match(html, /use-the-index-luke\.com/);
  });

  it('renders nothing without real provenance', () => {
    for (const none of [undefined, null, [], [{ id: 'x', title: 'bad', url: 'javascript:alert(1)' }], 'nope']) {
      assert.equal(renderToStaticMarkup(React.createElement(SourcesDisclosure, { sources: none })), '');
    }
  });

  it('keeps only http(s) links and at most three', () => {
    const many = [...SOURCES, ...SOURCES, { id: 'd', title: 'data', url: 'data:text/html,hi' }];
    const links = safeSourceLinks(many);
    assert.equal(links.length, 3);
    assert.ok(links.every((l) => l.url.startsWith('https://')));
  });
});

describe('Research note', () => {
  it('describes researched and fallback interviews honestly', () => {
    assert.match(researchNote({ status: 'grounded', sourceCount: 4 })!, /web research \(4 sources\)/);
    assert.match(researchNote({ status: 'unavailable', sourceCount: 0 })!, /wasn’t available/);
    assert.match(researchNote({ status: 'inadequate', sourceCount: 0 })!, /curated question bank/);
    assert.equal(researchNote(null), null, 'older interviews say nothing');
  });
});

describe('Create payload retry key', () => {
  const setup: SetupState = {
    mode: 'TOPIC', interviewType: 'technical', difficulty: 'medium', focusArea: 'dbms', targetRole: '',
    durationMinutes: 30, questionTypes: ['THEORY'], resumeProfile: null,
  };
  it('sends the same client request id on every attempt', () => {
    const a = buildCreatePayload(setup, 'req-12345678');
    const b = buildCreatePayload(setup, 'req-12345678');
    assert.equal(a.clientRequestId, 'req-12345678');
    assert.deepEqual(a, b);
    assert.ok(!('clientRequestId' in buildCreatePayload(setup)));
  });
});
