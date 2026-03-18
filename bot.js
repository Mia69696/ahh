require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials,
  SlashCommandBuilder, Routes, EmbedBuilder,
  PermissionFlagsBits, REST, Collection, ActivityType
} = require('discord.js');

const TOKEN = process.env.BOT_TOKEN;
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// ── STORAGE (in-memory) ──────────────────────────────
const xpData = {};         // { userId: { xp, level } }
const warnings = {};       // { guildId: { userId: count } }
const spamTracker = {};    // { userId: [timestamps] }
const settings = {};       // { guildId: { welcomeChannel, logChannel, ... } }

// ── HELPERS ──────────────────────────────────────────
function getXP(userId) {
  if (!xpData[userId]) xpData[userId] = { xp: 0, level: 1 };
  return xpData[userId];
}

function addXP(userId, amount) {
  const data = getXP(userId);
  data.xp += amount;
  const xpNeeded = data.level * 100;
  if (data.xp >= xpNeeded) {
    data.xp -= xpNeeded;
    data.level += 1;
    return true; // leveled up
  }
  return false;
}

function getWarnings(guildId, userId) {
  if (!warnings[guildId]) warnings[guildId] = {};
  if (!warnings[guildId][userId]) warnings[guildId][userId] = 0;
  return warnings[guildId][userId];
}

function addWarning(guildId, userId) {
  if (!warnings[guildId]) warnings[guildId] = {};
  if (!warnings[guildId][userId]) warnings[guildId][userId] = 0;
  warnings[guildId][userId]++;
  return warnings[guildId][userId];
}

function makeEmbed(color, title, description) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function isSpamming(userId) {
  const now = Date.now();
  if (!spamTracker[userId]) spamTracker[userId] = [];
  spamTracker[userId] = spamTracker[userId].filter(t => now - t < 5000);
  spamTracker[userId].push(now);
  return spamTracker[userId].length >= 5; // 5 messages in 5 seconds
}

const BAD_WORDS = ['badword1', 'badword2']; // add your own
const INVITE_REGEX = /(discord\.gg|discord\.com\/invite)\/[a-zA-Z0-9]+/gi;
const LINK_REGEX = /https?:\/\/[^\s]+/gi;

