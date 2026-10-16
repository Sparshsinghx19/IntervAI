#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/08cb7a5b092eb7e8b2776a2ff29671bc5037a32ba2a07b4b8b0cb363c9f929b8/contract';
import startContract from '../../snapshots/08cb7a5b092eb7e8b2776a2ff29671bc5037a32ba2a07b4b8b0cb363c9f929b8/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/0e038f1a2c53628e5a939510286cf176b89e6a2a22376bee2b5c9c18db6b3854/contract';
import endContract from '../../snapshots/0e038f1a2c53628e5a939510286cf176b89e6a2a22376bee2b5c9c18db6b3854/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@internal/postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'codeSubmission',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('executionTimeMs', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('interviewId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('language', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('memoryKb', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('questionId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('sourceCode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('testResults', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('testsPassed', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('totalTests', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'codingTestCase',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expectedOutput', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('input', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isHidden', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('orderIndex', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('problemSlug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'question',
        column: col('codingProblemSlug', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'codeSubmission',
        index: 'codeSubmission_interviewId_idx_766b64f2',
        columns: ['interviewId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'codeSubmission',
        index: 'codeSubmission_questionId_idx_fdb42076',
        columns: ['questionId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'codeSubmission',
        foreignKey: {
          name: 'codeSubmission_interviewId_fkey',
          columns: ['interviewId'],
          references: { schema: 'public', table: 'interview', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'codeSubmission',
        foreignKey: {
          name: 'codeSubmission_questionId_fkey',
          columns: ['questionId'],
          references: { schema: 'public', table: 'question', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
