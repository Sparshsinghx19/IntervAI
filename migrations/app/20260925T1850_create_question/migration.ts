#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/124c6a2ac76130f48f42717c9ba93ae7a09cf2b5b8155dff8fecff56f2f44386/contract';
import endContract from '../../snapshots/124c6a2ac76130f48f42717c9ba93ae7a09cf2b5b8155dff8fecff56f2f44386/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/1970e66a4bebbf054e6a95c3958c1f91d9ec0ee168f37f615665f2cbed4eec0d/contract';
import startContract from '../../snapshots/1970e66a4bebbf054e6a95c3958c1f91d9ec0ee168f37f615665f2cbed4eec0d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@internal/postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'question',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('interviewId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('orderIndex', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('questionText', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'question',
        index: 'question_interviewId_idx_766b64f2',
        columns: ['interviewId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'question',
        foreignKey: {
          name: 'question_interviewId_fkey',
          columns: ['interviewId'],
          references: { schema: 'public', table: 'interview', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
