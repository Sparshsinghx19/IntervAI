import { gemini } from '../../infrastructure/gemini.js';
import { envConfig } from '../../config/env.js';
import type { ResumeProfile } from './resume-intake.service.js';
import { cleanText } from './resume-intake.service.js';

/**
 * Web research for an interview plan, using Gemini's Google Search grounding.
 *
 * Runs once, when the interview is created. Its output (a small source
 * registry plus short notes linked to those sources) is persisted with the
 * plan; nothing here runs again on load, resume or report.
 *
 * Authenticity: sources come only from the SDK's `groundingMetadata`
 * (groundingChunks of a response made with the googleSearch tool), never from
 * text the model wrote. Notes are the grounded segments from
 * `groundingSupports`, each linked to the chunk indices Google reported.
 *
 * Privacy: queries are built from generic technology terms only. The resume's
 * text, project names/summaries, roles and any personal details never reach
 * the search prompt.
 */

export const RESEARCH_MAX_SOURCES = 6;
export const RESEARCH_MAX_NOTES = 16;
export const RESEARCH_MAX_TERMS = 6;
const NOTE_MAX_CHARS = 280;
const SUMMARY_MAX_CHARS = 200;

export interface ResearchSource {
  /** Stable id within this interview's plan (S1, S2, …). */
  id: string;
  title: string;
  url: string;
  domain: string;
  retrievedAt: string;
  /** First grounded statement this source supported (short, factual). */
  summary: string | null;
}

export interface ResearchNote {
  text: string;
  sourceIds: string[];
}

export type ResearchResult =
  | {
      status: 'grounded';
      retrievedAt: string;
      terms: string[];
      searchQueries: string[];
      sources: ResearchSource[];
      notes: ResearchNote[];
    }
  | {
      status: 'unavailable' | 'inadequate' | 'not_configured';
      retrievedAt: string;
      terms: string[];
      reason: string;
    };

export interface ResearchRequest {
  mode: 'TOPIC' | 'RESUME' | 'MIXED';
  /** Subject label, e.g. "Database Management Systems". */
  subject: string | null;
  targetRole: string | null;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  profile: ResumeProfile | null;
}

// ---------- Query terms (privacy boundary) ----------

/**
 * A "technology term" is short and generic: letters, digits and a few symbols
 * used in technology names (C++, C#, Node.js, CI/CD). Anything that looks like
 * contact details, an identifier or prose is dropped.
 */
const TECH_TERM = /^[A-Za-z][A-Za-z0-9+#./ -]{0,29}$/;
const looksPersonal = (t: string) => /@|https?:|www\.|\d{4,}/.test(t);

export function toTechTerm(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/\s+/g, ' ').trim();
  if (!t || looksPersonal(t) || !TECH_TERM.test(t) || t.split(' ').length > 3) return null;
  return t;
}

/** Generic role words only ("Senior Backend Engineer"), never free text. */
export function toRoleTerm(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/\s+/g, ' ').trim();
  if (!t || looksPersonal(t) || !/^[A-Za-z][A-Za-z /&+-]{1,59}$/.test(t) || t.split(' ').length > 5) return null;
  return t;
}

/**
 * Terms to research. From a resume we take declared skills and project
 * technologies — not project names, summaries, highlights or roles.
 */
export function researchTerms(req: ResearchRequest): string[] {
  const terms: string[] = [];
  const add = (t: string | null) => {
    if (t && !terms.some((x) => x.toLowerCase() === t.toLowerCase())) terms.push(t);
  };
  if (req.mode !== 'RESUME') add(toTechTerm(req.subject));
  if (req.profile && req.mode !== 'TOPIC') {
    const fromProjects = req.profile.projects.flatMap((p) => p.technologies);
    for (const raw of [...fromProjects, ...req.profile.skills]) {
      if (terms.length >= RESEARCH_MAX_TERMS) break;
      add(toTechTerm(raw));
    }
  }
  return terms.slice(0, RESEARCH_MAX_TERMS);
}

/** The only text sent to the search-grounded model. Contains no candidate data. */
export function buildResearchPrompt(req: ResearchRequest, terms: string[]): string {
  const role = toRoleTerm(req.targetRole) ?? 'software engineer';
  return [
    `Research current, technically accurate concepts that a ${req.difficulty.toLowerCase()}-level ${role} interview could assess, for these topics: ${terms.join(', ')}.`,
    'Prefer official documentation and technically authoritative sources; use interview-preparation material only as a supplement.',
    'Write 8 to 12 short factual statements about important concepts, trade-offs and common pitfalls. Do not write interview questions or answers.',
  ].join('\n');
}

// ---------- Sources from grounding metadata ----------

/** Low-signal domains we do not cite. */
const BLOCKED_DOMAINS = ['pinterest.', 'facebook.com', 'instagram.com', 'tiktok.com', 'quora.com'];

/** The Gemini API returns grounding links through this redirect host. */
export const GROUNDING_REDIRECT_HOST = 'vertexaisearch.cloud.google.com';

export function normalizeUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password) return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

const domainFromTitle = (title: string): string | null =>
  /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(title.trim()) ? title.trim().toLowerCase() : null;

type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, 'status' | 'headers'>>;

/**
 * Turns a Google grounding redirect link into the destination URL by reading
 * the redirect's Location header (no request is made to the destination).
 * Any other URL is returned unchanged.
 */
