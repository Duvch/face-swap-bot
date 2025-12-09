import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
import { faceSwapCommandData } from "./commands/faceswap";
import { faceSwapGifCommandData } from "./commands/faceswapgif";
import { gifSearchCommandData } from "./commands/gifsearch";
import { helpCommandData } from "./commands/help";
import { settingsCommandData } from "./commands/settings";
import { myfacesCommandData } from "./commands/myfaces";
import { savemyfaceCommandData } from "./commands/savemyface";
import { deletemyfaceCommandData } from "./commands/deletemyface";
import { leaderboardCommandData } from "./commands/leaderboard";
import { faceSwapContextCommandData } from "./commands/faceswapcontext";
import { logger } from "./utils/logger";

// Load environment variables
dotenv.config();

// Validate environment variables
if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CLIENT_ID) {
  logger.error(
    "DeployCommands",
    "Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID in .env file",
  );
  process.exit(1);
}

const commands = [
  faceSwapCommandData.toJSON(),
  faceSwapGifCommandData.toJSON(),
  gifSearchCommandData.toJSON(),
  helpCommandData.toJSON(),
  settingsCommandData.toJSON(),
  myfacesCommandData.toJSON(),
  savemyfaceCommandData.toJSON(),
  deletemyfaceCommandData.toJSON(),
  leaderboardCommandData.toJSON(),
  faceSwapContextCommandData.toJSON(),
];

const rest = new REST({ version: "10" }).setToken(
  process.env.DISCORD_BOT_TOKEN,
);

async function deployCommands() {
  try {
    logger.info("DeployCommands", "Refreshing application commands", {
      count: commands.length,
    });

    // Register commands globally
    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
      { body: commands },
    );

    logger.info("DeployCommands", "Commands deployed successfully", {
      deployedCount: (data as any).length,
    });
    commands.forEach((cmd) => {
      logger.debug("DeployCommands", "Command deployed", {
        name: cmd.name,
        description: (cmd as any).description,
      });
    });

    logger.info(
      "DeployCommands",
      "Note: It may take up to 1 hour for commands to appear in all servers.",
    );
    logger.info(
      "DeployCommands",
      "Tip: For instant updates during development, use guild-specific commands.",
    );
  } catch (error) {
    logger.error(
      "DeployCommands",
      "Error deploying commands",
      null,
      error as Error,
    );
    process.exit(1);
  }
}

deployCommands();
