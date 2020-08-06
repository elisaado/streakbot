'use strict';

const TelegramBot = require('node-telegram-bot-api');

const { daysBetween } = require('./util');
const streaks = require('./db');

const config = require('./config.json');

const bot = new TelegramBot(config.token, { polling: true });

bot.onText(/^\/streak$/, async (msg) => {
  const user = msg.from.id;
  const streak = await streaks().findOne({ id: user });

  let resp;
  let reply_markup;

  if (streak) {
    const days = Math.floor(daysBetween(streak.start, new Date));

    resp = `
Hey _${msg.from.first_name}_.
🔥 Your streak is *${days} days* long.

❌ Use /relapse if you have relapsed.`;
  } else {
    resp = `
Hey _${msg.from.first_name}_, welcome to Streak bot.

🏁 Tap start a new streak to start a new streak.`;

    reply_markup = {
      inline_keyboard: [[{
        text: "🏁 Start",
        callback_data: `start-${user}`
      }]]
    }
  }

  bot.sendMessage(msg.chat.id, resp, { reply_to_message_id: msg.message_id, parse_mode: "Markdown", reply_markup });
});

bot.onText(/^\/relapse$/, (msg) => {
  const resp = "";
  const user = msg.from.id;


  bot.sendMessage(msg.chat.id, resp, {reply_to_message_id: msg.message_id});
});

bot.on('callback_query', (query) => {
  const data = query.data.split('-');
  const user = query.from.id;
  const msg = query.message;

  const command = data[0];
  const dataUser = Number(data[1]);

  if (dataUser !== user) {
    return bot.answerCallbackQuery(query.id, {text: "🚫 This button was not meant for you"})
  }

  switch (command) {
    case 'start':
      const resp = `
I started a new streak for you.

🍀 Good luck, _${query.from.first_name}_.`;

      streaks().insertOne({id: user, start: (new Date).getTime()});
      bot.editMessageText(resp, { chat_id: msg.chat.id, message_id: msg.message_id, parse_mode: 'Markdown' })
      break;
    
    default:
      break;
  }

  bot.answerCallbackQuery(query.id, {})
});