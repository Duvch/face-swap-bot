import { SearchState, TenorGif, StateUpdateResult } from "../types";
import { logger } from "./logger";

// Native GIF state interface
export interface NativeGifState {
  id: string; // unique session ID
  gifUrl: string; // URL to the GIF
  userId: string; // user who posted the GIF
  messageId: string; // original message ID
  channelId: string; // channel ID
  timestamp: number; // for cleanup
  selectedFaceId?: string; // if user selected a saved face
}

// Store active GIF searches
const activeSearches = new Map<string, SearchState>();

// Store native GIF face swap sessions
const nativeGifStates = new Map<string, NativeGifState>();

// Cleanup interval (10 minutes)
const CLEANUP_INTERVAL = 10 * 60 * 1000;
const STATE_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const NATIVE_GIF_TIMEOUT = 5 * 60 * 1000; // 5 minutes for native GIF states

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
  let cleanedSearches = 0;
  let cleanedNativeGifs = 0;

  // Clean up expired search states
  for (const [searchId, state] of activeSearches.entries()) {
    if (now - state.timestamp > STATE_TIMEOUT) {
      activeSearches.delete(searchId);
      cleanedSearches++;
    }
  }

  // Clean up expired native GIF states
  for (const [sessionId, state] of nativeGifStates.entries()) {
    if (now - state.timestamp > NATIVE_GIF_TIMEOUT) {
      nativeGifStates.delete(sessionId);
      cleanedNativeGifs++;
    }
  }

  if (cleanedSearches > 0) {
    logger.info(CONTEXT, "Cleaned up expired search states", {
      count: cleanedSearches,
    });
  }

  if (cleanedNativeGifs > 0) {
    logger.info(CONTEXT, "Cleaned up expired native GIF states", {
      count: cleanedNativeGifs,
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

// ============================================================
// Native GIF State Management
// ============================================================

/**
 * Create a new native GIF state
 */
export function createNativeGifState(
  gifUrl: string,
  userId: string,
  messageId: string,
  channelId: string,
): NativeGifState {
  const sessionId = `native_${userId}_${Date.now()}`;

  const state: NativeGifState = {
    id: sessionId,
    gifUrl,
    userId,
    messageId,
    channelId,
    timestamp: Date.now(),
  };

  nativeGifStates.set(sessionId, state);
  logger.info(CONTEXT, "Native GIF state created", {
    sessionId,
    userId,
    gifUrl: gifUrl.substring(0, 50) + "...",
  });

  return state;
}

/**
 * Get native GIF state by ID
 */
export function getNativeGifState(
  sessionId: string,
): NativeGifState | undefined {
  const state = nativeGifStates.get(sessionId);

  if (state) {
    logger.debug(CONTEXT, "Native GIF state retrieved", {
      sessionId,
      userId: state.userId,
      hasSelectedFace: !!state.selectedFaceId,
    });
  } else {
    logger.warn(CONTEXT, "Native GIF state not found", { sessionId });
  }

  return state;
}

/**
 * Update native GIF state
 */
export function updateNativeGifState(
  sessionId: string,
  updates: Partial<NativeGifState>,
): boolean {
  const state = nativeGifStates.get(sessionId);
  if (!state) {
    logger.warn(CONTEXT, "Cannot update - native GIF state not found", {
      sessionId,
    });
    return false;
  }

  Object.assign(state, updates, { timestamp: Date.now() });
  nativeGifStates.set(sessionId, state);

  logger.debug(CONTEXT, "Native GIF state updated", {
    sessionId,
    updatedFields: Object.keys(updates),
  });

  return true;
}

/**
 * Delete native GIF state
 */
export function deleteNativeGifState(sessionId: string): void {
  const existed = nativeGifStates.delete(sessionId);
  if (existed) {
    logger.info(CONTEXT, "Native GIF state deleted", { sessionId });
  } else {
    logger.warn(CONTEXT, "Attempted to delete non-existent native GIF state", {
      sessionId,
    });
  }
}

/**
 * Get total active native GIF sessions
 */
export function getActiveNativeGifCount(): number {
  return nativeGifStates.size;
}
