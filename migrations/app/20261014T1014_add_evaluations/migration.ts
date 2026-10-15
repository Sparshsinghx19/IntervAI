#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6252a737fe5abbd9b1f42196b5714ae6c8f232dccb3b628f22966ee6b1fa86d5/contract';
import endContract from '../../snapshots/6252a737fe5abbd9b1f42196b5714ae6c8f232dccb3b628f22966ee6b1fa86d5/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b15275781c2bf3a51026c1a148939dc49b45415272330d506786040827466acd/contract';
import startContract from '../../snapshots/b15275781c2bf3a51026c1a148939dc49b45415272330d506786040827466acd/contract.json' with { type: 'json' };
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
        table: 'evaluation',
        columns: [
          col('answerId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('clarityScore', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('completenessScore', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('correctnessScore', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('improvements', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('overallScore', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('reasoningScore', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('sampleAnswer', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('strengths', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('summary', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'evaluation_status_check_04ef721f',
            "\"status\" IN ('PENDING', 'COMPLETED', 'FAILED')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'evaluation',
        constraint: 'evaluation_answerId_key',
        columns: ['answerId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'evaluation',
        foreignKey: {
          name: 'evaluation_answerId_fkey',
          columns: ['answerId'],
          references: { schema: 'public', table: 'answer', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
