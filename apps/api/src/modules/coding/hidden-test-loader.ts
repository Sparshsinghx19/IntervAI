import * as fs from 'fs';
import * as path from 'path';
import { db } from '../../prisma/db.js';

export interface HiddenTestCase {
  id?: string;
  problemSlug: string;
  input: string;
  expectedOutput: string;
  orderIndex?: number;
}

export class HiddenTestLoader {
  private privateSeedPath: string;

  constructor(customPath?: string) {
    this.privateSeedPath = customPath ||
      process.env.PRIVATE_HIDDEN_TESTS_FILE ||
      path.resolve(process.cwd(), 'data/private-hidden-tests.json');
  }

  /**
   * Retrieves hidden test cases for a given problem slug.
   * Priority:
   * 1. Database table `CodingTestCase` (server-side private storage)
   * 2. Local unversioned file (`apps/api/data/private-hidden-tests.json`, protected by .gitignore)
   */
  public async getHiddenTestCases(problemSlug: string): Promise<HiddenTestCase[]> {
    // 1. Try PostgreSQL database table
    try {
      const dbCases = await db.orm.public.CodingTestCase
        .where({
          problemSlug,
          isHidden: true,
        })
        .all();

      if (dbCases && dbCases.length > 0) {
        return dbCases
          .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0))
          .map((tc: any) => ({
            id: tc.id,
            problemSlug: tc.problemSlug,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            orderIndex: tc.orderIndex,
          }));
      }
    } catch (err) {
      console.warn(`[HiddenTestLoader] Database lookup for problem '${problemSlug}' failed:`, err);
    }

    // 2. Try unversioned local private seed file
    try {
      if (fs.existsSync(this.privateSeedPath)) {
        const fileContent = fs.readFileSync(this.privateSeedPath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        if (Array.isArray(parsed)) {
          const matching = parsed.filter(
            (item: any) => item.problemSlug === problemSlug && item.input && item.expectedOutput
          );
          if (matching.length > 0) {
            return matching
              .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0))
              .map((item: any, idx: number) => ({
                id: item.id || `private-${problemSlug}-${idx}`,
                problemSlug: item.problemSlug,
                input: item.input,
                expectedOutput: item.expectedOutput,
                orderIndex: item.orderIndex ?? idx,
              }));
          }
        }
      }
    } catch (err) {
      console.warn(`[HiddenTestLoader] Private file lookup at '${this.privateSeedPath}' failed:`, err);
    }

    return [];
  }

  /**
   * Determines if hidden test cases are configured and available for a problem slug.
   */
  public async hasHiddenTests(problemSlug: string): Promise<boolean> {
    const cases = await this.getHiddenTestCases(problemSlug);
    return cases.length > 0;
  }

  /**
   * Optional administrative utility to seed private hidden test cases into PostgreSQL
   * from an external private seed file or json array.
   */
  public async seedPrivateTests(cases: HiddenTestCase[]): Promise<number> {
    let inserted = 0;
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      await db.orm.public.CodingTestCase.create({
        problemSlug: c.problemSlug,
        input: c.input,
        expectedOutput: c.expectedOutput,
        isHidden: true,
        orderIndex: c.orderIndex ?? i,
      });
      inserted++;
    }
    return inserted;
  }
}

export const hiddenTestLoader = new HiddenTestLoader();
