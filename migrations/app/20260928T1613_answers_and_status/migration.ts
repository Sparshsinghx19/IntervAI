#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/124c6a2ac76130f48f42717c9ba93ae7a09cf2b5b8155dff8fecff56f2f44386/contract';
import startContract from '../../snapshots/124c6a2ac76130f48f42717c9ba93ae7a09cf2b5b8155dff8fecff56f2f44386/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b15275781c2bf3a51026c1a148939dc49b45415272330d506786040827466acd/contract';
import endContract from '../../snapshots/b15275781c2bf3a51026c1a148939dc49b45415272330d506786040827466acd/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@internal/postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'answer',
        columns: [
          col('answerText', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('questionId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('submittedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'interview',
        column: col('status', 'text', {
          notNull: true,
          default: lit('NOT_STARTED'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'answer',
        constraint: 'answer_questionId_key',
        columns: ['questionId'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'interview',
        constraint: 'interview_status_check_f11a989d',
        expression: "\"status\" IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')",
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'answer',
        foreignKey: {
          name: 'answer_questionId_fkey',
          columns: ['questionId'],
          references: { schema: 'public', table: 'question', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
