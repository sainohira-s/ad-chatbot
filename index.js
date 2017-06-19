"use strict"

if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

let Botkit = require('botkit');

var msg = require('./functions/message.js');
var scMsg = require('./functions/scheduleMessage.js');

let controller = Botkit.slackbot({
    debug: false,
});
let bot = controller.spawn({
    token: process.env.token
}).startRTM(function(err, bot, payload){
    if (err) {
        throw new Error(err);
    }
    scMsg.says(bot);
});

// 各班ごとに受け取ったワードを一時的に格納するディレクトリ
let channelWordDir = {
}

controller.hears('',['direct_mention','mention'],function(bot, message) {
    msg.mentionReplyMessage(bot, message);
});

controller.hears('',['direct_message'],function(bot, message) {
    msg.directReplyMessage(bot, message);
});

controller.hears('',['ambient','direct_message','direct_mention','mention'],function(bot, message) {
    msg.selfishMessage(bot, message);
});

//Stringにformatファンクションを追加
if (String.prototype.format == undefined) {
  String.prototype.format = function(arg)
  {
    let rep_fn = undefined;
    if (typeof arg == "object") {
      rep_fn = function(m, k) { return arg[k]; }
    }
    else {
      let args = arguments;
      rep_fn = function(m, k) { return args[ parseInt(k) ]; }
    }
    return this.replace( /\{(\w+)\}/g, rep_fn );
  }
}