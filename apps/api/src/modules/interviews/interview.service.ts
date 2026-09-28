import { db } from '../../prisma/db.js';
import { questionGenerationService } from './question-generation.service.js';

interface CreateInterviewData {
  type: 'TECHNICAL' | 'BEHAVIORAL' | 'HR';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  focusArea: string;
  questionCount: number;
}

export const interviewService = {
  createInterview: async (data: CreateInterviewData) => {
    return await db.transaction(async (tx) => {
      // Construct the Prisma 8 INSERT plan for the interview
      const plan = tx.sql.public.interview
        .insert([data])
        .returning('id', 'type', 'difficulty', 'focusArea', 'questionCount', 'status', 'createdAt', 'updatedAt')
        .build();

      const [interview] = await tx.query(plan);

      if (interview) {
        // Generate questions
        const questionsData = questionGenerationService.generateQuestions(
          data.focusArea,
          data.difficulty,
          data.questionCount,
          interview.id
        );

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
      .select('id', 'questionText', 'orderIndex')
      .where((f, fns) => fns.eq(f.interviewId, interviewId))
      .orderBy((f) => f.orderIndex, { direction: 'asc' })
      .build();

    const questions = await db.runtime().query(plan);
    return questions;
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
      const questionIds = questions.map(q => q.id);
      
      const answersRes = await tx.orm.public.Answer
        .where((a) => a.questionId.in(questionIds))
        .aggregate((agg) => ({
          count: agg.count()
        }));

      if (answersRes.count >= interview.questionCount) {
        await tx.orm.public.Interview.where({ id: interviewId }).update({ status: 'COMPLETED' });
      }

      return answer;
    });
  }
};
