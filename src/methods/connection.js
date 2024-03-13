require('dotenv').config();
import TelegramBot from 'node-telegram-bot-api';

const API_KEY_BOT = process.env.API_KEY_BOT;
const bot = new TelegramBot(API_KEY_BOT, {
    polling: true
})

module.exports = bot;