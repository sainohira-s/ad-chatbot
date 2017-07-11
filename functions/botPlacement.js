'use strict';
let config = require('config');
let pg = require('pg');
let async = require('async');

let conString = process.env.connectionstring;
let bot;
let message;
let client;
exports.joinChannel = function(bBot, bMessage, targetChannelList) {
    bot = bBot;
    message = bMessage;
    client = new pg.Client(conString);
    client.connect((err) => {
        if(err) {
            throw err;
        }
        let channelId = message.channel
        async.series([
            function (callback) {
                // 登録するチャンネルがDBに存在するか確認
                bot.api.channels.info({'channel': message.channel}, (err, res) => {
                    let insertChannel = config.sql.insert.channel.format(channelId, res.channel.name)
                    client.query(insertChannel, function(err, result) {
                        if(err) {
                            throw err;
                        }
                        insertAccountInfo(res.channel);
                        callback(null, '');
                    });
                });
            },
            function (callback) {
                let insertChannelStatus = config.sql.insert.channelStatus.format(channelId)
                client.query(insertChannelStatus, function(err, result) {
                    if(err) {
                        throw err;
                    }
                    callback(null, '');
                });
            },
            function (callback) {
                let insertReviewChannelStatus = config.sql.insert.reviewChannelStatus.format(channelId)
                client.query(insertReviewChannelStatus, function(err, result) {
                    if(err) {
                        throw err;
                    }
                    callback(null, '');
                });
            }
        ], function (err, results) {
            if (err) {
                throw err;
            }
            let selectChannels = config.sql.channels;
            client.query(selectChannels, (err, channelsResult) => {
                if (err) {
                    console.log(err)
                    client.end();
                    return;
                }
                channelsResult.rows.forEach((channelInfo, index, array) => {
                    targetChannelList.push(channelInfo.channel_id);
                });
            });
        });
    });
};

exports.accountJoin = function(bBot, bMessage) {
    bot = bBot;
    message = bMessage;
    client = new pg.Client(conString);
    client.connect((err, client) => {
        if(err) {
            throw err;
        }
        bot.api.channels.info({'channel': message.channel}, (err, res) => {
            insertAccountInfo(res.channel);
        });
    });
};

// ユーザーを追加
function insertAccountInfo(channelInfo) {
    let uuid;
    channelInfo.members.forEach((memberId, index) => {
        async.series([
            function (callback) {
                // 登録するアカウントがDBに存在するか確認
                let selectChannelComposition = config.sql.channelCompositionFromChannelIdAndAccountId.format(channelInfo.id, memberId)
                client.query(selectChannelComposition, function(err, resultChannelComposition) {  
                    if(err) {
                        throw err;
                    }
                    if (resultChannelComposition.rowCount == 0) {
                        callback(null, '');
                    }
                });
            },
            function (callback) {
                bot.api.users.info({'user': memberId}, function(err, res){
                    let selectUuid = config.sql.uuid;
                    client.query(selectUuid, function(err, resultUuid) {
                        if(err) {
                            throw err;
                        }
                        uuid = resultUuid.rows[0].uuid_generate_v4;
                        // アカウントを登録する
                        if (!res.user.is_bot) {
                            let selectAccount = config.sql.accountFromAccountId.format(memberId)
                            client.query(selectAccount, function(err, resultAccount) {
                                if(err) {
                                    throw err;
                                }
                                if (resultAccount.rowCount == 0) {
                                    let insertAccount = config.sql.insert.account.format(memberId, res.user.name)
                                    client.query(insertAccount, function(err, result) {
                                        if(err) {
                                            throw err;
                                        }
                                        let insertChannelComposition = config.sql.insert.channelComposition.format(uuid, channelInfo.id, memberId)
                                        client.query(insertChannelComposition, function(err, result) {
                                            if(err) {
                                                throw err;
                                            }
                                            callback(null, '');
                                        });
                                    });    
                                } else {
                                    let insertChannelComposition = config.sql.insert.channelComposition.format(uuid, channelInfo.id, memberId)
                                    client.query(insertChannelComposition, function(err, result) {
                                        if(err) {
                                            throw err;
                                        }
                                        callback(null, '');
                                    });
                                }
                            });
                        }
                    });
                });
            },
            function (callback) {
                let insertAccountChannelStatus = config.sql.insert.accountChannelStatus.format(uuid)
                client.query(insertAccountChannelStatus, function(err, result) {
                    if(err) {
                        throw err;
                    }
                    callback(null, '');
                });
            },
            function (callback) {
                let insertReviewAccountChannelStatus = config.sql.insert.reviewAccountChannelStatus.format(uuid)
                client.query(insertReviewAccountChannelStatus, function(err, result) {
                    if(err) {
                        throw err;
                    }
                    callback(null, 'done');
                });
            }
        ]);
    });
}