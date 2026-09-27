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
        .returning('id', 'type', 'difficulty', 'focusArea', 'questionCount', 'createdAt', 'updatedAt')
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
      .select('id', 'type', 'difficulty', 'focusArea', 'questionCount', 'createdAt', 'updatedAt')
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
  }
};
