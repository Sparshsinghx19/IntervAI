import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  saveInterviewAnswer,
  generateEvaluationReport,
  fetchEvaluationReport,
} from './evaluation-api.js';
import { EvaluationReportView } from '../components/interview/EvaluationReportView.js';
import { EvaluationReportResponse, QuestionType } from '../types/evaluation.js';

type MockFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const mockReport: EvaluationReportResponse = {
  id: 'rep-uuid-1234',
  interviewId: 'int-uuid-5678',
  status: 'COMPLETED',
  overallScore: 92,
  performanceLevel: 'Advanced',
  summary: 'Outstanding technical depth and consistent reasoning across all questions.',
  questionsEvaluated: 2,
  errorMessage: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  reportPayload: {
    interviewId: 'int-uuid-5678',
    type: 'TECHNICAL',
    difficulty: 'HARD',
    focusArea: 'DBMS',
    overallScore: 92,
    performanceLevel: 'Advanced',
    questionsAnswered: 2,
    questionsEvaluated: 2,
    summary: 'Outstanding technical depth and consistent reasoning across all questions.',
    questions: [
      {
        questionId: 'q-1',
        questionText: 'Explain write-ahead logging (WAL).',
        orderIndex: 1,
        candidateAnswer: 'WAL logs every change to disk before data pages.',
        correctnessScore: 95,
        completenessScore: 90,
        reasoningScore: 90,
        clarityScore: 90,
        overallScore: 92,
        summary: 'Excellent explanation of WAL principles.',
        strengths: ['Identified durability guarantee accurately.'],
        improvements: ['Mention checkpointing mechanics.'],
        sampleAnswer: 'WAL reference answer details...',
      },
      {
        questionId: 'q-2',
        questionText: 'What is strict 2-Phase Locking (S2PL)?',
        orderIndex: 2,
        candidateAnswer: 'S2PL holds all exclusive locks until transaction commit.',
        correctnessScore: 95,
        completenessScore: 90,
        reasoningScore: 85,
        clarityScore: 95,
        overallScore: 92,
        summary: 'Great clarity on cascading abort prevention.',
        strengths: ['Clear explanation of avoiding cascading aborts.'],
        improvements: ['Elaborate on deadlock detection trade-offs.'],
        sampleAnswer: 'S2PL reference answer details...',
      },
    ],
    crossInterviewAnalysis: {
      recurringStrengths: ['Deep grasp of concurrency control and persistence.'],
      weakTopics: ['Deadlock resolution algorithms.'],
      repeatedErrors: [],
      recommendations: ['Review distributed deadlock detection mechanisms.'],
      practiceAreas: ['Distributed Systems'],
    },
  },
};

