import { db } from '../../prisma/db.js';

interface CreateInterviewData {
  type: 'TECHNICAL' | 'BEHAVIORAL' | 'HR';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  focusArea: string;
  questionCount: number;
}

export const interviewService = {
  createInterview: async (data: CreateInterviewData) => {
    // Construct the Prisma 8 INSERT plan
    const plan = db.sql.public.interview
      .insert([data])
      .returning('id', 'type', 'difficulty', 'focusArea', 'questionCount', 'createdAt', 'updatedAt')
      .build();

    // Execute the plan using the Prisma 8 runtime
    const [interview] = await db.runtime().query(plan);
    
    return interview;
  }
};
