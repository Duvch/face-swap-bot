import {
  Client,
  Events,
  GatewayIntentBits,
  Collection,
  Interaction,
} from "discord.js";
import dotenv from "dotenv";
import http, { IncomingMessage, ServerResponse } from "http";
import { initializeMagicHour } from "./utils/magicHour";
import { initializeTenor } from "./utils/tenor";
import { startCleanupTimer } from "./utils/stateManager";
import { handleFaceSwapCommand } from "./commands/faceswap";
import { handleFaceSwapGifCommand } from "./commands/faceswapgif";
import { handleGifSearchCommand } from "./commands/gifsearch";
import { handleHelpCommand } from "./commands/help";
import { handleSettingsCommand } from "./commands/settings";
import { handleMyFacesCommand } from "./commands/myfaces";
import { handleSaveMyFaceCommand } from "./commands/savemyface";
import { handleDeleteMyFaceCommand } from "./commands/deletemyface";
import { handleLeaderboardCommand } from "./commands/leaderboard";
import { handleFaceSwapContextCommand } from "./commands/faceswapcontext";
import { handleButtonInteraction } from "./interactions/buttonHandler";
import { validateAllAPIs } from "./utils/apiValidator";
import {
  initializeDatabase,
  closeDatabase,
  runCleanup,
} from "./utils/database";
import { logger } from "./utils/logger";

// Load environment variables
dotenv.config();

// Validate environment variables
const requiredEnvVars = [
  "DISCORD_BOT_TOKEN",
  "DISCORD_CLIENT_ID",
  "MAGIC_HOUR_API_KEY",
  "TENOR_API_KEY",
];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error("Startup", "Missing required environment variable", {
      envVar,
    });
    logger.error(
      "Startup",
      "Please check your .env file and ensure all variables are set."
    );
    process.exit(1);
  }
}

// Initialize database
initializeDatabase();

// Initialize Magic Hour API client
initializeMagicHour(process.env.MAGIC_HOUR_API_KEY!);

// Initialize Tenor API client
initializeTenor(
  process.env.TENOR_API_KEY!,
  process.env.TENOR_CLIENT_KEY || "discord-face-swap-bot"
);

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Required to read message attachments
  ],
});

// Create HTTP server for Render health checks
const server = http.createServer(
  (req: IncomingMessage, res: ServerResponse) => {
    // Health check endpoint
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          service: "discord-face-swap-bot",
          timestamp: new Date().toISOString(),
        })
      );
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  }
);

// Start HTTP server on PORT (required for Render)
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  logger.info("Server", `HTTP server listening on port ${PORT}`);
});

// Bot ready event
client.once(Events.ClientReady, (readyClient) => {
  logger.info("Startup", "Discord bot is ready", {
    userTag: readyClient.user.tag,
    guildCount: readyClient.guilds.cache.size,
  });

  // Set bot activity status
  readyClient.user.setActivity("Face Swapping 🎭", { type: 3 }); // Type 3 = Watching
});

// Handle interactions (slash commands and buttons)
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      switch (interaction.commandName) {
        case "faceswap":
          await handleFaceSwapCommand(interaction);
          break;
        case "faceswapgif":
          await handleFaceSwapGifCommand(interaction);
          break;
        case "gifsearch":
          await handleGifSearchCommand(interaction);
          break;
        case "help":
          await handleHelpCommand(interaction);
          break;
        case "settings":
          await handleSettingsCommand(interaction);
          break;
        case "myfaces":
          await handleMyFacesCommand(interaction);
          break;
        case "savemyface":
          await handleSaveMyFaceCommand(interaction);
          break;
        case "deletemyface":
          await handleDeleteMyFaceCommand(interaction);
          break;
        case "leaderboard":
          await handleLeaderboardCommand(interaction);
          break;
        default:
          logger.warn("CommandHandler", "Unknown command received", {
            commandName: interaction.commandName,
          });
      }
    }

    // Handle button interactions
    else if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }

    // Handle context menu commands
    else if (interaction.isMessageContextMenuCommand()) {
      if (interaction.commandName === "Face Swap This GIF") {
        await handleFaceSwapContextCommand(interaction);
      }
    }
  } catch (error) {
    logger.error(
      "CommandHandler",
      "Error handling interaction",
      null,
      error as Error
    );

    // Send error message to user only if interaction hasn't been acknowledged
    const errorMessage =
      "❌ An unexpected error occurred. Please try again later.";

    try {
      if (interaction.isRepliable()) {
        // Check if interaction is already acknowledged to avoid "already acknowledged" errors
        if (interaction.replied || interaction.deferred) {
          // Only try followUp if we haven't already replied/deferred
          // Check if we can still follow up (interaction might be expired)
          try {
            await interaction.followUp({
              content: errorMessage,
              ephemeral: true,
            });
          } catch (followUpError: any) {
            // Ignore "already acknowledged" errors - interaction was already handled
            if (!followUpError.message?.includes("already been acknowledged")) {
              logger.warn("CommandHandler", "Failed to send error follow-up", {
                error: followUpError.message,
              });
            }
          }
        } else {
          // Try to reply if not yet acknowledged
          try {
            await interaction.reply({
              content: errorMessage,
              ephemeral: true,
            });
          } catch (replyError: any) {
            // Ignore "already acknowledged" errors
            if (!replyError.message?.includes("already been acknowledged")) {
              logger.warn("CommandHandler", "Failed to send error reply", {
                error: replyError.message,
              });
            }
          }
        }
      }
    } catch (replyError) {
      // Only log if it's not an "already acknowledged" error
      const errorMessage =
        replyError instanceof Error ? replyError.message : String(replyError);
      if (!errorMessage.includes("already been acknowledged")) {
        logger.error(
          "CommandHandler",
          "Error sending error follow-up message",
          null,
          replyError as Error
        );
      }
    }
  }
});

// Error handling
client.on(Events.Error, (error) => {
  logger.error("DiscordClient", "Discord client error", null, error);
});

process.on("unhandledRejection", (error) => {
  logger.error("Process", "Unhandled promise rejection", null, error as Error);
});

process.on("uncaughtException", async (error) => {
  logger.error("Process", "Uncaught exception", null, error);
  await closeDatabase();
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.warn("Process", "Received SIGINT. Shutting down gracefully...");
  server.close(() => {
    logger.info("Server", "HTTP server closed");
  });
  await closeDatabase();
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.warn("Process", "Received SIGTERM. Shutting down gracefully...");
  server.close(() => {
    logger.info("Server", "HTTP server closed");
  });
  await closeDatabase();
  client.destroy();
  process.exit(0);
});

// Validate APIs and start bot
(async () => {
  logger.info("Startup", "Validating APIs");
  const apisValid = await validateAllAPIs(
    process.env.MAGIC_HOUR_API_KEY!,
    process.env.TENOR_API_KEY!
  );

  if (!apisValid) {
    logger.error("Startup", "API validation failed. Bot will not start.");
    await closeDatabase();
    process.exit(1);
  }

  // Start state cleanup timer
  startCleanupTimer();
  logger.info("Startup", "State cleanup timer started");

  // Run database cleanup on startup
  await runCleanup();

  // Login to Discord
  logger.info("Startup", "Starting Discord Face Swap Bot");
  logger.info("Startup", "Logging in to Discord");

  client.login(process.env.DISCORD_BOT_TOKEN).catch(async (error) => {
    logger.error("Startup", "Failed to login to Discord", null, error);
    await closeDatabase();
    process.exit(1);
  });
})();
