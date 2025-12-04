import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

let prisma: PrismaClient | null = null;
const CONTEXT = "Database";

/**
 * Initialize the Prisma database connection
 */
export function initializeDatabase(): void {
  prisma = new PrismaClient({
    log: ["error", "warn"],
  });

  logger.info(CONTEXT, "Prisma database connection initialized");
}

/**
 * Get Prisma client instance
 */
export function getDatabase(): PrismaClient {
  if (!prisma) {
    throw new Error("Database not initialized. Call initializeDatabase first.");
  }
  return prisma;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
    logger.info(CONTEXT, "Database connection closed");
  }
}

/**
 * Run cleanup tasks (remove old entries)
 */
export async function runCleanup(): Promise<void> {
  const database = getDatabase();

  try {
    // Remove old rate limit entries (older than 24 hours)
    const oneDayAgo = BigInt(Date.now() - 24 * 60 * 60 * 1000);
    const deletedRateLimits = await database.rateLimit.deleteMany({
      where: {
        updatedAt: {
          lt: oneDayAgo,
        },
      },
    });

    if (deletedRateLimits.count > 0) {
      logger.info(CONTEXT, "Cleaned up old rate limit entries", {
        count: deletedRateLimits.count,
      });
    }

    // Remove old swap history (older than 90 days)
    const ninetyDaysAgo = BigInt(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const deletedHistory = await database.swapHistory.deleteMany({
      where: {
        createdAt: {
          lt: ninetyDaysAgo,
        },
      },
    });

    if (deletedHistory.count > 0) {
      logger.info(CONTEXT, "Cleaned up old swap history entries", {
        count: deletedHistory.count,
      });
    }
  } catch (error) {
    logger.error(CONTEXT, "Error during cleanup", null, error as Error);
  }
}
