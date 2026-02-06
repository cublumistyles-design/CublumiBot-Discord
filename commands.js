const { REST, Routes } = require('discord.js');

const commands = [
  {
    name: 'play',
    description: 'Play a song from YouTube',
    options: [{
      name: 'url',
      description: 'YouTube URL',
      type: 3,
      required: true
    }]
  },
  {
    name: 'skip',
    description: 'Skip current song'
  },
  {
    name: 'pause',
    description: 'Pause/resume playback'
  },
  {
    name: 'queue',
    description: 'Show music queue'
  },
  {
    name: 'volume',
    description: 'Set volume (1-100)',
    options: [{
      name: 'level',
      description: 'Volume level',
      type: 4,
      required: true,
      min_value: 1,
      max_value: 100
    }]
  },
  {
    name: 'loop',
    description: 'Toggle loop mode'
  },
  {
    name: 'leave',
    description: 'Leave voice channel'
  },
  {
    name: 'leaderboard',
    description: 'View server leaderboard',
    options: [{
      name: 'period',
      description: 'Time period',
      type: 3,
      required: false,
      choices: [
        { name: 'Daily', value: 'daily' },
        { name: 'Weekly', value: 'weekly' },
        { name: 'Monthly', value: 'monthly' },
        { name: 'All Time', value: 'alltime' }
      ]
    }]
  },
  {
    name: 'rank',
    description: 'Check your rank'
  },
  {
    name: 'badges',
    description: 'View your badges'
  },
  {
    name: 'ticket',
    description: 'Ticket system commands',
    options: [{
      name: 'action',
      description: 'Action to perform',
      type: 3,
      required: true,
      choices: [
        { name: 'Create Ticket', value: 'create' },
        { name: 'Close Ticket', value: 'close' },
        { name: 'View Tickets', value: 'view' }
      ]
    }]
  },
  {
    name: 'dnd',
    description: 'D&D character and adventure system',
    options: [{
      name: 'action',
      description: 'What to do',
      type: 3,
      required: true,
      choices: [
        { name: 'Create Character', value: 'create' },
        { name: 'View Character', value: 'character' },
        { name: 'Start Adventure', value: 'adventure' },
        { name: 'Join Campaign', value: 'join' }
      ]
    }]
  },
  {
    name: 'generate',
    description: 'Generate AI image',
    options: [{
      name: 'prompt',
      description: 'Describe the image you want',
      type: 3,
      required: true
    }]
  },
  {
    name: 'bot-config',
    description: 'Configure bot settings (Admin only)',
    options: [{
      name: 'personality',
      description: 'Set chatbot personality',
      type: 3,
      required: false,
      choices: [
        { name: 'Casual', value: 'casual' },
        { name: 'Professional', value: 'professional' },
        { name: 'Dommy Mommy', value: 'dommy_mommy' }
      ]
    }, {
      name: 'feature',
      description: 'Feature to toggle',
      type: 3,
      required: false,
      choices: [
        { name: 'Music', value: 'music' },
        { name: 'Leaderboard', value: 'leaderboard' },
        { name: 'Tickets', value: 'tickets' },
        { name: 'DND', value: 'dnd' },
        { name: 'Image Generation', value: 'images' }
      ]
    }, {
      name: 'enabled',
      description: 'Enable or disable',
      type: 5,
      required: false
    }]
  },
  {
    name: 'stats',
    description: 'View channel statistics'
  },
  {
    name: 'ping',
    description: 'Check if bot is online'
  }
];

async function registerCommands(client) {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
  
  try {
    console.log('🔄 Registering slash commands...');
    console.log(`📋 Total commands to register: ${commands.length}`);
    
    // Verify client ID is the application ID
    const appId = process.env.DISCORD_CLIENT_ID || client.application.id;
    console.log(`🔑 Using Application ID: ${appId}`);
    
    // Register commands for all guilds the bot is in
    const guilds = client.guilds.cache;
    console.log(`🏠 Found ${guilds.size} guild(s)`);
    
    if (guilds.size === 0) {
      console.log('⚠️ Bot is not in any guilds yet!');
      console.log('🔗 Make sure to invite the bot with this URL:');
      console.log(`https://discord.com/api/oauth2/authorize?client_id=${appId}&permissions=8&scope=bot%20applications.commands`);
      return;
    }
    
    for (const [guildId, guild] of guilds) {
      try {
        console.log(`⏳ Registering commands for: ${guild.name} (${guildId})...`);
        
        await rest.put(
          Routes.applicationGuildCommands(appId, guildId),
          { body: commands }
        );
        
        console.log(`✅ Registered ${commands.length} commands for guild: ${guild.name}`);
        
        // Verify commands were registered
        const registeredCommands = await rest.get(
          Routes.applicationGuildCommands(appId, guildId)
        );
        console.log(`✔️ Verified ${registeredCommands.length} commands active in ${guild.name}`);
        
      } catch (err) {
        console.error(`❌ Failed to register commands for guild ${guild.name}:`);
        console.error(`   Error: ${err.message}`);
        if (err.code) console.error(`   Code: ${err.code}`);
        if (err.status) console.error(`   Status: ${err.status}`);
      }
    }
    
    console.log('✅ Command registration complete');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
    console.error('Full error details:', JSON.stringify(err, null, 2));
    console.error('\n⚠️ Checklist:');
    console.error('  1. Bot invited with applications.commands scope?');
    console.error('  2. DISCORD_CLIENT_ID matches your Application ID?');
    console.error('  3. DISCORD_BOT_TOKEN is valid and not expired?');
    console.error('  4. Bot has Administrator or proper permissions in guild?');
  }
}

module.exports = { registerCommands };
