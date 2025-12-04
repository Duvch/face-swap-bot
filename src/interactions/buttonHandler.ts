import {
  ButtonInteraction,
  Message,
  TextChannel,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import {
  getSearchState,
  updateSearchState,
  deleteSearchState,
  getCurrentPageGifs,
  getAllSearchIds,
  getNativeGifState,
  updateNativeGifState,
  deleteNativeGifState,
} from "../utils/stateManager";
import { buildGifSelectionUI, buildGifEmbeds } from "../commands/gifsearch";
import { getGifUrl } from "../utils/tenor";
import {
  swapFacesInVideo,
  uploadToMagicHour,
  isValidImageUrl,
} from "../utils/magicHour";
import { getUserFaces, incrementFaceUsage } from "../utils/faceStorage";
import { getUserPreferences } from "../utils/userPreferences";
import { getDatabase } from "../utils/database";
import { logger } from "../utils/logger";

const CONTEXT = "ButtonHandler";

/**
 * Parse searchId and faceId from button customId
 */
function parseSearchAndFaceId(customId: string): {
  searchId: string | null;
  faceId?: string | null;
  legacy?: boolean;
} {
  // Preferred format: face_select|{searchId}|{faceId}
  if (customId.includes("|")) {
    const [, searchId, faceId] = customId.split("|");
    return {
      searchId: searchId || null,
      faceId: faceId || null,
      legacy: false,
    };
  }

  // Legacy format: face_select_{searchId}_{face.id}
  const legacyPrefix = "face_select_";
  if (customId.startsWith(legacyPrefix)) {
    const payload = customId.slice(legacyPrefix.length);
    const faceMarkerIndex = payload.indexOf("_face_");

    if (faceMarkerIndex !== -1) {
      const searchId = payload.substring(0, faceMarkerIndex);
      const faceId = payload.substring(faceMarkerIndex + 1); // includes "face_..."
      return {
        searchId,
        faceId,
        legacy: true,
      };
    }
  }

  return { searchId: null, faceId: null };
}

/**
 * Handle button interactions for GIF selection
 */
export async function handleButtonInteraction(
  interaction: ButtonInteraction,
): Promise<void> {
  const customId = interaction.customId;

  // Parse button type
  if (customId.startsWith("gif_select_")) {
    await handleGifSelection(interaction);
  } else if (
    customId.startsWith("face_select_") ||
    customId.startsWith("face_select|")
  ) {
    await handleSavedFaceSelection(interaction);
  } else if (
    customId.startsWith("face_upload_") ||
    customId.startsWith("face_upload|")
  ) {
    await handleFaceUploadPrompt(interaction);
  } else if (customId.startsWith("gif_next_")) {
    await handlePageNavigation(interaction, "next");
  } else if (customId.startsWith("gif_prev_")) {
    await handlePageNavigation(interaction, "prev");
  } else if (customId.startsWith("gif_cancel_")) {
    await handleSearchCancel(interaction);
  } else if (customId.startsWith("native_gif_swap|")) {
    await handleNativeGifSwapButton(interaction);
  } else if (customId.startsWith("native_face_select|")) {
    await handleNativeGifFaceSelect(interaction);
  } else if (customId.startsWith("native_upload_face|")) {
    await handleNativeGifFaceUpload(interaction);
  }
}

/**
 * Handle GIF selection
 */
async function handleGifSelection(
  interaction: ButtonInteraction,
): Promise<void> {
  await interaction.deferUpdate();

  // Parse: gif_select_{searchId}_{index}
  const parts = interaction.customId.split("_");
  const index = parseInt(parts[parts.length - 1]);
  const searchId = parts.slice(2, -1).join("_");

  logger.debug(CONTEXT, "GIF selection started", {
    searchId,
    index,
    userId: interaction.user.id,
    userTag: interaction.user.tag,
  });

  const state = getSearchState(searchId);

  if (!state) {
    logger.warn(CONTEXT, "Search state not found for GIF selection", {
      searchId,
      userId: interaction.user.id,
      availableSearchIds: getAllSearchIds(),
    });
    await interaction.followUp({
      content:
        "❌ This search has expired. Please start a new search with `/gifsearch`.",
      ephemeral: true,
    });
    return;
  }

  // Check if user is the one who initiated the search
  if (interaction.user.id !== state.userId) {
    logger.warn(CONTEXT, "User trying to use another user's search", {
      searchId,
      searchOwnerId: state.userId,
      attemptedBy: interaction.user.id,
    });
    await interaction.followUp({
      content:
        "❌ This is not your search! Use `/gifsearch` to start your own.",
      ephemeral: true,
    });
    return;
  }

  // Get selected GIF
  const currentGifs = getCurrentPageGifs(state);
  const selectedGif = currentGifs[index];

  if (!selectedGif) {
    logger.error(CONTEXT, "Invalid GIF index selected", {
      searchId,
      index,
      availableGifs: currentGifs.length,
    });
    await interaction.followUp({
      content: "❌ Invalid GIF selection.",
      ephemeral: true,
    });
    return;
  }

  logger.info(CONTEXT, "GIF selected", {
    searchId,
    gifId: selectedGif.id,
    gifTitle: selectedGif.title,
    userId: interaction.user.id,
  });

  // Update state with selected GIF and verify
  const updateResult = updateSearchState(searchId, { selectedGif });

  if (!updateResult.success) {
    logger.error(CONTEXT, "Failed to update state with selected GIF", {
      searchId,
      error: updateResult.error,
    });
    await interaction.followUp({
      content: "❌ Failed to save your selection. Please try again.",
      ephemeral: true,
    });
    return;
  }

  // Verify state was updated correctly
  const verifiedState = getSearchState(searchId);
  if (!verifiedState || !verifiedState.selectedGif) {
    logger.error(CONTEXT, "State verification failed after update", {
      searchId,
      stateExists: !!verifiedState,
      hasSelectedGif: !!verifiedState?.selectedGif,
    });
    await interaction.followUp({
      content: "❌ Failed to save your selection. Please start a new search.",
      ephemeral: true,
    });
    return;
  }

  logger.info(CONTEXT, "State update verified successfully", {
    searchId,
    selectedGifId: verifiedState.selectedGif.id,
  });

  // Get saved faces for user
  const userId = interaction.user.id;
  const savedFaces = await getUserFaces(userId);
  const prefs = await getUserPreferences(userId);

  logger.debug(CONTEXT, "Showing face selection UI", {
    searchId,
    userId,
    savedFacesCount: savedFaces.length,
    hasDefaultFace: !!prefs.default_face_id,
  });

  // Build face selection UI
  const faceButtons = buildFaceSelectionUI(
    savedFaces,
    searchId,
    prefs.default_face_id,
  );

  // Show face selection or upload prompt
  await interaction.editReply({
    content: `✅ GIF selected! Choose a face:`,
    components: faceButtons,
    embeds: [
      new EmbedBuilder()
        .setTitle("✅ Selected GIF")
        .setDescription(
          `**"${selectedGif.title}"**\n\nChoose a saved face or upload a new one!`,
        )
        .setImage(getGifUrl(selectedGif))
        .setColor(0x00ff00)
        .setFooter({
          text:
            savedFaces.length > 0
              ? "Click a saved face or upload new"
              : "Upload your face image",
        }),
    ],
  });
}

/**
 * Handle page navigation
 */
async function handlePageNavigation(
  interaction: ButtonInteraction,
  direction: "next" | "prev",
): Promise<void> {
  await interaction.deferUpdate();

  // Parse searchId
  const parts = interaction.customId.split("_");
  const searchId = parts.slice(2).join("_");

  const state = getSearchState(searchId);

  if (!state) {
    await interaction.followUp({
      content:
        "❌ This search has expired. Please start a new search with `/gifsearch`.",
      ephemeral: true,
    });
    return;
  }

  // Check if user is the one who initiated the search
  if (interaction.user.id !== state.userId) {
    await interaction.followUp({
      content: "❌ This is not your search!",
      ephemeral: true,
    });
    return;
  }

  // Update page
  const newPage =
    direction === "next"
      ? Math.min(state.currentPage + 1, state.totalPages - 1)
      : Math.max(state.currentPage - 1, 0);

  updateSearchState(searchId, { currentPage: newPage });

  // Get new page GIFs
  const newState = getSearchState(searchId)!;
  const currentGifs = getCurrentPageGifs(newState);

  // Rebuild UI
  const embeds = buildGifEmbeds(
    currentGifs,
    state.query,
    newState.currentPage,
    newState.totalPages,
  );
  const components = buildGifSelectionUI(
    searchId,
    currentGifs,
    newState.currentPage,
    newState.totalPages,
  );

  await interaction.editReply({
    content: `✅ Showing page ${newState.currentPage + 1} of ${
      newState.totalPages
    }`,
    embeds,
    components,
  });

  logger.info(CONTEXT, "User navigated to new page", {
    userId: interaction.user.id,
    searchId,
    newPage: newState.currentPage + 1,
    totalPages: newState.totalPages,
    direction,
  });
}

/**
 * Build face selection UI with saved faces
 */
function buildFaceSelectionUI(
  savedFaces: any[],
  searchId: string,
  defaultFaceId: string | null,
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  // Add saved face buttons (max 3)
  if (savedFaces.length > 0) {
    const faceRow = new ActionRowBuilder<ButtonBuilder>();

    savedFaces.forEach((face) => {
      const isDefault = face.id === defaultFaceId;
      faceRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`face_select|${searchId}|${face.id}`)
          .setLabel(`${isDefault ? "⭐ " : ""}${face.name}`)
          .setStyle(ButtonStyle.Primary),
      );
    });

    rows.push(faceRow);
  }

  // Add upload new button
  const uploadRow = new ActionRowBuilder<ButtonBuilder>();
  uploadRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`face_upload|${searchId}`)
      .setLabel("📤 Upload New Face")
      .setStyle(ButtonStyle.Secondary),
  );
  rows.push(uploadRow);

  return rows;
}

