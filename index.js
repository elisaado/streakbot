'use strict';

const TelegramBot = require('node-telegram-bot-api');

const { daysBetween } = require('./util');
const streaks = require('./db');

const config = require('./config.json');

const bot = new TelegramBot(config.token, {polling: true});

bot.onText(/^\/streak$/, async (msg) => {
  const user = msg.from.id;
  const streak = await streaks().findOne({id: user});

  let resp;
  let reply_markup;

  if (streak) {
    const days = Math.floor(daysBetween(streak.start, new Date));

    resp = `
Hey _${msg.from.first_name}_.

🔥 Your streak is *${days} days* long.`;
  } else {
      resp = `
Hey _${msg.from.first_name}_, welcome to Streak bot.

🏁 Tap start a new streak to start a new streak.`;
  }

  bot.sendMessage(msg.chat.id, resp, {reply_to_message_id: msg.message_id, parse_mode: "Markdown", reply_markup});
});

bot.onText(/^\/relapse$/, (msg) => {
  const resp = "";
  const user = msg.from.id;


  bot.sendMessage(msg.chat.id, resp, {reply_to_message_id: msg.message_id});
});

bot.on('callback_query', (query) => {
  const data = query.data;
  const user = query.from.id;


  bot.answerCallbackQuery(query.id, {})
});