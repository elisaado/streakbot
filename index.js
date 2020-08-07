'use strict';

const TelegramBot = require('node-telegram-bot-api');
const escape = require('markdown-escape');

const { daysBetween } = require('./util');
const { streaks, scoreboards } = require('./db');

const config = require('./config.json');

const bot = new TelegramBot(config.token, { polling: true });

bot.onText(/^\/streak(@.+bot)?$/, async (msg) => {
  const user = msg.from.id;
  const streak = await streaks().findOne({ id: user });

  let resp;
  let reply_markup;

  if (streak) {
    const days = Math.floor(daysBetween(streak.start, new Date));

    resp = `
Hey _${escape(msg.from.first_name)}_\\.
🔥 Your streak is *${days} days* long\\.

❌ Use /relapse if you have relapsed\\.`;
  } else {
    resp = `
Hey _${escape(msg.from.first_name)}_, welcome to Streak bot\\.

🏁 Tap start a new streak to start a new streak\\.`;

    reply_markup = {
      inline_keyboard: [[{
        text: "🏁 Start",
        callback_data: `start-${user}`
      }]]
    }
  }

  bot.sendMessage(msg.chat.id, resp, { reply_to_message_id: msg.message_id, parse_mode: "MarkdownV2", reply_markup });
});

bot.onText(/^\/relapse(@.+bot)?$/, async (msg) => {
  let resp = "";
  const user = msg.from.id;
  const streak = await streaks().findOne({ id: user });

  if (!streak) {
    resp = `
Hey _${escape(msg.from.first_name)}_, welcome to Streak bot\\.
    
↪️ Use /streak to start a new streak\\.`;

    return bot.sendMessage(msg.chat.id, resp, { reply_to_message_id: msg.message_id, parse_mode: "MarkdownV2" });
  }

  resp = `Are you sure you want to register a *relapse*?`;
  const reply_markup = {
    inline_keyboard: [[
      {
        text: "Yes",
        callback_data: `relapse-${user}`
      },
      {
        text: "No",
        callback_data: `cancel-${user}`
      }
    ]]
  }

  bot.sendMessage(msg.chat.id, resp, { reply_to_message_id: msg.message_id, parse_mode: "MarkdownV2", reply_markup });
});

bot.onText(/^\/enableScoreboard(@.+bot)?$/i, async (msg) => {
  const user = msg.from.id;

  const streak = await streaks().findOne({ id: user });

  let resp;
  let reply_markup;

  if (!streak) {
    resp = `
Hey _${escape(msg.from.first_name)}_, welcome to Streak bot\\.
    
↪️ Use /streak to start a new streak\\.`;

    return bot.sendMessage(msg.chat.id, resp, { reply_to_message_id: msg.message_id, parse_mode: "MarkdownV2" });
  }

  if (msg.chat.type === 'private') {
    resp = `🚫 You can't enable scoreboards in private chat\\.`
    return bot.sendMessage(msg.chat.id, resp, { reply_to_message_id: msg.message_id, parse_mode: "MarkdownV2" });
  }

  reply_markup = {
    inline_keyboard: [[
      {
        text: "📝 Turn this message into a scoreboard",
        callback_data: `scoreboard-admins`
      }
    ]]
  }

  let scoreboard = await scoreboards().findOne({ chat_id: msg.chat.id });
  if (!scoreboard) {
    scoreboard = {
      chat_id: msg.chat.id,
      members: [
        msg.from.id,
      ],
      message_id: 0,
      enabled: false
    }

    await scoreboards().insertOne(scoreboard);
    resp = `✅ *Created a new scoreboard for this chat\\.*`;
    return bot.sendMessage(msg.chat.id, resp, { reply_to_message_id: msg.message_id, parse_mode: "MarkdownV2", reply_markup });
  }

  if (scoreboard.members.includes(msg.from.id)) {
    resp = `🚫 You already enabled scoreboards\\.`;
    return bot.sendMessage(msg.chat.id, resp, { reply_to_message_id: msg.message_id, parse_mode: "MarkdownV2", reply_markup });
  }

  scoreboard.members.push(msg.from.id);
  await scoreboards().updateOne({ chat_id: msg.chat.id }, { $set: scoreboard })

  if (scoreboard.message_id) generateAndSetScoreboard(scoreboard);
  resp = `✅ *You are now appearing on the scoreboard\\.*`;
  return bot.sendMessage(msg.chat.id, resp, { reply_to_message_id: msg.message_id, parse_mode: "MarkdownV2", reply_markup });
});

