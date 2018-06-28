"use strict"

let MAIN = {};
exports.MANAGE = MAIN;
let pg = require('pg');
let config = require('config');
let util = require('../functions/utility.js').UTIL;

let controller;
let targetChannelList;
let channelWordDic;
let connectionString = process.env.connectionstring;

// ファイル内で共通して利用するプロパティを定義
MAIN.startController = function startController(cConnectionString, cController, cChannelWordDic) {
    controller = cController;
    channelWordDic = cChannelWordDic;

    let cClient = new pg.Client(connectionString);
    cClient.connect((err) => {
        if (err) {
            console.log('error: ' + err);
            return;
        }
        targetChannelList = [];
        let selectChannels = config.sql.channels;
        cClient.query(selectChannels, (err, channelsResult) => {
            if (err) {
                console.log(err)
                cClient.end();
                return;
            }
            channelsResult.rows.forEach((channelInfo, index, array) => {
                targetChannelList.push(channelInfo.channel_id);
            });
            cClient.end();
        });
    });

    controller.hears(['botsay'], 'direct_message', (bot, message) => {
        
        // Utilityのプロパティ設定
        util.setProperty(bot, message, cClient);
        util.accoutAccessCountUp();
        let botsayCommand = "botsay";
        let index = message.text.indexOf(botsayCommand);
        let text = message.text;
        text = text.slice(index);
        text = text.replace(botsayCommand,'');
                        console.log(text)

        let sClient = new pg.Client(connectionString);
        sClient.connect((err) => {
            if (err) {
                console.log('error: ' + err);
            }
            let selectAccountForReviewerByAccountId = config.sql.accountForReviewerByAccountId.format(message.user);
            sClient.query(selectAccountForReviewerByAccountId, (err, resultAccountForReviewer) => {
                if (err) {
                    util.errorBotSay('saybotの: ' + err);
                    console.log(err);
                    sClient.end();
                    return;
                }
                if (resultAccountForReviewer.rowCount > 0) {
                    bot.startConversation(message, function(err, convo) {
                        convo.ask(`■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■\n`+ text + '\n■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■\n上記の内容で送信しますか？(はい/いいえ)\n※ 私(bot)のいるチャンネル全てに通知されます。', [
                        {
                            pattern: 'はい',
                            callback: function(response, convo) {
                                targetChannelList.forEach((channelId, index) => {
                                    util.botSay(text, channelId);
                                });
                                util.botSay("通知しました！", message.channel);
                                convo.next();
                            },
                        },
                        {
                            pattern: 'いいえ',
                            callback: function(response, convo) {
                                util.botSay("了解しました。送信をキャンセルします。", message.channel);
                                convo.next();
                            },
                        },
                        {
                            default: true,
                            callback: function(response, convo) {
                                util.botSay("「はい」か「いいえ」でお願いします。:bow:", message.channel);
                            },
                        }
                    ]);
                    });
                } else {
                    util.botSay("管理者のみの機能となります。:bow:", message.channel);
                }
            });
        });
    });
};