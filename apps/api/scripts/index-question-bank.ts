import crypto from 'node:crypto';
import { qdrant } from '../src/infrastructure/qdrant.js';
import { embedTexts } from '../src/modules/ai/embedding.service.js';
import { questionBank, QuestionBankEntry } from '../src/modules/ai/question-bank.js';

const COLLECTION_NAME = 'intervai_question_bank';
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

function getHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function runIndexer() {
  try {
    console.log(`Checking collection '${COLLECTION_NAME}'...`);
    let collectionExists = false;

    try {
      const info = await qdrant.getCollection(COLLECTION_NAME);
      collectionExists = true;
      
      const vectors = info.config.params.vectors;
      if (!vectors) {
        throw new Error('Incompatible collection configuration: missing vector parameters.');
      }
      
      if ('size' in vectors && 'distance' in vectors) {
        if (vectors.size !== EMBEDDING_DIMENSIONS || vectors.distance !== 'Cosine') {
          throw new Error(`Incompatible collection configuration: expected size ${EMBEDDING_DIMENSIONS} and distance Cosine.`);
        }
      } else {
        throw new Error('Incompatible collection configuration: expected unnamed vectors.');
      }
    } catch (error: any) {
      if (error.status === 404 || error.message?.includes('Not Found')) {
        collectionExists = false;
      } else {
        throw error;
      }
    }

    if (!collectionExists) {
      console.log(`Creating collection '${COLLECTION_NAME}'...`);
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: {
          size: EMBEDDING_DIMENSIONS,
          distance: 'Cosine'
        }
      });
    }

    // Ensure payload indexes exist
    console.log('Ensuring payload indexes for topic and difficulty...');
    const createIndexSafely = async (field_name: string) => {
      try {
        await qdrant.createPayloadIndex(COLLECTION_NAME, { field_name, field_schema: 'keyword', wait: true });
      } catch (e: any) {
        const errorMsg = typeof e?.status === 'object' ? e.status.error : (e?.message || '');
        if (typeof errorMsg === 'string' && errorMsg.toLowerCase().includes('already exists')) {
          // Safe to ignore
        } else {
          throw e;
        }
      }
    };
    
    await createIndexSafely('topic');
    await createIndexSafely('difficulty');

    // Fetch existing points to determine delta
    console.log('Fetching existing points to calculate delta...');
    // We only have 30 questions, so limit 100 is sufficient to get all points.
    let existingPoints: any[] = [];
    if (collectionExists) {
      let offset: string | number | Record<string, unknown> | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const scrollRes = await qdrant.scroll(COLLECTION_NAME, {
          limit: 100,
          offset,
          with_payload: true,
          with_vector: false
        });

        if (scrollRes.points && scrollRes.points.length > 0) {
          existingPoints.push(...scrollRes.points);
        }

        if (scrollRes.next_page_offset !== undefined && scrollRes.next_page_offset !== null) {
          offset = scrollRes.next_page_offset;
        } else {
          hasMore = false;
        }
      }
    }

    const toEmbed: QuestionBankEntry[] = [];
    const toUpdateMetadata: QuestionBankEntry[] = [];
    let upToDateCount = 0;

    for (const q of questionBank) {
      const hash = getHash(q.questionText);
      const existing = existingPoints.find(p => p.id === q.id);

      if (!existing) {
        toEmbed.push(q);
      } else {
        const payload = existing.payload || {};
        if (
          payload.contentHash !== hash ||
          payload.embeddingModel !== EMBEDDING_MODEL ||
          payload.embeddingDimensions !== EMBEDDING_DIMENSIONS
        ) {
          toEmbed.push(q);
        } else {
          // Check if metadata changed
          if (
            payload.topic !== q.topic ||
            payload.subtopic !== q.subtopic ||
            payload.difficulty !== q.difficulty ||
            JSON.stringify(payload.tags) !== JSON.stringify(q.tags) ||
            payload.questionText !== q.questionText
          ) {
            toUpdateMetadata.push(q);
          } else {
            upToDateCount++;
          }
        }
      }
    }

    console.log(`Delta: ${toEmbed.length} need embedding, ${toUpdateMetadata.length} need metadata updates, ${upToDateCount} up to date.`);

    // 1. Process Metadata-Only Updates
    if (toUpdateMetadata.length > 0) {
      console.log(`Updating metadata for ${toUpdateMetadata.length} points...`);
      for (const q of toUpdateMetadata) {
        await qdrant.setPayload(COLLECTION_NAME, {
          wait: true,
          points: [q.id],
          payload: {
            questionId: q.id,
            questionText: q.questionText,
            topic: q.topic,
            subtopic: q.subtopic,
            difficulty: q.difficulty,
            tags: q.tags,
            contentHash: getHash(q.questionText),
            embeddingModel: EMBEDDING_MODEL,
            embeddingDimensions: EMBEDDING_DIMENSIONS
          }
        });
      }
    }

    // 2. Process New Embeddings
    if (toEmbed.length > 0) {
      console.log(`Generating embeddings for ${toEmbed.length} points using single batch request...`);
      const textsToEmbed = toEmbed.map(q => q.questionText);
      const vectors = await embedTexts(textsToEmbed, 'RETRIEVAL_DOCUMENT');

      const pointsToUpsert = toEmbed.map((q, index) => ({
        id: q.id,
        vector: vectors[index],
        payload: {
          questionId: q.id,
          questionText: q.questionText,
          topic: q.topic,
          subtopic: q.subtopic,
          difficulty: q.difficulty,
          tags: q.tags,
          contentHash: getHash(q.questionText),
          embeddingModel: EMBEDDING_MODEL,
          embeddingDimensions: EMBEDDING_DIMENSIONS
        }
      }));

      console.log('Upserting new vectors and payloads to Qdrant...');
      await qdrant.upsert(COLLECTION_NAME, {
        wait: true,
        points: pointsToUpsert
      });
      console.log(`Successfully upserted ${pointsToUpsert.length} embedded points.`);
    }

    if (toEmbed.length === 0 && toUpdateMetadata.length === 0) {
      console.log('The question bank index is already up to date. No API requests were made.');
    } else {
      console.log('Indexing complete.');
    }

  } catch (error: any) {
    console.error(`Diagnostic Error: ${error.message || 'Unknown error occurred.'}`);
    process.exit(1);
  }
}

runIndexer();
