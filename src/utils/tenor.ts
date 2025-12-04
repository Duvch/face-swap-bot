/**
 * Tenor API Integration
 * Reference: https://developers.google.com/tenor/guides/quickstart
 */

import { logger } from "./logger";

let tenorApiKey: string | null = null;
let tenorClientKey: string = "discord-face-swap-bot";
const CONTEXT = "Tenor";

/**
 * Initialize Tenor API with keys
 */
export function initializeTenor(apiKey: string, clientKey?: string): void {
  tenorApiKey = apiKey;
  if (clientKey) {
    tenorClientKey = clientKey;
  }
}

/**
 * Tenor GIF format
 */
export interface TenorGif {
  id: string;
  title: string;
  media_formats: {
    gif: {
      url: string;
      size: number;
      dims: number[];
    };
    tinygif: {
      url: string;
      size: number;
      dims: number[];
    };
  };
  url: string; // Tenor page URL
  itemurl: string; // Direct media URL
}

/**
 * Tenor API response
 */
interface TenorSearchResponse {
  results: TenorGif[];
  next: string;
}

/**
 * Search GIFs on Tenor
 * @param query - Search term
 * @param limit - Number of results (default: 50, max: 50)
 * @param pos - Position for pagination (optional)
 * @returns Array of GIFs
 */
export async function searchGifs(
  query: string,
  limit: number = 50,
  pos?: string,
): Promise<{ gifs: TenorGif[]; next?: string }> {
  if (!tenorApiKey) {
    throw new Error("Tenor API not initialized. Call initializeTenor first.");
  }

  try {
    // Build URL with parameters
    const params = new URLSearchParams({
      q: query,
      key: tenorApiKey,
      client_key: tenorClientKey,
      limit: Math.min(limit, 50).toString(),
      media_filter: "gif,tinygif",
    });

    if (pos) {
      params.append("pos", pos);
    }

    const url = `https://tenor.googleapis.com/v2/search?${params.toString()}`;

    logger.debug(CONTEXT, "Searching Tenor", { query, limit, pos });

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Tenor API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as TenorSearchResponse;

    logger.info(CONTEXT, "Tenor results received", {
      query,
      count: data.results.length,
    });

    return {
      gifs: data.results,
      next: data.next,
    };
  } catch (error: any) {
    logger.error(CONTEXT, "Error searching Tenor", { query }, error);
    throw new Error(`Failed to search GIFs: ${error.message}`);
  }
}

/**
 * Get direct GIF URL from a Tenor GIF object
 * @param gif - Tenor GIF object
 * @returns Direct URL to the GIF file
 */
export function getGifUrl(gif: TenorGif): string {
  // Return the full-size GIF URL
  return gif.media_formats.gif.url;
}

/**
 * Get thumbnail GIF URL from a Tenor GIF object (smaller for previews)
 * @param gif - Tenor GIF object
 * @returns URL to the thumbnail GIF
 */
export function getThumbnailUrl(gif: TenorGif): string {
  // Return the tiny GIF for previews
  return gif.media_formats.tinygif.url;
}

/**
 * Validate Tenor API key by making a test request
 */
export async function validateTenorKey(): Promise<boolean> {
  try {
    await searchGifs("test", 1);
    return true;
  } catch (error) {
    return false;
  }
}
