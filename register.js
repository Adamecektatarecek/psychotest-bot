require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('psychotest')
    .setDescription('Podej žádost o psychotesty a rezervuj si schůzku')
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log('Registruji slash příkazy...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('Příkazy úspěšně zaregistrovány!');
  } catch (err) {
    console.error('Chyba při registraci:', err);
  }
})();
