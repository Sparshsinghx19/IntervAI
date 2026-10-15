#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/6252a737fe5abbd9b1f42196b5714ae6c8f232dccb3b628f22966ee6b1fa86d5/contract';
import startContract from '../../snapshots/6252a737fe5abbd9b1f42196b5714ae6c8f232dccb3b628f22966ee6b1fa86d5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9fafa391d7d4b780381b94510a4cdec951c32ef31d23195618f343d207c055c1/contract';
import endContract from '../../snapshots/9fafa391d7d4b780381b94510a4cdec951c32ef31d23195618f343d207c055c1/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@internal/postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'evaluationReport',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('errorMessage', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('interviewId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('overallScore', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('performanceLevel', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('questionsEvaluated', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('reportPayload', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('summary', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'evaluationReport_status_check_04ef721f',
            "\"status\" IN ('PENDING', 'COMPLETED', 'FAILED')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'evaluationReport',
        constraint: 'evaluationReport_interviewId_key',
        columns: ['interviewId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'evaluationReport',
        foreignKey: {
          name: 'evaluationReport_interviewId_fkey',
          columns: ['interviewId'],
          references: { schema: 'public', table: 'interview', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
