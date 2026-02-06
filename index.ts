const { Client, GatewayIntentBits, REST, Routes, ActivityType } = require('discord.js');
const { registerCommands } = require('./commands');
const musicHandler = require('./handlers/music');
const leaderboardHandler = require('./handlers/leaderboard');
const ticketHandler = require('./handlers/tickets');
const chatbotHandler = require('./handlers/chatbot');
const dndHandler = require('./handlers/dnd');
const imageHandler = require('./handlers/imageGeneration');
const { checkScheduledAnnouncements } = require('./handlers/announcements');
const { checkRSSFeeds } = require('./handlers/rss');
const { updateQuestProgress, checkExpiredQuests } = require('./handlers/quests');
const { checkAutoModeration } = require('./handlers/automod');
const { checkScheduledSocialPosts } = require('./handlers/social');

const { Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message]
});

const BASE44_API = 'https://api.base44.com';
const APP_ID = process.env.BASE44_APP_ID;
const SERVICE_KEY = process.env.BASE44_SERVICE_ROLE_KEY;

// API helper
async function base44API(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(`${BASE44_API}/apps/${APP_ID}${endpoint}`, options);
  return await res.json();
}

// Bot ready event
client.once('ready', async () => {
  console.log(`✅ CublumiBot is online as ${client.user.tag}`);
  console.log(`📱 Application ID: ${client.application.id}`);
  console.log(`🔑 Client ID: ${process.env.DISCORD_CLIENT_ID}`);
  console.log(`🏠 In ${client.guilds.cache.size} guild(s)`);
  
  // Verify application ID matches client ID
  if (client.application.id !== process.env.DISCORD_CLIENT_ID) {
    console.error('⚠️ WARNING: Application ID mismatch!');
    console.error(`Application ID: ${client.application.id}`);
    console.error(`DISCORD_CLIENT_ID: ${process.env.DISCORD_CLIENT_ID}`);
  }
  
  // Set bot status
  client.user.setActivity('Cublumi.com', { type: ActivityType.Watching });
  
  // Register slash commands
  try {
    await registerCommands(client);
    console.log('✅ Slash commands registered');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
    console.error('Full error:', JSON.stringify(err, null, 2));
  }
  
  // Start monitoring loops
  setInterval(() => leaderboardHandler.trackVoiceActivity(client, base44API), 60000); // Every minute
  setInterval(() => musicHandler.monitorQueues(client, base44API), 2000); // Every 2 seconds
  
  // 24/7 Server Features
  setInterval(() => checkScheduledAnnouncements(client, base44API), 60000); // Every minute
  setInterval(() => checkRSSFeeds(client, base44API), 5 * 60000); // Every 5 minutes
  setInterval(() => checkExpiredQuests(client, base44API), 60 * 60000); // Every hour
  setInterval(() => checkScheduledSocialPosts(base44API), 60000); // Every minute
  
  console.log('✅ All 24/7 monitoring systems active');
});

