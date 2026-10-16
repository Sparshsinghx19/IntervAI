import { envConfig } from '../../config/env.js';
import { SupportedLanguage } from './coding.types.js';

export class RunnerUnavailableError extends Error {
  constructor(message: string = 'The code execution runner is currently unavailable. Please check the runner configuration.') {
    super(message);
    this.name = 'RunnerUnavailableError';
  }
}

export interface Judge0SubmissionPayload {
  language_id: number;
  source_code: string;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  wall_time_limit?: number;
  memory_limit?: number;
}

export interface RawJudge0Submission {
  token: string;
  status_id?: number;
  status?: { id: number; description: string };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  time?: string | null;
  memory?: number | null;
}

export interface ExecutionResultItem {
  testIndex: number;
  passed: boolean;
  status: string;
  actualOutput?: string;
  executionTimeMs?: number;
  memoryKb?: number;
  errorMessage?: string;
  compileOutput?: string;
}

export interface BatchExecutionResponse {
  overallStatus: string;
  testsPassed: number;
  totalTests: number;
  results: ExecutionResultItem[];
  compileOutput?: string;
}

export class Judge0Service {
  private baseUrl: string;
  private authToken?: string;
  private authHeader: string;
  private cachedLanguages: Map<SupportedLanguage, number> | null = null;
  private customFetch?: typeof fetch;

  // Enforced execution limits
  public static readonly MAX_SOURCE_LENGTH = 64 * 1024; // 64 KB
  public static readonly MAX_TEST_CASES = 25;
  public static readonly CPU_TIME_LIMIT = 2.0; // 2 seconds
  public static readonly WALL_TIME_LIMIT = 5.0; // 5 seconds
  public static readonly MEMORY_LIMIT = 128000; // 128 MB in KB

  constructor(options?: {
    baseUrl?: string;
    authToken?: string;
    authHeader?: string;
    fetch?: typeof fetch;
  }) {
    this.baseUrl = options?.baseUrl ?? envConfig.judge0.baseUrl;
    this.authToken = options?.authToken ?? envConfig.judge0.authToken;
    this.authHeader = options?.authHeader ?? envConfig.judge0.authHeader;
    this.customFetch = options?.fetch;
  }

