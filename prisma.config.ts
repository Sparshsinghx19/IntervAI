import { config as loadEnv } from 'dotenv';
import { definePrismaConfig } from "prisma/config";
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';

// Local development: DATABASE_URL from the root .env, as before.
// Production migrations: set PRISMA_ENV_FILE=.env.production.local. The CLI then
// uses that file's DIRECT_URL (Neon's non-pooled connection) and refuses to fall
// back to any other database URL.
const envFile = process.env['PRISMA_ENV_FILE']?.trim();

const resolveConnection = (): string => {
  if (!envFile) {
    loadEnv();
    return process.env['DATABASE_URL']!;
  }
  const loaded = loadEnv({ path: envFile, override: true, quiet: true });
  if (loaded.error) {
    throw new Error(`PRISMA_ENV_FILE: could not read ${envFile}.`);
  }
  const direct = loaded.parsed?.['DIRECT_URL']?.trim();
  if (!direct) {
    throw new Error(`PRISMA_ENV_FILE: ${envFile} must define DIRECT_URL (the direct, non-pooled connection used for migrations).`);
  }
  return direct;
};

export default definePrismaConfig({
  orm: ormConfig({
    contract: "apps/api/src/prisma/contract.prisma",
    db: {
      connection: resolveConnection(),
    },
  }),
  skills: {
    agents: ["claude", "cursor", "agents", "devin"],
  },
});
