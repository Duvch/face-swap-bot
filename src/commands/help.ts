import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";

// Command definition
export const helpCommandData = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Get help and usage information for bot commands")
  .addStringOption((option) =>
    option
      .setName("command")
      .setDescription("Get help for a specific command")
      .setRequired(false)
      .addChoices(
        { name: "faceswap", value: "faceswap" },
        { name: "faceswapgif", value: "faceswapgif" },
        { name: "gifsearch", value: "gifsearch" },
        { name: "myfaces", value: "myfaces" },
        { name: "savemyface", value: "savemyface" },
        { name: "settings", value: "settings" },
      ),
  );

/**
 * Handle the /help command
 */
export async function handleHelpCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const command = interaction.options.getString("command");

  if (command) {
    // Show specific command help
    await showCommandHelp(interaction, command);
  } else {
    // Show general help
    await showGeneralHelp(interaction);
  }
}

/**
 * Show general help
 */
async function showGeneralHelp(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle("🤖 Face Swap Bot - Help")
    .setDescription(
      "A Discord bot that swaps faces in images and GIFs using AI!\n\n" +
        "**Quick Start:**\n" +
        "1. Use `/gifsearch` to browse GIFs\n" +
        "2. Select a GIF and upload your face\n" +
        "3. Get your face-swapped result!\n\n" +
        "**Or use direct commands:**\n" +
        "• `/faceswap` - Swap faces in static images\n" +
        "• `/faceswapgif` - Swap faces in GIFs/videos\n" +
        "• `/gifsearch` - Browse and search GIFs from Tenor",
    )
    .addFields(
      {
        name: "📸 Image Face Swap",
        value:
          "`/faceswap source_face:[image] target_image:[image]`\n" +
          "Swap faces between two static images. Fast and simple!",
        inline: false,
      },
      {
        name: "🎬 GIF Face Swap",
        value:
          "`/faceswapgif source_face:[image] target_gif:[gif]`\n" +
          "Swap faces in animated GIFs. Returns MP4 or GIF format.",
        inline: false,
      },
      {
        name: "🔍 GIF Search (Recommended!)",
        value:
          "`/gifsearch query:[search term]`\n" +
          "Browse thousands of GIFs, select one, upload your face, done!",
        inline: false,
      },
      {
        name: "💾 Saved Faces",
        value:
          "`/myfaces` - View your saved faces\n" +
          "`/savemyface name:[name]` - Save a new face (max 3)\n" +
          "`/deletemyface id:[face_id]` - Delete a saved face",
        inline: false,
      },
      {
        name: "⚙️ Settings",
        value:
          "`/settings` - Manage your preferences\n" +
          "Set default face, auto-save, and more!",
        inline: false,
      },
      {
        name: "💡 Tips",
        value:
          "• Use clear, front-facing photos for best results\n" +
          "• GIF processing takes 1-3 minutes\n" +
          "• Each image swap costs 5 credits\n" +
          "• GIF swaps cost more based on duration\n" +
          "• Save your faces to reuse them quickly!",
        inline: false,
      },
    )
    .setColor(0x5865f2)
    .setFooter({
      text: "Use /help [command] for detailed help on a specific command",
    });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Show specific command help
 */
async function showCommandHelp(
  interaction: ChatInputCommandInteraction,
  command: string,
): Promise<void> {
  let embed: EmbedBuilder;

  switch (command) {
    case "faceswap":
      embed = new EmbedBuilder()
        .setTitle("📸 /faceswap - Image Face Swap")
        .setDescription("Swap faces between two static images")
        .addFields(
          {
            name: "Usage",
            value: "`/faceswap source_face:[image] target_image:[image]`",
          },
          {
            name: "Parameters",
            value:
              "• `source_face` - Image with the face you want to use\n" +
              "• `target_image` - Image where the face will be swapped",
          },
          {
            name: "Example",
            value:
              "`/faceswap source_face:[selfie.jpg] target_image:[poster.jpg]`",
          },
          {
            name: "Cost",
            value: "5 credits per swap",
          },
          {
            name: "Processing Time",
            value: "10-30 seconds",
          },
        )
        .setColor(0x5865f2);
      break;

    case "faceswapgif":
      embed = new EmbedBuilder()
        .setTitle("🎬 /faceswapgif - GIF Face Swap")
        .setDescription("Swap faces in animated GIFs or videos")
        .addFields(
          {
            name: "Usage",
            value:
              "`/faceswapgif source_face:[image] target_gif:[gif] max_duration:[seconds]`",
          },
          {
            name: "Parameters",
            value:
              "• `source_face` - Image with the face you want to use\n" +
              "• `target_gif` - Animated GIF or video file\n" +
              "• `max_duration` - Maximum duration in seconds (1-30, default: 20)",
          },
          {
            name: "Example",
            value:
              "`/faceswapgif source_face:[selfie.jpg] target_gif:[reaction.gif] max_duration:15`",
          },
          {
            name: "Cost",
            value: "Variable - approximately 30-50 credits per second @ 30fps",
          },
          {
            name: "Processing Time",
            value: "1-3 minutes",
          },
          {
            name: "Output",
            value: "MP4 or GIF format (automatically detected)",
          },
        )
        .setColor(0x5865f2);
      break;

    case "gifsearch":
      embed = new EmbedBuilder()
        .setTitle("🔍 /gifsearch - Interactive GIF Search")
        .setDescription(
          "Search and browse thousands of GIFs from Tenor, then swap faces!",
        )
        .addFields(
          {
            name: "Usage",
            value: "`/gifsearch query:[search term]`",
          },
          {
            name: "Parameters",
            value: "• `query` - Search term (e.g., 'funny cat', 'excited')",
          },
          {
            name: "Example",
            value: "`/gifsearch query:funny reaction`",
          },
          {
            name: "How It Works",
            value:
              "1. Bot shows 9 GIF previews with buttons\n" +
              "2. Browse pages with Next/Previous\n" +
              "3. Click 'Select' on any GIF\n" +
              "4. Upload your face image\n" +
              "5. Get your face-swapped result!",
          },
          {
            name: "Privacy",
            value:
              "Search and selection are private (ephemeral). Only the final result is public!",
          },
        )
        .setColor(0x5865f2);
      break;

    case "myfaces":
      embed = new EmbedBuilder()
        .setTitle("💾 /myfaces - View Saved Faces")
        .setDescription("View all your saved faces with previews")
        .addFields(
          {
            name: "Usage",
            value: "`/myfaces`",
          },
          {
            name: "What You'll See",
            value:
              "• List of all your saved faces\n" +
              "• Face names and IDs\n" +
              "• Usage count\n" +
              "• Thumbnail previews",
          },
          {
            name: "Limit",
            value: "Maximum 3 saved faces per user",
          },
        )
        .setColor(0x5865f2);
      break;

    case "savemyface":
      embed = new EmbedBuilder()
        .setTitle("💾 /savemyface - Save a Face")
        .setDescription("Upload and save a face for quick reuse")
        .addFields(
          {
            name: "Usage",
            value: "`/savemyface name:[face name]`",
          },
          {
            name: "Parameters",
            value:
              "• `name` - Name for your saved face (e.g., 'Profile Pic', 'Formal Photo')",
          },
          {
            name: "Example",
            value: "`/savemyface name:My Profile Picture`",
          },
          {
            name: "How It Works",
            value:
              "1. Run the command\n" +
              "2. Upload your face image when prompted\n" +
              "3. Face is saved and can be reused instantly!",
          },
          {
            name: "Limit",
            value: "Maximum 3 saved faces per user",
          },
        )
        .setColor(0x5865f2);
      break;

    case "settings":
      embed = new EmbedBuilder()
        .setTitle("⚙️ /settings - User Preferences")
        .setDescription("Manage your bot preferences")
        .addFields(
          {
            name: "Usage",
            value:
              "`/settings view` - View current settings\n" +
              "`/settings default_face id:[face_id]` - Set default face\n" +
              "`/settings auto_save [true/false]` - Toggle auto-save\n" +
              "`/settings max_duration [seconds]` - Set max GIF duration",
          },
          {
            name: "Options",
            value:
              "• `default_face` - Face to use by default in GIF search\n" +
              "• `auto_save` - Automatically save new faces\n" +
              "• `max_duration` - Maximum GIF duration (1-30 seconds)",
          },
        )
        .setColor(0x5865f2);
      break;

    default:
      embed = new EmbedBuilder()
        .setTitle("❌ Unknown Command")
        .setDescription(`No help available for command: ${command}`)
        .setColor(0xff0000);
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
