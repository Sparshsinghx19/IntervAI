import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { sessionCompanion, setupCompanion } from './companion-status';
import { loadCoachWithFallback } from '../components/marketing/coach/load-coach';
import { CoachStaticFallback } from '../components/marketing/coach/CoachFallback';

const base = { evaluationStage: 'idle', isGeneratingReport: false, isInterviewComplete: false, timeUp: false };

describe('Session companion follows real request state', () => {
  it('is idle and ready by default, with no listening or speaking claims', () => {
    const s = sessionCompanion(base);
    assert.equal(s.mood, 'idle');
    assert.equal(s.label, 'Ready for your answer.');
    assert.doesNotMatch(`${s.label} ${s.short}`, /listen|speak|hear/i);
  });

  it('thinks only while a save or the report evaluation is pending', () => {
    assert.equal(sessionCompanion({ ...base, evaluationStage: 'saving' }).mood, 'thinking');
    assert.equal(sessionCompanion({ ...base, isInterviewComplete: true, isGeneratingReport: true }).mood, 'thinking');
    assert.match(sessionCompanion({ ...base, isGeneratingReport: true }).label, /Evaluating/);
  });

  it('returns to idle when the request succeeds or fails', () => {
    // saving -> saved (success) and saving -> save_error (failure) both end the thinking state.
    const ok = sessionCompanion({ ...base, evaluationStage: 'saved' });
    const failed = sessionCompanion({ ...base, evaluationStage: 'save_error' });
    assert.deepEqual([ok.mood, ok.tone], ['idle', 'success']);
    assert.deepEqual([failed.mood, failed.tone], ['idle', 'error']);
    assert.match(failed.label, /wasn’t saved/);
  });

  it('settles into a calm completed state, noting a time-limit finish', () => {
    assert.equal(sessionCompanion({ ...base, isInterviewComplete: true }).mood, 'complete');
    assert.match(sessionCompanion({ ...base, isInterviewComplete: true, timeUp: true }).label, /Time is up/);
  });
});

describe('Setup companion', () => {
  it('thinks only while the interview is being prepared', () => {
    assert.equal(setupCompanion({ isPreparing: true, isValid: true, completed: 4, total: 4 }).mood, 'thinking');
    assert.deepEqual(
      [setupCompanion({ isPreparing: false, isValid: true, completed: 4, total: 4 }).mood, setupCompanion({ isPreparing: false, isValid: true, completed: 4, total: 4 }).label],
      ['idle', 'Ready to initiate']
    );
    assert.equal(setupCompanion({ isPreparing: false, isValid: false, completed: 2, total: 4 }).label, '2/4 configured');
  });
});

describe('Coach chunk loading', () => {
  const Coach = () => null;

  it('uses the 3D coach when the chunk loads', async () => {
    assert.equal(await loadCoachWithFallback(async () => Coach, 0), Coach);
  });

  it('retries once after a failed chunk load', async () => {
    let calls = 0;
    const result = await loadCoachWithFallback(async () => {
      calls += 1;
      if (calls === 1) throw new Error('ChunkLoadError');
      return Coach;
    }, 0);
    assert.equal(result, Coach);
    assert.equal(calls, 2);
  });

  it('falls back to the static coach when the retry also fails', async () => {
    let calls = 0;
    const result = await loadCoachWithFallback(async () => {
      calls += 1;
      throw new Error('ChunkLoadError');
    }, 0);
    assert.equal(result, CoachStaticFallback);
    assert.equal(calls, 2);
  });

  it('renders a compact static companion for small panels', () => {
    const html = renderToStaticMarkup(React.createElement(CoachStaticFallback, { variant: 'compact' }));
    assert.match(html, /role="img"/);
    assert.match(html, /aria-label="IntervAI coach"/);
    assert.doesNotMatch(html, /w-64/, 'not the large hero fallback');
  });
});
