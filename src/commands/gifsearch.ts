import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { searchGifs, getThumbnailUrl } from "../utils/tenor";
import { createSearchState, getCurrentPageGifs } from "../utils/stateManager";
import { logger } from "../utils/logger";
import { checkRateLimit, recordAction } from "../utils/rateLimiter";

// Command definition
export const gifSearchCommandData = new SlashCommandBuilder()
  .setName("gifsearch")
  .setDescription("Search for GIFs from Tenor to use for face swapping")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Search term (e.g., funny cat, excited)")
      .setRequired(true)
  );

/**
 * Build pagination buttons for GIF selection
 */
export function buildGifSelectionUI(
  searchId: string,
  gifs: any[],
  currentPage: number,
  totalPages: number
) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  // Row 1-3: GIF selection buttons (3 per row, 9 total)
  for (let row = 0; row < 3; row++) {
    const buttonRow = new ActionRowBuilder<ButtonBuilder>();

    for (let col = 0; col < 3; col++) {
      const index = row * 3 + col;
      const gif = gifs[index];

      if (gif) {
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`gif_select_${searchId}_${index}`)
            .setLabel(`Select GIF ${index + 1}`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji("🎬")
        );
      } else {
        // Empty slot - disabled button
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`gif_empty_${index}`)
            .setLabel(`-`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );
      }
    }

    rows.push(buttonRow);
  }

  // Row 4: Navigation buttons
  const navRow = new ActionRowBuilder<ButtonBuilder>();

  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`gif_prev_${searchId}`)
      .setLabel("◀️ Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0)
  );

  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`gif_page_${searchId}`)
      .setLabel(`Page ${currentPage + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );

  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`gif_next_${searchId}`)
      .setLabel("Next ▶️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages - 1)
  );

  rows.push(navRow);

  // Row 5: Cancel button
  const cancelRow = new ActionRowBuilder<ButtonBuilder>();
  cancelRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`gif_cancel_${searchId}`)
      .setLabel("❌ Cancel")
      .setStyle(ButtonStyle.Danger)
  );

  rows.push(cancelRow);

  return rows;
}

/**
 * Build embeds showing GIF previews
 */
export function buildGifEmbeds(
  gifs: any[],
  query: string,
  currentPage: number,
  totalPages: number
) {
  const embeds: EmbedBuilder[] = [];

  const mainEmbed = new EmbedBuilder()
    .setTitle(`🔍 GIF Search Results for "${query}"`)
    .setDescription(
      `Found ${gifs.length} GIFs on this page. Click a button below to select a GIF!\n\n` +
        `**Page ${currentPage + 1} of ${totalPages}**`
    )
    .setColor(0x00ae86)
    .setFooter({ text: "Powered by Tenor" });

  embeds.push(mainEmbed);

  // Add GIF previews (max 3 per embed due to Discord limits)
  gifs.forEach((gif, index) => {
    const gifEmbed = new EmbedBuilder()
      .setTitle(`GIF ${index + 1}: ${gif.title || "Untitled"}`)
      .setImage(getThumbnailUrl(gif))
      .setColor(0x5865f2);

    embeds.push(gifEmbed);
  });

  // Discord allows max 10 embeds per message
  // We have 1 main + up to 9 GIF embeds = 10 total (perfect!)
  return embeds;
}

/**
 * Handle the /gifsearch command
 */
const CONTEXT = "GifSearchCommand";

export async function handleGifSearchCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  // Check rate limit
  const userId = interaction.user.id;
  const rateLimitError = checkRateLimit(userId, "gifsearch");
  if (rateLimitError) {
    await interaction.reply({
      content: rateLimitError,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Record action for rate limiting
    recordAction(userId, "gifsearch");

    const query = interaction.options.getString("query", true);

    logger.info(CONTEXT, "GIF search requested", {
      userId,
      userTag: interaction.user.tag,
      query,
    });

    // Search Tenor for GIFs
    await interaction.editReply({
      content: `🔍 Searching Tenor for "${query}"...`,
    });

    const searchResult = await searchGifs(query, 50);

    if (searchResult.gifs.length === 0) {
      await interaction.editReply({
        content: `❌ No GIFs found for "${query}". Try a different search term!`,
      });
      return;
    }

    // Create search state
    const searchId = `${interaction.id}_${Date.now()}`;
    const state = createSearchState(
      searchId,
      query,
      searchResult.gifs,
      interaction.user.id,
      interaction.channelId
    );

    // Get first page of GIFs
    const currentGifs = getCurrentPageGifs(state);

    // Build UI
    const embeds = buildGifEmbeds(
      currentGifs,
      query,
      state.currentPage,
      state.totalPages
    );
    const components = buildGifSelectionUI(
      searchId,
      currentGifs,
      state.currentPage,
      state.totalPages
    );

    await interaction.editReply({
      content: `✅ Found ${searchResult.gifs.length} GIFs! Select one below:`,
      embeds,
      components,
    });

    logger.info(CONTEXT, "Displayed GIFs for search", {
      searchId,
      userId,
      displayed: currentGifs.length,
    });
  } catch (error: any) {
    logger.error(CONTEXT, "Error in GIF search command", { userId }, error);

    await interaction.editReply({
      content: `❌ An error occurred while searching for GIFs: ${error.message}`,
    });
  }
}
