const { Client, GatewayIntentBits, Events, Partials, Collection } = require('discord.js');
const words = require('an-array-of-english-words');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

let game = null;
const joinMessageIdMap = new Map(); // Map of messageId to game info

function shuffleWord(word) {
  return word.split('').sort(() => Math.random() - 0.5).join('');
}

function startTournament() {
  if (!game || game.players.length === 0) {
    game.channel.send('⚠️ No players joined. Cancelling the game.');
    game = null;
    return;
  }

  game.round = 0;
  game.isRunning = true;
  game.waitingForPlayers = false;  // Ensure the waiting flag is reset
  nextRound();
}

function nextRound() {
  if (!game || game.round >= game.maxRounds) {
    endGame();
    return;
  }

  game.round++;
  const easyWords = words.filter(w => w.length >= 4 && w.length <= 7 && /^[a-z]+$/.test(w));
  game.currentWord = easyWords[Math.floor(Math.random() * easyWords.length)];  const scrambled = shuffleWord(game.currentWord);
  game.startTime = Date.now();

  game.channel.send(`🔤 **Round ${game.round}**: Unscramble this word: **${scrambled}** (60s)`);

  game.timer = setTimeout(() => {
    game.channel.send(`⏰ Time's up! The word was **${game.currentWord}**.`);
    nextRound();
  }, 60000);
}

function endGame() {
  if (!game) return;

  game.isRunning = false;
  const scoreboard = Object.entries(game.scores)
    .sort((a, b) => b[1] - a[1])
    .map(([user, score], i) => `**${i + 1}.** ${user}: ${score} pts`)
    .join('\n') || 'No one scored.';

  game.channel.send(`🏁 **Tournament Over!**\n\n**Final Scores:**\n${scoreboard}`);
  
  // Remove the game from the map when it ends
  joinMessageIdMap.delete(game.joinMessageId);
  
  game = null; // Explicitly reset the game state
}

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // /battle command - Start a new battle game
  if (interaction.commandName === 'battle') {
    const gameType = interaction.options.getString('type');
    const startMode = interaction.options.getString('start');
    const roundsInput = interaction.options.getInteger('rounds');
    const rounds = gameType === 'quick' ? 1 : (roundsInput || 5);

    if (game?.isRunning || game?.waitingForPlayers) {
      await interaction.reply({ content: '⚠️ A game is already in progress or being prepared.', ephemeral: true });
      return;
    }

    const joinMsg = await interaction.channel.send(
      `🎮 **Word Battle Starting!** Type: **${gameType}** (${rounds} round${rounds > 1 ? 's' : ''})\nReact with ✅ to join!\nStart: **${startMode === 'manual' ? 'Manually by host' : 'Auto in 2 mins'}**`
    );
    await joinMsg.react('✅');

    game = {
      round: 0,
      maxRounds: rounds,
      scores: {},
      currentWord: '',
      isRunning: false,
      startTime: null,
      timer: null,
      channel: interaction.channel,
      players: [],
      waitingForPlayers: true,
      hostId: interaction.user.id,
      joinMessageId: joinMsg.id
    };

    joinMessageIdMap.set(joinMsg.id, game);

    if (startMode === 'auto') {
      setTimeout(() => {
        if (game?.waitingForPlayers) {
          game.waitingForPlayers = false;
          startTournament();
        }
      }, 120000); // Auto start the game after 2 minutes
    }

    await interaction.reply({
      content: `📝 Game setup started. Type: **${gameType}**, Rounds: **${rounds}**, Start mode: **${startMode}**`,
      ephemeral: true
    });
  }

  // /startgame command - Manually start the game
  if (interaction.commandName === 'startgame') {
    if (interaction.user.id !== game.hostId) {
      await interaction.reply({ content: '❌ Only the host can start the game!', ephemeral: true });
      return;
    }

    if (!game || game.isRunning) {
      await interaction.reply({ content: '⚠️ No game is being prepared or the game has already started.', ephemeral: true });
      return;
    }

    startTournament();
    await interaction.reply({ content: '✅ The game has started!', ephemeral: true });
  }
});

// Reaction handler to track players joining
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  
  if (reaction.message.partial) await reaction.message.fetch();

  const gameInfo = joinMessageIdMap.get(reaction.message.id);
  if (!gameInfo || reaction.emoji.name !== '✅' || !gameInfo.waitingForPlayers) return;

  const username = user.username;
  if (!gameInfo.players.includes(username)) {
    gameInfo.players.push(username);
  }
});

// Handle guesses during the game
client.on('messageCreate', message => {
  if (message.author.bot || !game?.isRunning) return;
  if (!game.players.includes(message.author.username)) return;

  const guess = message.content.toLowerCase();
  if (guess === game.currentWord) {
    clearTimeout(game.timer);

    const timeTaken = Math.floor((Date.now() - game.startTime) / 1000);
    const points = Math.max(60 - timeTaken, 5);

    const username = message.author.username;
    game.scores[username] = (game.scores[username] || 0) + points;

    message.channel.send(`✅ Correct, ${username}! You earned **${points} pts**.`);
    nextRound();
  }
});

client.login(process.env.DISCORD_TOKEN);
