'use strict';

const TelegramBot = require('node-telegram-bot-api');

const config = require('./config.json');
const streaks = require('./db');

const bot = new TelegramBot(config.token, {polling: true});

bot.onText(/^\/streak$/, (msg) => {
  const resp = "";
  const user = msg.from.id;


  bot.sendMessage(msg.chat.id, resp, {reply_to_message_id: msg.message_id});
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