const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { clientId, token } = require('./config.json'); // Replace with your values

const commands = [
  new SlashCommandBuilder()
    .setName('battle')
    .setDescription('Start a new word battle game')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of game')
        .setRequired(true)
        .addChoices(
          { name: 'Quick (1 round)', value: 'quick' },
          { name: 'Tournament (multiple rounds)', value: 'tournament' }
        ))
    .addStringOption(option =>
      option.setName('start')
        .setDescription('When should the game start?')
        .setRequired(true)
        .addChoices(
          { name: 'Manual (/startgame)', value: 'manual' },
          { name: 'Automatic (after 2 mins)', value: 'auto' }
        ))
    .addIntegerOption(option =>
      option.setName('rounds')
        .setDescription('Number of rounds (if tournament)')
        .setRequired(false)),
        
  new SlashCommandBuilder()
    .setName('startgame')
    .setDescription('Start the game early (only the host can use this)')
].map(cmd => cmd.toJSON());


const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('🔄 Refreshing application commands...');
    
    // Change to global commands registration
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    console.log('✅ Slash commands reloaded.');
  } catch (error) {
    console.error(error);
  }
})();
