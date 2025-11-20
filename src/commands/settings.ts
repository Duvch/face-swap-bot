import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import {
  getUserPreferences,
  updateUserPreferences,
  setDefaultFace,
  setAutoSaveFaces,
  setMaxGifDuration,
} from "../utils/userPreferences";
import { getFaceById } from "../utils/faceStorage";

// Command definition
export const settingsCommandData = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Manage your bot preferences")
  .addSubcommand((subcommand) =>
    subcommand.setName("view").setDescription("View your current settings")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("default_face")
      .setDescription("Set your default face for quick use")
      .addStringOption((option) =>
        option
          .setName("id")
          .setDescription("Face ID from /myfaces")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("auto_save")
      .setDescription("Toggle auto-save for new faces")
      .addBooleanOption((option) =>
        option
          .setName("enabled")
          .setDescription("Enable or disable auto-save")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("max_duration")
      .setDescription("Set maximum GIF duration (1-30 seconds)")
      .addIntegerOption((option) =>
        option
          .setName("seconds")
          .setDescription("Maximum duration in seconds")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(30)
      )
  );

/**
 * Handle the /settings command
 */
export async function handleSettingsCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "view":
      await handleViewSettings(interaction);
      break;
    case "default_face":
      await handleSetDefaultFace(interaction);
      break;
    case "auto_save":
      await handleSetAutoSave(interaction);
      break;
    case "max_duration":
      await handleSetMaxDuration(interaction);
      break;
    default:
      await interaction.reply({
        content: "❌ Unknown subcommand.",
        ephemeral: true,
      });
  }
}

/**
 * View current settings
 */
async function handleViewSettings(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const userId = interaction.user.id;
  const prefs = getUserPreferences(userId);

  const defaultFaceName = prefs.default_face_id
    ? (() => {
        const face = getFaceById(prefs.default_face_id!, userId);
        return face ? face.name : "Unknown";
      })()
    : "None";

  const embed = new EmbedBuilder()
    .setTitle("⚙️ Your Settings")
    .setDescription("Current bot preferences")
    .addFields(
      {
        name: "👤 Default Face",
        value: prefs.default_face_id
          ? `${defaultFaceName} (ID: ${prefs.default_face_id})`
          : "Not set",
        inline: true,
      },
      {
        name: "💾 Auto-Save Faces",
        value: prefs.auto_save_faces ? "✅ Enabled" : "❌ Disabled",
        inline: true,
      },
      {
        name: "⏱️ Max GIF Duration",
        value: `${prefs.max_gif_duration} seconds`,
        inline: true,
      }
    )
    .setColor(0x5865F2)
    .setFooter({ text: "Use /settings [option] to change settings" });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Set default face
 */
async function handleSetDefaultFace(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const userId = interaction.user.id;
  const faceId = interaction.options.getString("id", true);

  // Verify face exists and belongs to user
  const face = getFaceById(faceId, userId);
  if (!face) {
    await interaction.reply({
      content:
        "❌ Face not found. Use `/myfaces` to see your saved faces.",
      ephemeral: true,
    });
    return;
  }

  setDefaultFace(userId, faceId);

  const embed = new EmbedBuilder()
    .setTitle("✅ Default Face Updated")
    .setDescription(`Your default face is now: **${face.name}**`)
    .setColor(0x00ff00)
    .setFooter({
      text: "This face will be used by default in GIF searches",
    });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Set auto-save
 */
async function handleSetAutoSave(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const userId = interaction.user.id;
  const enabled = interaction.options.getBoolean("enabled", true);

  setAutoSaveFaces(userId, enabled);

  const embed = new EmbedBuilder()
    .setTitle("✅ Auto-Save Updated")
    .setDescription(
      `Auto-save faces is now **${enabled ? "enabled" : "disabled"}**`
    )
    .setColor(0x00ff00)
    .setFooter({
      text: enabled
        ? "New faces will be automatically saved"
        : "You'll be asked before saving new faces",
    });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Set max duration
 */
async function handleSetMaxDuration(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const userId = interaction.user.id;
  const duration = interaction.options.getInteger("seconds", true);

  setMaxGifDuration(userId, duration);

  const embed = new EmbedBuilder()
    .setTitle("✅ Max Duration Updated")
    .setDescription(`Maximum GIF duration set to **${duration} seconds**`)
    .setColor(0x00ff00)
    .setFooter({
      text: "GIFs longer than this will be trimmed",
    });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

