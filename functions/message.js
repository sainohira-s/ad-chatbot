'use strict';
var config = require('config');
var pg = require('pg');
var selfMsg = require('./selfishMessage.js');
var reviewMsg = require('./review.js');

var conString = process.env.connectionstring;

exports.mentionReplyMessage = function(bot, message) {
    pg.connect(conString, function(err, client) {
        if(err) {
            console.log('[mentionReplyMessage]DB connected failed.', err);
            return;
        }
        var accountStatusSql = config.sql.accountChannelStatus.format(message.user);
        client.query(accountStatusSql, function(err, resultAccountStatus) {
            if(err) {
                console.log('[mentionReplyMessage]error running MessageSearch query.', err);
                return;
            }
            if(resultAccountStatus.rowCount > 0){
                if(resultAccountStatus.rows[0].stage != 0){
                    reviewMsg.search(bot, message);
                    return;
                }
            }
            selfMsg.replyMessage(bot, message);
            return;
        });
    });
};

exports.directReplyMessage = function(bot, message) {
    pg.connect(conString, function(err, client) {
        if(err) {
            console.log('[selfishMessage]DB connected failed.', err);
            return;
        }
        var accountStatusSql = config.sql.accountChannelStatus.format(message.user);
        client.query(accountStatusSql, function(err, resultAccountStatus) {
            if(err) {
                console.log('[mentionReplyMessage]error running MessageSearch query.', err);
                return;
            }
            if(resultAccountStatus.rowCount > 0){
                if(resultAccountStatus.rows[0].stage != 0){
                    reviewMsg.search(bot, message);
                    return;
                }
            }
            selfMsg.replyMessage(bot, message);
            return;
        });
    });
};
