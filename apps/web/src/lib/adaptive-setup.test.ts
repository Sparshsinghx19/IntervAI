import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  buildCreatePayload,
  checkResumeFile,
  parseResumeFile,
  parseResumeText,
  questionOriginLabel,
  recommendedMode,
  ResumeProfile,
  SetupState,
  validateSetup,
} from './adaptive-setup';
import { ResumeInput } from '../components/interview/ResumeInput';

const PROFILE: ResumeProfile = {
  headline: 'Backend engineer',
  skills: ['TypeScript', 'PostgreSQL'],
  projects: [{ name: 'Order service', summary: 'Event-driven orders.', technologies: ['Kafka'], highlights: [] }],
  experience: [{ title: 'Software Engineer', summary: 'Payments APIs.', technologies: ['Node.js'] }],
};

const setup = (overrides: Partial<SetupState> = {}): SetupState => ({
  mode: 'TOPIC',
  interviewType: 'technical',
  difficulty: 'medium',
  focusArea: 'dbms',
  targetRole: '',
  durationMinutes: 30,
  questionTypes: ['THEORY'],
  resumeProfile: null,
  ...overrides,
});

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('Interview setup validation', () => {
  it('validates a topic interview', () => {
    assert.equal(validateSetup(setup()), null);
    assert.match(validateSetup(setup({ focusArea: '' }))!, /focus area/);
    assert.match(validateSetup(setup({ interviewType: '' }))!, /interview type/);
  });

  it('requires a role and a resume for resume interviews', () => {
    const resume = setup({ mode: 'RESUME', focusArea: '', interviewType: '' });
    assert.match(validateSetup(resume)!, /role/);
    assert.match(validateSetup({ ...resume, targetRole: 'Backend Engineer' })!, /resume/);
    assert.equal(validateSetup({ ...resume, targetRole: 'Backend Engineer', resumeProfile: PROFILE }), null);
  });

  it('requires a subject for mixed interviews and a theory or design question type', () => {
    const mixed = setup({ mode: 'MIXED', targetRole: 'Backend Engineer', resumeProfile: PROFILE, focusArea: '' });
    assert.match(validateSetup(mixed)!, /subject/);
    assert.match(validateSetup({ ...mixed, focusArea: 'dsa', questionTypes: ['CODING'] })!, /Theory or System Design/);
    assert.match(validateSetup({ ...mixed, focusArea: 'dsa', questionTypes: [] })!, /at least one/);
    assert.equal(validateSetup({ ...mixed, focusArea: 'dsa', questionTypes: ['THEORY', 'CODING'] }), null);
  });

  it('recommends mixed when both a resume and a subject are present', () => {
    assert.equal(recommendedMode(true, true), 'MIXED');
    assert.equal(recommendedMode(true, false), 'RESUME');
    assert.equal(recommendedMode(false, true), 'TOPIC');
  });

  it('sends only the fields each mode needs', () => {
    const topic = buildCreatePayload(setup());
    assert.deepEqual(topic, { mode: 'TOPIC', type: 'technical', difficulty: 'medium', focusArea: 'dbms', durationMinutes: 30 });

    const resume = buildCreatePayload(setup({ mode: 'RESUME', targetRole: ' Backend Engineer ', resumeProfile: PROFILE }));
    assert.equal(resume.targetRole, 'Backend Engineer');
    assert.equal(resume.resumeProfile, PROFILE);
    assert.ok(!('focusArea' in resume));

    const mixed = buildCreatePayload(setup({ mode: 'MIXED', targetRole: 'Engineer', resumeProfile: PROFILE, questionTypes: ['THEORY', 'CODING'] }));
    assert.equal(mixed.focusArea, 'dbms');
    assert.deepEqual(mixed.questionTypes, ['THEORY', 'CODING']);
  });
});

describe('Resume upload', () => {
  beforeEach(() => mock.restoreAll());

  it('accepts PDF and DOCX up to 2 MB and rejects other files before uploading', () => {
    assert.deepEqual(checkResumeFile({ name: 'cv.PDF', size: 1000, type: '' }), { ok: true, mime: 'application/pdf' });
    assert.equal(checkResumeFile({ name: 'cv.docx', size: 1000, type: '' }).ok, true);
    assert.equal(checkResumeFile({ name: 'cv.doc', size: 1000, type: '' }).ok, false);
    assert.equal(checkResumeFile({ name: 'cv.pdf', size: 3 * 1024 * 1024, type: '' }).ok, false);
    assert.equal(checkResumeFile({ name: 'cv.pdf', size: 0, type: '' }).ok, false);
  });

  it('uploads the file with its type and the session cookie, and returns the profile', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => jsonResponse(200, { profile: PROFILE }));
    const file = Object.assign(new Blob(['%PDF-1.4']), { name: 'cv.pdf' });
    const result = await parseResumeFile(file, { apiUrl: 'http://api' });
    assert.deepEqual(result, { ok: true, profile: PROFILE });
    const [url, init] = fetchMock.mock.calls[0].arguments as [string, RequestInit];
    assert.equal(url, 'http://api/api/interviews/resume/parse');
    assert.equal((init.headers as Record<string, string>)['Content-Type'], 'application/pdf');
    assert.equal(init.credentials, 'include');
  });

  it('reports server messages, rate limits and short text clearly', async () => {
    const unreadable = await parseResumeText('x'.repeat(100), { fetchFn: (async () => jsonResponse(422, { error: 'We couldn’t find skills.' })) as unknown as typeof fetch });
    assert.deepEqual(unreadable, { ok: false, error: 'We couldn’t find skills.' });
    const limited = await parseResumeText('x'.repeat(100), { fetchFn: (async () => jsonResponse(429, {})) as unknown as typeof fetch });
    assert.match(!limited.ok ? limited.error : '', /wait/);
    const short = await parseResumeText('too short');
    assert.equal(short.ok, false);
  });
});

describe('Resume input and question origin', () => {
  it('shows the upload choice before a resume is added', () => {
    const html = renderToStaticMarkup(React.createElement(ResumeInput, { profile: null, onProfile: () => undefined }));
    assert.match(html, /Choose a PDF or Word/);
    assert.match(html, /role="tablist"/);
  });

  it('shows the extracted profile and says what is kept', () => {
    const html = renderToStaticMarkup(React.createElement(ResumeInput, { profile: PROFILE, onProfile: () => undefined }));
    assert.match(html, /TypeScript/);
    assert.match(html, /Order service/);
    assert.match(html, /Software Engineer/);
    assert.match(html, /aren(&#x27;|')t stored/);
  });

  it('labels where a question came from', () => {
    assert.equal(questionOriginLabel('RESUME', 'RESUME_DEEP_DIVE'), 'Based on your resume');
    assert.equal(questionOriginLabel('RESUME', 'SCENARIO'), 'Scenario · based on your resume');
    assert.equal(questionOriginLabel('RESUME', 'INTRODUCTION'), 'Introduction');
    assert.equal(questionOriginLabel('CURATED', 'TECHNICAL'), 'From the question bank');
    assert.equal(questionOriginLabel('CURATED', null), null, 'legacy questions carry no label');
    assert.equal(questionOriginLabel('SUBJECT', 'TECHNICAL', true), 'Researched for this topic');
    assert.equal(questionOriginLabel('SUBJECT', 'TECHNICAL', false), 'Written for this topic');
  });
});
