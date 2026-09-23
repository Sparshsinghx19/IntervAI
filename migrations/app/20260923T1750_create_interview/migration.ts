#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1970e66a4bebbf054e6a95c3958c1f91d9ec0ee168f37f615665f2cbed4eec0d/contract';
import endContract from '../../snapshots/1970e66a4bebbf054e6a95c3958c1f91d9ec0ee168f37f615665f2cbed4eec0d/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
} from '@internal/postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'interview',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('difficulty', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('focusArea', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('questionCount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'interview_difficulty_check_244bf003',
            "\"difficulty\" IN ('EASY', 'MEDIUM', 'HARD')",
          ),
          checkExpression(
            'interview_type_check_9bd27793',
            "\"type\" IN ('TECHNICAL', 'BEHAVIORAL', 'HR')",
          ),
        ],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