bot.on('callback_query', async (query) => {
  const data = query.data.split('-');
  const user = query.from.id;
  const msg = query.message;

  const command = data[0];
  const dataUser = Number(data[1]);

  if (!isNaN(dataUser) && dataUser !== user) {
    return bot.answerCallbackQuery(query.id, { text: "🚫 This button was not meant for you" })
  }

  let username = `@${query.from.username}`;
  if (!username) username = `[${escape(query.from.first_name)}](tg://user?id=${user})`;
  switch (command) {
    case 'start': {
      const resp = `
I started a new streak for you\\.

🍀 Good luck, _${escape(query.from.first_name)}_\\.`;

      await streaks().insertOne({ id: user, username, start: (new Date).getTime() });
      bot.editMessageText(resp, { chat_id: msg.chat.id, message_id: msg.message_id, parse_mode: 'MarkdownV2' })
      break;
    }
    case 'relapse': {
      const streak = await streaks().findOne({ id: user });
      const days = Math.floor(daysBetween(streak.start, new Date));

      await streaks().insertOne({ id: user, username, start: (new Date).getTime() });

      const resp = `
🗑 Sad to see your streak of *${days} days* go down the drain\\.


I started a new streak for you\\.

🍀 Good luck, _${escape(query.from.first_name)}_, you will need it\\.`;

      await streaks().updateOne({ id: user }, { $set: { id: user, start: (new Date).getTime() } });
      bot.editMessageText(resp, { chat_id: msg.chat.id, message_id: msg.message_id, parse_mode: 'MarkdownV2' })
      break;
    }
    case 'cancel': {
      const resp = `🆗 Cancelled\\.`;

      bot.editMessageText(resp, { chat_id: msg.chat.id, message_id: msg.message_id, parse_mode: 'MarkdownV2' })
      break;
    }
    case 'scoreboard': {
      // check if admin
      const member = await bot.getChatMember(msg.chat.id, user);
      if (!['creator', 'administrator'].includes(member.status)) {
        return bot.answerCallbackQuery(query.id, { text: "🚫 This button was not meant for you" })
      }

      const scoreboard = await scoreboards().findOne({ chat_id: msg.chat.id });
      scoreboard.message_id = msg.message_id;
      await scoreboards().updateOne({ _id: scoreboard._id }, { $set: scoreboard })
      await generateAndSetScoreboard(scoreboard);

      await bot.pinChatMessage(msg.chat.id, msg.message_id, { disable_notification: true }).catch(() => { });
      break;
    }
    default:
      break;
  }

  bot.answerCallbackQuery(query.id, {})
});

async function generateAndSetScoreboard(scoreboard) {
  const scores = [];
  for (let i = 0; i < scoreboard.members.length; i++) {
    const memberID = scoreboard.members[i];
    const member = await bot.getChatMember(scoreboard.chat_id, memberID).catch(() => undefined);
    if (!member) return;

    const streak = await streaks().findOne({ id: memberID });
    const days = Math.floor(daysBetween(streak.start, new Date));

    let namestring;

    if (!member.user.username) {
      namestring = `[${escape(member.user.first_name)}](tg://user?id=${memberID})`;
    } else {
      namestring = `${escape(member.user.first_name)} \\(@${escape(member.user.username)}\\)`;
    }

    const score = {
      days,
      resp: `${namestring} — *${days} days*\n`
    }

    scores.push(score);
  }

  scores.sort((a, b) => b.days - a.days);

  let resp = '🏆 __Scoreboard__\n\n';
  scores.forEach((score, i) => resp += `${i + 1}\\. ${score.resp}`);

  resp += "\n📝 *Use* /enableScoreboard *to appear on the scoreboard.*"
  return bot.editMessageText(resp, { chat_id: scoreboard.chat_id, message_id: scoreboard.message_id, parse_mode: "MarkdownV2" });
}

function refreshScoreboards() {
  scoreboards().find().toArray().forEach(scoreboard => {
    if (!scoreboard.message_id) return;
    return generateAndSetScoreboard(scoreboard);
  });
}

// every hour
setInterval(refreshScoreboards, 60 * 60 * 1000);
