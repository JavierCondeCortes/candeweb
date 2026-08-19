import { backup, DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const databasePath = resolve(process.env.DATABASE_PATH ?? 'server/data/candemor.db');
const backupDir = resolve(process.env.BACKUP_DIR ?? 'server/data/backups');
mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const destination = join(backupDir, `candemor-${stamp}.db`);
const database = new DatabaseSync(databasePath, { readOnly: true });

try {
  await backup(database, destination);
  console.log(`Copia creada en ${destination}`);
} finally {
  database.close();
}
