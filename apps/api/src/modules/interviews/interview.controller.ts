import { Request, Response } from 'express';
import { interviewService } from './interview.service.js';
import { DEFAULT_DURATION_MINUTES, interviewLifecycle, isValidDuration } from './interview-lifecycle.service.js';
import { PlannedQuestion, PlanQuestionType, PlanUnavailableError, questionCountForDuration, questionPlanService } from './question-plan.service.js';
import { ResumeIntakeError, resumeIntakeService, sanitizeResumeProfile } from './resume-intake.service.js';
import { interviewResearchService, ResearchResult } from './interview-research.service.js';
import { subjectLabel } from './question-plan.service.js';
import { IN_PROGRESS_DEFAULT_LIMIT, IN_PROGRESS_MAX_LIMIT, interviewProgressService } from './interview-progress.service.js';
import { HISTORY_DEFAULT_LIMIT, HISTORY_MAX_LIMIT, interviewHistoryService } from './interview-history.service.js';

const VALID_TYPES = ['TECHNICAL', 'BEHAVIORAL', 'HR'] as const;
const VALID_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;

type InterviewType = typeof VALID_TYPES[number];
type InterviewDifficulty = typeof VALID_DIFFICULTIES[number];

const typeMap: Record<string, InterviewType> = {
  technical: 'TECHNICAL',
  behavioral: 'BEHAVIORAL',
  hr: 'HR',
  TECHNICAL: 'TECHNICAL',
  BEHAVIORAL: 'BEHAVIORAL',
  HR: 'HR',
};

const difficultyMap: Record<string, InterviewDifficulty> = {
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
};

const CLIENT_REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;
const readClientRequestId = (raw: unknown): string | null =>
  typeof raw === 'string' && CLIENT_REQUEST_ID.test(raw) ? raw : null;

/**
 * What is kept from research: status, generic search terms, the queries Google
 * reported, and the bounded source registry. Notes and page text are not kept.
 */
export const persistedResearch = (r: ResearchResult) =>
  r.status === 'grounded'
    ? { status: r.status, retrievedAt: r.retrievedAt, terms: r.terms, searchQueries: r.searchQueries, sources: r.sources }
    : { status: r.status, retrievedAt: r.retrievedAt, terms: r.terms, reason: r.reason };

