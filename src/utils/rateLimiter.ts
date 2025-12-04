import { getDatabase } from "./database";
import { logger } from "./logger";

export type ActionType = "faceswap" | "gifsearch";

interface RateLimitConfig {
  maxActions: number;
  timeWindow: number; // in milliseconds
  actionName: string;
}

const RATE_LIMITS: Record<ActionType, RateLimitConfig> = {
  faceswap: {
    maxActions: 5,
    timeWindow: 60 * 60 * 1000, // 1 hour
    actionName: "face swaps",
  },
  gifsearch: {
    maxActions: 10,
    timeWindow: 60 * 60 * 1000, // 1 hour
    actionName: "GIF searches",
  },
};

// Burst protection for face swaps
const BURST_LIMIT: RateLimitConfig = {
  maxActions: 3,
  timeWindow: 10 * 60 * 1000, // 10 minutes
  actionName: "face swaps",
};

/**
 * Check if user can perform an action
 * @returns null if allowed, error message if rate limited
 */
export async function checkRateLimit(
  userId: string,
  actionType: ActionType,
): Promise<string | null> {
  const db = getDatabase();
  const config = RATE_LIMITS[actionType];

  // Get existing timestamps
  const rateLimit = await db.rateLimit.findUnique({
    where: {
      userId_actionType: {
        userId,
        actionType,
      },
    },
  });

  let timestamps: number[] = [];
  if (rateLimit) {
    try {
      timestamps = JSON.parse(rateLimit.timestamps);
    } catch {
      timestamps = [];
    }
  }

  const now = Date.now();
  const windowStart = now - config.timeWindow;

  // Filter timestamps within the time window
  const recentTimestamps = timestamps.filter((ts) => ts > windowStart);

  // Check main rate limit
  if (recentTimestamps.length >= config.maxActions) {
    const oldestTimestamp = Math.min(...recentTimestamps);
    const waitTime = Math.ceil(
      (oldestTimestamp + config.timeWindow - now) / 1000 / 60,
    );
    return `⏱️ Rate limit exceeded! You've used ${config.maxActions} ${config.actionName} in the last hour. Please wait ${waitTime} minute(s).`;
  }

  // Check burst limit for face swaps
  if (actionType === "faceswap") {
    const burstWindowStart = now - BURST_LIMIT.timeWindow;
    const burstTimestamps = recentTimestamps.filter(
      (ts) => ts > burstWindowStart,
    );

    if (burstTimestamps.length >= BURST_LIMIT.maxActions) {
      const oldestBurst = Math.min(...burstTimestamps);
      const waitTime = Math.ceil(
        (oldestBurst + BURST_LIMIT.timeWindow - now) / 1000 / 60,
      );
      return `⏱️ Too many requests! You've made ${BURST_LIMIT.maxActions} face swaps in the last 10 minutes. Please wait ${waitTime} minute(s).`;
    }
  }

  return null; // Allowed
}

/**
 * Record an action for rate limiting
 */
export async function recordAction(
  userId: string,
  actionType: ActionType,
): Promise<void> {
  const db = getDatabase();

  // Get existing timestamps
  const rateLimit = await db.rateLimit.findUnique({
    where: {
      userId_actionType: {
        userId,
        actionType,
      },
    },
  });

  let timestamps: number[] = [];
  if (rateLimit) {
    try {
      timestamps = JSON.parse(rateLimit.timestamps);
    } catch {
      timestamps = [];
    }
  }

  // Add current timestamp
  timestamps.push(Date.now());

  // Clean up old timestamps (older than 24 hours)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  timestamps = timestamps.filter((ts) => ts > oneDayAgo);

  const timestampsJson = JSON.stringify(timestamps);
  const now = BigInt(Date.now());

  // Upsert rate limit record
  await db.rateLimit.upsert({
    where: {
      userId_actionType: {
        userId,
        actionType,
      },
    },
    update: {
      timestamps: timestampsJson,
      updatedAt: now,
    },
    create: {
      userId,
      actionType,
      timestamps: timestampsJson,
      updatedAt: now,
    },
  });

  logger.debug("RateLimiter", "Recorded user action", { userId, actionType });
}

/**
 * Get remaining actions for user
 */
export async function getRemainingActions(
  userId: string,
  actionType: ActionType,
): Promise<number> {
  const db = getDatabase();
  const config = RATE_LIMITS[actionType];

  const rateLimit = await db.rateLimit.findUnique({
    where: {
      userId_actionType: {
        userId,
        actionType,
      },
    },
  });

  if (!rateLimit) {
    return config.maxActions;
  }

  try {
    const timestamps: number[] = JSON.parse(rateLimit.timestamps);
    const now = Date.now();
    const windowStart = now - config.timeWindow;
    const recentTimestamps = timestamps.filter((ts) => ts > windowStart);
    return Math.max(0, config.maxActions - recentTimestamps.length);
  } catch {
    return config.maxActions;
  }
}

/**
 * Clear rate limits for a user (admin function)
 */
export async function clearRateLimits(userId: string): Promise<void> {
  const db = getDatabase();
  await db.rateLimit.deleteMany({
    where: {
      userId,
    },
  });
  logger.info("RateLimiter", "Cleared rate limits for user", { userId });
}
