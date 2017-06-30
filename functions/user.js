'use strict';
var config = require('config');
var pg = require('pg');
var async = require('async');

var conString = process.env.connectionstring;

exports.registUser = function(userId, userName, channelId, channelName) {
    pg.connect(conString, function(err, client) {
        if(err) {
            throw err;
        }

        async.series([
            function (callback) {
                var userSearchSql = config.sql.user.search.format(userId);
                client.query(userSearchSql, function(err, resultUserSearch) {
                    if(err) {
                        throw err;
                    }
                    if(resultUserSearch.rowCount == 0){
                        var userInsertSql = config.sql.user.insert.format(userId, userName);
                        client.query(userInsertSql, function(err, resultAccountInsert) {
                            if(err) {
                                throw err;
                            }
                            callback(null, '');
                        });
                    }
                    else{
                        callback(null, '');
                    }
                });
            },
            function (callback) {
                var compositionSearchSql = config.sql.composition.search.format(userId, channelId);
                client.query(compositionSearchSql, function(err, resultCompositionSearch) {
                    if(err) {
                        throw err;
                    }
                    if(resultCompositionSearch.rowCount == 0){
                        var compositionInsertSql = config.sql.composition.insert.format(userId, channelId);
                        console.log(compositionInsertSql);
                        client.query(compositionInsertSql, function(err, resultCompositionInsert) {
                            if(err) {
                                throw err;
                            }
                            callback(null, 'done');
                        });
                    }
                    else{
                        callback(null, 'done');
                    }
                });
            }
        ],
        function (err, results) {
            client.end();
            console.log(results);
            return;
        });
        return;
    });
};

exports.registChannel = function(channelId, channelName) {
    pg.connect(conString, function(err, client) {
        if(err) {
            throw err;
        }
        async.series([
            function (callback) {
                var channelSearchSql = config.sql.channel.search.format(channelId);
                client.query(channelSearchSql, function(err, resultChannelSearch) {
                    if(err) {
                        throw err;
                    }
                    if(resultChannelSearch.rowCount == 0){
                        var channelInsertSql = config.sql.channel.insert.format(channelId, channelName);
                        client.query(userInsertSql, function(err, resultChannelInsert) {
                            if(err) {
                                throw err;
                            }
                            callback(null, 'done');
                        });
                    }
                    else{
                        callback(null, 'done');
                    }
                });
            }
        ],
        function (err, results) {
            client.end();
            console.log(results);
            return;
        });
        return;
    });
};
