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
  const adminIds =
    process.env.ADMIN_USER_IDS?.split(",").map((id) => id.trim()) || [];
  return adminIds.includes(userId);
}

/**
 * Handle the /leaderboard command
 */
export async function handleLeaderboardCommand(
  interaction: ChatInputCommandInteraction,
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
    const topUsers = await db.$queryRaw<
      Array<{
        user_id: string;
        total_swaps: bigint;
        total_credits: bigint;
      }>
    >`
      SELECT 
        user_id,
        COUNT(*) as total_swaps,
        SUM(credits_used) as total_credits
      FROM swap_history
      GROUP BY user_id
      ORDER BY total_swaps DESC
      LIMIT 10
    `;

    if (topUsers.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle("📊 Leaderboard")
        .setDescription("No swaps recorded yet!")
        .setColor(0x5865f2);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Get total stats
    const totalStats = await db.$queryRaw<
      Array<{
        total_swaps: bigint;
        total_credits: bigint;
        unique_users: bigint;
      }>
    >`
      SELECT 
        COUNT(*) as total_swaps,
        SUM(credits_used) as total_credits,
        COUNT(DISTINCT user_id) as unique_users
      FROM swap_history
    `;

    // Get weekly stats
    const oneWeekAgo = BigInt(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyStats = await db.$queryRaw<
      Array<{
        weekly_swaps: bigint;
        weekly_credits: bigint;
      }>
    >`
      SELECT 
        COUNT(*) as weekly_swaps,
        SUM(credits_used) as weekly_credits
      FROM swap_history
      WHERE created_at > ${oneWeekAgo}
    `;

    const totalStatsData = totalStats[0] || {
      total_swaps: 0n,
      total_credits: 0n,
      unique_users: 0n,
    };
    const weeklyStatsData = weeklyStats[0] || {
      weekly_swaps: 0n,
      weekly_credits: 0n,
    };

    // Build leaderboard embed
    const embed = new EmbedBuilder()
      .setTitle("🏆 Face Swap Leaderboard")
      .setDescription("Top 10 users by total face swaps")
      .setColor(0xffd700)
      .addFields(
        {
          name: "📊 Overall Statistics",
          value:
            `**Total Swaps:** ${totalStatsData.total_swaps}\n` +
            `**Total Credits Used:** ${Number(totalStatsData.total_credits).toLocaleString()}\n` +
            `**Unique Users:** ${totalStatsData.unique_users}`,
          inline: false,
        },
        {
          name: "📅 This Week",
          value:
            `**Swaps:** ${weeklyStatsData.weekly_swaps || 0n}\n` +
            `**Credits:** ${Number(weeklyStatsData.weekly_credits || 0n).toLocaleString()}`,
          inline: false,
        },
      );

    // Add top users
    const leaderboardText = topUsers
      .map((user, index) => {
        const medal =
          index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "  ";
        return `${medal} **<@${user.user_id}>**\n   ${user.total_swaps} swaps • ${Number(user.total_credits).toLocaleString()} credits`;
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
