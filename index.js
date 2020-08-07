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
    
↪️ Use /start to start a new streak\\.`;

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

bot.on('callback_query', async (query) => {
  const data = query.data.split('-');
  const user = query.from.id;
  const msg = query.message;

  const command = data[0];
  const dataUser = Number(data[1]);

  if (dataUser !== user) {
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
    default:
      break;
  }

  bot.answerCallbackQuery(query.id, {})
});