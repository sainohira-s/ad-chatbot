'use strict';
let config = require('config');
let pg = require('pg');
let uuid = require('uuid/v4');
require('date-utils');

let conString = process.env.connectionstring;
let bot;
let message;
exports.joinChannel = function(bBot, bMessage, targetChannelList) {
    bot = bBot;
    message = bMessage;
    let jcClient = new pg.Client(conString);
    jcClient.connect((err) => {
        if(err) {
            throw err;
        }

        let channelId = message.channel
        // 登録するチャンネルがDBに存在するか確認
        bot.api.channels.info({'channel': message.channel}, (err, res) => {
            console.log(channelId + ':::'+ res.channel.name)
            let insertChannel = config.sql.insert.channel.format(channelId, res.channel.name)
            console.log(insertChannel)
            jcClient.query(insertChannel, (err, result) => {
                if(err) {
                    console.log(insertChannel)
                    throw err;
                }
                insertAccountInfo(res.channel);
                let insertChannelRelation = config.sql.insert.channelStatus.format(channelId) +
                                            config.sql.insert.reviewChannelStatus.format(channelId)
                jcClient.query(insertChannelRelation, (err, result) => {
                    if(err) {
                        jcClient.end();
                        return;
                    }
                    let selectChannels = config.sql.channels;
                    jcClient.query(selectChannels, (err, channelsResult) => {
                        if (err) {
                            console.log(err)
                            jcClient.end();
                            return;
                        }
                        channelsResult.rows.forEach((channelInfo, index, array) => {
                            targetChannelList.push(channelInfo.channel_id);
                        });
                        jcClient.end();
                    });
                });
            });
        });
    });
};

exports.accountJoin = function(bBot, bMessage) {
    bot = bBot;
    message = bMessage;
    bot.api.channels.info({'channel': message.channel}, (err, res) => {
        insertAccountInfo(res.channel);
    });
};

// ユーザーを追加
function insertAccountInfo(channelInfo) {
    channelInfo.members.forEach((memberId, index) => {
        let uuidStr = uuid();
        let iaiClient =new pg.Client(conString);
        iaiClient.connect((err) => {
            if(err) {
                throw err;
            }
            // 登録するアカウントがDBに存在するか確認
            let selectChannelComposition = config.sql.channelCompositionFromChannelIdAndAccountId.format(channelInfo.id, memberId)
            iaiClient.query(selectChannelComposition, (err, resultChannelComposition) => {
                if(err) {
                    iaiClient.end();
                    throw err;
                }
                if (resultChannelComposition.rowCount == 0) {
                    bot.api.users.info({'user': memberId}, (err, res) => {
                        // アカウントを登録する
                        if (!res.user.is_bot) {
                            let selectAccount = config.sql.accountFromAccountId.format(memberId)
                            iaiClient.query(selectAccount, (err, resultAccount) => {
                                if(err) {
                                    console.log(selectAccount)
                                    iaiClient.end();
                                    throw err;
                                }
                                let insertAccountInfo = config.sql.insert.channelComposition.format(uuidStr, channelInfo.id, memberId, (new Date()).toFormat('YYYYMMDD HH24:MI:SS')) +
                                                        config.sql.insert.accountChannelStatus.format(uuidStr) + 
                                                        config.sql.insert.reviewAccountChannelStatus.format(uuidStr)
                                if (resultAccount.rowCount == 0) {
                                    insertAccountInfo = config.sql.insert.account.format(memberId, res.user.name) + insertAccountInfo
                                    iaiClient.query(insertAccountInfo, (err, result) => {
                                        if(err) {
                                            console.log(insertAccountInfo)
                                            iaiClient.end();
                                            throw err;
                                        }
                                        iaiClient.end();
                                    });
                                } else {
                                    iaiClient.query(insertAccountInfo, (err, result) => {
                                        if(err) {
                                            console.log(insertAccountInfo)
                                            iaiClient.end();
                                            throw err;
                                        }
                                        iaiClient.end();
                                    });
                                }
                            });
                        }
                    });
                }
            });
        });
    });
}