export async function resolveSourceUrl(url: URL, fetchFn: FetchLike = fetch as FetchLike, timeoutMs = 3000): Promise<URL> {
  if (url.hostname !== GROUNDING_REDIRECT_HOST) return url;
  try {
    const res = await fetchFn(url.toString(), { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    const target = location ? normalizeUrl(location) : null;
    return target && target.protocol === 'https:' ? target : url;
  } catch {
    return url;
  }
}

/**
 * Builds the source registry and grounded notes from SDK grounding metadata.
 * Only chunks with a valid web URI are kept; notes reference sources by the
 * chunk indices Google attached to each grounded segment.
 */
export async function extractGrounding(
  metadata: any,
  retrievedAt: string,
  fetchFn?: FetchLike
): Promise<{ sources: ResearchSource[]; notes: ResearchNote[]; searchQueries: string[] }> {
  const chunks: any[] = Array.isArray(metadata?.groundingChunks) ? metadata.groundingChunks : [];
  const supports: any[] = Array.isArray(metadata?.groundingSupports) ? metadata.groundingSupports : [];
  const searchQueries = (Array.isArray(metadata?.webSearchQueries) ? metadata.webSearchQueries : [])
    .filter((q: unknown): q is string => typeof q === 'string')
    .slice(0, 8)
    .map((q: string) => q.slice(0, 200));

  // chunk index -> source id
  const idByChunk = new Map<number, string>();
  const sources: ResearchSource[] = [];
  const seen = new Set<string>();

  const candidates = await Promise.all(
    chunks.map(async (chunk, index) => {
      const raw = normalizeUrl(chunk?.web?.uri);
      if (!raw) return null;
      const url = await resolveSourceUrl(raw, fetchFn);
      const title = cleanText(chunk?.web?.title, 160);
      const domain =
        url.hostname !== GROUNDING_REDIRECT_HOST
          ? url.hostname.replace(/^www\./, '').toLowerCase()
          : domainFromTitle(title) ?? '';
      return { index, url, title, domain };
    })
  );

  for (const c of candidates) {
    if (!c || !c.domain || !c.title) continue;
    if (BLOCKED_DOMAINS.some((d) => c.domain.includes(d))) continue;
    const key = `${c.domain}|${c.url.pathname}`;
    if (seen.has(key)) {
      const existing = sources.find((s) => `${s.domain}|${new URL(s.url).pathname}` === key);
      if (existing) idByChunk.set(c.index, existing.id);
      continue;
    }
    if (sources.length >= RESEARCH_MAX_SOURCES) continue;
    seen.add(key);
    const id = `S${sources.length + 1}`;
    idByChunk.set(c.index, id);
    sources.push({ id, title: c.title, url: c.url.toString(), domain: c.domain, retrievedAt, summary: null });
  }

  const notes: ResearchNote[] = [];
  for (const support of supports) {
    if (notes.length >= RESEARCH_MAX_NOTES) break;
    // Grounded segments often start with list markers ("* ", "- ", "1. ").
    const text = cleanText(support?.segment?.text, NOTE_MAX_CHARS).replace(/^(?:[*•\-–]+|\d+[.)])\s+/, '');
    const ids: string[] = [];
    for (const i of Array.isArray(support?.groundingChunkIndices) ? support.groundingChunkIndices : []) {
      const id = idByChunk.get(i);
      if (id && !ids.includes(id)) ids.push(id);
    }
    if (text.length < 20 || ids.length === 0) continue;
    notes.push({ text, sourceIds: ids });
    for (const id of ids) {
      const s = sources.find((x) => x.id === id);
      if (s && !s.summary) s.summary = text.slice(0, SUMMARY_MAX_CHARS);
    }
  }

  // Keep only sources that actually support at least one note.
  const used = new Set(notes.flatMap((n) => n.sourceIds));
  return { sources: sources.filter((s) => used.has(s.id)), notes, searchQueries };
}

type GenerateContent = typeof gemini.models.generateContent;

export const interviewResearchService = {
  /** One grounded search for the plan. Never throws: failures return a non-grounded status. */
  research: async (
    req: ResearchRequest,
    deps: { generate?: GenerateContent; fetchFn?: FetchLike; now?: () => Date } = {}
  ): Promise<ResearchResult> => {
    const retrievedAt = (deps.now ?? (() => new Date()))().toISOString();
    const terms = researchTerms(req);
    if (terms.length === 0) {
      return { status: 'inadequate', retrievedAt, terms, reason: 'No technical topics to research.' };
    }
    if (!envConfig.gemini.apiKey) {
      return { status: 'not_configured', retrievedAt, terms, reason: 'GEMINI_API_KEY is not configured.' };
    }

    const generate = deps.generate ?? ((args) => gemini.models.generateContent(args));
    let response: any;
    try {
      response = await generate({
        model: envConfig.gemini.model,
        contents: buildResearchPrompt(req, terms),
        config: { tools: [{ googleSearch: {} }], temperature: 0.2 },
      });
    } catch {
      return { status: 'unavailable', retrievedAt, terms, reason: 'Web research is temporarily unavailable.' };
    }

    const metadata = response?.candidates?.[0]?.groundingMetadata;
    if (!metadata) {
      return { status: 'inadequate', retrievedAt, terms, reason: 'The search returned no grounding information.' };
    }
    const { sources, notes, searchQueries } = await extractGrounding(metadata, retrievedAt, deps.fetchFn);
    if (sources.length < 2 || notes.length < 2) {
      return { status: 'inadequate', retrievedAt, terms, reason: 'Not enough usable sources were found.' };
    }
    return { status: 'grounded', retrievedAt, terms, searchQueries, sources, notes };
  },
};
