'use strict';
var Botkit = require('botkit');
var async = require('async');
var msg = require('./functions/message.js');
var scMsg = require('./functions/scheduleMessage.js');
var user = require('./functions/user.js');

var urlencodedParser = bodyParser.urlencoded({ extended: false })

const controller = Botkit.slackbot({
    debug: false
});

controller.spawn({
    token: process.env.token
}).startRTM(function(err, bot, payload){
    if (err) {
        throw new Error(err);
    }
    scMsg.says(bot);
});

controller.hears('',['direct_mention','mention'],function(bot, message) {
    msg.mentionReplyMessage(bot, message);
});

controller.hears('',['direct_message'],function(bot, message) {
    msg.mentionReplyMessage(bot, message);
});

controller.hears('',['ambient','direct_message','direct_mention','mention'],function(bot, message) {
    msg.selfishMessage(bot, message);
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
