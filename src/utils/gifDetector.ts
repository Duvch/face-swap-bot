import { Message } from "discord.js";
import { logger } from "./logger";

const CONTEXT = "GifDetector";

export interface GifDetails {
  url: string;
  type: "attachment" | "tenor" | "embed";
  source: string;
}

/**
 * Detect if a Discord message contains a GIF
 * @param message Discord message to check
 * @returns GIF details if found, null otherwise
 */
export function detectGif(message: Message): GifDetails | null {
  // Check attachments first (direct .gif uploads)
  if (message.attachments.size > 0) {
    for (const attachment of message.attachments.values()) {
      // Check if it's a GIF file
      if (
        attachment.contentType?.includes("gif") ||
        attachment.url.toLowerCase().endsWith(".gif")
      ) {
        logger.debug(CONTEXT, "GIF detected in attachments", {
          url: attachment.url,
          name: attachment.name,
        });

        return {
          url: attachment.url,
          type: "attachment",
          source: "discord_upload",
        };
      }
    }
  }

  // Check embeds (Discord's GIF picker uses Tenor and other providers)
  if (message.embeds.length > 0) {
    for (const embed of message.embeds) {
      // Check for Tenor GIFs (Discord's primary GIF provider)
      if (embed.provider?.name?.toLowerCase() === "tenor") {
        // Tenor embeds have video or image URLs
        const gifUrl =
          embed.video?.url || embed.video?.proxyURL || embed.thumbnail?.url;

        if (gifUrl) {
          logger.debug(CONTEXT, "Tenor GIF detected in embeds", {
            url: gifUrl,
            title: embed.title,
          });

          return {
            url: gifUrl,
            type: "tenor",
            source: "tenor",
          };
        }
      }

      // Check for GIPHY (another common provider)
      if (embed.provider?.name?.toLowerCase() === "giphy") {
        const gifUrl =
          embed.video?.url || embed.video?.proxyURL || embed.thumbnail?.url;

        if (gifUrl) {
          logger.debug(CONTEXT, "GIPHY GIF detected in embeds", {
            url: gifUrl,
            title: embed.title,
          });

          return {
            url: gifUrl,
            type: "embed",
            source: "giphy",
          };
        }
      }

      // Check for any video embed that might be a GIF
      if (embed.video && embed.video.url) {
        const videoUrl = embed.video.url;
        if (
          videoUrl.includes("gif") ||
          videoUrl.includes("tenor") ||
          videoUrl.includes("giphy")
        ) {
          logger.debug(CONTEXT, "Video embed detected (likely GIF)", {
            url: videoUrl,
            provider: embed.provider?.name || "unknown",
          });

          return {
            url: videoUrl,
            type: "embed",
            source: embed.provider?.name || "unknown",
          };
        }
      }

      // Check for GIF in thumbnail or image
      if (embed.thumbnail?.url || embed.image?.url) {
        const imageUrl = embed.thumbnail?.url || embed.image?.url || "";
        if (imageUrl.toLowerCase().includes(".gif")) {
          logger.debug(CONTEXT, "GIF detected in embed image/thumbnail", {
            url: imageUrl,
          });

          return {
            url: imageUrl,
            type: "embed",
            source: embed.provider?.name || "unknown",
          };
        }
      }
    }
  }

  return null;
}

/**
 * Check if a message is eligible for native GIF face swap
 * @param message Discord message
 * @returns true if eligible (not a bot, contains GIF, in a guild)
 */
export function isEligibleForGifSwap(message: Message): boolean {
  // Ignore bot messages
  if (message.author.bot) {
    return false;
  }

  // Must be in a guild (not DM)
  if (!message.guild) {
    return false;
  }

  // Must contain a GIF
  const gif = detectGif(message);
  if (!gif) {
    return false;
  }

  return true;
}
