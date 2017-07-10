'use strict';
var config = require('config');
var pg = require('pg');

exports.replyMessage = function(bot, message, resultMessage) {
    if(resultMessage.rowCount > 0){
        var messageType = resultMessage.rows[0].type;
        if(resultMessage.rows[0].message.length > 1){
            bot.reply(message, resultMessage.rows[0].message[(Math.floor(Math.random() * resultMessage.rows[0].message.length))].replace(/\\n/g,'\n'));
        }
        else{
            bot.reply(message, resultMessage.rows[0].message[0].replace(/\\n/g,'\n'));
        }
    }
    return;
};
