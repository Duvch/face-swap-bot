import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
} from "discord.js";
import {
  swapFaces,
  isValidImageUrl,
  getFriendlyErrorMessage,
  uploadToMagicHour,
} from "../utils/magicHour";
import { MagicHourError } from "../types";
import { checkRateLimit, recordAction } from "../utils/rateLimiter";
import { getDatabase } from "../utils/database";
import { logger } from "../utils/logger";

// Command definition for deployment
export const faceSwapCommandData = new SlashCommandBuilder()
  .setName("faceswap")
  .setDescription("Swap faces between two images using AI")
  .addAttachmentOption((option) =>
    option
      .setName("source_face")
      .setDescription("Image containing the face you want to use")
      .setRequired(true),
  )
  .addAttachmentOption((option) =>
    option
      .setName("target_image")
      .setDescription("Image where the face will be swapped")
      .setRequired(true),
  );

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext || "jpg";
}

const CONTEXT = "FaceSwapCommand";

/**
 * Handle the /faceswap command
 */
export async function handleFaceSwapCommand(
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

  // Defer reply immediately as face swap takes time
  await interaction.deferReply();

  try {
    // Record action for rate limiting
    await recordAction(userId, "faceswap");
    // Get attachments from command options
    const sourceFaceAttachment = interaction.options.getAttachment(
      "source_face",
      true,
    );
    const targetImageAttachment = interaction.options.getAttachment(
      "target_image",
      true,
    );

    // Validate attachments exist
    if (!sourceFaceAttachment || !targetImageAttachment) {
      await interaction.editReply({
        content:
          "❌ Both images are required. Please upload a source face and a target image.",
      });
      return;
    }

    // Validate file types
    if (!isValidImageUrl(sourceFaceAttachment.url)) {
      await interaction.editReply({
        content:
          "❌ Invalid source face image format. Please upload a PNG, JPG, JPEG, or WEBP image.",
      });
      return;
    }

    if (!isValidImageUrl(targetImageAttachment.url)) {
      await interaction.editReply({
        content:
          "❌ Invalid target image format. Please upload a PNG, JPG, JPEG, or WEBP image.",
      });
      return;
    }

    // Validate file sizes (Discord has max 25MB for attachments by default)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (
      sourceFaceAttachment.size > maxSize ||
      targetImageAttachment.size > maxSize
    ) {
      await interaction.editReply({
        content:
          "❌ Image files are too large. Please upload images smaller than 25MB.",
      });
      return;
    }

    logger.info(CONTEXT, "Face swap requested", {
      userId,
      userTag: interaction.user.tag,
      sourceName: sourceFaceAttachment.name,
      sourceSize: sourceFaceAttachment.size,
      targetName: targetImageAttachment.name,
      targetSize: targetImageAttachment.size,
    });

    // Update user with processing status
    await interaction.editReply({
      content: "🔄 Downloading images from Discord...",
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

    logger.debug(CONTEXT, "Downloading target image from Discord");
    const targetImageResponse = await fetch(targetImageAttachment.url);
    if (!targetImageResponse.ok) {
      throw new Error(
        `Failed to download target image: ${targetImageResponse.statusText}`,
      );
    }
    const targetImageBuffer = Buffer.from(
      await targetImageResponse.arrayBuffer(),
    );

    // Upload to Magic Hour storage
    await interaction.editReply({
      content: "🔄 Uploading images to Magic Hour...",
    });

    logger.debug(CONTEXT, "Uploading images to Magic Hour storage");
    const [sourcePath, targetPath] = await Promise.all([
      uploadToMagicHour(
        sourceFaceBuffer,
        getFileExtension(sourceFaceAttachment.name),
      ),
      uploadToMagicHour(
        targetImageBuffer,
        getFileExtension(targetImageAttachment.name),
      ),
    ]);

    logger.info(CONTEXT, "Files uploaded to Magic Hour", {
      sourcePath,
      targetPath,
    });

    // Update user with processing status
    await interaction.editReply({
      content: "🔄 Processing face swap... This may take 10-30 seconds.",
    });

    // Perform face swap using Magic Hour API with uploaded file paths
    const result = await swapFaces(sourcePath, targetPath);

    // Download the result image
    logger.debug(CONTEXT, "Downloading result", {
      url: result.downloadUrl,
    });
    const response = await fetch(result.downloadUrl);

    if (!response.ok) {
      throw new Error(`Failed to download result: ${response.statusText}`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Create attachment from buffer
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `faceswap_${Date.now()}.png`,
    });

    // Track in history
    const db = getDatabase();
    const swapId = `swap_${userId}_${Date.now()}`;
    await db.swapHistory.create({
      data: {
        id: swapId,
        userId: userId,
        swapType: "image",
        creditsUsed: result.creditsCharged,
        createdAt: BigInt(Date.now()),
      },
    });

    // Send the result to the user
    await interaction.editReply({
      content: `✅ Face swap complete! Used ${result.creditsCharged} credits.`,
      files: [attachment],
    });

    logger.info(CONTEXT, "Face swap completed", {
      userId,
      creditsUsed: result.creditsCharged,
    });
  } catch (error: any) {
    logger.error(CONTEXT, "Error in face swap command", { userId }, error);

    // Get user-friendly error message
    const errorMessage = error.code
      ? getFriendlyErrorMessage(error as MagicHourError)
      : `❌ An error occurred: ${error.message || "Unknown error"}`;

    await interaction.editReply({
      content: errorMessage,
    });
  }
}