// Check if feature is enabled for guild
async function isFeatureEnabled(guildId, featureName) {
  try {
    const settings = await base44API(`/entities/DiscordGuildSettings?guildId=${guildId}`, 'GET');
    if (settings && settings.length > 0) {
      const guildSettings = settings[0];
      if (guildSettings.disabledFeatures && guildSettings.disabledFeatures.includes(featureName)) {
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Error checking feature status:', error);
    return true; // Default to enabled if check fails
  }
}

// Slash command interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  const { commandName } = interaction;
  
  try {
    // Bot config command
    if (commandName === 'bot-config') {
      if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ content: '❌ Only administrators can configure the bot!', ephemeral: true });
      }

      const personality = interaction.options.getString('personality');
      const feature = interaction.options.getString('feature');
      const enabled = interaction.options.getBoolean('enabled');

      // Handle personality change
      if (personality) {
        let settings = await base44API(`/entities/DiscordGuildSettings?guildId=${interaction.guildId}`, 'GET');
        
        if (!settings || settings.length === 0) {
          await base44API('/entities/DiscordGuildSettings', 'POST', {
            guildId: interaction.guildId,
            guildName: interaction.guild.name,
            chatbotPersonality: personality
          });
        } else {
          await base44API(`/entities/DiscordGuildSettings/${settings[0].id}`, 'PUT', {
            chatbotPersonality: personality
          });
        }

        return interaction.reply({
          embeds: [{
            color: 0x8b5cf6,
            title: '✨ Personality Updated',
            description: `Chatbot personality set to **${personality}**`,
            timestamp: new Date().toISOString()
          }]
        });
      }

      // Handle feature toggle
      if (feature !== null && enabled !== null) {
        let settings = await base44API(`/entities/DiscordGuildSettings?guildId=${interaction.guildId}`, 'GET');
        
        if (!settings || settings.length === 0) {
          await base44API('/entities/DiscordGuildSettings', 'POST', {
            guildId: interaction.guildId,
            guildName: interaction.guild.name,
            disabledFeatures: enabled ? [] : [feature]
          });
        } else {
          const guildSettings = settings[0];
          let disabledFeatures = guildSettings.disabledFeatures || [];
          
          if (enabled) {
            disabledFeatures = disabledFeatures.filter(f => f !== feature);
          } else {
            if (!disabledFeatures.includes(feature)) {
              disabledFeatures.push(feature);
            }
          }
          
          await base44API(`/entities/DiscordGuildSettings/${guildSettings.id}`, 'PUT', {
            disabledFeatures
          });
        }

        return interaction.reply({
          embeds: [{
            color: enabled ? 0x10b981 : 0xef4444,
            title: `${enabled ? '✅' : '❌'} Feature ${enabled ? 'Enabled' : 'Disabled'}`,
            description: `**${feature}** has been ${enabled ? 'enabled' : 'disabled'} for this server.`,
            timestamp: new Date().toISOString()
          }]
        });
      }

      // No valid options provided
      await interaction.reply({
        content: '❌ Please provide either `personality` or both `feature` and `enabled` options.',
        ephemeral: true
      });
    }
    
    // Music commands
    else if (commandName === 'play') {
      if (!(await isFeatureEnabled(interaction.guildId, 'music'))) {
        return interaction.reply({ content: '❌ Music feature is disabled on this server!', ephemeral: true });
      }
      await musicHandler.play(interaction, base44API);
    } else if (commandName === 'skip') {
      if (!(await isFeatureEnabled(interaction.guildId, 'music'))) {
        return interaction.reply({ content: '❌ Music feature is disabled!', ephemeral: true });
      }
      await musicHandler.skip(interaction, base44API);
    } else if (commandName === 'pause') {
      if (!(await isFeatureEnabled(interaction.guildId, 'music'))) {
        return interaction.reply({ content: '❌ Music feature is disabled!', ephemeral: true });
      }
      await musicHandler.pause(interaction, base44API);
    } else if (commandName === 'queue') {
      if (!(await isFeatureEnabled(interaction.guildId, 'music'))) {
        return interaction.reply({ content: '❌ Music feature is disabled!', ephemeral: true });
      }
      await musicHandler.showQueue(interaction, base44API);
    } else if (commandName === 'volume') {
      if (!(await isFeatureEnabled(interaction.guildId, 'music'))) {
        return interaction.reply({ content: '❌ Music feature is disabled!', ephemeral: true });
      }
      await musicHandler.setVolume(interaction, base44API);
    } else if (commandName === 'loop') {
      if (!(await isFeatureEnabled(interaction.guildId, 'music'))) {
        return interaction.reply({ content: '❌ Music feature is disabled!', ephemeral: true });
      }
      await musicHandler.setLoop(interaction, base44API);
    } else if (commandName === 'leave') {
      if (!(await isFeatureEnabled(interaction.guildId, 'music'))) {
        return interaction.reply({ content: '❌ Music feature is disabled!', ephemeral: true });
      }
      await musicHandler.leave(interaction, base44API);
    }
    
    // Leaderboard commands
    else if (commandName === 'leaderboard') {
      if (!(await isFeatureEnabled(interaction.guildId, 'leaderboard'))) {
        return interaction.reply({ content: '❌ Leaderboard feature is disabled!', ephemeral: true });
      }
      await leaderboardHandler.showLeaderboard(interaction, base44API);
    } else if (commandName === 'rank') {
      if (!(await isFeatureEnabled(interaction.guildId, 'leaderboard'))) {
        return interaction.reply({ content: '❌ Leaderboard feature is disabled!', ephemeral: true });
      }
      await leaderboardHandler.showRank(interaction, base44API);
    } else if (commandName === 'badges') {
      if (!(await isFeatureEnabled(interaction.guildId, 'leaderboard'))) {
        return interaction.reply({ content: '❌ Leaderboard feature is disabled!', ephemeral: true });
      }
      await leaderboardHandler.showBadges(interaction, base44API);
    }
    
    // Ticket commands
    else if (commandName === 'ticket') {
      if (!(await isFeatureEnabled(interaction.guildId, 'tickets'))) {
        return interaction.reply({ content: '❌ Ticket system is disabled!', ephemeral: true });
      }
      await ticketHandler.handleTicket(interaction, base44API);
    }
    
    // DND commands
    else if (commandName === 'dnd') {
      if (!(await isFeatureEnabled(interaction.guildId, 'dnd'))) {
        return interaction.reply({ content: '❌ D&D system is disabled!', ephemeral: true });
      }
      const action = interaction.options.getString('action');
      if (action === 'create') {
        await dndHandler.createCharacter(interaction, base44API);
      } else if (action === 'character') {
        await dndHandler.viewCharacter(interaction, base44API);
      } else if (action === 'adventure') {
        await dndHandler.startAdventure(interaction, base44API);
      } else if (action === 'join') {
        await dndHandler.joinCampaign(interaction, base44API);
      }
    }
    
    // Image generation
    else if (commandName === 'generate') {
      if (!(await isFeatureEnabled(interaction.guildId, 'images'))) {
        return interaction.reply({ content: '❌ Image generation is disabled!', ephemeral: true });
      }
      await imageHandler.generateImage(interaction, base44API);
    }
    
    // Stats command
    else if (commandName === 'stats') {
      const totalMessages = await interaction.channel.messages.fetch({ limit: 100 });
      const uniqueUsers = new Set(totalMessages.map(m => m.author.id)).size;
      
      await interaction.reply({
        embeds: [{
          color: 0x8b5cf6,
          title: '📊 Channel Statistics',
          fields: [
            { name: 'Messages (Last 100)', value: totalMessages.size.toString(), inline: true },
            { name: 'Active Users', value: uniqueUsers.toString(), inline: true }
          ],
          timestamp: new Date().toISOString()
        }]
      });
    }
    
    // Ping command
    else if (commandName === 'ping') {
      await interaction.reply('🏓 Pong! Bot is online and connected to Base44.');
    }
  } catch (err) {
    console.error(`Error handling ${commandName}:`, err);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ Something went wrong!', ephemeral: true });
    }
  }
});

