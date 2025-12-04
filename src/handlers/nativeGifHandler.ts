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

/**
 * Handle a message that contains a GIF
 * Shows ephemeral button to user for face swapping
 */
export async function handleNativeGifMessage(message: Message): Promise<void> {
  try {
    // Detect GIF in message
    const gifDetails = detectGif(message);
    if (!gifDetails) {
      logger.debug(CONTEXT, "No GIF detected in message", {
        messageId: message.id,
      });
      return;
    }

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
      message.channelId,
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
        "Want to face swap this GIF? Click the button below to get started!",
      )
      .setColor(0x5865f2)
      .setFooter({
        text: "Face swap will be posted publicly in this channel",
      });

    // Reply to message with ephemeral button (only user sees it)
    await message.reply({
      embeds: [embed],
      components: [row],
      // Note: ephemeral only works with interactions, but we can delete it after timeout
    });

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
      error,
    );
  }
}
