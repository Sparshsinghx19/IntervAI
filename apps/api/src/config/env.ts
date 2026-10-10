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
  };
  qdrant: {
    url: string;
    apiKey: string;
  };
}

const loadConfig = (): Config => {
  return {
    gemini: {
      apiKey: getEnvVar('GEMINI_API_KEY'),
    },
    qdrant: {
      url: getEnvVar('QDRANT_URL'),
      apiKey: getEnvVar('QDRANT_API_KEY'),
    }
  };
};

export const envConfig: Readonly<Config> = Object.freeze(loadConfig());
