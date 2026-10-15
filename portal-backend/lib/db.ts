import {databaseConnectionString} from "./database-connection";
import 'server-only';
import { Pool } from 'pg';
let pool: Pool | undefined;
export function getDb() {
  return pool ??= new Pool({ connectionString: databaseConnectionString(), max: 5, connectionTimeoutMillis: 15000 });
}