/**
 * Handle saved face selection
 */
async function handleSavedFaceSelection(
  interaction: ButtonInteraction,
): Promise<void> {
  await interaction.deferUpdate();

  // Parse custom ID
  const { searchId, faceId, legacy } = parseSearchAndFaceId(
    interaction.customId,
  );

  logger.debug(CONTEXT, "Saved face selection started", {
    searchId,
    faceId,
    userId: interaction.user.id,
    customId: interaction.customId,
    legacyFormat: legacy,
  });

  if (!searchId || !faceId) {
    logger.error(CONTEXT, "Invalid custom ID for saved face selection", {
      customId: interaction.customId,
    });
    await interaction.followUp({
      content:
        "❌ Something went wrong with this button. Please start a new search.",
      ephemeral: true,
    });
    return;
  }

  // Get and validate state
  const state = getSearchState(searchId);

  logger.debug(CONTEXT, "Retrieved state for saved face selection", {
    searchId,
    stateExists: !!state,
    hasSelectedGif: !!state?.selectedGif,
    selectedGifId: state?.selectedGif?.id,
    availableSearchIds: getAllSearchIds(),
  });

  if (!state) {
    logger.error(CONTEXT, "State not found for saved face selection", {
      searchId,
      userId: interaction.user.id,
    });
    await interaction.followUp({
      content:
        "❌ Search session expired. Please start a new search with `/gifsearch`.",
      ephemeral: true,
    });
    return;
  }

  if (!state.selectedGif) {
    logger.error(CONTEXT, "State found but no selectedGif", {
      searchId,
      userId: interaction.user.id,
      stateKeys: Object.keys(state),
    });
    await interaction.followUp({
      content:
        "❌ No GIF selected. Please start a new search with `/gifsearch`.",
      ephemeral: true,
    });
    return;
  }

  // Verify user owns this search
  if (interaction.user.id !== state.userId) {
    logger.warn(
      CONTEXT,
      "User trying to use another user's saved face selection",
      {
        searchId,
        searchOwnerId: state.userId,
        attemptedBy: interaction.user.id,
      },
    );
    await interaction.followUp({
      content: "❌ This is not your search!",
      ephemeral: true,
    });
    return;
  }

  // Get face from database
  const { getFaceById } = require("../utils/faceStorage");
  const face = getFaceById(faceId, interaction.user.id);

  if (!face) {
    logger.error(CONTEXT, "Saved face not found", {
      searchId,
      faceId,
      userId: interaction.user.id,
    });
    await interaction.followUp({
      content:
        "❌ Face not found. It may have been deleted. Please use `/myfaces` to check your saved faces.",
      ephemeral: true,
    });
    return;
  }

  logger.info(CONTEXT, "Using saved face for face swap", {
    searchId,
    faceId,
    faceName: face.name,
    userId: interaction.user.id,
    gifId: state.selectedGif.id,
  });

  // Increment usage count
  incrementFaceUsage(faceId, interaction.user.id);

  // Update UI
  await interaction.editReply({
    content: "🔄 Processing face swap with saved face...",
    components: [],
    embeds: [
      new EmbedBuilder()
        .setTitle("🔄 Processing")
        .setDescription(
          `Using saved face: **${face.name}**\n\nThis may take 1-3 minutes...`,
        )
        .setColor(0x5865f2),
    ],
  });

  // Process face swap directly with saved face
  const channel = interaction.channel as TextChannel;

  logger.debug(CONTEXT, "Starting face swap with saved face", {
    searchId,
    userId: interaction.user.id,
    facePath: face.magic_hour_path,
    gifId: state.selectedGif.id,
  });

  await processFaceSwapWithSavedFace(
    channel,
    state.selectedGif,
    face.magic_hour_path,
    searchId,
    interaction.user.id,
  );
}

