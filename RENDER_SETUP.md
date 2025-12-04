# Discord Face Swap Bot - Render Deployment Guide

This guide walks you through deploying the Discord Face Swap Bot on Render, a cloud hosting platform that makes it easy to run your bot 24/7.

## Prerequisites

Before starting, make sure you have:

1. A GitHub account (or GitLab/Bitbucket)
2. Your Discord Bot Token
3. Your Discord Application ID (Client ID)
4. A Magic Hour API Key
5. A Tenor API Key
6. A Render account (free tier available at https://render.com)

## Step 1: Prepare Your Code Repository

### 1.1 Push Code to GitHub

If you haven't already, push your bot code to a GitHub repository:

1. Create a new repository on GitHub
2. Initialize git in your project folder (if not already done):
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/your-username/your-repo-name.git
   git push -u origin main
   ```

### 1.2 Verify Required Files

Make sure these files exist in your repository:

- `package.json` - Contains build and start scripts
- `tsconfig.json` - TypeScript configuration
- `src/` directory - Source code
- `.env.example` - Example environment variables (optional but recommended)

## Step 2: Create a Discord Bot

If you haven't created your Discord bot yet:

1. Go to https://discord.com/developers/applications
2. Click "New Application" and name it
3. Go to the "Bot" section
4. Click "Add Bot" and confirm
5. Copy the Bot Token (you'll need this for Render)
6. Under "Privileged Gateway Intents", enable:
   - Message Content Intent
7. Go to "OAuth2" → "URL Generator"
8. Select scopes:
   - bot
   - applications.commands
9. Select bot permissions:
   - Read Messages/View Channels
   - Send Messages
   - Attach Files
   - Use Slash Commands
10. Copy the generated URL and invite the bot to your server

### Get Your Application ID

1. In Discord Developer Portal, go to "General Information"
2. Copy the "Application ID" (this is your DISCORD_CLIENT_ID)

## Step 3: Get API Keys

### Magic Hour API Key

1. Go to https://magichour.ai/developer
2. Sign in or create an account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `mh_`)

### Tenor API Key

1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable the Tenor API
4. Go to Credentials → Create Credentials → API Key
5. Copy the API key
6. (Optional) Restrict the key to Tenor API only for security

## Step 4: Create a Render Account

1. Go to https://render.com
2. Sign up with GitHub (recommended) or email
3. Verify your email if required

## Step 5: Create a New Web Service on Render

1. In Render dashboard, click "New +"
2. Select "Web Service"
3. Connect your GitHub account if not already connected
4. Select the repository containing your bot code
5. Click "Connect"

## Step 6: Configure Render Service Settings

### Basic Settings

- **Name**: Choose a name for your service (e.g., "discord-face-swap-bot")
- **Region**: Select the region closest to your users
- **Branch**: Select `main` (or your default branch)
- **Root Directory**: Leave empty (or specify if your code is in a subdirectory)
- **Runtime**: Select "Node"
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

### Environment Variables

Click "Add Environment Variable" and add each of these:

```
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
MAGIC_HOUR_API_KEY=your_magic_hour_api_key_here
TENOR_API_KEY=your_tenor_api_key_here
TENOR_CLIENT_KEY=discord-face-swap-bot
```

Optional environment variables:

```
LOG_LEVEL=INFO
LOG_TO_FILE=false
LOG_FILE_PATH=./logs/bot.log
ADMIN_USER_IDS=your_discord_user_id_1,your_discord_user_id_2
```

**Important**: Replace all placeholder values with your actual keys and IDs.

### Advanced Settings

- **Instance Type**: Free tier is sufficient for most bots
- **Auto-Deploy**: Enable to automatically deploy on git push
- **Health Check Path**: Leave empty (not needed for Discord bots)

## Step 7: Deploy the Service

1. Click "Create Web Service"
2. Render will start building your service
3. Watch the build logs for any errors
4. Once deployed, your bot should be running

## Step 8: Deploy Slash Commands

Before your bot can respond to commands, you need to register them with Discord:

### Option A: Deploy Commands Locally (Recommended)

1. On your local machine, ensure you have Node.js installed
2. Clone your repository (if you don't have it locally)
3. Create a `.env` file with your credentials:
   ```
   DISCORD_BOT_TOKEN=your_token
   DISCORD_CLIENT_ID=your_client_id
   ```
4. Install dependencies: `npm install`
5. Run: `npm run deploy-commands`
6. You should see: "Successfully reloaded X application (/) command(s)."

### Option B: Deploy Commands via Render Shell

1. In Render dashboard, go to your service
2. Click "Shell" tab
3. Run: `npm run deploy-commands`
4. Note: You may need to set environment variables in the shell session

**Important**: Global commands can take up to 1 hour to appear in all Discord servers. For faster testing, consider using guild-specific commands during development.

## Step 9: Verify Bot is Running

1. Check Render service logs - you should see:
   - "Discord bot is ready!"
   - "Bot is in X server(s)"
   - No error messages

2. Check your Discord server:
   - Bot should appear online in the member list
   - Commands should be available (may take up to 1 hour for global commands)

3. Test a command:
   - Type `/help` in any channel
   - Bot should respond with help information

## Step 10: Database Considerations

This bot uses SQLite for storing user data (saved faces, preferences, rate limits, etc.).

**Important Notes for Render:**

1. **Ephemeral Disk**: Render's free tier uses ephemeral disk storage. This means:
   - Database files are stored temporarily
   - Data may be lost if the service restarts or is redeployed
   - For production use, consider upgrading to a persistent disk plan

2. **Database Location**: The bot creates a `data/` directory for the database. On Render:
   - Files are stored in the service's filesystem
   - Backups are created automatically by the bot
   - Consider implementing periodic backups to external storage

3. **Alternative Solutions**:
   - Use Render's PostgreSQL addon for persistent storage (requires code changes)
   - Implement periodic database backups to cloud storage
   - Use a managed database service

## Troubleshooting

### Bot Not Starting

**Check Build Logs:**

- Look for TypeScript compilation errors
- Verify all dependencies installed correctly
- Check for missing environment variables

**Common Issues:**

1. **"Missing required environment variable"**
   - Solution: Verify all environment variables are set in Render dashboard
   - Check for typos in variable names
   - Ensure no extra spaces or quotes

2. **"Failed to login to Discord"**
   - Solution: Verify DISCORD_BOT_TOKEN is correct
   - Check that the token hasn't been regenerated
   - Ensure bot is not already logged in elsewhere

3. **"API validation failed"**
   - Solution: Verify MAGIC_HOUR_API_KEY and TENOR_API_KEY are correct
   - Check API key permissions and quotas
   - Ensure API keys haven't expired

### Commands Not Appearing

1. **Wait Time**: Global commands can take up to 1 hour to propagate
2. **Deploy Commands**: Ensure you ran `npm run deploy-commands`
3. **Permissions**: Verify bot has proper permissions in your server
4. **Bot Status**: Check that bot is online in Discord

### Bot Goes Offline

1. **Check Render Logs**: Look for error messages or crashes
2. **Service Status**: Verify service is running in Render dashboard
3. **Resource Limits**: Free tier has resource limits - check if exceeded
4. **Auto-Deploy Issues**: Check if recent git push caused deployment issues

### Database Issues

1. **Data Loss**: Expected on free tier with ephemeral storage
2. **Database Locked**: Usually resolves on service restart
3. **Backup Failed**: Check disk space and permissions

## Updating Your Bot

### Automatic Updates

If "Auto-Deploy" is enabled:

1. Push changes to your GitHub repository
2. Render automatically detects changes
3. Service rebuilds and redeploys
4. Bot restarts with new code

### Manual Updates

1. In Render dashboard, go to your service
2. Click "Manual Deploy"
3. Select the branch/commit to deploy
4. Click "Deploy"

**Important**: After code changes that add/modify commands:

- Run `npm run deploy-commands` again to register new commands
- Wait for command propagation (up to 1 hour for global commands)

## Monitoring and Logs

### View Logs in Render

1. Go to your service in Render dashboard
2. Click "Logs" tab
3. View real-time logs
4. Use search/filter to find specific errors

### Log Levels

Configure log level via environment variable:

- `LOG_LEVEL=DEBUG` - Most verbose (development)
- `LOG_LEVEL=INFO` - Standard logging (recommended)
- `LOG_LEVEL=WARN` - Warnings and errors only
- `LOG_LEVEL=ERROR` - Errors only

### Health Monitoring

While Render doesn't provide built-in health checks for Discord bots, you can:

- Monitor logs for errors
- Check service uptime in Render dashboard
- Set up external monitoring (e.g., UptimeRobot) to ping your bot

## Cost Considerations

### Free Tier Limits

- 750 hours/month of runtime
- 512MB RAM
- Ephemeral disk storage
- Sleeps after 15 minutes of inactivity (wakes on request)

### Paid Plans

- Starter: $7/month - Persistent disk, always-on
- Standard: $25/month - More resources, better performance
- Pro: $85/month - Production-grade resources

**Recommendation**: Start with free tier for testing, upgrade if you need:

- Persistent database storage
- Always-on service (no sleep)
- More resources for high usage

## Security Best Practices

1. **Never commit `.env` file** - Already in `.gitignore`
2. **Use environment variables** - Never hardcode secrets
3. **Restrict API keys** - Limit Tenor API key to specific APIs
4. **Regular updates** - Keep dependencies updated
5. **Monitor logs** - Watch for suspicious activity
6. **Backup database** - Implement regular backups for important data

## Additional Resources

- Render Documentation: https://render.com/docs
- Discord.js Guide: https://discordjs.guide/
- Magic Hour API Docs: https://docs.magichour.ai/
- Tenor API Docs: https://developers.google.com/tenor/guides

## Support

If you encounter issues:

1. Check Render service logs for errors
2. Verify all environment variables are set correctly
3. Ensure bot has proper Discord permissions
4. Check API key validity and quotas
5. Review this guide's troubleshooting section

For Render-specific issues, consult Render's documentation or support.
For Discord bot issues, check Discord.js documentation.
For API issues, consult Magic Hour or Tenor documentation.

---

Your bot should now be running 24/7 on Render! The free tier is perfect for testing and moderate usage. Upgrade to a paid plan when you need persistent storage or higher performance.
