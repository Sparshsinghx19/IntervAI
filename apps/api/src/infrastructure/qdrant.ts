import { QdrantClient } from '@qdrant/js-client-rest';
import { envConfig } from '../config/env.js';

export const qdrant = new QdrantClient({
  url: envConfig.qdrant.url,
  apiKey: envConfig.qdrant.apiKey
});