  private getFetch(): typeof fetch {
    return this.customFetch || fetch;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.authToken) {
      headers[this.authHeader] = this.authToken;
    }
    return headers;
  }

  public isConfigured(): boolean {
    if (process.env.NODE_ENV === 'production') {
      return Boolean(process.env.JUDGE0_BASE_URL);
    }
    return Boolean(this.baseUrl);
  }

  public clearLanguageCache(): void {
    this.cachedLanguages = null;
  }

  public setCachedLanguages(map: Map<SupportedLanguage, number>): void {
    this.cachedLanguages = new Map(map);
  }

  /**
   * Resolves language IDs dynamically from the Judge0 /languages endpoint.
   * Caches results in memory to avoid repeated network overhead.
   */
  public async resolveLanguageId(language: SupportedLanguage): Promise<number> {
    if (!['cpp', 'python', 'java'].includes(language)) {
      throw new Error(`Unsupported execution language requested: ${language}`);
    }

    if (this.cachedLanguages && this.cachedLanguages.has(language)) {
      return this.cachedLanguages.get(language)!;
    }

    if (!this.isConfigured()) {
      throw new RunnerUnavailableError('Code execution provider is not configured for this environment.');
    }

    const fetchFn = this.getFetch();
    let data: Array<{ id: number; name: string }>;

    try {
      const res = await fetchFn(`${this.baseUrl.replace(/\/+$/, '')}/languages`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        throw new RunnerUnavailableError(`Runner returned ${res.status} while fetching available languages.`);
      }

      data = await res.json();
    } catch (err: any) {
      if (err instanceof RunnerUnavailableError) throw err;
      throw new RunnerUnavailableError(`Unable to connect to code execution runner at ${this.baseUrl}: ${err.message || 'Connection failed'}`);
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new RunnerUnavailableError('Runner returned invalid language list.');
    }

    const mapping = new Map<SupportedLanguage, number>();

    // 1. C++ match (prefer GCC or modern C++)
    const cppEntry = data.find(l => /c\+\+/i.test(l.name) && /gcc/i.test(l.name)) ||
      data.find(l => /c\+\+/i.test(l.name));
    if (cppEntry) {
      mapping.set('cpp', cppEntry.id);
    }

    // 2. Python match (prefer Python 3)
    const pythonEntry = data.find(l => /python\s*\(?3/i.test(l.name)) ||
      data.find(l => /python/i.test(l.name));
    if (pythonEntry) {
      mapping.set('python', pythonEntry.id);
    }

    // 3. Java match (prefer OpenJDK)
    const javaEntry = data.find(l => /java/i.test(l.name) && /openjdk/i.test(l.name)) ||
      data.find(l => /java/i.test(l.name));
    if (javaEntry) {
      mapping.set('java', javaEntry.id);
    }

    this.cachedLanguages = mapping;

    const resolved = mapping.get(language);
    if (!resolved) {
      throw new RunnerUnavailableError(`Language '${language}' is not installed or available on the configured execution runner.`);
    }

    return resolved;
  }

  /**
   * Normalizes stdout and expected output for fair whitespace comparison:
   * Replaces Windows \r\n with \n, trims line-ending spaces and trailing blank lines.
   */
  public normalizeOutput(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+$/gm, '')
      .trimEnd();
  }

  private decodeBase64(str?: string | null): string {
    if (!str) return '';
    try {
      return Buffer.from(str, 'base64').toString('utf-8');
    } catch {
      return str;
    }
  }

  private encodeBase64(str: string): string {
    return Buffer.from(str, 'utf-8').toString('base64');
  }

  /**
   * Executes a batch of test cases asynchronously against Judge0.
   * Submits via POST /submissions/batch?base64_encoded=true,
   * polls GET /submissions/batch with bounded attempts,
   * and returns structured results.
   */
  public async executeBatch(options: {
    language: SupportedLanguage;
    sourceCode: string;
    testCases: Array<{ input: string; expectedOutput: string }>;
  }): Promise<BatchExecutionResponse> {
    if (!options.sourceCode || options.sourceCode.trim() === '') {
      throw new Error('Source code cannot be empty.');
    }

    if (options.sourceCode.length > Judge0Service.MAX_SOURCE_LENGTH) {
      throw new Error(`Source code exceeds maximum allowed size of ${Judge0Service.MAX_SOURCE_LENGTH / 1024}KB.`);
    }

    if (!options.testCases || options.testCases.length === 0) {
      throw new Error('At least one test case must be provided for execution.');
    }

    if (options.testCases.length > Judge0Service.MAX_TEST_CASES) {
      throw new Error(`Exceeded maximum test cases limit (${Judge0Service.MAX_TEST_CASES}).`);
    }

    const languageId = await this.resolveLanguageId(options.language);
    const fetchFn = this.getFetch();
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, '');

    const submissions: Judge0SubmissionPayload[] = options.testCases.map(tc => ({
      language_id: languageId,
      source_code: this.encodeBase64(options.sourceCode),
      stdin: this.encodeBase64(tc.input),
      expected_output: this.encodeBase64(tc.expectedOutput),
      cpu_time_limit: Judge0Service.CPU_TIME_LIMIT,
      wall_time_limit: Judge0Service.WALL_TIME_LIMIT,
      memory_limit: Judge0Service.MEMORY_LIMIT,
    }));

    let initialTokens: Array<{ token: string }>;

    try {
      const submitRes = await fetchFn(`${cleanBaseUrl}/submissions/batch?base64_encoded=true`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ submissions }),
      });

      if (submitRes.status === 429 || submitRes.status === 503) {
        throw new RunnerUnavailableError('Execution runner is currently at capacity. Please retry in a few moments.');
      }

      if (!submitRes.ok) {
        throw new RunnerUnavailableError(`Runner submission rejected with status ${submitRes.status}.`);
      }

      initialTokens = await submitRes.json();
    } catch (err: any) {
      if (err instanceof RunnerUnavailableError) throw err;
      throw new RunnerUnavailableError(`Failed to submit code to runner: ${err.message || 'Connection error'}`);
    }

    if (!Array.isArray(initialTokens) || initialTokens.length === 0) {
      throw new RunnerUnavailableError('Runner did not return submission tokens.');
    }

    const tokens = initialTokens.map(t => t.token);
    const tokensParam = tokens.join(',');

    // Polling loop with bounded timeout
    const maxPollAttempts = 25;
    const pollIntervalMs = 300;
    let pollResults: RawJudge0Submission[] = [];
    let allFinished = false;

    for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
      // Bounded delay between poll attempts
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

      try {
        const pollRes = await fetchFn(
          `${cleanBaseUrl}/submissions/batch?tokens=${tokensParam}&base64_encoded=true&fields=token,status_id,status,stdout,stderr,compile_output,time,memory`,
          {
            method: 'GET',
            headers: this.getHeaders(),
          }
        );

        if (pollRes.status === 429 || pollRes.status === 503) {
          continue; // transient queue pressure, retry next tick
        }

        if (!pollRes.ok) {
          throw new RunnerUnavailableError(`Runner poll failed with status ${pollRes.status}.`);
        }

        const pollData = await pollRes.json();
        pollResults = Array.isArray(pollData) ? pollData : pollData.submissions || [];

        // Check if every submission reached terminal state (status_id > 2)
        const inProgress = pollResults.some(item => {
          const sId = item.status_id ?? item.status?.id ?? 1;
          return sId <= 2; // 1: In Queue, 2: Processing
        });

        if (!inProgress && pollResults.length === tokens.length) {
          allFinished = true;
          break;
        }
      } catch (err: any) {
        if (err instanceof RunnerUnavailableError) throw err;
        // Network fluctuation during poll, retry unless final attempt
        if (attempt === maxPollAttempts - 1) {
          throw new RunnerUnavailableError(`Runner polling interrupted: ${err.message}`);
        }
      }
    }

    // Map results in original test case order
    const tokenToResultMap = new Map<string, RawJudge0Submission>();
    for (const resItem of pollResults) {
      if (resItem.token) {
        tokenToResultMap.set(resItem.token, resItem);
      }
    }

    const items: ExecutionResultItem[] = [];
    let testsPassed = 0;
    let sharedCompileOutput: string | undefined = undefined;

    for (let i = 0; i < options.testCases.length; i++) {
      const tc = options.testCases[i];
      const token = tokens[i];
      const raw = token ? tokenToResultMap.get(token) : undefined;

      if (!raw) {
        items.push({
          testIndex: i,
          passed: false,
          status: 'Time Limit Exceeded',
          actualOutput: '',
          errorMessage: 'Execution timed out before completion.',
        });
        continue;
      }

      const statusId = raw.status_id ?? raw.status?.id ?? 0;
      const statusDesc = raw.status?.description || 'Unknown';
      const actualStdout = this.decodeBase64(raw.stdout);
      const stderr = this.decodeBase64(raw.stderr);
      const compileOutput = this.decodeBase64(raw.compile_output);

      if (compileOutput && !sharedCompileOutput) {
        sharedCompileOutput = compileOutput;
      }

      const execTimeMs = raw.time ? Math.round(parseFloat(raw.time) * 1000) : undefined;
      const memoryKb = raw.memory ? Math.round(raw.memory) : undefined;

      // Status mapping
      if (statusId === 6) {
        // Compilation Error
        items.push({
          testIndex: i,
          passed: false,
          status: 'Compilation Error',
          actualOutput: '',
          compileOutput: compileOutput || stderr,
          errorMessage: stderr || compileOutput,
          executionTimeMs: execTimeMs,
          memoryKb,
        });
      } else if (statusId === 5) {
        // Time Limit Exceeded
        items.push({
          testIndex: i,
          passed: false,
          status: 'Time Limit Exceeded',
          actualOutput: actualStdout,
          errorMessage: 'Time limit exceeded.',
          executionTimeMs: execTimeMs,
          memoryKb,
        });
      } else if (statusId >= 7 && statusId <= 12) {
        // Runtime Errors
        items.push({
          testIndex: i,
          passed: false,
          status: 'Runtime Error',
          actualOutput: actualStdout,
          errorMessage: stderr || statusDesc,
          executionTimeMs: execTimeMs,
          memoryKb,
        });
      } else if (statusId === 13 || statusId === 14) {
        // Internal / Exec format error
        items.push({
          testIndex: i,
          passed: false,
          status: 'Internal Error',
          actualOutput: actualStdout,
          errorMessage: stderr || 'Internal execution runner error.',
          executionTimeMs: execTimeMs,
          memoryKb,
        });
      } else if (statusId <= 2) {
        // Still in queue or processing after timeout
        items.push({
          testIndex: i,
          passed: false,
          status: 'Time Limit Exceeded',
          actualOutput: '',
          errorMessage: 'Execution timed out waiting in runner queue.',
          executionTimeMs: execTimeMs,
          memoryKb,
        });
      } else {
        // Output verification (Judge0 status 3: Accepted, 4: Wrong Answer)
        const normalizedActual = this.normalizeOutput(actualStdout);
        const normalizedExpected = this.normalizeOutput(tc.expectedOutput);
        const passed = normalizedActual === normalizedExpected;

        if (passed) {
          testsPassed++;
          items.push({
            testIndex: i,
            passed: true,
            status: 'Accepted',
            actualOutput: actualStdout,
            executionTimeMs: execTimeMs,
            memoryKb,
          });
        } else {
          items.push({
            testIndex: i,
            passed: false,
            status: 'Wrong Answer',
            actualOutput: actualStdout,
            executionTimeMs: execTimeMs,
            memoryKb,
          });
        }
      }
    }

    // Determine overall status
    let overallStatus = 'Accepted';
    if (items.some(r => r.status === 'Compilation Error')) {
      overallStatus = 'Compilation Error';
    } else if (items.some(r => r.status === 'Runtime Error')) {
      overallStatus = 'Runtime Error';
    } else if (items.some(r => r.status === 'Time Limit Exceeded')) {
      overallStatus = 'Time Limit Exceeded';
    } else if (items.some(r => r.status === 'Internal Error')) {
      overallStatus = 'Internal Error';
    } else if (testsPassed < items.length) {
      overallStatus = 'Wrong Answer';
    }

    return {
      overallStatus,
      testsPassed,
      totalTests: items.length,
      results: items,
      compileOutput: sharedCompileOutput,
    };
  }
}

export const judge0Service = new Judge0Service();
