'use strict';
var Botkit = require('botkit');
var async = require('async');
var msg = require('./functions/message.js');
var scMsg = require('./functions/scheduleMessage.js');
var user = require('./functions/user.js');

var controller = Botkit.slackbot({
    debug: false
}).configureSlackApp(
  {
    clientId: process.env.clientid,
    clientSecret: process.env.clientsecret,
    scopes: ['bot'],
  }
);

var activeBot = {};
function trackBot(bot) {
    activeBot[bot.config.token] = bot;
}

controller.on('create_bot',function(bot,config) {
    if (activeBot[bot.config.token]) {
    }
    else{
        bot.startRTM(function(err, bot, payload){
            if (err) {
                throw new Error(err);
            }
            scMsg.says(bot);
        });
    }
});

controller.setupWebserver('8080', function(err,webserver) {
  controller.createWebhookEndpoints(controller.webserver);

  controller.createOauthEndpoints(controller.webserver,function(err,req,res) {
    if (err) {
        res.status(500).send('OAuth ERROR: ' + err);
    } else {
        res.send('Success! Slack Appの認証に成功しました');
    }
  });
});

controller.hears('',['direct_mention','mention'],function(bot, message) {
    msg.mentionReplyMessage(bot, message);
});

controller.hears('',['direct_message'],function(bot, message) {
    if(message.text == 'button'){
        buttonReply(bot, message);
        return;
    }

    msg.mentionReplyMessage(bot, message);
});

controller.hears('',['ambient','direct_message','direct_mention','mention'],function(bot, message) {
    msg.selfishMessage(bot, message);
});

controller.on('interactive_message_callback', function(bot, message) {
    var users_answer = message.actions[0].name;
    if (message.callback_id == "test_button") {
        bot.replyInteractive(message, "あなたは「" + users_answer + "」を押しました");
    }
});

controller.hears('',['bot_channel_join'],function(bot, message) {
    var channelId = message.channel;
    var channelName = message.channel;

    user.registChannel(channelId, channelName);

    bot.api.users.list({}, function(err, res){
        async.each(res.members, function(member, callback){
            if(!member.deleted){
                user.registUser(member.id, member.name, channelId, channelName);
            }
        });
    });
});
controller.hears('',['user_channel_join'],function(bot, message) {
    user.registUser(message.user, message.user_profile.name, message.channel, message.channel);
});

//Stringにformat functionを追加
if (String.prototype.format == undefined) {
  String.prototype.format = function(arg)
  {
    var rep_fn = undefined;
    if (typeof arg == "object") {
      rep_fn = function(m, k) { return arg[k]; }
    }
    else {
      var args = arguments;
      rep_fn = function(m, k) { return args[ parseInt(k) ]; }
    }
    return this.replace( /\{(\w+)\}/g, rep_fn );
  }
}

function buttonReply(bot, message){
    var reply = {
        "text": "ボタンテスト",
        "attachments": [{
            "text": "どれか押して",
            "fallback": "失敗",
            "callback_id": "test_button",
            "color": "#55AA00",
            "actions": [
                {
                    "type": "button",
                    "name": "test_button1",
                    "text": "テストボタン1"
                },
                {
                    "text": "*bold* `code` _italic_ ~strike~",
                    "username": "markdownbot",
                    "mrkdwn": true
                },
                {
                    "name": "game",
                    "text": "Falken's Maze",
                    "type": "button",
                    "value": "maze"
                },
                {
                    "name": "game",
                    "text": "Thermonuclear War",
                    "style": "danger",
                    "type": "button",
                    "value": "war",
                    "confirm": {
                        "title": "Are you sure?",
                        "text": "Wouldn't you prefer a good game of chess?",
                        "ok_text": "Yes",
                        "dismiss_text": "No"
                    }
                }
            ]
        }]
    };
    bot.reply(message, reply);
    return;
}