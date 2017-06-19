"use strict"
let config = require('config');
let pg = require('pg');

// 今回ターゲットとしているチャンネルのIDリスト
let targetChannelList = ['G5LBPD8G6', 'G5JT69BDW']
let util = require('./utility.js').UTIL;
// let cancelController = require('./controller/cancel.js');

// PostgreSQL
let connectionString = process.env.connectionstring;

let client;

exports.search = function(bot, message) {
    // SQLクエリに影響する文字列を置換
    message.text = message.text.replace(/'/g,"''");

    let channelId = message.channel;
    let accountId = message.user;

    client = new pg.Client(connectionString);
    client.connect((err) => {
        // Utilityのプロパティ設定
        util.setProperty(bot, message, client);
        if (err) {
            console.log('error: ' + err)
            return;
        }
        util.accoutAccessCountUp();

        let selectStatus = config.sql.channelStatus.format(channelId);
        if (targetChannelList.indexOf(message.channel) == -1) {
             selectStatus = config.sql.accountChannelStatus.format(accountId);
        }
        client.query(selectStatus, (err, statusResult) => {
            if (err) {
                util.botSay('現在のステータス取得時にエラー発生: ' + err)
                client.end();
                return;
            }
            if (statusResult.rowCount){
                
                // 現在のステータスにより処理を分ける
                switch (statusResult.rows[0].current_type_id) {
                case 0:
                    // ノンステータス
                    let selectMessage = config.sql.messageSearch.format(message.text)
                    client.query(selectMessage, (err, resultMessage) => {
                        if(err) {
                            util.errorBotSay('現在のステータスが0ときのメッセージ取得時にエラー発生: ' + err)
                            client.end();
                            return;
                        }
                        if (resultMessage.rowCount == 1){

                            // Messageの持つステータスにより処理を分ける
                            switch (resultMessage.rows[0].type_id) {
                            case 0:
                                // 連続した対話が発生していない場合の処理
                                if (message.event != 'ambient') {
                                    // ボットに向けた発言に対する処理
                                    let text = resultMessage.rows[0].message[0];
                                    util.botSay(text, message.channel);
                                    client.end();
                                } else {
                                    // チャンネルに向けた発言に対する処理
                                    
                                }
                                break;
                            case 1:
                                // レビュー一覧に関する対話が発生している場合
                                util.updateStatus(1, 1, null, null, targetChannelList);
                                break;
                            case 2:
                                // レビューチェックの対話がしている場合
                                util.updateStatus(2, 2, null, null, targetChannelList);
                                break;
                            default :
                                client.end();
                            }
                        } else if (resultMessage.rowCount > 1) {
                            // util.botSay('(んー、なんと答えるのがべきなのか...。。:disappointed_relieved:)\n端的に話してくれると嬉しいな！', message.channel);
                        } else {
                            // util.botSay('対話できるBotをここに用意したい。', message.channel);
                        }
                    });
                    break;
                case 1:
                    // レビューチェック機能操作中ステータス
                    break;
                case 2:
                    // レビューチェック開始
                    break;
                }
            }
        });

    });
});
