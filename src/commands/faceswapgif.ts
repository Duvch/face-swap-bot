import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
} from "discord.js";
import {
  swapFacesInVideo,
  isValidImageUrl,
  isValidVideoUrl,
  getFriendlyErrorMessage,
  uploadToMagicHour,
} from "../utils/magicHour";
import { MagicHourError } from "../types";
import { checkRateLimit, recordAction } from "../utils/rateLimiter";
import { getDatabase } from "../utils/database";
import { logger } from "../utils/logger";

// Command definition for deployment
export const faceSwapGifCommandData = new SlashCommandBuilder()
  .setName("faceswapgif")
  .setDescription("Swap faces in an animated GIF or video (returns MP4)")
  .addAttachmentOption((option) =>
    option
      .setName("source_face")
      .setDescription("Image containing the face you want to use")
      .setRequired(true),
  )
  .addAttachmentOption((option) =>
    option
      .setName("target_gif")
      .setDescription("Animated GIF or video where the face will be swapped")
      .setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("max_duration")
      .setDescription("Maximum duration in seconds (default: 20, max: 30)")
      .setMinValue(1)
      .setMaxValue(30)
      .setRequired(false),
  );

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext || "jpg";
}

/**
 * Handle the /faceswapgif command
 */
const CONTEXT = "FaceSwapGifCommand";

export async function handleFaceSwapGifCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  // Check rate limit
  const userId = interaction.user.id;
  const rateLimitError = await checkRateLimit(userId, "faceswap");
  if (rateLimitError) {
    await interaction.reply({
      content: rateLimitError,
      ephemeral: true,
    });
    return;
  }

  // Defer reply immediately as video face swap takes time
  await interaction.deferReply();

  try {
    // Record action for rate limiting
    await recordAction(userId, "faceswap");
    // Get attachments from command options
    const sourceFaceAttachment = interaction.options.getAttachment(
      "source_face",
      true,
    );
    const targetGifAttachment = interaction.options.getAttachment(
      "target_gif",
      true,
    );
    const maxDuration = interaction.options.getInteger("max_duration") || 20;

    // Validate attachments exist
    if (!sourceFaceAttachment || !targetGifAttachment) {
      await interaction.editReply({
        content:
          "❌ Both files are required. Please upload a source face image and a target GIF/video.",
      });
      return;
    }

    // Validate source face is an image
    if (!isValidImageUrl(sourceFaceAttachment.url)) {
      await interaction.editReply({
        content:
          "❌ Invalid source face format. Please upload a PNG, JPG, JPEG, or WEBP image.",
      });
      return;
    }

    // Validate target is a video/GIF
    if (!isValidVideoUrl(targetGifAttachment.url)) {
      await interaction.editReply({
        content:
          "❌ Invalid target format. Please upload a GIF, MP4, MOV, or WEBM file.",
      });
      return;
    }

    // Validate file sizes (Discord has max 25MB for attachments by default)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (
      sourceFaceAttachment.size > maxSize ||
      targetGifAttachment.size > maxSize
    ) {
      await interaction.editReply({
        content:
          "❌ File(s) are too large. Please upload files smaller than 25MB.",
      });
      return;
    }

    logger.info(CONTEXT, "GIF face swap requested", {
      userId,
      userTag: interaction.user.tag,
      sourceName: sourceFaceAttachment.name,
      sourceSize: sourceFaceAttachment.size,
      targetName: targetGifAttachment.name,
      targetSize: targetGifAttachment.size,
      maxDuration,
    });

    // Update user with processing status
    await interaction.editReply({
      content: "🔄 Downloading files from Discord...",
    });

    // Download Discord attachments first (ephemeral URLs expire quickly!)
    logger.debug(CONTEXT, "Downloading source face from Discord");
    const sourceFaceResponse = await fetch(sourceFaceAttachment.url);
    if (!sourceFaceResponse.ok) {
      throw new Error(
        `Failed to download source image: ${sourceFaceResponse.statusText}`,
      );
    }
    const sourceFaceBuffer = Buffer.from(
      await sourceFaceResponse.arrayBuffer(),
    );

    logger.debug(CONTEXT, "Downloading target GIF/video from Discord");
    const targetGifResponse = await fetch(targetGifAttachment.url);
    if (!targetGifResponse.ok) {
      throw new Error(
        `Failed to download target GIF/video: ${targetGifResponse.statusText}`,
      );
    }
    const targetGifBuffer = Buffer.from(await targetGifResponse.arrayBuffer());

    // Upload to Magic Hour storage
    await interaction.editReply({
      content: "🔄 Uploading files to Magic Hour...",
    });

    logger.debug(CONTEXT, "Uploading files to Magic Hour storage");
    const [sourcePath, targetPath] = await Promise.all([
      uploadToMagicHour(
        sourceFaceBuffer,
        getFileExtension(sourceFaceAttachment.name),
      ),
      uploadToMagicHour(
        targetGifBuffer,
        getFileExtension(targetGifAttachment.name),
      ),
    ]);

    logger.info(CONTEXT, "Files uploaded to Magic Hour", {
      facePath: sourcePath,
      targetPath,
    });

    // Update user with processing status
    await interaction.editReply({
      content: `🔄 Processing face swap in video/GIF... This may take 1-3 minutes for a ${maxDuration}s clip.`,
    });

    // Perform face swap using Magic Hour Video API with uploaded file paths
    const result = await swapFacesInVideo(sourcePath, targetPath, maxDuration);

    // Download the result
    logger.debug(CONTEXT, "Downloading result", {
      url: result.downloadUrl,
    });
    const response = await fetch(result.downloadUrl);

    if (!response.ok) {
      throw new Error(`Failed to download result: ${response.statusText}`);
    }

    const resultBuffer = Buffer.from(await response.arrayBuffer());

    // Detect file extension from Magic Hour's download URL
    const urlPath = new URL(result.downloadUrl).pathname;
    const extension = urlPath.split(".").pop()?.toLowerCase() || "mp4";
    const isGif = extension === "gif";

    logger.debug(CONTEXT, "Result file type detected", { extension });

    // Create attachment with correct extension
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

    // Send the result to the user
    await interaction.editReply({
      content: `✅ Face swap complete! Used ${result.creditsCharged} credits.${
        isGif
          ? "\n🎉 Result is an animated GIF!"
          : "\n💡 Result is in MP4 format (plays inline on Discord)."
      }`,
      files: [attachment],
    });

    logger.info(CONTEXT, "GIF face swap completed", {
      userId,
      creditsUsed: result.creditsCharged,
      extension,
    });
  } catch (error: any) {
    logger.error(CONTEXT, "Error in GIF face swap command", { userId }, error);

    // Get user-friendly error message
    const errorMessage = error.code
      ? getFriendlyErrorMessage(error as MagicHourError)
      : `❌ An error occurred: ${error.message || "Unknown error"}`;

    await interaction.editReply({
      content: errorMessage,
    });
  }
}