/**
 * Handle face upload prompt
 */
async function handleFaceUploadPrompt(
  interaction: ButtonInteraction,
): Promise<void> {
  await interaction.deferUpdate();

  // Parse: face_upload|{searchId}
  let searchId: string | null = null;
  if (interaction.customId.includes("|")) {
    const [, extractedSearchId] = interaction.customId.split("|");
    searchId = extractedSearchId;
  } else {
    // Legacy fallback: face_upload_{searchId}
    const parts = interaction.customId.split("_");
    searchId = parts.slice(2).join("_");
  }

  if (!searchId) {
    logger.error(CONTEXT, "Invalid custom ID for face upload prompt", {
      customId: interaction.customId,
    });
    await interaction.followUp({
      content: "❌ Invalid state. Please start a new search with `/gifsearch`.",
      ephemeral: true,
    });
    return;
  }

  const state = getSearchState(searchId);
  if (!state || !state.selectedGif) {
    await interaction.followUp({
      content: "❌ Invalid state. Please start a new search.",
      ephemeral: true,
    });
    return;
  }

  // Verify user owns this search
  if (interaction.user.id !== state.userId) {
    await interaction.followUp({
      content: "❌ This is not your search!",
      ephemeral: true,
    });
    return;
  }

  // Show upload prompt
  await interaction.editReply({
    content:
      "📤 Please upload your face image as an attachment in your next message.",
    components: [],
    embeds: [
      new EmbedBuilder()
        .setTitle("📤 Upload Face")
        .setDescription("Upload your face image now!")
        .setColor(0x5865f2)
        .setFooter({ text: "You have 5 minutes to upload your image" }),
    ],
  });

  // Start waiting for upload
  await waitForFaceUpload(interaction, searchId, state.selectedGif);
}

