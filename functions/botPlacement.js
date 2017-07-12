'use strict';
let config = require('config');
let pg = require('pg');
let async = require('async');
let uuid = require('uuid/v4');

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
            (callback) => {
                // 登録するチャンネルがDBに存在するか確認
                bot.api.channels.info({'channel': message.channel}, (err, res) => {
                    let insertChannel = config.sql.insert.channel.format(channelId, res.channel.name)
                    client.query(insertChannel, (err, result) => {
                        if(err) {
                            throw err;
                        }
                        insertAccountInfo(res.channel);
                        callback(null, '');
                    });
                });
            },
            (callback) => {
                let insertChannelStatus = config.sql.insert.channelStatus.format(channelId)
                client.query(insertChannelStatus, (err, result) => {
                    if(err) {
                        throw err;
                    }
                    callback(null, '');
                });
            },
            (callback) => {
                let insertReviewChannelStatus = config.sql.insert.reviewChannelStatus.format(channelId)
                client.query(insertReviewChannelStatus, (err, result) => {
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
    let uuidStr;
    channelInfo.members.forEach((memberId, index) => {
    // 登録するアカウントがDBに存在するか確認
    let selectChannelComposition = config.sql.channelCompositionFromChannelIdAndAccountId.format(channelInfo.id, memberId)
    client.query(selectChannelComposition, (err, resultChannelComposition) => {  
        if(err) {
            throw err;
        }
        if (resultChannelComposition.rowCount == 0) {
            bot.api.users.info({'user': memberId}, (err, res) => {
                uuidStr = uuid();
                // アカウントを登録する
                if (!res.user.is_bot) {
                    let selectAccount = config.sql.accountFromAccountId.format(memberId)
                    client.query(selectAccount, (err, resultAccount) => {
                        if(err) {
                            throw err;
                        }
                        if (resultAccount.rowCount == 0) {
                            let insertAccount = config.sql.insert.account.format(memberId, res.user.name)
                            client.query(insertAccount, (err, result) => {
                                if(err) {
                                    throw err;
                                }
                                insertChannelCompositionRelation(uuidStr, channelInfo, memberId);
                            });
                        } else {
                            insertChannelCompositionRelation(uuidStr, channelInfo, memberId);
                        }
                    });
                }
            });
        }
    });
    });
}

function insertChannelCompositionRelation(uuidStr, channelInfo, memberId) {
    let insertChannelComposition = config.sql.insert.channelComposition.format(uuidStr, channelInfo.id, memberId)
    client.query(insertChannelComposition, (err, result) => {
        if(err) {
            throw err;
        }
        let insertAccountChannelStatus = config.sql.insert.accountChannelStatus.format(uuidStr)
        client.query(insertAccountChannelStatus, (err, result) => {
            if(err) {
                throw err;
            }
        });
        let insertReviewAccountChannelStatus = config.sql.insert.reviewAccountChannelStatus.format(uuidStr)
        client.query(insertReviewAccountChannelStatus, (err, result) => {
            if(err) {
                throw err;
            }
        });
    });

}
