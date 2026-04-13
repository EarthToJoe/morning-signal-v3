import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

async function migrate() {
  logger.info('Running V3 database migration...', { component: 'db-migrate' });
  try {
    const sql = readFileSync(join(__dirname, 'migrations', '001-v3-schema.sql'), 'utf-8');
    await pool.query(sql);
    logger.info('V3 migration completed successfully', { component: 'db-migrate' });
  } catch (error: any) {
    logger.error('V3 migration failed', { component: 'db-migrate', error: error.message });
    throw error;
  } finally {
    await pool.end();
  }
}

migrate().catch(err => { console.error('Migration failed:', err.message); process.exit(1); });
