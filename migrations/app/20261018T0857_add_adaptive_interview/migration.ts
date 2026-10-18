#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4fe7e0fbba4a7785773fa913f7bc760390bc5b62c71e02910ecc2a00d86a81a7/contract';
import startContract from '../../snapshots/4fe7e0fbba4a7785773fa913f7bc760390bc5b62c71e02910ecc2a00d86a81a7/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/939e37ca60b3e9fd06d7de3c45ab2513cf4edb0de0e4b1cb10bf0e4eb57a3802/contract';
import endContract from '../../snapshots/939e37ca60b3e9fd06d7de3c45ab2513cf4edb0de0e4b1cb10bf0e4eb57a3802/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@internal/postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'interview',
        column: col('completedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'interview',
        column: col('completionReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'interview',
        column: col('deadlineAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'interview',
        column: col('durationMinutes', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'interview',
        column: col('followUpCount', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'interview',
        column: col('mode', 'text', {
          notNull: true,
          default: lit('TOPIC'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'interview',
        column: col('planContext', 'json', { codecRef: { codecId: 'pg/json@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'interview',
        column: col('startedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'interview',
        column: col('targetRole', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'question',
        column: col('category', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'question',
        column: col('followUpOfId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'question',
        column: col('origin', 'text', {
          notNull: true,
          default: lit('CURATED'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'question',
        column: col('sources', 'json', { codecRef: { codecId: 'pg/json@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'interview',
        constraint: 'interview_completionReason_check_e5987b82',
        expression: "\"completionReason\" IN ('ALL_ANSWERED', 'TIME_EXPIRED')",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'interview',
        constraint: 'interview_mode_check_d077e14f',
        expression: "\"mode\" IN ('TOPIC', 'RESUME', 'MIXED')",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'question',
        constraint: 'question_origin_check_43fd7afc',
        expression: "\"origin\" IN ('CURATED', 'SUBJECT', 'RESUME', 'FOLLOW_UP')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'question',
        constraint: 'question_followUpOfId_key',
        columns: ['followUpOfId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
