#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/08cb7a5b092eb7e8b2776a2ff29671bc5037a32ba2a07b4b8b0cb363c9f929b8/contract';
import endContract from '../../snapshots/08cb7a5b092eb7e8b2776a2ff29671bc5037a32ba2a07b4b8b0cb363c9f929b8/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9fafa391d7d4b780381b94510a4cdec951c32ef31d23195618f343d207c055c1/contract';
import startContract from '../../snapshots/9fafa391d7d4b780381b94510a4cdec951c32ef31d23195618f343d207c055c1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@internal/postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'question',
        column: col('type', 'text', {
          notNull: true,
          default: lit('THEORY'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'question',
        constraint: 'question_type_check_9ee3e86d',
        expression: "\"type\" IN ('THEORY', 'CODING', 'SYSTEM_DESIGN')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
