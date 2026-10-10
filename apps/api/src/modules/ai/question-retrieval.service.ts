import { embedText } from './embedding.service.js';
import { qdrant } from '../../infrastructure/qdrant.js';
import { Topic, Difficulty } from './question-bank.js';

export interface QuestionRetrievalInput {
  query: string;
  topic?: Topic;
  difficulty?: Difficulty;
  limit: number;
}

export interface RetrievedQuestion {
  id: number;
  questionText: string;
  topic: Topic;
  subtopic: string;
  difficulty: Difficulty;
  tags: string[];
  score: number;
}

const COLLECTION_NAME = 'intervai_question_bank';

export async function retrieveQuestions(input: QuestionRetrievalInput): Promise<RetrievedQuestion[]> {
  if (!input.query || input.query.trim() === '') {
    throw new Error('Search query must not be empty.');
  }

  if (!Number.isInteger(input.limit) || input.limit <= 0) {
    throw new Error('Limit must be a positive integer.');
  }

  // 1. Embed the search query
  // embedText delegates to embedTexts with taskType = "RETRIEVAL_QUERY" automatically
  const queryVector = await embedText(input.query);

  // 2. Build the Qdrant filter
  const mustConditions: any[] = [];
  if (input.topic) {
    mustConditions.push({ key: 'topic', match: { value: input.topic } });
  }
  if (input.difficulty) {
    mustConditions.push({ key: 'difficulty', match: { value: input.difficulty } });
  }

  const searchRequest: any = {
    query: queryVector,
    limit: input.limit,
    with_payload: true,
    with_vector: false
  };

  if (mustConditions.length > 0) {
    searchRequest.filter = { must: mustConditions };
  }

  // 3. Execute semantic search
  const searchResults = await qdrant.query(COLLECTION_NAME, searchRequest);

  // 4. Map the ranked results to a safe typed object
  return searchResults.points.map(res => {
    const p = res.payload as any;
    return {
      id: p.questionId,
      questionText: p.questionText,
      topic: p.topic as Topic,
      subtopic: p.subtopic,
      difficulty: p.difficulty as Difficulty,
      tags: p.tags,
      score: res.score
    };
  });
}
