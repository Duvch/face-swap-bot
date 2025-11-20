import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageCollector,
  TextChannel,
} from "discord.js";
import { saveFace, canSaveMoreFaces, getUserFaces } from "../utils/faceStorage";
import { uploadToMagicHour } from "../utils/magicHour";
import { logger } from "../utils/logger";

// Command definition
export const savemyfaceCommandData = new SlashCommandBuilder()
  .setName("savemyface")
  .setDescription("Upload and save a face for quick reuse")
  .addStringOption((option) =>
    option
      .setName("name")
      .setDescription("Name for your saved face (e.g., 'Profile Pic')")
      .setRequired(true)
  );

/**
 * Handle the /savemyface command
 */
export async function handleSaveMyFaceCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;

  try {
    const faceName = interaction.options.getString("name", true);

    // Check if user can save more faces
    if (!canSaveMoreFaces(userId)) {
      await interaction.editReply({
        content:
          "❌ You've reached the limit of 3 saved faces. Delete one with `/deletemyface` first.",
      });
      return;
    }

    // Prompt for image upload
    const embed = new EmbedBuilder()
      .setTitle("📤 Upload Your Face")
      .setDescription(
        `Please upload your face image as an attachment in your next message.\n\n` +
          `**Name:** ${faceName}\n` +
          `**Remaining slots:** ${3 - getUserFaces(userId).length}`
      )
      .setColor(0x5865f2)
      .setFooter({ text: "You have 5 minutes to upload your image" });

    await interaction.editReply({ embeds: [embed] });

    // Wait for image upload
    const channel = interaction.channel as TextChannel;
    if (!channel) {
      throw new Error("Channel not found");
    }

    const collector = channel.createMessageCollector({
      filter: (m) => {
        return !!(
          m.author.id === userId &&
          m.attachments.size > 0 &&
          m.attachments.first()?.contentType?.startsWith("image/")
        );
      },
      time: 5 * 60 * 1000, // 5 minutes
      max: 1,
    });

    collector.on("collect", async (message) => {
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
        await interaction.editReply({
          content: "🔄 Uploading to Magic Hour...",
        });

        const magicHourPath = await uploadToMagicHour(
          buffer,
          attachment.name?.split(".").pop() || "jpg"
        );

        // Save face
        const savedFace = saveFace(
          userId,
          faceName,
          magicHourPath,
          attachment.url // Use Discord URL as thumbnail
        );

        if (!savedFace) {
          throw new Error("Failed to save face (limit reached?)");
        }

        const successEmbed = new EmbedBuilder()
          .setTitle("✅ Face Saved!")
          .setDescription(
            `Your face **"${faceName}"** has been saved successfully!\n\n` +
              `**ID:** \`${savedFace.id}\`\n` +
              `Use this ID with \`/settings default_face\` or in GIF search.`
          )
          .setThumbnail(attachment.url)
          .setColor(0x00ff00);

        await interaction.editReply({ embeds: [successEmbed] });
      } catch (error: any) {
        logger.error(
          "SaveMyFaceCommand",
          "Error saving face",
          { userId, faceName },
          error
        );
        await interaction.editReply({
          content: `❌ Error saving face: ${error.message}`,
        });
      }
    });

    collector.on("end", (collected, reason) => {
      if (collected.size === 0) {
        interaction.editReply({
          content: "❌ Timeout! You didn't upload an image in time.",
        });
      }
    });
  } catch (error: any) {
    logger.error("SaveMyFaceCommand", "Error in /savemyface", { userId }, error);
    await interaction.editReply({
      content: `❌ Error: ${error.message}`,
    });
  }
}
