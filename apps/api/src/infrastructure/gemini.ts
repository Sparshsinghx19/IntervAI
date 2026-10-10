import { GoogleGenAI } from '@google/genai';
import { envConfig } from '../config/env.js';

export const gemini = new GoogleGenAI({
  apiKey: envConfig.gemini.apiKey
});