/**
 * Process face swap with saved face
 */
async function processFaceSwapWithSavedFace(
  channel: TextChannel,
  selectedGif: any,
  facePath: string,
  searchId: string,
  userId: string,
): Promise<void> {
  try {
    logger.info(CONTEXT, "Processing face swap with saved face", {
      searchId,
      userId,
      facePath,
      gifId: selectedGif.id,
    });

    // Download GIF from Tenor
    logger.debug(CONTEXT, "Downloading GIF from Tenor", {
      gifUrl: getGifUrl(selectedGif),
    });
    const gifUrl = getGifUrl(selectedGif);
    const gifResponse = await fetch(gifUrl);
    if (!gifResponse.ok) {
      throw new Error(`Failed to download GIF: ${gifResponse.statusText}`);
    }
    const gifBuffer = Buffer.from(await gifResponse.arrayBuffer());

    // Upload GIF to Magic Hour
    logger.debug(CONTEXT, "Uploading GIF to Magic Hour");
    const gifPath = await uploadToMagicHour(gifBuffer, "gif");
    logger.info(CONTEXT, "Files ready for video face swap", {
      facePath,
      gifPath,
    });

    // Get user preferences for max duration
    const prefs = await getUserPreferences(userId);
    const maxDuration = prefs.max_gif_duration || 20;

    logger.debug(CONTEXT, "Starting Magic Hour video face swap", {
      maxDuration,
    });

    // Process face swap
    const result = await swapFacesInVideo(facePath, gifPath, maxDuration);

    logger.info(CONTEXT, "Video face swap completed", {
      projectId: result.id,
      creditsUsed: result.creditsCharged,
    });

    // Download result
    logger.debug(CONTEXT, "Downloading video result", {
      url: result.downloadUrl,
    });
    const resultResponse = await fetch(result.downloadUrl);
    if (!resultResponse.ok) {
      throw new Error(
        `Failed to download result: ${resultResponse.statusText}`,
      );
    }

    const resultBuffer = Buffer.from(await resultResponse.arrayBuffer());

    // Detect extension
    const urlPath = new URL(result.downloadUrl).pathname;
    const extension = urlPath.split(".").pop()?.toLowerCase() || "mp4";
    const isGif = extension === "gif";

    logger.debug(CONTEXT, "Result file details", {
      extension,
      sizeBytes: resultBuffer.length,
    });

    // Create attachment
    const attachment = new AttachmentBuilder(resultBuffer, {
      name: `faceswap_${Date.now()}.${extension}`,
    });

    // Track in history
    const db = getDatabase();
    const swapId = `swap_${userId}_${Date.now()}`;
    await db.swapHistory.create({
      data: {
        id: swapId,
        userId: userId,
        swapType: "gif",
        creditsUsed: result.creditsCharged,
        createdAt: BigInt(Date.now()),
      },
    });

    // Send result PUBLICLY
    if (channel.isTextBased() && !channel.isDMBased()) {
      await (channel as TextChannel).send({
        content: `✅ Face swap complete! Used ${
          result.creditsCharged
        } credits.${
          isGif
            ? "\n🎉 Result is an animated GIF!"
            : "\n💡 Result is in MP4 format."
        }`,
        files: [attachment],
      });
    }

    logger.info(CONTEXT, "Face swap with saved face sent to channel", {
      userId,
      searchId,
      creditsUsed: result.creditsCharged,
      extension,
    });

    // Clean up search state
    deleteSearchState(searchId);
  } catch (error: any) {
    logger.error(
      CONTEXT,
      "Error processing face swap with saved face",
      {
        searchId,
        userId,
      },
      error,
    );
    if (channel.isTextBased()) {
      await channel.send({
        content: `❌ <@${userId}> Face swap failed: ${error.message}`,
      });
    }
    deleteSearchState(searchId);
  }
}