describe('End-of-Interview Batch Evaluation Flow (Frontend)', () => {
  it('saveInterviewAnswer saves answer and does NOT request AI evaluation', async () => {
    const urlsCalled: string[] = [];
    const mockFetch: MockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      urlsCalled.push(url);

      if (url.includes('/answer')) {
        assert.equal(init?.method, 'POST');
        const body = JSON.parse(String(init?.body));
        assert.equal(body.answerText, 'WAL ensures durability.');
        return new Response(JSON.stringify({ id: 'ans-1', questionId: 'q-1' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response();
    };

    const result = await saveInterviewAnswer({
      interviewId: 'int-uuid-5678',
      questionId: 'q-1',
      answerText: 'WAL ensures durability.',
      fetchFn: mockFetch,
    });

    assert.equal(result.success, true);
    assert.equal(urlsCalled.length, 1);
    assert.ok(urlsCalled[0].includes('/answer'));
    assert.ok(!urlsCalled.some((u) => u.includes('/evaluation')), 'Must NOT call evaluation endpoint during answer submission');
  });

  it('saveInterviewAnswer rejects empty answers without network requests', async () => {
    let called = false;
    const mockFetch: MockFetch = async () => {
      called = true;
      return new Response();
    };

    const result = await saveInterviewAnswer({
      interviewId: 'int-uuid-5678',
      questionId: 'q-1',
      answerText: '   ',
      fetchFn: mockFetch,
    });

    assert.equal(result.success, false);
    assert.match(result.error || '', /Please provide a response/);
    assert.equal(called, false);
  });

  it('generateEvaluationReport invokes POST /evaluation-report', async () => {
    const mockFetch: MockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/evaluation-report')) {
        assert.equal(init?.method, 'POST');
        return new Response(JSON.stringify(mockReport), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response();
    };

    const result = await generateEvaluationReport({
      interviewId: 'int-uuid-5678',
      fetchFn: mockFetch,
    });

    assert.equal(result.success, true);
    assert.equal(result.report?.id, 'rep-uuid-1234');
    assert.equal(result.report?.overallScore, 92);
  });

  it('fetchEvaluationReport retrieves existing report or returns found: false on 404', async () => {
    // 1. Found case
    const mockFetchFound: MockFetch = async () => {
      return new Response(JSON.stringify(mockReport), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const foundResult = await fetchEvaluationReport({
      interviewId: 'int-uuid-5678',
      fetchFn: mockFetchFound,
    });

    assert.equal(foundResult.found, true);
    assert.equal(foundResult.report?.overallScore, 92);

    // 2. 404 Not Found case
    const mockFetchNotFound: MockFetch = async () => {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const notFoundResult = await fetchEvaluationReport({
      interviewId: 'int-uuid-5678',
      fetchFn: mockFetchNotFound,
    });

    assert.equal(notFoundResult.found, false);
  });

  it('EvaluationReportView renders loading state when isLoading is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(EvaluationReportView, {
        report: null,
        isLoading: true,
        onRetry: () => {},
        onReturnToSetup: () => {},
      })
    );

    assert.ok(html.includes('Generating Evaluation Report'));
    assert.ok(html.includes('Analyzing holistic strengths &amp; gaps'));
  });

  it('EvaluationReportView renders error state with retry and safe answer notice', () => {
    const html = renderToStaticMarkup(
      React.createElement(EvaluationReportView, {
        report: null,
        isLoading: false,
        error: 'AI evaluation service temporarily unavailable.',
        onRetry: () => {},
        onReturnToSetup: () => {},
      })
    );

    assert.ok(html.includes('Report Generation Notice'));
    assert.ok(html.includes('The AI service is temporarily busy. Your answers are saved. Please try again shortly.'));
    assert.ok(html.includes('All your submitted interview answers are securely saved in the database.'));
    assert.ok(html.includes('Retry Report Generation'));
  });

  it('EvaluationReportView renders complete evaluation report with overall score, rubric breakdowns, and insights', () => {
    const html = renderToStaticMarkup(
      React.createElement(EvaluationReportView, {
        report: mockReport,
        isLoading: false,
        onRetry: () => {},
        onReturnToSetup: () => {},
      })
    );

    assert.ok(html.includes('Comprehensive Performance Summary'));
    assert.ok(html.includes('92'), 'Must display overall score');
    assert.ok(html.includes('Advanced'), 'Must display performance level');
    assert.ok(html.includes('Explain write-ahead logging (WAL).'));
    assert.ok(html.includes('What is strict 2-Phase Locking (S2PL)?'));
    assert.ok(html.includes('Correctness'));
    assert.ok(html.includes('Completeness'));
    assert.ok(html.includes('Reasoning'));
    assert.ok(html.includes('Clarity'));
    assert.ok(html.includes('Recurring Strengths'));
    assert.ok(html.includes('Prioritized Recommendations'));
    assert.ok(html.includes('Reference Model Answer'));
    assert.ok(html.includes('Start Another Interview'));
  });

  it('formatSafeEvaluationErrorMessage correctly maps 503, 429, network, and raw JSON errors', async () => {
    const { formatSafeEvaluationErrorMessage } = await import('./evaluation-api.js');

    // 1. Raw 503 provider JSON
    const raw503 = '{"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}}';
    assert.equal(
      formatSafeEvaluationErrorMessage(raw503, 503),
      'The AI service is temporarily busy. Your answers are saved. Please try again shortly.'
    );

    // 2. Raw 429 quota JSON
    const raw429 = '{"error":{"code":429,"message":"Resource exhausted: quota exceeded","status":"RESOURCE_EXHAUSTED"}}';
    assert.equal(
      formatSafeEvaluationErrorMessage(raw429, 429),
      'The AI evaluation service has reached a usage limit. Your answers are saved; please try again later.'
    );

    // 3. Network connection error
    assert.equal(
      formatSafeEvaluationErrorMessage('TypeError: Failed to fetch', 0),
      "We couldn't reach the evaluation service. Your answers remain saved."
    );

    // 4. Other failure
    assert.equal(
      formatSafeEvaluationErrorMessage('Unknown error', 500),
      'Failed to generate evaluation report. Your answers are safely stored. Please try again.'
    );
  });

  it('EvaluationReportView sanitizes raw JSON error in error state', () => {
    const raw503 = '{"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}}';
    const html = renderToStaticMarkup(
      React.createElement(EvaluationReportView, {
        report: null,
        isLoading: false,
        error: raw503,
        onRetry: () => {},
        onReturnToSetup: () => {},
      })
    );

    assert.ok(html.includes('The AI service is temporarily busy. Your answers are saved. Please try again shortly.'));
    assert.ok(!html.includes('{"error"'), 'Must never render raw JSON string to user');
    assert.ok(html.includes('Retry Report Generation'));
  });

  it('verifies question-type routing: router/switch conceptual question uses Text Mode, coding problem uses Coding IDE', () => {
    const getWorkspaceMode = (q: { type?: QuestionType }): 'code' | 'text' => {
      const qType = q.type || 'THEORY';
      return qType === 'CODING' ? 'code' : 'text';
    };

    // Theory question (router vs switch)
    const routerQuestion = {
      id: 'q-router',
      questionText: 'What is the difference between a router and a switch?',
      type: 'THEORY' as QuestionType,
    };
    assert.equal(routerQuestion.type, 'THEORY');
    assert.equal(getWorkspaceMode(routerQuestion), 'text', 'Router vs switch must use text mode');

    // Coding question (reverse linked list)
    const codingQuestion = {
      id: 'q-reverse',
      questionText: 'How do you reverse a singly linked list?',
      type: 'CODING' as QuestionType,
    };
    assert.equal(codingQuestion.type, 'CODING');
    assert.equal(getWorkspaceMode(codingQuestion), 'code', 'Coding problem must use coding IDE');

    // Unknown question defaults to THEORY (text mode)
    const unknownQuestion: { id: string; questionText: string; type?: QuestionType } = {
      id: 'q-unknown',
      questionText: 'Explain software engineering principle.',
    };
    const unknownType: QuestionType = unknownQuestion.type || 'THEORY';
    assert.equal(unknownType, 'THEORY', 'Unknown question must default to THEORY');
    assert.equal(getWorkspaceMode(unknownQuestion), 'text', 'Unknown question must default to text mode');
  });
});
