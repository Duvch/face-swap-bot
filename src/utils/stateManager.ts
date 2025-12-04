import { SearchState, TenorGif, StateUpdateResult } from "../types";
import { logger } from "./logger";

// Store active GIF searches
const activeSearches = new Map<string, SearchState>();

// Cleanup interval (10 minutes)
const CLEANUP_INTERVAL = 10 * 60 * 1000;
const STATE_TIMEOUT = 10 * 60 * 1000; // 10 minutes

const CONTEXT = "StateManager";

/**
 * Create a new search state
 */
export function createSearchState(
  searchId: string,
  query: string,
  results: TenorGif[],
  userId: string,
  channelId: string,
): SearchState {
  const totalPages = Math.ceil(results.length / 9);

  const state: SearchState = {
    searchId,
    query,
    results,
    currentPage: 0,
    totalPages,
    userId,
    channelId,
    timestamp: Date.now(),
  };

  activeSearches.set(searchId, state);
  logger.info(CONTEXT, "Search state created", {
    searchId,
    userId,
    query,
    resultsCount: results.length,
    totalPages,
  });

  return state;
}

/**
 * Get search state by ID
 */
export function getSearchState(searchId: string): SearchState | undefined {
  const state = activeSearches.get(searchId);

  if (state) {
    logger.debug(CONTEXT, "Search state retrieved", {
      searchId,
      userId: state.userId,
      hasSelectedGif: !!state.selectedGif,
    });
  } else {
    logger.warn(CONTEXT, "Search state not found", { searchId });
  }

  return state;
}

/**
 * Update search state with validation
 */
export function updateSearchState(
  searchId: string,
  updates: Partial<SearchState>,
): StateUpdateResult {
  logger.debug(CONTEXT, "Updating search state", { searchId, updates });

  // Check if state exists
  if (!activeSearches.has(searchId)) {
    logger.error(CONTEXT, "Cannot update - state not found", { searchId });
    return {
      success: false,
      error: "Search state not found",
    };
  }

  const state = activeSearches.get(searchId)!;

  // Log before state
  logger.debug(CONTEXT, "State before update", {
    searchId,
    currentPage: state.currentPage,
    hasSelectedGif: !!state.selectedGif,
  });

  // Apply updates
  try {
    Object.assign(state, updates, { timestamp: Date.now() });
    activeSearches.set(searchId, state);

    // Log after state
    logger.debug(CONTEXT, "State after update", {
      searchId,
      currentPage: state.currentPage,
      hasSelectedGif: !!state.selectedGif,
      selectedGifId: state.selectedGif?.id,
    });

    // Verify the update by reading back
    const verifyState = activeSearches.get(searchId);
    if (!verifyState) {
      logger.error(CONTEXT, "Verification failed - state disappeared", {
        searchId,
      });
      return {
        success: false,
        error: "State verification failed",
      };
    }

    // Verify specific updates were applied
    for (const [key, value] of Object.entries(updates)) {
      if (
        key !== "timestamp" &&
        verifyState[key as keyof SearchState] !== value
      ) {
        logger.error(CONTEXT, "Verification failed - update not applied", {
          searchId,
          key,
          expectedValue: value,
          actualValue: verifyState[key as keyof SearchState],
        });
        return {
          success: false,
          error: `Update verification failed for ${key}`,
        };
      }
    }

    logger.info(CONTEXT, "Search state updated successfully", {
      searchId,
      updatedFields: Object.keys(updates),
    });

    return { success: true };
  } catch (error: any) {
    logger.error(CONTEXT, "Error updating search state", { searchId }, error);
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

/**
 * Delete search state
 */
export function deleteSearchState(searchId: string): void {
  const existed = activeSearches.delete(searchId);
  if (existed) {
    logger.info(CONTEXT, "Search state deleted", { searchId });
  } else {
    logger.warn(CONTEXT, "Attempted to delete non-existent state", {
      searchId,
    });
  }
}

/**
 * Get GIFs for current page
 */
export function getCurrentPageGifs(state: SearchState): TenorGif[] {
  const startIndex = state.currentPage * 9;
  return state.results.slice(startIndex, startIndex + 9);
}

/**
 * Clean up expired search states
 */
export function cleanupExpiredStates(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [searchId, state] of activeSearches.entries()) {
    if (now - state.timestamp > STATE_TIMEOUT) {
      activeSearches.delete(searchId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info(CONTEXT, "Cleaned up expired search states", {
      count: cleaned,
    });
  }
}

/**
 * Start automatic cleanup
 */
export function startCleanupTimer(): NodeJS.Timeout {
  logger.info(CONTEXT, "Starting cleanup timer", {
    intervalMs: CLEANUP_INTERVAL,
  });
  return setInterval(cleanupExpiredStates, CLEANUP_INTERVAL);
}

/**
 * Get total active searches
 */
export function getActiveSearchCount(): number {
  return activeSearches.size;
}

/**
 * Get all search IDs (for debugging)
 */
export function getAllSearchIds(): string[] {
  return Array.from(activeSearches.keys());
}
