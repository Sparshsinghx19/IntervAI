import { db } from '../../prisma/db.js';
import { questionGenerationService } from './question-generation.service.js';
import { retrieveQuestions } from '../ai/question-retrieval.service.js';
import { questionBank, Topic } from '../ai/question-bank.js';
import { classifyNewQuestion, effectiveQuestionType, runnableProblemSlug } from '../coding/coding-problems.catalog.js';
import { interviewLifecycle, toTiming } from './interview-lifecycle.service.js';
import type { PlannedQuestion } from './question-plan.service.js';
import { instantFromMs } from '../auth/auth.time.js';

/** Stored sources are re-checked before they reach the browser (http/https only, bounded). */
export function safeSources(raw: unknown): Array<{ id: string; title: string; url: string; domain: string; retrievedAt: string }> | null {
  if (!Array.isArray(raw)) return null;
  const out = raw
    .filter((s: any) => s && typeof s.url === 'string' && typeof s.title === 'string')
    .map((s: any) => {
      try {
        const url = new URL(s.url);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        return {
          id: String(s.id ?? '').slice(0, 8),
          title: String(s.title).slice(0, 160),
          url: url.toString(),
          domain: String(s.domain ?? url.hostname).slice(0, 100),
          retrievedAt: String(s.retrievedAt ?? '').slice(0, 40),
        };
      } catch {
        return null;
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .slice(0, 3);
  return out.length ? out : null;
}

/** What the session may show about research: whether it ran, and how many sources back the plan. */
export function researchSummary(planContext: any): { status: string; sourceCount: number } | null {
  const research = planContext?.research;
  if (!research || typeof research.status !== 'string') return null;
  return { status: research.status, sourceCount: Array.isArray(research.sources) ? research.sources.length : 0 };
}

interface CreateInterviewData {
  type: 'TECHNICAL' | 'BEHAVIORAL' | 'HR';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  focusArea: string;
  questionCount: number;
  ownerId: string;
  /** Time limit in minutes; null/undefined keeps the interview untimed. */
  durationMinutes?: number | null;
  mode?: 'TOPIC' | 'RESUME' | 'MIXED';
  targetRole?: string | null;
  /** Non-sensitive planning context kept with the interview (resume profile, planner info). */
  planContext?: Record<string, unknown> | null;
  /** A pre-built, ordered plan (resume/mixed modes). When given, no retrieval or generator runs. */
  plannedQuestions?: PlannedQuestion[];
}

export const interviewService = {
  createInterview: async (input: CreateInterviewData) => {
    const { plannedQuestions, ...data } = input;
    let retrievedQuestionsText: string[] | null = null;

    if (!plannedQuestions && data.type === 'TECHNICAL') {
      const topicMap: Record<string, Topic> = {
        'dsa': 'DSA',
        'os': 'OS',
        'dbms': 'DBMS',
        'cn': 'CN',
        'networks': 'CN',
        'oop': 'OOP',
        'system design': 'System Design',
        'system-design': 'System Design'
      };
      
      const mappedTopic = topicMap[data.focusArea.toLowerCase()];
      
      if (mappedTopic) {
        try {
          const results = await retrieveQuestions({
            query: `Interview questions about ${data.focusArea}`,
            topic: mappedTopic,
            difficulty: data.difficulty,
            limit: data.questionCount
          });
          
          if (results && results.length === data.questionCount) {
            retrievedQuestionsText = results.map(r => r.questionText);
          } else {
            console.warn(`[Retrieval Warning] Requested ${data.questionCount} questions for ${mappedTopic}, but got ${results?.length || 0}. Falling back to generator.`);
          }
        } catch (error: any) {
          console.warn(`[Retrieval Warning] Semantic retrieval failed: ${error.message || 'Unknown error'}. Falling back to generator.`);
        }
      }
    }

    return await db.transaction(async (tx) => {
      // Construct the Prisma 8 INSERT plan for the interview
      const plan = tx.sql.public.interview
        // planContext is plain JSON (validated profile + planner metadata).
        .insert([{ ...data, planContext: (data.planContext ?? null) as any }])
        .returning('id', 'type', 'difficulty', 'focusArea', 'questionCount', 'status', 'createdAt', 'updatedAt')
        .build();

      const [interview] = await tx.query(plan);

      if (interview) {
        let questionsData;

        if (plannedQuestions) {
          // The plan was built (outside this transaction) before creating the interview.
          questionsData = plannedQuestions.map((q, i) => ({
            interviewId: interview.id,
            questionText: q.questionText,
            orderIndex: i + 1,
            type: q.type,
            codingProblemSlug: q.codingProblemSlug,
            origin: q.origin,
            category: q.category,
            // Validated references to this plan's grounded sources (or none).
            sources: q.sources?.length ? (q.sources as any) : null,
          }));
        } else if (retrievedQuestionsText) {
          questionsData = retrievedQuestionsText.map((text, i) => {
            const entry = questionBank.find(qb => qb.questionText === text);
            const storedType = entry?.type || (data.focusArea.toLowerCase() === 'system design' || data.focusArea.toLowerCase() === 'system-design' ? 'SYSTEM_DESIGN' : data.focusArea.toLowerCase() === 'dsa' ? 'CODING' : 'THEORY');
            // CODING only when a runnable catalog problem backs the question.
            const kind = classifyNewQuestion({ type: storedType, questionText: text, codingProblemSlug: entry?.codingProblemSlug });
            return {
              interviewId: interview.id,
              questionText: text,
              orderIndex: i + 1,
              type: kind.type,
              codingProblemSlug: kind.codingProblemSlug,
            };
          });
        } else {
          // Generate questions fallback
          questionsData = questionGenerationService.generateQuestions(
            data.focusArea,
            data.difficulty,
            data.questionCount,
            interview.id
          );
        }

        // Insert questions using the ORM to let it handle client-side UUIDs and temporal values
        for (const q of questionsData) {
          await tx.orm.public.Question.create(q);
        }
      }
      
      return interview;
    });
  },

  getInterviewById: async (id: string) => {
    // A timed interview past its deadline is finalized here, on the server clock.
    await interviewLifecycle.expireIfDue(id);
    const plan = db.sql.public.interview
      .select('id', 'type', 'difficulty', 'focusArea', 'questionCount', 'status', 'createdAt', 'updatedAt',
        'mode', 'targetRole', 'durationMinutes', 'startedAt', 'deadlineAt', 'completedAt', 'completionReason', 'planContext')
      .where((f, fns) => fns.eq(f.id, id))
      .limit(1)
      .build();

    const [interview] = await db.runtime().query(plan);

    if (!interview) return null;
    // planContext stays server-side; only a research summary is exposed.
    const { planContext, ...rest } = interview as any;
    return { ...rest, timing: toTiming(interview), research: researchSummary(planContext) };
  },

  getInterviewQuestions: async (interviewId: string) => {
    const plan = db.sql.public.question
      .select('id', 'questionText', 'orderIndex', 'type', 'codingProblemSlug', 'origin', 'category', 'sources')
      .where((f, fns) => fns.eq(f.interviewId, interviewId))
      .orderBy((f) => f.orderIndex, { direction: 'asc' })
      .build();

    const questions = await db.runtime().query(plan);
    return questions.map((q: any) => {
      // The session follows the effective type: a stored CODING question with no
      // runnable problem is answered in text and flagged so the UI can say why.
      const type = effectiveQuestionType(q);
      return {
        ...q,
        type,
        codingProblemSlug: type === 'CODING' ? runnableProblemSlug(q) : null,
        codingUnavailable: q.type === 'CODING' && type !== 'CODING',
        sources: safeSources(q.sources),
      };
    });
  },

  /** An interview this owner created recently with the same client request id (retry protection). */
  findByClientRequestId: async (ownerId: string, clientRequestId: string) => {
    const since = instantFromMs(Date.now() - 15 * 60_000);
    const rows = await db.orm.public.Interview
      .where((i) => i.ownerId.eq(ownerId))
      .where((i) => i.createdAt.gt(since))
      .select('id', 'planContext')
      .all();
    const match = (rows as any[]).find((r) => r.planContext?.clientRequestId === clientRequestId);
    return match ? interviewService.getInterviewById(match.id) : null;
  },

  /**
   * Starts the interview clock. Idempotent: refreshes and resumes return the
   * original start time and deadline instead of restarting them.
   */
  startInterview: async (id: string) => {
    await interviewLifecycle.expireIfDue(id);
    const timing = await interviewLifecycle.start(id);
    if (!timing) throw new Error('Interview not found');
    return { id, status: timing.status, timing };
  },

  submitAnswer: async (interviewId: string, questionId: string, answerText: string) => {
    // Finalize first if the deadline already passed, so the submission below is refused.
    await interviewLifecycle.expireIfDue(interviewId);
    return await db.transaction(async (tx) => {
      // Locks the interview row and refuses closed or past-deadline interviews.
      await interviewLifecycle.lockOpenForSubmission(tx, interviewId);
      const interview = (await tx.orm.public.Interview.first({ id: interviewId }))!;

      const question = await tx.orm.public.Question.where({ id: questionId }).first();
      if (!question || question.interviewId !== interviewId) {
        const error = new Error('Question not found or does not belong to this interview');
        (error as any).code = 'NOT_FOUND';
        throw error;
      }

      let answer = await tx.orm.public.Answer.where({ questionId }).first();
      if (answer) {
        const plan = tx.sql.public.answer
          .update({ answerText, submittedAt: new Date() })
          .where((f, fns) => fns.eq(f.id, answer!.id))
          .returning('id', 'questionId', 'answerText', 'submittedAt')
          .build();
        const [updated] = await tx.query(plan);
        answer = updated as any;
      } else {
        answer = await tx.orm.public.Answer.create({ questionId, answerText });
      }

      const questions = await tx.orm.public.Question.where({ interviewId }).all();
      const theoryQuestions = questions.filter((q: any) => effectiveQuestionType(q) !== 'CODING');
      const codingQuestions = questions.filter((q: any) => effectiveQuestionType(q) === 'CODING');

      let theoryAnswered = 0;
      if (theoryQuestions.length > 0) {
        const theoryIds = theoryQuestions.map((q: any) => q.id);
        const ansRes = await tx.orm.public.Answer
          .where((a: any) => a.questionId.in(theoryIds))
          .aggregate((agg: any) => ({ count: agg.count() }));
        theoryAnswered = Number((ansRes as any).count) || 0;
      }

      let codingAnswered = 0;
      if (codingQuestions.length > 0) {
        const codingIds = codingQuestions.map((q: any) => q.id);
        const subs = await tx.orm.public.CodeSubmission
          .where((cs: any) => cs.questionId.in(codingIds))
          .all();
        codingAnswered = new Set(subs.map((s: any) => s.questionId)).size;
      }

      const totalAnswered = theoryAnswered + codingAnswered;
      if (totalAnswered >= interview.questionCount && totalAnswered >= questions.length) {
        await interviewLifecycle.markAllAnswered(tx, interviewId);
      }

      return answer;
    });
  }
};
