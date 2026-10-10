import { gemini } from '../../infrastructure/gemini.js';

const EXPECTED_DIMENSIONS = 768;

export type EmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

/**
 * Generates embeddings for an array of texts in a single batch request.
 * The embedding is a numerical representation used for semantic similarity search.
 */
export async function embedTexts(texts: string[], taskType: EmbeddingTaskType): Promise<number[][]> {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('An array of texts is required for batch embedding.');
  }

  for (const text of texts) {
    if (!text || text.trim() === '') {
      throw new Error('Texts provided for embedding must not be empty or whitespace.');
    }
  }

  const response = await gemini.models.embedContent({
    model: 'gemini-embedding-001',
    contents: texts,
    config: {
      outputDimensionality: EXPECTED_DIMENSIONS,
      taskType: taskType
    }
  });

  const embeddings = response.embeddings;
  
  if (!embeddings || !Array.isArray(embeddings)) {
    throw new Error('Failed to generate embeddings: Gemini did not return a valid array of embeddings.');
  }

  if (embeddings.length !== texts.length) {
    throw new Error(`Failed to generate embeddings: expected ${texts.length} vectors, but received ${embeddings.length}.`);
  }

  const result: number[][] = [];

  for (const emb of embeddings) {
    const values = emb.values;
    if (!values || !Array.isArray(values)) {
      throw new Error('Failed to generate embeddings: Gemini returned an invalid vector format.');
    }
    
    if (values.length !== EXPECTED_DIMENSIONS) {
      throw new Error(`Failed to generate embeddings: expected ${EXPECTED_DIMENSIONS} dimensions, but received ${values.length}.`);
    }

    if (!values.every(Number.isFinite)) {
      throw new Error('Failed to generate embeddings: response contains invalid non-finite numbers.');
    }

    result.push(values);
  }

  return result;
}

/**
 * Generates an embedding for a single text.
 * The embedding is a numerical representation used for semantic similarity search.
 */
export async function embedText(text: string): Promise<number[]> {
  const vectors = await embedTexts([text], 'RETRIEVAL_QUERY');
  return vectors[0];
}
