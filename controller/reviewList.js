"use strict"

let MAIN = {};
exports.REVIEWLIST = MAIN;
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

    controller.hears('review list', 'ambient,direct_message,direct_mention,mention', (bot, message) => {
        let ssrlClient = new pg.Client(connectionString);
        ssrlClient.connect((err) => {
            if (err) {
                console.log('error: ' + err);
            }
            let selectSummaryList = config.sql.review.summaryList;
            ssrlClient.query(selectSummaryList, function(err, summaryResult) {
                if(err) {
                    console.log('レビュー一覧(サマリー)取得時にエラー発生: ' + err);
                    ssrlClient.end();
                    return;
                }
                let actions = {};
                summaryResult.rows.forEach((summaryInfo, index) => {
                    
                })
                let jsonList = {
                    "fallback": "どのレビュー一覧を確認しますか？",
                    "callback_id": "reviewList",
                    "attachment_type": 'default',
                    "color": "#3AA3E3",
                    "actions": [
                                {
                        "name": "Screen",
                        "value": "Screen",
                        "text": "画面設計",
                        "type": "button"
                        },{
                        "name": "Test",
                        "value": "Test",
                        "text": "結合テスト設計",
                        "type": "button"
                        },{
                        "name": "Program",
                        "value": "Program",
                        "text": "プログラム設計",
                        "type": "button"
                        }
                    ]
                }
                var jsonlist2 = JSON.parse(JSON.stringify(jsonList));
                jsonlist2.color = "#AA1111"
                console.log(jsonlist2.color)
                console.log(jsonList.color)
                bot.reply(message, {
                    "text": "どのレビュー一覧を確認しますか？",
                    "attachments": [jsonList]
                });
                console.log(summaryResult)
                ssrlClient.end();
            });
        })
    })
};