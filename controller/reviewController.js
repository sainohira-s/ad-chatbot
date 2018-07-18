"use strict"

let MAIN = {};
exports.REVIEW = MAIN;
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

    controller.hears(['rc','review check'], 'direct_message', (bot, message) => {
        let jsonList = {
            "fallback": "ボタン操作のできない端末かブラウザです。",
            "callback_id": "startReviewList",
            "color": config.color.selectingColor,
            "actions": [
                        {
                "name": "1",
                "value": "画面設計",
                "text": "画面設計",
                "type": "button"
                },{
                "name": "2",
                "value": "結合テスト設計",
                "text": "結合テスト設計",
                "type": "button"
                },{
                "name": "3",
                "value": "プログラム設計",
                "text": "プログラム設計",
                "type": "button"
                }
            ]
        }
        bot.reply(message, {
            "text": "レビューしたいフェーズを選択してください。",
            "attachments": [jsonList]
        });
    });
};