// Message events for chatbot, learning, and auto-moderation
client.on('messageCreate', async (message) => {
  console.log('📨 Message received:', {
    author: message.author.tag,
    content: message.content,
    guildId: message.guild?.id,
    channelId: message.channel.id,
    mentions: message.mentions.users.map(u => u.tag),
    hasBotMention: message.mentions.has(client.user)
  });

  if (message.author.bot) return;

  // Auto-moderation check (runs on all messages)
  await checkAutoModeration(message, base44API);

  // Track message for leaderboard
  await leaderboardHandler.trackMessage(message, base44API);

  // Track message for quest progress
  if (message.guild) {
    await updateQuestProgress(
      message.author.id,
      message.guild.id,
      'messages',
      1,
      base44API
    );
  }

  // Track bot activity (async, don't block)
  trackActivity(message, base44API).catch(err => console.error('Activity tracking failed:', err));

  // Check if bot was mentioned
  console.log('🔍 Checking mentions...', {
    hasMention: message.mentions.has(client.user),
    hasKeyword: message.content.toLowerCase().includes('cublumibot')
  });
  
  if (message.mentions.has(client.user) || message.content.toLowerCase().includes('cublumibot')) {
    console.log('✅ Bot mentioned! Responding...');
    await chatbotHandler.respond(message, base44API);
  }
});

