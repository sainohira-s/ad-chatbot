'use strict';
var config = require('config');
var pg = require('pg');
var selfMsg = require('./selfishMessage.js');

var conString = process.env.connectionstring;

exports.mentionReplyMessage = function(bot, message) {
    pg.connect(conString, function(err, client) {
        if(err) {
            console.log('[mentionReplyMessage]DB connected failed.', err);
            return;
        }
        var userStatusSql = config.sql.userStatus.format(message.user);
        client.query(userStatusSql, function(err, resultUserStatus) {
            client.end();
            if(err) {
                console.log('[mentionReplyMessage]error running MessageSearch query.', err);
                return;
            }
            selfMsg.replyMessage(bot, message);
            return;
        });
    });
};

exports.selfishMessage = function(bot, message) {
    pg.connect(conString, function(err, client) {
        if(err) {
            console.log('[selfishMessage]DB connected failed.', err);
            return;
        }
        var userStatusSql = config.sql.userStatus.format(message.user);
        client.query(userStatusSql, function(err, resultUserStatus) {
            client.end();
            if(err) {
                console.log('[selfishMessage]error running MessageSearch query.', err);
                return;
            }
            selfMsg.replyMessage(bot, message);
            return;
        });
    });
};
