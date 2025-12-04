import { validateTenorKey, searchGifs } from "./tenor";
import { initializeMagicHour } from "./magicHour";
import { logger } from "./logger";

const CONTEXT = "ApiValidator";

/**
 * Validate Magic Hour API
 */
async function validateMagicHourAPI(apiKey: string): Promise<boolean> {
  try {
    logger.info(CONTEXT, "Validating Magic Hour API");

    // Initialize client
    initializeMagicHour(apiKey);

    // Try to make a simple request (we'll use a test endpoint if available)
    // For now, we'll just check if the key format is correct
    if (!apiKey) {
      logger.error(CONTEXT, "Invalid Magic Hour API key format");
      return false;
    }

    logger.info(CONTEXT, "Magic Hour API key format valid");
    return true;
  } catch (error: any) {
    logger.error(
      CONTEXT,
      "Magic Hour API validation failed",
      { message: error.message },
      error,
    );
    return false;
  }
}

/**
 * Validate Tenor API
 */
async function validateTenorAPI(apiKey: string): Promise<boolean> {
  try {
    logger.info(CONTEXT, "Validating Tenor API");

    // Try a simple search
    await searchGifs("test", 1);

    logger.info(CONTEXT, "Tenor API validated successfully");
    return true;
  } catch (error: any) {
    logger.error(
      CONTEXT,
      "Tenor API validation failed",
      { message: error.message },
      error,
    );
    return false;
  }
}

/**
 * Validate all APIs on startup
 */
export async function validateAllAPIs(
  magicHourKey: string,
  tenorKey: string,
): Promise<boolean> {
  logger.info(CONTEXT, "Starting API validation");

  const magicHourValid = await validateMagicHourAPI(magicHourKey);
  const tenorValid = await validateTenorAPI(tenorKey);

  if (!magicHourValid) {
    logger.error(
      CONTEXT,
      "Magic Hour API validation failed. Please check your MAGIC_HOUR_API_KEY in .env",
    );
    return false;
  }

  if (!tenorValid) {
    logger.error(
      CONTEXT,
      "Tenor API validation failed. Please check your TENOR_API_KEY in .env",
    );
    return false;
  }

  logger.info(CONTEXT, "All APIs validated successfully");
  return true;
}
