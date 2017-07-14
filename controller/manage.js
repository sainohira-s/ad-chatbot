"use strict"
let MAIN = {};
exports.CANCEL = MAIN;
let pg = require('pg');
let config = require('config');

let connectionString;
let controller;
let targetChannelList;
let channelWordDic;

// ファイル内で共通して利用するプロパティを定義
MAIN.startController = function startController(cConnectionString, cController, cChannelWordDic) {
    connectionString = cConnectionString;
    controller = cController;
    channelWordDic = cChannelWordDic;

    controller.hears(['delete user (.*) (.*)'], 'ambient,direct_message,direct_mention,mention', (bot, message) => {
        // 管理者(レビューアー)のみが行える操作。
        message.match[1];

        // SQLクエリに影響する文字列を置換
        message.text = message.text.replace(/'/g,"''");

        let channelId = message.channel;
        let accountId = message.user
        let cClient = new pg.Client(connectionString);
        cClient.connect((err) => {
            if (err) {
                console.log('error: ' + err);
            }
            // Utilityのプロパティ設定
            util.setProperty(bot, message, cClient);
            util.accoutAccessCountUp();
            if (err) {
                util.errorBotSay('キャンセル時のステータス確認時にエラー発生: ' + err);
                console.log(err);
                return;
            }
            let selectStatus = config.sql.channelStatus.format(channelId);
            // ダイレクトメッセージで受けた場合
            if (targetChannelList.indexOf(channelId) == -1) {
                selectStatus = config.sql.accountChannelStatus.format(accountId);
            }
            cClient.query(selectStatus, (err, statusResult) => {
                if (err) {
                    util.errorBotSay('キャンセル時のステータス確認時にエラー発生: ' + err);
                    console.log(err);
                    cClient.end();
                    return;
                }
                if (statusResult.rows[0].current_type_id == 1 && statusResult.rows[0].stage == 1) {
                    // 処理の途中ではない場合
                    if (message.event != 'ambient') {
                        util.botSay('んー、そう言われても..。 :droplet:', channelId)
                    }
                    cClient.end();
                } else if (statusResult.rows[0].current_type_id == 3 && statusResult.rows[0].stage == 3) {
                    let selectReviewAccountChannelStatus = config.sql.review.accountChannelStatusFromAccountId.format(message.user);
                    cClient.query(selectReviewAccountChannelStatus, (err, resultReviewAccountChannelStatus) => {
                        if (err) {
                            util.errorBotSay('キャンセル時のアカウントのレビューステータス確認でエラー発生: ' + err);
                            console.log(err);
                            cClient.end();
                            return;
                        }
                        if (resultReviewAccountChannelStatus.rowCount == 1) {
                            util.botSay('了解。処理を中断しました。', channelId)
                            util.updateStatus(1, 1, targetChannelList);
                            if (resultReviewAccountChannelStatus.rows[0].current_summary_id == 0) {
                                cClient.end();
                                return;
                            }
                            util.updateReviewStatus(null, null, 0, 0, targetChannelList);
                            reviewCheck.setProperty(bot, message, cClient, channelWordDic, targetChannelList);
                            reviewCheck.updateReviewSummaryResult(statusResult, channelId, resultReviewAccountChannelStatus.rows[0].current_summary_id, true);
                            cClient.end();
                        } else {
                            cClient.end();
                        }
                    });
                } else {
                    // 処理の途中の場合
                    util.updateStatus(1, 1, targetChannelList)
                    util.updateReviewStatus(null, null, 0, 0, targetChannelList)
                    util.botSay('了解。処理を中断しました。', channelId)
                    cClient.end();
                }
            });
        });
    });
};