import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { getUserFaces } from "../utils/faceStorage";
import { logger } from "../utils/logger";

// Command definition
export const myfacesCommandData = new SlashCommandBuilder()
  .setName("myfaces")
  .setDescription("View all your saved faces");

/**
 * Handle the /myfaces command
 */
export async function handleMyFacesCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const userId = interaction.user.id;
    const faces = getUserFaces(userId);

    if (faces.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle("💾 Your Saved Faces")
        .setDescription(
          "You don't have any saved faces yet!\n\n" +
          "Use `/savemyface` to save a face for quick reuse."
        )
        .setColor(0x5865F2);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`💾 Your Saved Faces (${faces.length}/3)`)
      .setDescription(
        "Here are all your saved faces. Use the IDs with `/settings default_face` or in GIF search."
      )
      .setColor(0x5865F2);

    // Add fields for each face
    faces.forEach((face, index) => {
      const uploadedDate = new Date(face.uploaded_at).toLocaleDateString();
      embed.addFields({
        name: `${index + 1}. ${face.name}`,
        value:
          `**ID:** \`${face.id}\`\n` +
          `**Used:** ${face.usage_count} time(s)\n` +
          `**Saved:** ${uploadedDate}`,
        inline: true,
      });
    });

    // Add thumbnail if available
    if (faces[0]?.thumbnail_url) {
      embed.setThumbnail(faces[0].thumbnail_url);
    }

    embed.setFooter({
      text: "Use /deletemyface id:[face_id] to delete a face",
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    logger.error("MyFacesCommand", "Error in /myfaces", null, error);
    await interaction.editReply({
      content: `❌ Error: ${error.message}`,
    });
  }
}

