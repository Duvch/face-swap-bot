import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";

let db: Database.Database | null = null;
const CONTEXT = "Database";

/**
 * Initialize the database
 */
export function initializeDatabase(): void {
  // Ensure data directory exists
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logger.info(CONTEXT, "Created data directory", { dataDir });
  }

  const dbPath = path.join(dataDir, "database.db");
  db = new Database(dbPath);

  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  logger.info(CONTEXT, "Database initialized", { dbPath });

  // Create tables
  createTables();

  // Create backup
  createBackup();
}

/**
 * Get database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized. Call initializeDatabase first.");
  }
  return db;
}

/**
 * Create all database tables
 */
function createTables(): void {
  const database = getDatabase();

  // Create saved_faces table
  database.exec(`
    CREATE TABLE IF NOT EXISTS saved_faces (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      magic_hour_path TEXT NOT NULL,
      thumbnail_url TEXT,
      uploaded_at INTEGER NOT NULL,
      usage_count INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_user_faces ON saved_faces(user_id);
  `);

  // Create rate_limits table
  database.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      user_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      timestamps TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, action_type)
    );
  `);

  // Create user_preferences table
  database.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      default_face_id TEXT,
      auto_save_faces INTEGER DEFAULT 0,
      max_gif_duration INTEGER DEFAULT 20,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Create swap_history table
  database.exec(`
    CREATE TABLE IF NOT EXISTS swap_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      swap_type TEXT NOT NULL,
      credits_used INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_swaps ON swap_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_created_at ON swap_history(created_at);
  `);

  logger.info(CONTEXT, "Database tables created/verified");
}

/**
 * Create database backup
 */
function createBackup(): void {
  try {
    const database = getDatabase();
    const dataDir = path.join(process.cwd(), "data");
    const backupPath = path.join(
      dataDir,
      `database_backup_${Date.now()}.db`
    );

    database
      .backup(backupPath)
      .then(() => {
        logger.info(CONTEXT, "Database backup created", { backupPath });
      })
      .catch((error) => {
        logger.error(CONTEXT, "Failed to create backup", { backupPath }, error);
      });
  } catch (error) {
    logger.error(CONTEXT, "Backup error", null, error as Error);
  }
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info(CONTEXT, "Database connection closed");
  }
}

/**
 * Run cleanup tasks (remove old entries)
 */
export function runCleanup(): void {
  const database = getDatabase();

  try {
    // Remove old rate limit entries (older than 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const deleted = database
      .prepare(
        "DELETE FROM rate_limits WHERE updated_at < ?"
      )
      .run(oneDayAgo);
    
    if (deleted.changes > 0) {
      logger.info(CONTEXT, "Cleaned up old rate limit entries", {
        count: deleted.changes,
      });
    }

    // Remove old swap history (older than 90 days)
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const deletedHistory = database
      .prepare("DELETE FROM swap_history WHERE created_at < ?")
      .run(ninetyDaysAgo);
    
    if (deletedHistory.changes > 0) {
      logger.info(CONTEXT, "Cleaned up old swap history entries", {
        count: deletedHistory.changes,
      });
    }
  } catch (error) {
    logger.error(CONTEXT, "Error during cleanup", null, error as Error);
  }
}

