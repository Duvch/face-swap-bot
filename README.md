# Discord Face Swap Bot

A Discord bot that performs AI-powered face swapping using the Magic Hour API. Upload images or animated GIFs and let the bot swap faces!

## Features

- 🎭 **Face Swapping**: Swap faces between any two images
- 🔍 **GIF Search**: Browse thousands of GIFs from Tenor (NEW!)
- 🎬 **GIF Face Swapping**: Swap faces in animated GIFs
- ⚡ **Fast Processing**: Images in 10-30 seconds, GIFs in 1-3 minutes
- 🤖 **Slash Commands**: Modern Discord slash command interface
- 📸 **High Quality**: Powered by Magic Hour's professional AI models
- 🎯 **Interactive UI**: Pagination and button-based selection
- ❌ **Error Handling**: User-friendly error messages

## Prerequisites

Before you begin, you'll need:

1. **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
2. **A Discord Bot Token** - See setup instructions below
3. **Magic Hour API Key** - [Get one here](https://magichour.ai/developer)
4. **Tenor API Key** - [Get one here](https://console.cloud.google.com/)

## Setup Instructions

### 1. Clone and Install

```bash
# Clone or download this repository
cd gif-faces-swap

# Install dependencies
npm install
```

### 2. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"** and give it a name
3. Go to the **"Bot"** section
4. Click **"Add Bot"**
5. Under the bot's username, click **"Reset Token"** and copy the token
6. **Save this token** - you'll need it for the `.env` file

#### Set Bot Permissions

Still in the Discord Developer Portal:

1. Go to **"Bot"** section
2. Enable these **Privileged Gateway Intents**:
   - ✅ Message Content Intent (if you plan to read messages)
3. Go to **"OAuth2"** → **"URL Generator"**
4. Select scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
5. Select bot permissions:
   - ✅ Read Messages/View Channels
   - ✅ Send Messages
   - ✅ Attach Files
   - ✅ Use Slash Commands
6. Copy the generated URL at the bottom
7. Open the URL in your browser to invite the bot to your server

### 3. Get Your Application ID

1. In the Discord Developer Portal, go to **"General Information"**
2. Copy the **"Application ID"**
3. Save this - you'll need it as `DISCORD_CLIENT_ID`

### 4. Get Magic Hour API Key

1. Go to [Magic Hour Developer Hub](https://magichour.ai/developer)
2. Sign in or create an account
3. Navigate to **API Keys** tab
4. Click **"Create new API Key"**
5. Copy the API key (it starts with `mh_`)

### 5. Get Tenor API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Tenor API**
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy the API key
6. (Optional) Restrict the key to Tenor API only for security

Reference: [Tenor API Quickstart](https://developers.google.com/tenor/guides/quickstart)

### 6. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here

# Magic Hour API Configuration
MAGIC_HOUR_API_KEY=your_magic_hour_api_key_here

# Tenor API Configuration (for GIF search)
TENOR_API_KEY=your_tenor_api_key_here
TENOR_CLIENT_KEY=discord-face-swap-bot
```

### 7. Build the Project

```bash
npm run build
```

### 7. Deploy Slash Commands

Before running the bot, register the slash commands with Discord:

```bash
npm run deploy-commands
```

You should see:

```
✅ Successfully reloaded 1 application (/) command(s).
```

**Note**: Global commands can take up to 1 hour to appear in all servers.

### 9. Start the Bot

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

You should see:

```
✅ Discord bot is ready! Logged in as YourBot#1234
📊 Bot is in 1 server(s)
```

## Usage

Once the bot is running and invited to your server, you have three commands available:

### `/gifsearch` - Interactive GIF Search (NEW! 🎉)

The easiest way to create face-swapped GIFs! Browse and select from thousands of GIFs without leaving Discord.

1. Type `/gifsearch query:funny cat` (or any search term)
2. Bot shows 9 GIF previews with selection buttons
3. Use **Next/Previous** buttons to browse more GIFs
4. Click **Select** on any GIF you like
5. Upload your face image when prompted
6. Wait 1-3 minutes for automatic processing
7. Get your face-swapped GIF!

**Example:**

```
/gifsearch query:excited
```

Bot shows GIF grid with buttons. After selection:

```
✅ GIF selected! Now please upload your face image...
```

You upload your face, then:

```
✅ Face swap complete! Used 134 credits.
🎉 Result is an animated GIF!
[Uploads result]
```

**Why use `/gifsearch`?**

- ✅ No need to download GIFs
- ✅ Browse thousands of GIFs
- ✅ See previews before selecting
- ✅ Automatic processing

### `/faceswap` - Swap faces in static images

1. Type `/faceswap` in any channel
2. Upload **source_face**: The image with the face you want to use
3. Upload **target_image**: The image where you want the face swapped
4. Wait 10-30 seconds for processing
5. The bot will reply with your face-swapped image!

**Example:**

```
/faceswap source_face:[selfie.jpg] target_image:[movie-poster.jpg]
```

Bot response:

```
✅ Face swap complete! Used 5 credits.
[Uploads result image]
```

### `/faceswapgif` - Swap faces in animated GIFs (NEW! 🎉)

1. Type `/faceswapgif` in any channel
2. Upload **source_face**: The image with the face you want to use
3. Upload **target_gif**: An animated GIF where you want the face swapped
4. (Optional) Set **max_duration**: Maximum duration in seconds (1-30, default: 20)
5. Wait 1-3 minutes for processing
6. The bot will reply with your face-swapped GIF!

**Example:**

```
/faceswapgif source_face:[selfie.jpg] target_gif:[funny-reaction.gif] max_duration:15
```

Bot response:

```
✅ Face swap complete! Used 134 credits.
🎉 Result is an animated GIF!
[Uploads result GIF]
```

**Note:** GIF processing takes longer and uses more credits based on the duration and frame rate of the GIF.

## Supported Formats

### Image Formats (for `/faceswap` and source faces)

- PNG (.png)
- JPEG (.jpg, .jpeg)
- WebP (.webp)
- AVIF (.avif)
- TIFF (.tiff)
- BMP (.bmp)

### Video/GIF Formats (for `/faceswapgif` target)

- GIF (.gif) - Animated GIFs
- MP4 (.mp4)
- MOV (.mov)
- WEBM (.webm)

## Error Messages

The bot provides helpful error messages:

- ❌ **No face detected**: Use images with clear, visible faces
- ❌ **Invalid image format**: Upload a supported image format
- ❌ **File too large**: Keep images under 25MB
- ❌ **Insufficient credits**: Check your Magic Hour account balance

## Pricing

### Image Face Swap (`/faceswap`)

- **5 credits** per image
- Processing time: 10-30 seconds

### GIF/Video Face Swap (`/faceswapgif`)

- **Variable credits** based on duration and frame rate
- Approximately **30-50 credits per second** of video @ 30fps
- Example: A 5-second GIF ≈ 150-250 credits
- Processing time: 1-3 minutes

**Tips to reduce costs:**

- Keep GIFs short (5-15 seconds recommended)
- Use the `max_duration` parameter to limit length
- Lower frame rate GIFs cost less

Check your usage at [Magic Hour Dashboard](https://magichour.ai/dashboard)  
See pricing plans at [Magic Hour Pricing](https://magichour.ai/pricing)

## Project Structure

```
gif-faces-swap/
├── src/
│   ├── index.ts              # Bot entry point
│   ├── deploy-commands.ts    # Command registration script
│   ├── commands/
│   │   └── faceswap.ts       # Face swap command handler
│   ├── utils/
│   │   └── magicHour.ts      # Magic Hour API wrapper
│   └── types/
│       └── index.ts          # TypeScript type definitions
├── dist/                     # Compiled JavaScript (generated)
├── .env                      # Environment variables (create this)
├── .env.example              # Example environment file
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled bot
- `npm run dev` - Run with ts-node for development
- `npm run deploy-commands` - Register slash commands with Discord

### Adding New Commands

1. Create a new file in `src/commands/`
2. Export a `SlashCommandBuilder` for the command definition
3. Export a handler function
4. Import and register in `src/index.ts`
5. Add to `src/deploy-commands.ts`
6. Run `npm run deploy-commands`

## Troubleshooting

### Bot doesn't respond to commands

- Ensure you ran `npm run deploy-commands`
- Wait up to 1 hour for global commands to propagate
- Check that the bot has proper permissions in your server
- Verify the bot is online (check Discord server member list)

### "/Missing required environment variable" error

- Check that your `.env` file exists in the project root
- Verify all four variables are set: `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `MAGIC_HOUR_API_KEY`, `TENOR_API_KEY`
- Make sure there are no extra spaces or quotes around the values

### "Magic Hour API authentication failed"

- Verify your `MAGIC_HOUR_API_KEY` is correct
- Ensure your Magic Hour account has sufficient credits
- Check [Magic Hour Dashboard](https://magichour.ai/dashboard) for account status

### "No face detected" errors

- Use images with clear, front-facing faces
- Ensure good lighting in the source images
- Avoid images with multiple faces (unless you want all faces swapped)
- Try different images if detection fails

## Resources

- [Discord.js Guide](https://discordjs.guide/)
- [Discord Developer Portal](https://discord.com/developers/applications)
- [Magic Hour API Documentation](https://docs.magichour.ai/)
- [Magic Hour Dashboard](https://magichour.ai/dashboard)

## License

MIT

## Support

- For Discord bot issues: Check [Discord.js Guide](https://discordjs.guide/)
- For Magic Hour API issues: Visit [Magic Hour Docs](https://docs.magichour.ai/)
- For bug reports: Create an issue in this repository

---

Built with ❤️ using [discord.js](https://discord.js.org/) and [Magic Hour API](https://magichour.ai/)
