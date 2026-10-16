import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const getEnvVar = (key: string): string => {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Configuration Error: Missing required environment variable '${key}'. Please ensure it is set and not empty.`);
  }
  return value.trim();
};

export interface Config {
  gemini: {
    apiKey: string;
    model: string;
  };
  qdrant: {
    url: string;
    apiKey: string;
  };
  judge0: {
    baseUrl: string;
    authToken?: string;
    authHeader: string;
  };
}

const loadConfig = (): Config => {
  return {
    gemini: {
      apiKey: getEnvVar('GEMINI_API_KEY'),
      model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
    },
    qdrant: {
      url: getEnvVar('QDRANT_URL'),
      apiKey: getEnvVar('QDRANT_API_KEY'),
    },
    judge0: {
      baseUrl: process.env.JUDGE0_BASE_URL?.trim() || 'http://localhost:2358',
      authToken: process.env.JUDGE0_AUTH_TOKEN?.trim() || undefined,
      authHeader: process.env.JUDGE0_AUTH_HEADER?.trim() || 'X-Auth-Token',
    },
  };
};

export const envConfig: Readonly<Config> = Object.freeze(loadConfig());