/**
 * Handle search cancellation
 */
async function handleSearchCancel(
  interaction: ButtonInteraction,
): Promise<void> {
  await interaction.deferUpdate();

  const parts = interaction.customId.split("_");
  const searchId = parts.slice(2).join("_");

  const state = getSearchState(searchId);

  if (state && interaction.user.id !== state.userId) {
    await interaction.followUp({
      content: "❌ This is not your search!",
      ephemeral: true,
    });
    return;
  }

  // Delete state
  deleteSearchState(searchId);

  await interaction.editReply({
    content: "❌ Search cancelled.",
    embeds: [],
    components: [],
  });

  logger.info(CONTEXT, "User cancelled search", {
    userId: interaction.user.id,
    searchId,
  });
}

/**
 * Wait for user to upload face image
 */
async function waitForFaceUpload(
  interaction: ButtonInteraction,
  searchId: string,
  selectedGif: any,
): Promise<void> {
  const channel = interaction.channel as TextChannel;
  const userId = interaction.user.id;

  logger.info(CONTEXT, "Waiting for face upload", {
    userId,
    searchId,
    channelId: channel.id,
  });

  // Create message collector - only collect messages with attachments
  const collector = channel.createMessageCollector({
    filter: (m) => {
      const hasAttachment = m.attachments.size > 0;
      const isCorrectUser = m.author.id === userId;

      logger.debug(CONTEXT, "Message filter check", {
        authorId: m.author.id,
        authorTag: m.author.tag,
        isCorrectUser,
        attachmentCount: m.attachments.size,
        passFilter: isCorrectUser && hasAttachment,
      });

      return isCorrectUser && hasAttachment;
    },
    time: 5 * 60 * 1000, // 5 minutes
  });

  logger.debug(CONTEXT, "Message collector started", {
    userId,
    timeout: "5 minutes",
  });

  let collected = false;

  collector.on("collect", async (message: Message) => {
    logger.info(CONTEXT, "Collector received message", {
      messageId: message.id,
      authorTag: message.author.tag,
      attachmentCount: message.attachments.size,
    });

    if (collected) {
      logger.debug(CONTEXT, "Already collected, ignoring message");
      return;
    }

    // Check if message has an image attachment
    const attachment = message.attachments.first();

    if (!attachment) {
      // This should never happen due to filter, but just in case
      logger.warn(CONTEXT, "No attachment found (shouldn't happen)");
      await message.reply({
        content: "❌ Please upload an image file. You have 5 minutes.",
      });
      return;
    }

    logger.debug(CONTEXT, "Attachment details", {
      name: attachment.name,
      sizeBytes: attachment.size,
      contentType: attachment.contentType,
      url: attachment.url,
    });

    // Validate it's an image using contentType (more reliable than URL)
    const validImageTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/avif",
      "image/tiff",
      "image/bmp",
    ];

    if (
      !attachment.contentType ||
      !validImageTypes.includes(attachment.contentType.toLowerCase())
    ) {
      logger.warn(CONTEXT, "Invalid content type", {
        contentType: attachment.contentType,
        validTypes: validImageTypes,
      });
      await message.reply({
        content:
          "❌ Please upload a valid image (PNG, JPG, JPEG, WEBP). You have 5 minutes.",
      });
      return;
    }

    collected = true;
    collector.stop();

    logger.info(CONTEXT, "Valid image received, starting face swap", {
      userId,
      attachmentName: attachment.name,
      searchId,
    });

    // Process face swap
    await processFaceSwap(message, selectedGif, attachment.url, searchId);
  });

  collector.on("end", (collectedMessages, reason) => {
    logger.info(CONTEXT, "Collector ended", {
      reason,
      collectedCount: collectedMessages.size,
      processed: collected,
      userId,
      searchId,
    });

    if (!collected) {
      logger.warn(CONTEXT, "Timeout - no valid image uploaded", {
        userId,
        searchId,
      });
      if (channel.isTextBased()) {
        channel.send({
          content: `❌ <@${userId}> Timeout! You didn't upload a face image in time. Use \`/gifsearch\` to try again.`,
        });
      }
      deleteSearchState(searchId);
    }
  });
}

