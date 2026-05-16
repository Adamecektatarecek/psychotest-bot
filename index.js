require('dotenv').config();
const { Client, GatewayIntentBits, ModalBuilder, TextInputBuilder,
        TextInputStyle, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder,
        InteractionType } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const WEBHOOK_URL = process.env.WEBHOOK_URL;

// ── Pomocná funkce: odeslání na webhook ──
async function sendToWebhook(data) {
  const { user, icJmeno, icAlias, vek, typTestu, pozice, termin, dostupnost, duvod } = data;

  const avatarUrl = user.displayAvatarURL({ size: 256, extension: 'png', forceStatic: false });

  const embed = new EmbedBuilder()
    .setTitle('Nová žádost o Psychotesty')
    .setDescription(`Žadatel: <@${user.id}>`)
    .setColor(0x3b82f6)
    .setThumbnail(avatarUrl)
    .addFields(
      { name: 'IC Jméno',           value: icJmeno || '—',   inline: true },
      { name: 'IC Alias',           value: icAlias || '—',   inline: true },
      { name: 'IC Věk',             value: vek     || '—',   inline: true },
      { name: 'Discord tag',        value: `${user.username}`, inline: true },
      { name: 'Discord ID',         value: `\`${user.id}\``,  inline: true },
      { name: 'Typ psychotestu',    value: typTestu || '—',  inline: true },
      { name: 'Pracovní pozice',    value: pozice   || '—',  inline: false },
      { name: 'Preferovaný termín', value: termin   || '—',  inline: false },
      { name: 'Dostupnost',         value: dostupnost || '—', inline: false },
      { name: 'Důvod / Info',       value: duvod    || '—',  inline: false },
    )
    .setFooter({ text: 'Psychotesty • Formulář žádosti', iconURL: avatarUrl })
    .setTimestamp();

  const payload = {
    username: 'Psychotesty Bot',
    avatar_url: avatarUrl,
    content: `@here Nová žádost o psychotesty od <@${user.id}>!`,
    embeds: [embed.toJSON()],
    allowed_mentions: { parse: ['everyone', 'users'] }
  };

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return res.ok || res.status === 204;
}

// ── Uložení mezikroku (typ psychotestu) per user ──
const pendingSelections = new Map();

client.once('ready', () => {
  console.log(`Bot přihlášen jako ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {

  // ── /psychotest příkaz ──
  if (interaction.isChatInputCommand() && interaction.commandName === 'psychotest') {
    // Nejprve Select menu pro typ testu
    const select = new StringSelectMenuBuilder()
      .setCustomId('select_typ_testu')
      .setPlaceholder('Vyberte typ psychotestu…')
      .addOptions([
        { label: 'Vstupní psychotest',    value: 'Vstupní psychotest',    emoji: '📋' },
        { label: 'Opakovaný psychotest',  value: 'Opakovaný psychotest',  emoji: '🔄' },
        { label: 'Kariérní poradenství',  value: 'Kariérní poradenství',  emoji: '💼' },
        { label: 'Jiný',                  value: 'Jiný',                  emoji: '📝' },
      ]);

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.reply({
      content: '**Žádost o psychotesty**\nNejprve vyberte typ psychotestu:',
      components: [row],
      ephemeral: true
    });
  }

  // ── Výběr typu testu → otevřít modal ──
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_typ_testu') {
    const typTestu = interaction.values[0];
    pendingSelections.set(interaction.user.id, typTestu);

    const modal = new ModalBuilder()
      .setCustomId('modal_psychotest')
      .setTitle('Žádost o psychotesty');

    const icJmenoInput = new TextInputBuilder()
      .setCustomId('icJmeno')
      .setLabel('IC Jméno a Příjmení')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Např. Adam Novotný')
      .setRequired(true);

    const icAliasInput = new TextInputBuilder()
      .setCustomId('icAlias')
      .setLabel('IC Alias / Přezdívka')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Nepovinné')
      .setRequired(false);

    const vekInput = new TextInputBuilder()
      .setCustomId('vek')
      .setLabel('IC Věk')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Např. 28')
      .setRequired(false);

    const terminInput = new TextInputBuilder()
      .setCustomId('termin')
      .setLabel('Preferovaný termín a čas')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Např. 20.05.2026 v 18:00')
      .setRequired(true);

    const duvodInput = new TextInputBuilder()
      .setCustomId('duvod')
      .setLabel('Důvod žádosti / doplňující info')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Stručně popište důvod žádosti, dostupnost, pozici…')
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(icJmenoInput),
      new ActionRowBuilder().addComponents(icAliasInput),
      new ActionRowBuilder().addComponents(vekInput),
      new ActionRowBuilder().addComponents(terminInput),
      new ActionRowBuilder().addComponents(duvodInput),
    );

    await interaction.showModal(modal);
  }

  // ── Odeslání modalu ──
  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'modal_psychotest') {
    await interaction.deferReply({ ephemeral: true });

    const typTestu    = pendingSelections.get(interaction.user.id) || '—';
    const icJmeno     = interaction.fields.getTextInputValue('icJmeno');
    const icAlias     = interaction.fields.getTextInputValue('icAlias');
    const vek         = interaction.fields.getTextInputValue('vek');
    const termin      = interaction.fields.getTextInputValue('termin');
    const duvod       = interaction.fields.getTextInputValue('duvod');

    pendingSelections.delete(interaction.user.id);

    try {
      const ok = await sendToWebhook({
        user: interaction.user,
        icJmeno, icAlias, vek, typTestu,
        pozice: '',
        termin,
        dostupnost: '',
        duvod
      });

      if (ok) {
        await interaction.editReply({
          content: '✅ **Tvoje žádost byla úspěšně odeslána!**\nBudeme tě kontaktovat přes Discord ohledně termínu schůzky.'
        });
      } else {
        await interaction.editReply({ content: '❌ Nastala chyba při odesílání. Zkus to prosím znovu.' });
      }
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: '❌ Neočekávaná chyba. Kontaktuj administrátora.' });
    }
  }
});

client.login(process.env.BOT_TOKEN);
