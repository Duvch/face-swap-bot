import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { deleteFace, getFaceById } from "../utils/faceStorage";
import { logger } from "../utils/logger";

// Command definition
export const deletemyfaceCommandData = new SlashCommandBuilder()
  .setName("deletemyface")
  .setDescription("Delete a saved face")
  .addStringOption((option) =>
    option
      .setName("id")
      .setDescription("Face ID from /myfaces")
      .setRequired(true),
  );

/**
 * Handle the /deletemyface command
 */
export async function handleDeleteMyFaceCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const userId = interaction.user.id;
    const faceId = interaction.options.getString("id", true);

    // Verify face exists and belongs to user
    const face = await getFaceById(faceId, userId);
    if (!face) {
      await interaction.editReply({
        content: "❌ Face not found. Use `/myfaces` to see your saved faces.",
      });
      return;
    }

    // Delete face
    const deleted = await deleteFace(faceId, userId);
    if (!deleted) {
      throw new Error("Failed to delete face");
    }

    const embed = new EmbedBuilder()
      .setTitle("✅ Face Deleted")
      .setDescription(`Face **"${face.name}"** has been deleted.`)
      .setColor(0x00ff00)
      .setFooter({
        text: "You can save a new face with /savemyface",
      });

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    logger.error("DeleteMyFaceCommand", "Error in /deletemyface", null, error);
    await interaction.editReply({
      content: `❌ Error: ${error.message}`,
    });
  }
}