// ── SLASH COMMANDS ────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member')
    .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member')
    .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .addUserOption(o => o.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a member')
    .addUserOption(o => o.setName('user').setDescription('User to mute').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('Duration in minutes').setRequired(false))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove timeout from a member')
    .addUserOption(o => o.setName('user').setDescription('User to unmute').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Check warnings for a user')
    .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear all warnings for a user')
    .addUserOption(o => o.setName('user').setDescription('User to clear').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your XP rank')
    .addUserOption(o => o.setName('user').setDescription('User to check (optional)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Top members by XP'),

  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete multiple messages')
    .addIntegerOption(o => o.setName('amount').setDescription('Number of messages (1-100)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Info about this server'),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Info about a user')
    .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(false)),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all commands'),
].map(c => c.toJSON());

// ── REGISTER COMMANDS ─────────────────────────────────
async function registerCommands(guildId) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
    console.log(`commands registered in guild ${guildId}`);
  } catch (e) {
    console.error('failed to register commands:', e.message);
  }
}

// ── BOT READY ─────────────────────────────────────────
client.once('ready', () => {
  console.log(`ahh bot online as ${client.user.tag}`);
  client.user.setActivity('your server', { type: ActivityType.Watching });

  // register commands in all guilds
  client.guilds.cache.forEach(guild => {
    registerCommands(guild.id);
  });
});

// register commands when joining a new guild
client.on('guildCreate', guild => {
  registerCommands(guild.id);
  console.log(`joined guild: ${guild.name}`);
});

// ── WELCOME / GOODBYE ────────────────────────────────
client.on('guildMemberAdd', async member => {
  const s = settings[member.guild.id] || {};
  const channelId = s.welcomeChannel;
  const channel = channelId
    ? member.guild.channels.cache.get(channelId)
    : member.guild.systemChannel;
  if (!channel) return;

  const embed = makeEmbed(
    0x1650ff,
    '👋 welcome!',
    `hey <@${member.id}>, welcome to **${member.guild.name}**!\nyou're member **#${member.guild.memberCount}**. enjoy your stay.`
  ).setThumbnail(member.user.displayAvatarURL());

  channel.send({ embeds: [embed] }).catch(() => {});
});

client.on('guildMemberRemove', async member => {
  const s = settings[member.guild.id] || {};
  const channelId = s.welcomeChannel;
  const channel = channelId
    ? member.guild.channels.cache.get(channelId)
    : member.guild.systemChannel;
  if (!channel) return;

  channel.send({
    embeds: [makeEmbed(0xff3555, '👋 goodbye', `**${member.user.username}** has left the server.`)]
  }).catch(() => {});
});

// ── AUTO MOD ──────────────────────────────────────────
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const member = message.member;
  const isAdmin = member && member.permissions.has(PermissionFlagsBits.Administrator);
  if (isAdmin) {
    // still give xp to admins, just skip moderation
    handleXP(message);
    return;
  }

  const content = message.content.toLowerCase();

  // 1. Block Discord invite links
  if (INVITE_REGEX.test(message.content)) {
    await message.delete().catch(() => {});
    const warn = addWarning(message.guild.id, message.author.id);
    message.channel.send({
      embeds: [makeEmbed(0xff3555, '🚫 invite blocked', `<@${message.author.id}> discord invite links are not allowed here. warning **${warn}/3**.`)]
    }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    if (warn >= 3) autoban(message, 'too many automod violations');
    return;
  }

  // 2. Block external links (optional — remove if too strict)
  // if (LINK_REGEX.test(message.content)) { ... }

  // 3. Bad words filter
  if (BAD_WORDS.some(w => content.includes(w))) {
    await message.delete().catch(() => {});
    const warn = addWarning(message.guild.id, message.author.id);
    message.channel.send({
      embeds: [makeEmbed(0xff3555, '🚫 message removed', `<@${message.author.id}> watch your language. warning **${warn}/3**.`)]
    }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    if (warn >= 3) autoban(message, 'too many automod violations');
    return;
  }

  // 4. Anti spam
  if (isSpamming(message.author.id)) {
    await message.delete().catch(() => {});
    try {
      await member.timeout(5 * 60 * 1000, 'spamming');
      message.channel.send({
        embeds: [makeEmbed(0xffb700, '⚠️ spam detected', `<@${message.author.id}> you've been timed out for 5 minutes for spamming.`)]
      }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    } catch (e) {}
    return;
  }

  // 5. XP
  handleXP(message);
});

function handleXP(message) {
  const leveled = addXP(message.author.id, Math.floor(Math.random() * 10) + 5);
  if (leveled) {
    const data = getXP(message.author.id);
    message.channel.send({
      embeds: [makeEmbed(0x00e87a, '🎉 level up!', `gg <@${message.author.id}>, you hit **level ${data.level}**!`)]
    }).then(m => setTimeout(() => m.delete().catch(() => {}), 8000));
  }
}

async function autoban(message, reason) {
  try {
    await message.member.ban({ reason });
    message.channel.send({
      embeds: [makeEmbed(0xff3555, '🔨 auto-banned', `<@${message.author.id}> was banned for: ${reason}`)]
    }).catch(() => {});
  } catch (e) {}
}

// ── SLASH COMMAND HANDLER ─────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // ── /ban ──
  if (commandName === 'ban') {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'no reason provided';
    try {
      const member = await interaction.guild.members.fetch(user.id);
      await member.ban({ reason });
      await interaction.reply({
        embeds: [makeEmbed(0xff3555, '🔨 banned', `**${user.username}** was banned.\n**reason:** ${reason}`)],
      });
    } catch (e) {
      await interaction.reply({ content: `couldn't ban that user: ${e.message}`, ephemeral: true });
    }
  }

  // ── /kick ──
  else if (commandName === 'kick') {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'no reason provided';
    try {
      const member = await interaction.guild.members.fetch(user.id);
      await member.kick(reason);
      await interaction.reply({
        embeds: [makeEmbed(0xff8c00, '👟 kicked', `**${user.username}** was kicked.\n**reason:** ${reason}`)],
      });
    } catch (e) {
      await interaction.reply({ content: `couldn't kick: ${e.message}`, ephemeral: true });
    }
  }

  // ── /warn ──
  else if (commandName === 'warn') {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'no reason provided';
    const count = addWarning(interaction.guild.id, user.id);
    await interaction.reply({
      embeds: [makeEmbed(0xffb700, '⚠️ warned', `**${user.username}** has been warned.\n**reason:** ${reason}\n**total warnings:** ${count}/3`)],
    });
    if (count >= 3) {
      try {
        const member = await interaction.guild.members.fetch(user.id);
        await member.ban({ reason: 'reached 3 warnings' });
        await interaction.followUp({
          embeds: [makeEmbed(0xff3555, '🔨 auto-banned', `**${user.username}** reached 3 warnings and was auto-banned.`)],
        });
      } catch (e) {}
    }
  }

  // ── /mute ──
  else if (commandName === 'mute') {
    const user = interaction.options.getUser('user');
    const minutes = interaction.options.getInteger('minutes') || 10;
    const reason = interaction.options.getString('reason') || 'no reason provided';
    try {
      const member = await interaction.guild.members.fetch(user.id);
      await member.timeout(minutes * 60 * 1000, reason);
      await interaction.reply({
        embeds: [makeEmbed(0x7b6bff, '🔇 muted', `**${user.username}** was timed out for **${minutes} min**.\n**reason:** ${reason}`)],
      });
    } catch (e) {
      await interaction.reply({ content: `couldn't mute: ${e.message}`, ephemeral: true });
    }
  }

  // ── /unmute ──
  else if (commandName === 'unmute') {
    const user = interaction.options.getUser('user');
    try {
      const member = await interaction.guild.members.fetch(user.id);
      await member.timeout(null);
      await interaction.reply({
        embeds: [makeEmbed(0x00e87a, '🔊 unmuted', `**${user.username}**'s timeout was removed.`)],
      });
    } catch (e) {
      await interaction.reply({ content: `couldn't unmute: ${e.message}`, ephemeral: true });
    }
  }

  // ── /warnings ──
  else if (commandName === 'warnings') {
    const user = interaction.options.getUser('user');
    const count = getWarnings(interaction.guild.id, user.id);
    await interaction.reply({
      embeds: [makeEmbed(0xffb700, '⚠️ warnings', `**${user.username}** has **${count}/3** warnings.`)],
    });
  }

  // ── /clearwarnings ──
  else if (commandName === 'clearwarnings') {
    const user = interaction.options.getUser('user');
    if (warnings[interaction.guild.id]) warnings[interaction.guild.id][user.id] = 0;
    await interaction.reply({
      embeds: [makeEmbed(0x00e87a, '✅ warnings cleared', `All warnings for **${user.username}** have been cleared.`)],
    });
  }

  // ── /rank ──
  else if (commandName === 'rank') {
    const user = interaction.options.getUser('user') || interaction.user;
    const data = getXP(user.id);
    const xpNeeded = data.level * 100;
    const bar = '█'.repeat(Math.floor((data.xp / xpNeeded) * 10)) + '░'.repeat(10 - Math.floor((data.xp / xpNeeded) * 10));
    await interaction.reply({
      embeds: [makeEmbed(0x1650ff, `📊 ${user.username}'s rank`,
        `**level:** ${data.level}\n**xp:** ${data.xp} / ${xpNeeded}\n\`${bar}\``
      ).setThumbnail(user.displayAvatarURL())],
    });
  }

  // ── /leaderboard ──
  else if (commandName === 'leaderboard') {
    const sorted = Object.entries(xpData)
      .sort((a, b) => b[1].level - a[1].level || b[1].xp - a[1].xp)
      .slice(0, 10);
    const medals = ['🥇', '🥈', '🥉'];
    const desc = sorted.length
      ? sorted.map(([id, d], i) => `${medals[i] || `**${i + 1}.**`} <@${id}> — level **${d.level}** (${d.xp} xp)`).join('\n')
      : 'no one has xp yet — start chatting!';
    await interaction.reply({
      embeds: [makeEmbed(0x1650ff, '🏆 leaderboard', desc)],
    });
  }

  // ── /purge ──
  else if (commandName === 'purge') {
    const amount = Math.min(100, Math.max(1, interaction.options.getInteger('amount')));
    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await interaction.reply({
        embeds: [makeEmbed(0x00e87a, '🗑️ purged', `deleted **${deleted.size}** messages.`)],
        ephemeral: true,
      });
    } catch (e) {
      await interaction.reply({ content: `couldn't purge: ${e.message}`, ephemeral: true });
    }
  }

  // ── /serverinfo ──
  else if (commandName === 'serverinfo') {
    const g = interaction.guild;
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x1650ff)
        .setTitle(g.name)
        .setThumbnail(g.iconURL())
        .addFields(
          { name: 'owner', value: `<@${g.ownerId}>`, inline: true },
          { name: 'members', value: `${g.memberCount}`, inline: true },
          { name: 'created', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true },
          { name: 'channels', value: `${g.channels.cache.size}`, inline: true },
          { name: 'roles', value: `${g.roles.cache.size}`, inline: true },
          { name: 'id', value: g.id, inline: true },
        )
        .setTimestamp()
      ],
    });
  }

  // ── /userinfo ──
  else if (commandName === 'userinfo') {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const data = getXP(user.id);
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x1650ff)
        .setTitle(user.username)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: 'id', value: user.id, inline: true },
          { name: 'joined', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : '—', inline: true },
          { name: 'account created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: 'level', value: `${data.level}`, inline: true },
          { name: 'xp', value: `${data.xp}`, inline: true },
          { name: 'warnings', value: `${getWarnings(interaction.guild.id, user.id)}`, inline: true },
        )
        .setTimestamp()
      ],
    });
  }

  // ── /help ──
  else if (commandName === 'help') {
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x1650ff)
        .setTitle('📖 ahh — commands')
        .addFields(
          { name: '🔨 moderation', value: '`/ban` `/kick` `/warn` `/mute` `/unmute`\n`/warnings` `/clearwarnings` `/purge`' },
          { name: '📊 leveling', value: '`/rank` `/leaderboard`' },
          { name: 'ℹ️ info', value: '`/serverinfo` `/userinfo` `/help`' },
          { name: '🤖 auto mod', value: 'invite links, spam, bad words — all handled automatically' },
        )
        .setFooter({ text: 'ahh bot' })
        .setTimestamp()
      ],
      ephemeral: true,
    });
  }
});

// ── LOGIN ─────────────────────────────────────────────
client.login(TOKEN).catch(e => {
  console.error('bot login failed:', e.message);
});

module.exports = client;
