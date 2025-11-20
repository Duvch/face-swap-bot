import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { getDatabase } from "../utils/database";
import { logger } from "../utils/logger";

// Command definition
export const leaderboardCommandData = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("View top face swappers (Admin only)");

/**
 * Check if user is admin
 */
function isAdmin(userId: string): boolean {
  const adminIds = process.env.ADMIN_USER_IDS?.split(",").map((id) =>
    id.trim()
  ) || [];
  return adminIds.includes(userId);
}

/**
 * Handle the /leaderboard command
 */
export async function handleLeaderboardCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const userId = interaction.user.id;

    // Check if user is admin
    if (!isAdmin(userId)) {
      await interaction.editReply({
        content: "❌ This command is only available to administrators.",
      });
      return;
    }

    const db = getDatabase();

    // Get top 10 users by total swaps
    const topUsers = db
      .prepare(
        `
      SELECT 
        user_id,
        COUNT(*) as total_swaps,
        SUM(credits_used) as total_credits
      FROM swap_history
      GROUP BY user_id
      ORDER BY total_swaps DESC
      LIMIT 10
    `
      )
      .all() as Array<{
      user_id: string;
      total_swaps: number;
      total_credits: number;
    }>;

    if (topUsers.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle("📊 Leaderboard")
        .setDescription("No swaps recorded yet!")
        .setColor(0x5865F2);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Get total stats
    const totalStats = db
      .prepare(
        `
      SELECT 
        COUNT(*) as total_swaps,
        SUM(credits_used) as total_credits,
        COUNT(DISTINCT user_id) as unique_users
      FROM swap_history
    `
      )
      .get() as {
      total_swaps: number;
      total_credits: number;
      unique_users: number;
    };

    // Get weekly stats
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklyStats = db
      .prepare(
        `
      SELECT 
        COUNT(*) as weekly_swaps,
        SUM(credits_used) as weekly_credits
      FROM swap_history
      WHERE created_at > ?
    `
      )
      .get(oneWeekAgo) as {
      weekly_swaps: number;
      weekly_credits: number;
    };

    // Build leaderboard embed
    const embed = new EmbedBuilder()
      .setTitle("🏆 Face Swap Leaderboard")
      .setDescription("Top 10 users by total face swaps")
      .setColor(0xFFD700)
      .addFields(
        {
          name: "📊 Overall Statistics",
          value:
            `**Total Swaps:** ${totalStats.total_swaps}\n` +
            `**Total Credits Used:** ${totalStats.total_credits.toLocaleString()}\n` +
            `**Unique Users:** ${totalStats.unique_users}`,
          inline: false,
        },
        {
          name: "📅 This Week",
          value:
            `**Swaps:** ${weeklyStats.weekly_swaps || 0}\n` +
            `**Credits:** ${(weeklyStats.weekly_credits || 0).toLocaleString()}`,
          inline: false,
        }
      );

    // Add top users
    const leaderboardText = topUsers
      .map((user, index) => {
        const medal =
          index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "  ";
        return `${medal} **<@${user.user_id}>**\n   ${user.total_swaps} swaps • ${user.total_credits.toLocaleString()} credits`;
      })
      .join("\n\n");

    embed.addFields({
      name: "👥 Top Users",
      value: leaderboardText || "No users yet",
      inline: false,
    });

    embed.setFooter({
      text: "Updated in real-time",
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    logger.error("LeaderboardCommand", "Error in /leaderboard", null, error);
    await interaction.editReply({
      content: `❌ Error: ${error.message}`,
    });
  }
}