export const interviewController = {
  /**
   * GET /api/interviews/history: the signed-in user's completed interviews with saved reports.
   * The user always comes from the session; there is no user parameter.
   */
  /**
   * GET /api/interviews/in-progress: the signed-in user's unfinished interviews, most recent activity first.
   */
  getInProgressInterviews: async (req: Request, res: Response) => {
    const ownerId = req.principal?.userId;
    if (!ownerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let limit = IN_PROGRESS_DEFAULT_LIMIT;
    if (req.query.limit !== undefined) {
      const parsed = Number(req.query.limit);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > IN_PROGRESS_MAX_LIMIT) {
        return res.status(400).json({ error: `limit must be an integer between 1 and ${IN_PROGRESS_MAX_LIMIT}` });
      }
      limit = parsed;
    }

    try {
      const interviews = await interviewProgressService.listInProgress(ownerId, limit);
      return res.status(200).json({ interviews, limit });
    } catch (error: any) {
      console.error('Failed to load in-progress interviews:', error?.name || 'Error');
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * GET /api/interviews/:id/progress: saved answers and latest code for an owned interview, used to resume it.
   */
  getInterviewProgress: async (req: Request, res: Response) => {
    try {
      const progress = await interviewProgressService.getProgress(String(req.params.id));
      if (!progress) {
        return res.status(404).json({ error: 'Interview not found' });
      }
      return res.status(200).json(progress);
    } catch (error: any) {
      console.error('Failed to load interview progress:', error?.name || 'Error');
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * GET /api/interviews/summary: dashboard metrics for the signed-in user only.
   */
  getDashboardSummary: async (req: Request, res: Response) => {
    const ownerId = req.principal?.userId;
    if (!ownerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      const summary = await interviewHistoryService.getDashboardSummary(ownerId);
      return res.status(200).json(summary);
    } catch (error: any) {
      console.error('Failed to load dashboard summary:', error?.name || 'Error');
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  getInterviewHistory: async (req: Request, res: Response) => {
    const ownerId = req.principal?.userId;
    if (!ownerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let limit = HISTORY_DEFAULT_LIMIT;
    if (req.query.limit !== undefined) {
      const parsed = Number(req.query.limit);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > HISTORY_MAX_LIMIT) {
        return res.status(400).json({ error: `limit must be an integer between 1 and ${HISTORY_MAX_LIMIT}` });
      }
      limit = parsed;
    }

    try {
      const reports = await interviewHistoryService.listCompletedReports(ownerId, limit);
      return res.status(200).json({ reports, limit });
    } catch (error: any) {
      console.error('Failed to load interview history:', error?.name || 'Error');
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  createInterview: async (req: Request, res: Response) => {
    try {
      // The owner always comes from the authenticated session, never from the body.
      const ownerId = req.principal?.userId;
      if (!ownerId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { type, difficulty, focusArea, durationMinutes } = req.body ?? {};
      let { questionCount } = req.body ?? {};
      const mode = req.body?.mode ?? 'TOPIC';

      if (durationMinutes !== undefined && durationMinutes !== null && !isValidDuration(durationMinutes)) {
        return res.status(400).json({ error: 'durationMinutes must be one of 15, 30, 45 or 60' });
      }
      if (!['TOPIC', 'RESUME', 'MIXED'].includes(mode)) {
        return res.status(400).json({ error: 'mode must be one of TOPIC, RESUME, MIXED' });
      }

      if (mode === 'RESUME' || mode === 'MIXED') {
        return interviewController.createPlannedInterview(req, res, ownerId, mode);
      }

      // Topic interviews may give a duration instead of a question count.
      if (questionCount === undefined && isValidDuration(durationMinutes)) {
        questionCount = questionCountForDuration(durationMinutes);
      }
      
      // Basic invalid input handling
      if (!type || !difficulty || !focusArea || questionCount === undefined) {
        return res.status(400).json({ error: 'Missing required fields: type, difficulty, focusArea, questionCount' });
      }

      if (typeof questionCount !== 'number' || questionCount <= 0 || !Number.isInteger(questionCount)) {
        return res.status(400).json({ error: 'questionCount must be a positive integer' });
      }

      const normalizedType = typeMap[String(type).toLowerCase()];
      if (!normalizedType) {
        return res.status(400).json({ error: `Invalid type. Must be one of: TECHNICAL, BEHAVIORAL, HR` });
      }

      const normalizedDifficulty = difficultyMap[String(difficulty).toLowerCase()];
      if (!normalizedDifficulty) {
        return res.status(400).json({ error: `Invalid difficulty. Must be one of: EASY, MEDIUM, HARD` });
      }

      const clientRequestId = readClientRequestId(req.body?.clientRequestId);
      if (clientRequestId) {
        // A retried request returns the interview it already created (no new research or questions).
        const existing = await interviewService.findByClientRequestId(ownerId, clientRequestId);
        if (existing) return res.status(200).json(existing);
      }

      const targetRole = typeof req.body?.targetRole === 'string' ? req.body.targetRole.trim().slice(0, 100) || null : null;

      // Research once, then plan. If research is not grounded or planning fails,
      // the original curated/retrieval path builds the interview instead.
      const research = await interviewResearchService.research({
        mode: 'TOPIC',
        subject: subjectLabel(String(focusArea)),
        targetRole,
        difficulty: normalizedDifficulty,
        profile: null,
      });
      let plannedQuestions: PlannedQuestion[] | undefined;
      let planner: Record<string, unknown> = { generator: 'curated', reason: research.status === 'grounded' ? 'planning-failed' : 'research-' + research.status };
      if (research.status === 'grounded') {
        try {
          const plan = await questionPlanService.buildPlan({
            mode: 'TOPIC',
            difficulty: normalizedDifficulty,
            durationMinutes: isValidDuration(durationMinutes) ? durationMinutes : DEFAULT_DURATION_MINUTES,
            questionCount,
            targetRole: targetRole ?? '',
            focusArea: String(focusArea),
            questionTypes: ['THEORY'],
            profile: null,
            research,
          });
          plannedQuestions = plan.questions;
          planner = { generator: plan.generator, generatedAt: plan.generatedAt };
        } catch (planError: any) {
          if (!(planError instanceof PlanUnavailableError)) throw planError;
        }
      }

      // Call the service
      const newInterview = await interviewService.createInterview({
        type: normalizedType,
        difficulty: normalizedDifficulty,
        focusArea: String(focusArea),
        questionCount: plannedQuestions ? plannedQuestions.length : questionCount,
        ownerId,
        durationMinutes: durationMinutes ?? null,
        mode: 'TOPIC',
        targetRole,
        planContext: {
          planner,
          research: persistedResearch(research),
          ...(clientRequestId ? { clientRequestId } : {}),
        },
        plannedQuestions,
      });
      
      // Return appropriate JSON response
      res.status(201).json(newInterview);
    } catch (error: any) {
      console.error('Failed to create interview:', error?.name || 'Error');
      if (
        error?.code === 'ECONNREFUSED' ||
        (Array.isArray(error?.errors) && error.errors.some((e: any) => e?.code === 'ECONNREFUSED'))
      ) {
        return res.status(503).json({ error: 'Database service is currently unavailable. Please ensure database is running.' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Resume-based or mixed interview: validate, build the ordered question plan
   * (model call happens before any database transaction), then persist it.
   */
  createPlannedInterview: async (req: Request, res: Response, ownerId: string, mode: 'RESUME' | 'MIXED') => {
    const body = req.body ?? {};
    const errors: string[] = [];

    const difficulty = difficultyMap[String(body.difficulty ?? '').toLowerCase()];
    if (!difficulty) errors.push('Choose a difficulty: EASY, MEDIUM or HARD.');

    const targetRole = typeof body.targetRole === 'string' ? body.targetRole.trim() : '';
    if (targetRole.length < 2 || targetRole.length > 100) errors.push('Enter a target role (2–100 characters).');

    const duration = body.durationMinutes ?? DEFAULT_DURATION_MINUTES;
    if (!isValidDuration(duration)) errors.push('durationMinutes must be one of 15, 30, 45 or 60.');

    const allowedTypes: PlanQuestionType[] = ['THEORY', 'CODING', 'SYSTEM_DESIGN'];
    const questionTypes: PlanQuestionType[] = Array.isArray(body.questionTypes) && body.questionTypes.length
      ? body.questionTypes
      : ['THEORY'];
    if (!questionTypes.every((t: unknown) => allowedTypes.includes(t as PlanQuestionType))) {
      errors.push('questionTypes may only contain THEORY, CODING and SYSTEM_DESIGN.');
    } else if (!questionTypes.includes('THEORY') && !questionTypes.includes('SYSTEM_DESIGN')) {
      errors.push('Resume questions need Theory or System Design questions to be enabled.');
    }

    const subject = typeof body.focusArea === 'string' ? body.focusArea.trim() : '';
    if (mode === 'MIXED' && (subject.length < 2 || subject.length > 60)) {
      errors.push('A mixed interview needs a subject or focus area.');
    }

    // The profile comes back from the client, so it is validated again here.
    const profile = sanitizeResumeProfile(body.resumeProfile);
    if (!profile) errors.push('Add your resume first: we need its skills, projects or experience to plan questions.');

    if (errors.length) {
      return res.status(400).json({ error: errors[0], errors });
    }

    const type = typeMap[String(body.type ?? 'technical').toLowerCase()] ?? 'TECHNICAL';
    const clientRequestId = readClientRequestId(body.clientRequestId);

    try {
      if (clientRequestId) {
        const existing = await interviewService.findByClientRequestId(ownerId, clientRequestId);
        if (existing) return res.status(200).json(existing);
      }

      // Research failures are not fatal: the plan is then built without sources.
      const research = await interviewResearchService.research({
        mode,
        subject: mode === 'MIXED' ? subjectLabel(subject) : null,
        targetRole,
        difficulty: difficulty!,
        profile: profile!,
      });

      const plan = await questionPlanService.buildPlan({
        mode,
        difficulty: difficulty!,
        durationMinutes: duration,
        targetRole,
        focusArea: mode === 'MIXED' ? subject : null,
        questionTypes,
        profile: profile!,
        research,
      });

      const interview = await interviewService.createInterview({
        type,
        difficulty: difficulty!,
        focusArea: mode === 'MIXED' ? subject : targetRole,
        questionCount: plan.questions.length,
        ownerId,
        durationMinutes: duration,
        mode,
        targetRole,
        planContext: {
          questionTypes,
          resumeProfile: profile,
          planner: { generator: plan.generator, generatedAt: plan.generatedAt },
          research: persistedResearch(research),
          ...(clientRequestId ? { clientRequestId } : {}),
        },
        plannedQuestions: plan.questions,
      });
      return res.status(201).json(interview);
    } catch (error: any) {
      if (error instanceof PlanUnavailableError) {
        return res.status(503).json({ error: error.message, code: error.code });
      }
      console.error('Failed to create planned interview:', error?.name || 'Error');
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * POST /api/interviews/resume/parse: a PDF/DOCX body (raw) or JSON {text}.
   * Returns the extracted profile for the candidate to review; nothing is stored.
   */
  parseResume: async (req: Request, res: Response) => {
    try {
      const profile = Buffer.isBuffer(req.body)
        ? await resumeIntakeService.fromFile(req.body, req.headers['content-type'])
        : await resumeIntakeService.fromText(req.body?.text);
      return res.status(200).json({ profile });
    } catch (error: any) {
      if (error instanceof ResumeIntakeError) {
        return res.status(error.status).json({ error: error.message });
      }
      // Never log resume content: only the error class.
      console.error('Failed to parse resume:', error?.name || 'Error');
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  getInterviewById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Interview ID is required and must be a string' });
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: 'Invalid Interview ID format' });
      }

      const interview = await interviewService.getInterviewById(id as string);

      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
      }

      res.status(200).json(interview);
    } catch (error) {
      console.error('Failed to get interview by ID:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getInterviewQuestions: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Interview ID is required and must be a string' });
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: 'Invalid Interview ID format' });
      }

      // First check if the interview exists
      const interview = await interviewService.getInterviewById(id as string);
      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
      }

      // Get questions
      const questions = await interviewService.getInterviewQuestions(id as string);
      
      res.status(200).json({ questions });
    } catch (error) {
      console.error('Failed to get interview questions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  startInterview: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Interview ID is required and must be a string' });
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: 'Invalid Interview ID format' });
      }

      const interview = await interviewService.startInterview(id);
      res.status(200).json(interview);
    } catch (error: any) {
      console.error('Failed to start interview:', error);
      if (error.message === 'Interview not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Interview cannot be started from this state') {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  submitAnswer: async (req: Request, res: Response) => {
    try {
      const { interviewId, questionId } = req.params;
      const { answerText } = req.body;

      if (!interviewId || !questionId) {
        return res.status(400).json({ error: 'Interview ID and Question ID are required' });
      }
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(interviewId as string) || !uuidRegex.test(questionId as string)) {
        return res.status(400).json({ error: 'Invalid UUID format' });
      }

      if (!answerText || typeof answerText !== 'string' || answerText.trim() === '') {
        return res.status(400).json({ error: 'answerText is required and must be a non-empty string' });
      }

      const answer = await interviewService.submitAnswer(interviewId as string, questionId as string, answerText);
      
      res.status(201).json(answer);
    } catch (error: any) {
      console.error('Failed to submit answer:', error);
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({ error: error.message });
      }
      if (error.code === 'CONFLICT') {
        return res.status(409).json({ error: error.message, reason: error.reason ?? 'COMPLETED' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * POST /api/interviews/:id/finalize: closes a timed interview whose deadline has
   * passed (exactly once). Before the deadline it changes nothing and returns 409.
   */
  finalizeInterview: async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      await interviewLifecycle.expireIfDue(id);
      const interview = await interviewService.getInterviewById(id);
      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
      }
      if (interview.status !== 'COMPLETED') {
        return res.status(409).json({ error: 'The interview time limit has not been reached yet.', timing: interview.timing });
      }
      return res.status(200).json({ status: interview.status, timing: interview.timing });
    } catch (error: any) {
      console.error('Failed to finalize interview:', error?.name || 'Error');
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
};
