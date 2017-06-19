"use strict"

if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

let Botkit = require('botkit');
let config = require('config');
let pg = require('pg');

let controller = Botkit.slackbot({
    debug: true,
});
let bot = controller.spawn({
    token: process.env.token
}).startRTM();

controller.hears(['キャンセル', 'きゃんせる', 'cancel', 'やめる', 'やめて', '止める', '止めて'], 'ambient,direct_message,direct_mention,mention', (bot, message) => {
});
