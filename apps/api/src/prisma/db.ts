import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "./contract.js";
import contractJson from "./contract.json" with { type: "json" };

export const db = postgres<Contract>({
  contractJson,
  url: process.env["DATABASE_URL"]!,
});
