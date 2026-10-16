import { db } from '../../prisma/db.js';
import { questionGenerationService } from './question-generation.service.js';
import { retrieveQuestions } from '../ai/question-retrieval.service.js';
import { questionBank, Topic } from '../ai/question-bank.js';
import { findCodingProblemForQuestion } from '../coding/coding-problems.catalog.js';

interface CreateInterviewData {
  type: 'TECHNICAL' | 'BEHAVIORAL' | 'HR';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  focusArea: string;
  questionCount: number;
}

export const interviewService = {
  createInterview: async (data: CreateInterviewData) => {
    let retrievedQuestionsText: string[] | null = null;

    if (data.type === 'TECHNICAL') {
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
        .insert([data])
        .returning('id', 'type', 'difficulty', 'focusArea', 'questionCount', 'status', 'createdAt', 'updatedAt')
        .build();

      const [interview] = await tx.query(plan);

      if (interview) {
        let questionsData;
        
        if (retrievedQuestionsText) {
          questionsData = retrievedQuestionsText.map((text, i) => {
            const entry = questionBank.find(qb => qb.questionText === text);
            let slug = entry?.codingProblemSlug || null;
            if (!slug) {
              const resolved = findCodingProblemForQuestion(text);
              if (resolved) {
                slug = resolved.slug;
              }
            }
            return {
              interviewId: interview.id,
              questionText: text,
              orderIndex: i + 1,
              type: entry?.type || (data.focusArea.toLowerCase() === 'system design' || data.focusArea.toLowerCase() === 'system-design' ? 'SYSTEM_DESIGN' : data.focusArea.toLowerCase() === 'dsa' ? 'CODING' : 'THEORY'),
              codingProblemSlug: slug,
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
    const plan = db.sql.public.interview
      .select('id', 'type', 'difficulty', 'focusArea', 'questionCount', 'status', 'createdAt', 'updatedAt')
      .where((f, fns) => fns.eq(f.id, id))
      .limit(1)
      .build();

    const [interview] = await db.runtime().query(plan);
    
    return interview || null;
  },

  getInterviewQuestions: async (interviewId: string) => {
    const plan = db.sql.public.question
      .select('id', 'questionText', 'orderIndex', 'type', 'codingProblemSlug')
      .where((f, fns) => fns.eq(f.interviewId, interviewId))
      .orderBy((f) => f.orderIndex, { direction: 'asc' })
      .build();

    const questions = await db.runtime().query(plan);
    return questions.map((q: any) => {
      let slug = q.codingProblemSlug;
      if (!slug && q.type === 'CODING') {
        const resolved = findCodingProblemForQuestion(q.questionText);
        if (resolved) {
          slug = resolved.slug;
        }
      }
      return {
        ...q,
        type: q.type || 'THEORY',
        codingProblemSlug: slug || null,
      };
    });
  },

  startInterview: async (id: string) => {
    return await db.transaction(async (tx) => {
      const interview = await tx.orm.public.Interview.first({ id });
      if (!interview) throw new Error('Interview not found');
      if (interview.status !== 'NOT_STARTED') throw new Error('Interview cannot be started from this state');

      await tx.orm.public.Interview.where({ id }).update({ status: 'IN_PROGRESS' });
      
      return await tx.orm.public.Interview.first({ id });
    });
  },

  submitAnswer: async (interviewId: string, questionId: string, answerText: string) => {
    return await db.transaction(async (tx) => {
      const interview = await tx.orm.public.Interview.first({ id: interviewId });
      if (!interview) {
        const error = new Error('Interview not found');
        (error as any).code = 'NOT_FOUND';
        throw error;
      }
      if (interview.status === 'COMPLETED') {
        const error = new Error('Interview is already completed');
        (error as any).code = 'CONFLICT';
        throw error;
      }
      
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
      const theoryQuestions = questions.filter((q: any) => q.type !== 'CODING');
      const codingQuestions = questions.filter((q: any) => q.type === 'CODING');

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
        await tx.orm.public.Interview.where({ id: interviewId }).update({ status: 'COMPLETED' });
      }

      return answer;
    });
  }
};
