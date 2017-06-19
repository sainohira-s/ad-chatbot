'use strict';
var config = require('config');
var pg = require('pg');

var conString = process.env.connectionstring;

exports.replyMessage = function(bot, message) {
    pg.connect(conString, function(err, client) {
        if(err) {
            console.log('[selfish]DB connected failed.', err);
            return;
        }
        var messageSearchSql = config.sql.message.search.format(message.text);
        client.query(messageSearchSql, function(err, result) {
            client.end()
            if(err) {
                console.log('[selfish]error running MessageSearch query.', err);
                return;
            }
            if(result.rowCount > 0){
                var messageType = result.rows[0].type;
                if(messageType == config.messagetype.NegativeWord.id){
                    if(result.rows[0].message.length > 1){
                        bot.reply(message, result.rows[0].message[(Math.floor(Math.random() * result.rows[0].message.length))].replace(/\\n/g,'\n'));
                    }
                    else{
                        bot.reply(message, result.rows[0].message[0].replace(/\\n/g,'\n'));
                    }
                }
            }
            return;
        });
    });
    return;
};
