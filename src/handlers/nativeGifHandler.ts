import {
  Message,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { detectGif } from "../utils/gifDetector";
import { createNativeGifState } from "../utils/stateManager";
import { logger } from "../utils/logger";

const CONTEXT = "NativeGifHandler";

// Track recently processed message IDs to prevent duplicate processing
// (Discord sometimes sends duplicate events)
const processedMessages = new Set<string>();
const PROCESSED_MESSAGE_TTL = 60 * 1000; // 60 seconds

// Cleanup old message IDs periodically
setInterval(() => {
  // Clear the set periodically to prevent memory leaks
  // Since we can't track timestamps easily, we'll just clear it every minute
  // This is safe because the TTL is 60 seconds anyway
  processedMessages.clear();
}, PROCESSED_MESSAGE_TTL);

/**
 * Handle a message that contains a GIF
 * Shows ephemeral button to user for face swapping
 */
export async function handleNativeGifMessage(message: Message): Promise<void> {
  try {
    // Check if we've already processed this message (deduplication)
    if (processedMessages.has(message.id)) {
      logger.debug(CONTEXT, "Message already processed, skipping", {
        messageId: message.id,
        userId: message.author.id,
      });
      return;
    }

    // Detect GIF in message
    const gifDetails = detectGif(message);
    if (!gifDetails) {
      logger.debug(CONTEXT, "No GIF detected in message", {
        messageId: message.id,
      });
      return;
    }

    // Mark message as processed before proceeding
    processedMessages.add(message.id);

    logger.info(CONTEXT, "GIF detected, offering face swap", {
      userId: message.author.id,
      messageId: message.id,
      gifType: gifDetails.type,
      gifSource: gifDetails.source,
    });

    // Create state for this native GIF session
    const state = createNativeGifState(
      gifDetails.url,
      message.author.id,
      message.id,
      message.channelId
    );

    // Create button for face swapping
    const button = new ButtonBuilder()
      .setCustomId(`native_gif_swap|${state.id}`)
      .setLabel("🎭 Face Swap This GIF")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    // Create embed
    const embed = new EmbedBuilder()
      .setDescription(
        "Want to face swap this GIF? Click the button below to get started!"
      )
      .setColor(0x5865f2)
      .setFooter({
        text: "Face swap will be posted publicly in this channel",
      });

    // Send DM to user (only they will see it)
    // This is the only way to make it private since ephemeral only works with interactions
    try {
      await message.author.send({
        embeds: [embed],
        components: [row],
      });
      logger.debug(CONTEXT, "Face swap button sent via DM", {
        sessionId: state.id,
        userId: message.author.id,
      });
    } catch (error: any) {
      // If DM fails (user has DMs disabled), send a public reply as fallback
      logger.warn(CONTEXT, "Failed to send DM, using public reply", {
        userId: message.author.id,
        error: error.message || error,
      });
      await message.reply({
        content: `<@${message.author.id}> Check your DMs for the face swap option!`,
        embeds: [embed],
        components: [row],
      });
    }

    logger.debug(CONTEXT, "Face swap button sent", {
      sessionId: state.id,
      userId: message.author.id,
    });
  } catch (error: any) {
    logger.error(
      CONTEXT,
      "Error handling native GIF message",
      {
        messageId: message.id,
        userId: message.author.id,
      },
      error
    );
  }
}