/**
 * Process the face swap
 */
async function processFaceSwap(
  message: Message,
  selectedGif: any,
  faceImageUrl: string,
  searchId: string,
): Promise<void> {
  const channel = message.channel;

  logger.info(CONTEXT, "Processing face swap from uploaded image", {
    userId: message.author.id,
    searchId,
    faceImageUrl,
    gifId: selectedGif.id,
  });

  // Send ephemeral status message (only visible to user)
  const statusMsg = await message.reply({
    content: "🔄 Downloading files...",
  });

  try {
    // Download GIF from Tenor
    logger.debug(CONTEXT, "Downloading GIF from Tenor", {
      gifUrl: getGifUrl(selectedGif),
    });
    const gifUrl = getGifUrl(selectedGif);
    const gifResponse = await fetch(gifUrl);
    if (!gifResponse.ok) {
      throw new Error(`Failed to download GIF: ${gifResponse.statusText}`);
    }
    const gifBuffer = Buffer.from(await gifResponse.arrayBuffer());
    logger.debug(CONTEXT, "GIF downloaded", { sizeBytes: gifBuffer.length });

    // Download face image
    logger.debug(CONTEXT, "Downloading face image", { faceImageUrl });
    const faceResponse = await fetch(faceImageUrl);
    if (!faceResponse.ok) {
      throw new Error(
        `Failed to download face image: ${faceResponse.statusText}`,
      );
    }
    const faceBuffer = Buffer.from(await faceResponse.arrayBuffer());
    logger.debug(CONTEXT, "Face image downloaded", {
      sizeBytes: faceBuffer.length,
    });

    // Upload to Magic Hour
    await statusMsg.edit({ content: "🔄 Uploading to Magic Hour..." });
    logger.debug(CONTEXT, "Uploading files to Magic Hour");

    const [facePath, gifPath] = await Promise.all([
      uploadToMagicHour(faceBuffer, "jpg"),
      uploadToMagicHour(gifBuffer, "gif"),
    ]);

    logger.info(CONTEXT, "Files uploaded to Magic Hour", {
      facePath,
      gifPath,
    });

    // Process face swap
    await statusMsg.edit({
      content: "🔄 Processing face swap... This may take 1-3 minutes.",
    });
    logger.debug(CONTEXT, "Starting Magic Hour face swap");

    const result = await swapFacesInVideo(facePath, gifPath, 30);

    logger.info(CONTEXT, "Face swap complete", {
      creditsUsed: result.creditsCharged,
      downloadUrl: result.downloadUrl,
    });

    // Download result
    logger.debug(CONTEXT, "Downloading result", { url: result.downloadUrl });
    const resultResponse = await fetch(result.downloadUrl);
    if (!resultResponse.ok) {
      throw new Error(
        `Failed to download result: ${resultResponse.statusText}`,
      );
    }

    const resultBuffer = Buffer.from(await resultResponse.arrayBuffer());

    // Detect extension
    const urlPath = new URL(result.downloadUrl).pathname;
    const extension = urlPath.split(".").pop()?.toLowerCase() || "mp4";
    const isGif = extension === "gif";

    logger.debug(CONTEXT, "Result file details", {
      extension,
      isGif,
      sizeBytes: resultBuffer.length,
    });

    // Create attachment
    const attachment = new AttachmentBuilder(resultBuffer, {
      name: `faceswap_${Date.now()}.${extension}`,
    });

    // Track in history
    const db = getDatabase();
    const userId = message.author.id;
    const swapId = `swap_${userId}_${Date.now()}`;
    await db.swapHistory.create({
      data: {
        id: swapId,
        userId: userId,
        swapType: "gif",
        creditsUsed: result.creditsCharged,
        createdAt: BigInt(Date.now()),
      },
    });

    // Delete ephemeral status message
    await statusMsg.delete().catch(() => {});

    // Send final result PUBLICLY to channel (everyone can see)
    if (channel.isTextBased() && !channel.isDMBased()) {
      await (channel as TextChannel).send({
        content: `✅ Face swap complete! Used ${
          result.creditsCharged
        } credits.${
          isGif
            ? "\n🎉 Result is an animated GIF!"
            : "\n💡 Result is in MP4 format."
        }`,
        files: [attachment],
      });
    }

    logger.info(CONTEXT, "Face swap completed and sent to channel", {
      userId: message.author.id,
      searchId,
      creditsUsed: result.creditsCharged,
      extension,
    });

    // Clean up search state
    deleteSearchState(searchId);
  } catch (error: any) {
    logger.error(
      CONTEXT,
      "Face swap failed",
      {
        userId: message.author.id,
        searchId,
      },
      error,
    );
    await statusMsg.edit({
      content: `❌ Face swap failed: ${error.message}`,
    });
    deleteSearchState(searchId);
  }
}

