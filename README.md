# Face Swap Bot – Setup & Usage

This README lists only what you must do to set up, invite, configure, deploy commands, and use the bot. Keep it open while configuring.

## Prerequisites
- Node.js 18+
- Discord application with bot token and application ID
- Magic Hour API key
- Tenor API key

## Permissions, Intents, Scopes (required unless noted)
- OAuth2 scopes: `bot`, `applications.commands`
- Bot permissions: Read Messages/View Channels, Send Messages, Attach Files, Use Slash Commands; optional: Manage Messages (for cleanup)
- Gateway intents: Guilds, GuildMessages, Message Content (privileged)

## Environment (.env)
```
DISCORD_BOT_TOKEN=...
DISCORD_CLIENT_ID=...
MAGIC_HOUR_API_KEY=...
TENOR_API_KEY=...
TENOR_CLIENT_KEY=discord-face-swap-bot   # optional override
ADMIN_USER_IDS=comma,separated,userIds   # optional, for /leaderboard
```

## Setup Scenarios
### A) New bot (from scratch)
1) Create bot in Discord Developer Portal → Bot tab → create token.  
2) Enable intents: Guilds, GuildMessages, Message Content.  
3) OAuth2 → URL Generator → scopes `bot` + `applications.commands`; permissions: Read Messages, Send Messages, Attach Files, Use Slash Commands (optional Manage Messages). Invite the bot with the generated URL.  
4) Clone repo & install: `npm install`.  
5) Create `.env` with values above.  
6) Build (optional for dev): `npm run build`.  
7) Deploy commands: `npm run deploy-commands`.  
8) Start bot: `npm start` (or `npm run dev`).

### B) Bot already exists, just update commands
1) Pull latest code and update `.env` if needed.  
2) Run `npm run deploy-commands`.  
3) Restart bot (`npm start` or your process manager).

### C) Bot removed or permissions changed (re-invite)
1) Regenerate invite URL with scopes `bot` + `applications.commands`; permissions as listed.  
2) Re-invite the bot.  
3) Run `npm run deploy-commands`.  
4) Restart bot.

### D) Bot not responding (quick checks)
- Is the bot online? (member list)  
- Does it have required permissions in the channel?  
- Were commands deployed recently? (`npm run deploy-commands`, wait up to 1 hour for global)  
- Message Content intent enabled in Portal and in code (.env token)?  
- Env vars set correctly?  
- Restart the bot.

## Command Deployment
- Run `npm run deploy-commands` after any command changes or first setup.  
- Global commands can take up to 1 hour to appear; guild-specific (if used) are instant.

## All Commands
- `/faceswap` — source_face (image), target_image (image)  
- `/faceswapgif` — source_face (image), target_gif (gif/video), max_duration (1-30, default 20)  
- `/gifsearch` — query (search term) → interactive selection + face upload  
- `/help` — optional command argument  
- `/settings` subcommands: `view`, `default_face id`, `auto_save enabled`, `max_duration seconds`  
- `/myfaces` — list saved faces  
- `/savemyface name` — prompt to upload a face (max 3 saved)  
- `/deletemyface id` — delete saved face  
- `/leaderboard` — admin only (ADMIN_USER_IDS)  
- Context menu: right-click message → Apps → **Face Swap This GIF**

## Running
- Development: `npm run dev`  
- Production: `npm run build` then `npm start`

## Minimal Usage Flow
1) Right-click any GIF message → Apps → Face Swap This GIF → pick a saved face or upload.  
2) Or run `/gifsearch`, pick a GIF, upload face when prompted.  
3) Results post in the channel; face selection prompts are ephemeral.

## Permissions Summary (server)
- Required per channel: Read, Send, Attach Files, Use Application Commands.  
- Optional: Manage Messages (used to delete temporary upload messages when possible).

## Re-deploy Checklist
- Update code and `.env` if needed.  
- `npm run deploy-commands`.  
- Restart bot/process.  
- Wait for global propagation if commands not visible immediately.
