import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import { detectGif } from "../utils/gifDetector";
import { createNativeGifState } from "../utils/stateManager";
import { getUserFaces } from "../utils/faceStorage";
import { getUserPreferences } from "../utils/userPreferences";
import { logger } from "../utils/logger";

const CONTEXT = "FaceSwapContext";

// Command definition for deployment
export const faceSwapContextCommandData = new ContextMenuCommandBuilder()
  .setName("Face Swap This GIF")
  .setType(ApplicationCommandType.Message);

/**
 * Build face selection UI for context menu
 */
function buildFaceSelectionUI(
  faces: any[],
  sessionId: string,
  defaultFaceId: string | null,
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  // Add saved face buttons (max 5 per row, multiple rows if needed)
  if (faces.length > 0) {
    for (let i = 0; i < faces.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>();
      const facesInRow = faces.slice(i, i + 5);

      for (const face of facesInRow) {
        const isDefault = face.id === defaultFaceId;
        const button = new ButtonBuilder()
          .setCustomId(`native_face_select|${sessionId}|${face.id}`)
          .setLabel(`${isDefault ? "⭐ " : ""}${face.name}`)
          .setStyle(isDefault ? ButtonStyle.Primary : ButtonStyle.Secondary);
        row.addComponents(button);
      }

      rows.push(row);
    }
  }

  // Add upload button
  const uploadRow = new ActionRowBuilder<ButtonBuilder>();
  uploadRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`native_upload_face|${sessionId}`)
      .setLabel("📤 Upload New Face")
      .setStyle(ButtonStyle.Success),
  );
  rows.push(uploadRow);

  return rows;
}

/**
 * Handle the context menu command
 */
export async function handleFaceSwapContextCommand(
  interaction: MessageContextMenuCommandInteraction,
): Promise<void> {
  const userId = interaction.user.id;
  const message = interaction.targetMessage;

  logger.info(CONTEXT, "Context menu command triggered", {
    userId,
    messageId: message.id,
    channelId: interaction.channelId,
  });

  // Check if interaction is already acknowledged
  if (interaction.replied || interaction.deferred) {
    logger.warn(CONTEXT, "Interaction already acknowledged, skipping", {
      userId,
      messageId: message.id,
    });
    return;
  }

  try {
    // Defer reply as ephemeral (only visible to the user)
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (error: any) {
    // If already acknowledged, just return
    if (error.message?.includes("already been acknowledged")) {
      logger.warn(CONTEXT, "Interaction already acknowledged during defer", {
        userId,
        messageId: message.id,
      });
      return;
    }
    throw error;
  }

  // Detect GIF in the target message
  const gifDetails = detectGif(message);
  if (!gifDetails) {
    await interaction.editReply({
      content:
        "❌ This message doesn't contain a GIF. Please right-click on a message with a GIF.",
    });
    logger.warn(CONTEXT, "No GIF detected in target message", {
      userId,
      messageId: message.id,
    });
    return;
  }

  logger.info(CONTEXT, "GIF detected in target message", {
    userId,
    messageId: message.id,
    gifType: gifDetails.type,
    gifSource: gifDetails.source,
  });

  // Create state for this face swap session
  const state = createNativeGifState(
    gifDetails.url,
    userId,
    message.id,
    interaction.channelId,
  );

  // Get saved faces for user
  const savedFaces = await getUserFaces(userId);
  const prefs = await getUserPreferences(userId);

  logger.debug(CONTEXT, "Showing face selection for context menu", {
    sessionId: state.id,
    userId,
    savedFacesCount: savedFaces.length,
    hasDefaultFace: !!prefs.default_face_id,
  });

  // Build face selection UI
  const faceButtons = buildFaceSelectionUI(
    savedFaces,
    state.id,
    prefs.default_face_id,
  );

  // Show face selection (ephemeral - only visible to the user)
  await interaction.editReply({
    content: "✅ Choose a face for the swap:",
    components: faceButtons,
  });

  logger.info(CONTEXT, "Face selection UI shown", {
    sessionId: state.id,
    userId,
  });
}