// ============================================================
// Native GIF Face Swap Handlers
// ============================================================

/**
 * Handle native GIF swap button click
 * Shows face selection UI (saved faces + upload option)
 */
async function handleNativeGifSwapButton(
  interaction: ButtonInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  // Parse: native_gif_swap|{sessionId}
  const sessionId = interaction.customId.split("|")[1];
  const userId = interaction.user.id;

  logger.info(CONTEXT, "Native GIF swap button clicked", {
    sessionId,
    userId,
  });

  // Get state
  const state = getNativeGifState(sessionId);
  if (!state) {
    await interaction.editReply({
      content: "❌ Session expired. Please post the GIF again.",
    });
    return;
  }

  // Verify user
  if (state.userId !== userId) {
    await interaction.editReply({
      content: "❌ You can only swap your own GIF!",
    });
    return;
  }

  // Get saved faces
  const savedFaces = await getUserFaces(userId);
  const prefs = await getUserPreferences(userId);

  logger.debug(CONTEXT, "Showing face selection for native GIF", {
    sessionId,
    userId,
    savedFacesCount: savedFaces.length,
  });

  // Build face selection UI
  const faceButtons = buildNativeGifFaceSelectionUI(
    savedFaces,
    sessionId,
    prefs.default_face_id,
  );

  // Show face selection
  await interaction.editReply({
    content: "✅ Choose a face for the swap:",
    components: faceButtons,
  });
}

/**
 * Build face selection UI for native GIF
 */
function buildNativeGifFaceSelectionUI(
  faces: any[],
  sessionId: string,
  defaultFaceId: string | null,
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  // Add saved face buttons
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
 * Handle saved face selection for native GIF
 */
async function handleNativeGifFaceSelect(
  interaction: ButtonInteraction,
): Promise<void> {
  await interaction.deferUpdate();

  // Parse: native_face_select|{sessionId}|{faceId}
  const [, sessionId, faceId] = interaction.customId.split("|");
  const userId = interaction.user.id;

  logger.info(CONTEXT, "Native GIF face selected", {
    sessionId,
    faceId,
    userId,
  });

  // Get state
  const state = getNativeGifState(sessionId);
  if (!state) {
    await interaction.followUp({
      content: "❌ Session expired. Please post the GIF again.",
      ephemeral: true,
    });
    return;
  }

  // Get face
  const face = await getUserFaces(userId);
  const selectedFace = face.find((f) => f.id === faceId);
  if (!selectedFace) {
    await interaction.followUp({
      content: "❌ Face not found.",
      ephemeral: true,
    });
    return;
  }

  // Update state
  updateNativeGifState(sessionId, { selectedFaceId: faceId });

  // Start face swap
  await processNativeGifFaceSwap(
    interaction,
    state,
    selectedFace.magic_hour_path,
  );

  // Increment usage
  await incrementFaceUsage(faceId, userId);
}

/**
 * Handle face upload for native GIF
 */
async function handleNativeGifFaceUpload(
  interaction: ButtonInteraction,
): Promise<void> {
  await interaction.deferUpdate();

  // Parse: native_upload_face|{sessionId}
  const sessionId = interaction.customId.split("|")[1];
  const userId = interaction.user.id;

  logger.info(CONTEXT, "Native GIF face upload requested", {
    sessionId,
    userId,
  });

  // Get state
  const state = getNativeGifState(sessionId);
  if (!state) {
    await interaction.followUp({
      content: "❌ Session expired. Please post the GIF again.",
      ephemeral: true,
    });
    return;
  }

  // Prompt for upload
  await interaction.editReply({
    content:
      "📤 **Upload Your Face**\n\nPlease upload an image containing a face in your next message in this channel.\n\nYou have 2 minutes.",
    components: [],
  });

  // Wait for image upload
  const channel = interaction.channel;
  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    await interaction.followUp({
      content: "❌ Cannot collect messages in this channel.",
      ephemeral: true,
    });
    return;
  }

  const collector = (channel as TextChannel).createMessageCollector({
    filter: (m: Message) =>
      m.author.id === userId &&
      m.attachments.size > 0 &&
      !!m.attachments.first()?.contentType?.startsWith("image/"),
    time: 2 * 60 * 1000, // 2 minutes
    max: 1,
  });

  collector.on("collect", async (message: Message) => {
    const attachment = message.attachments.first();
    if (!attachment) return;

    try {
      // Download image
      const response = await fetch(attachment.url);
      if (!response.ok) {
        throw new Error("Failed to download image");
      }
      const buffer = Buffer.from(await response.arrayBuffer());

      // Upload to Magic Hour
      const facePath = await uploadToMagicHour(
        buffer,
        attachment.name?.split(".").pop() || "jpg",
      );

      // Start face swap
      await processNativeGifFaceSwap(interaction, state, facePath);

      // Delete user's upload message to keep channel clean
      try {
        await message.delete();
      } catch {
        // Ignore if can't delete
      }
    } catch (error: any) {
      logger.error(
        CONTEXT,
        "Error processing uploaded face for native GIF",
        { sessionId, userId },
        error,
      );
      await interaction.followUp({
        content: `❌ Error processing image: ${error.message}`,
        ephemeral: true,
      });
    }
  });

  collector.on("end", (collected: any, reason: string) => {
    if (collected.size === 0 && reason === "time") {
      interaction.followUp({
        content: "⏱️ Timeout! You didn't upload an image in time.",
        ephemeral: true,
      });
    }
  });
}