// Track activity helper
async function trackActivity(message, base44API) {
  try {
    await base44API('/entities/BotActivityStream', 'POST', {
      guildId: message.guild.id,
      guildName: message.guild.name,
      userId: message.author.id,
      userName: message.author.username,
      eventType: 'message',
      eventData: { channelId: message.channel.id, messageLength: message.content.length },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to track activity:', err);
  }
}

// Voice state changes for leaderboard tracking
client.on('voiceStateUpdate', async (oldState, newState) => {
  await leaderboardHandler.trackVoiceChange(oldState, newState, base44API);
});

// Guild Join - Send introduction message
client.on('guildCreate', async (guild) => {
  console.log(`✅ Joined new server: ${guild.name} (${guild.id})`);
  
  // Find a channel to send welcome message
  const channel = guild.channels.cache.find(
    ch => ch.type === 0 && (ch.name.includes('general') || ch.name.includes('chat'))
  ) || guild.channels.cache.find(ch => ch.type === 0 && ch.permissionsFor(guild.members.me).has('SendMessages'));

  if (!channel) {
    console.log('No suitable channel found for welcome message');
    return;
  }

  const welcomeEmbed = {
    color: 0x8b5cf6,
    title: '👋 Hello! I\'m CublumiBot',
    description: 'Thanks for adding me to your server! I\'m a feature-rich Discord bot with music, leaderboards, tickets, D&D, and AI chatbot capabilities.',
    fields: [
      {
        name: '🎵 Music Commands',
        value: '`/play [youtube-url]` - Play music in voice channel\n`/skip` - Skip current song\n`/pause` - Pause/resume playback\n`/queue` - View music queue\n`/volume [1-100]` - Adjust volume\n`/loop` - Toggle loop mode\n`/leave` - Leave voice channel',
        inline: false
      },
      {
        name: '🏆 Leaderboard & Ranks',
        value: '`/leaderboard [daily|weekly|monthly|alltime]` - View server rankings\n`/rank` - Check your personal rank\n`/badges` - View your achievements',
        inline: false
      },
      {
        name: '🎫 Support Tickets',
        value: '`/ticket create` - Create a support ticket\n`/ticket close` - Close your ticket\n`/ticket view` - View your tickets',
        inline: false
      },
      {
        name: '🎲 D&D System',
        value: '`/dnd create` - Create your D&D character\n`/dnd character` - View your character\n`/dnd adventure` - Start an adventure\n`/dnd join` - Join active campaign',
        inline: false
      },
      {
        name: '💬 AI Chatbot',
        value: 'Just **@mention me** in any channel and I\'ll respond with AI-powered conversations! I remember context and can help with questions, jokes, and more.',
        inline: false
      },
      {
        name: '⚙️ Configuration',
        value: '`/bot-config personality [casual|professional|dommy_mommy]` - Set chatbot personality\n`/bot-config toggle-feature` - Enable/disable features\n`/ping` - Check if bot is online\n`/stats` - View channel statistics',
        inline: false
      },
      {
        name: '🎯 How It Works',
        value: '• **Leaderboard**: Automatically tracks messages and voice time\n• **Music**: Join a voice channel and use `/play` with YouTube links\n• **Tickets**: Creates private channels for support requests\n• **AI Chat**: Mention me anywhere for intelligent responses\n• **D&D**: Full character system with campaigns and adventures',
        inline: false
      },
      {
        name: '🚀 Getting Started',
        value: '1. Use `/bot-config` to customize settings\n2. Join a voice channel and try `/play`\n3. Check `/leaderboard` to see activity tracking\n4. Create a `/ticket` if you need help\n5. @mention me to chat!',
        inline: false
      }
    ],
    footer: {
      text: 'All features are enabled by default. Use /bot-config to customize.'
    },
    timestamp: new Date().toISOString()
  };

  try {
    await channel.send({ embeds: [welcomeEmbed] });
    console.log(`✅ Sent welcome message to ${guild.name}`);
  } catch (error) {
    console.error('Failed to send welcome message:', error);
  }
});

// Login with error handling
console.log('🔐 Attempting to login to Discord...');
console.log('📋 Environment check:', {
  hasToken: !!process.env.DISCORD_BOT_TOKEN,
  hasClientId: !!process.env.DISCORD_CLIENT_ID,
  tokenPrefix: process.env.DISCORD_BOT_TOKEN?.substring(0, 10) + '...'
});

client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => console.log('✅ Login successful'))
  .catch(err => {
    console.error('❌ Failed to login to Discord:');
    console.error('Error:', err.message);
    console.error('Code:', err.code);
    console.error('Full error:', JSON.stringify(err, null, 2));
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  musicHandler.cleanup();
  client.destroy();
  process.exit(0);
});