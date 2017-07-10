"use strict"
let MAIN = {};
exports.CANCEL = MAIN;
let pg = require('pg');
let config = require('config');
let util = require('../functions/utility.js').UTIL;

let connectionString;
let controller;
let targetChannelList;


// ファイル内で共通して利用するプロパティを定義
MAIN.startController = function startController(cConnectionString, cController) {
    connectionString = cConnectionString;
    controller = cController;

    let client = new pg.Client(connectionString);
    client.connect((err) => {
        if (err) {
            console.log('error: ' + err);
            return;
        }
        targetChannelList = [];
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

    controller.hears(['キャンセル', 'きゃんせる', 'cancel', 'やめる', 'やめて', '止める', '止めて'], 'ambient,direct_message,direct_mention,mention', (bot, message) => {
        // ステータスをデフォルト状態に戻す

        // SQLクエリに影響する文字列を置換
        message.text = message.text.replace(/'/g,"''");

        let channelId = message.channel;
        let accountId = message.user
        let client = new pg.Client(connectionString);
        client.connect((err) => {
            // Utilityのプロパティ設定
            util.setProperty(bot, message, client);
            util.accoutAccessCountUp();
            if (err) {
                util.errorBotSay('キャンセル時のステータス確認時にエラー発生: ' + err)
                return;
            }
            let selectStatus = config.sql.channelStatus.format(channelId);
            // ダイレクトメッセージで受けた場合
            if (targetChannelList.indexOf(channelId) == -1) {
                selectStatus = config.sql.accountChannelStatus.format(accountId);
            }

            client.query(selectStatus, (err, result) => {
                if (err) {
                    util.errorBotSay('キャンセル時のステータス確認時にエラー発生: ' + err)
                    client.end();
                    return;
                }
                if (result.rows[0].current_type_id == 0 && result.rows[0].stage == 0) {
                    // 処理の途中ではない場合
                    if (message.event != 'ambient') {
                        util.botSay('んー、そう言われても..。 :droplet:', channelId)
                    }
                    client.end();
                } else {
                    // 処理の途中の場合
                    util.updateStatus(1, 1, targetChannelList)
                    util.updateReviewStatus(null, null, 0, 0, targetChannelList)
                    util.botSay('了解。処理を中断しました。', channelId)
                }
            });
        });
    });
};