/**
 * Process face swap for native GIF
 */
async function processNativeGifFaceSwap(
  interaction: ButtonInteraction,
  state: any,
  facePath: string,
): Promise<void> {
  const userId = interaction.user.id;
  const sessionId = state.id;

  try {
    // Update status
    await interaction.editReply({
      content: "🔄 Processing face swap... This may take a minute.",
      components: [],
    });

    logger.info(CONTEXT, "Starting native GIF face swap", {
      sessionId,
      userId,
      gifUrl: state.gifUrl.substring(0, 50) + "...",
    });

    // Download GIF
    const gifResponse = await fetch(state.gifUrl);
    if (!gifResponse.ok) {
      throw new Error(`Failed to download GIF: ${gifResponse.statusText}`);
    }
    const gifBuffer = Buffer.from(await gifResponse.arrayBuffer());

    // Upload GIF to Magic Hour
    const gifPath = await uploadToMagicHour(gifBuffer, "gif");

    // Get user preferences for max duration
    const prefs = await getUserPreferences(userId);
    const maxDuration = prefs.max_gif_duration || 20;

    // Process face swap
    const result = await swapFacesInVideo(facePath, gifPath, maxDuration);

    logger.info(CONTEXT, "Native GIF face swap completed", {
      sessionId,
      creditsUsed: result.creditsCharged,
    });

    // Download result
    const resultResponse = await fetch(result.downloadUrl);
    if (!resultResponse.ok) {
      throw new Error(
        `Failed to download result: ${resultResponse.statusText}`,
      );
    }

    const resultBuffer = Buffer.from(await resultResponse.arrayBuffer());

    // Detect extension
    const urlPath = new URL(result.downloadUrl).pathname;
    const extension = urlPath.split(".").pop()?.toLowerCase() || "mp4";
    const isGif = extension === "gif";

    // Create attachment
    const attachment = new AttachmentBuilder(resultBuffer, {
      name: `faceswap_${Date.now()}.${extension}`,
    });

    // Track in history
    const db = getDatabase();
    const swapId = `swap_${userId}_${Date.now()}`;
    await db.swapHistory.create({
      data: {
        id: swapId,
        userId: userId,
        swapType: "gif",
        creditsUsed: result.creditsCharged,
        createdAt: BigInt(Date.now()),
      },
    });

    // Get channel and post result publicly
    const channel = interaction.channel;
    if (channel && channel.isTextBased() && !channel.isDMBased()) {
      await (channel as TextChannel).send({
        content: `✅ <@${userId}> Face swap complete! Used ${
          result.creditsCharged
        } credits.${
          isGif
            ? "\n🎉 Result is an animated GIF!"
            : "\n💡 Result is in MP4 format."
        }`,
        files: [attachment],
      });
    }

    // Update interaction
    await interaction.editReply({
      content: "✅ Face swap complete! Check the channel for your result.",
      components: [],
    });

    // Clean up state
    deleteNativeGifState(sessionId);

    logger.info(CONTEXT, "Native GIF face swap posted successfully", {
      sessionId,
      userId,
    });
  } catch (error: any) {
    logger.error(
      CONTEXT,
      "Native GIF face swap failed",
      { sessionId, userId },
      error,
    );

    await interaction.editReply({
      content: `❌ Face swap failed: ${error.message}`,
      components: [],
    });

    deleteNativeGifState(sessionId);
  }
}
