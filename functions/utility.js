"use strict"
let MAIN = {};
exports.UTIL = MAIN;
let config = require('config');
let pg = require('pg');

let bot;
let message;
let connectionString = process.env.connectionstring;

// ファイル内で共通して利用するプロパティを定義
MAIN.setProperty = function setProperty(slackBot, recieveMessage) {
    bot = slackBot;
    message = recieveMessage;
}

/**
* ステータスの更新処理(引数がnullの項目は、更新されない)
*/
MAIN.updateStatus = function updateStatus(currentTypeId, stage, targetChannelList) {
    let usClient = new pg.Client(connectionString);
    usClient.connect((err) => {
        if (err) {
            console.log('error: ' + err);
            return;
        }
        let setPhrase = ``;
        if (currentTypeId != null){
            setPhrase = setPhrase + `current_type_id = ${currentTypeId}, `;
        }
        if (stage != null){
            setPhrase = setPhrase + `stage = ${stage}, `;
        }
        setPhrase = setPhrase.substr(0, setPhrase.length-2);
        if (targetChannelList.indexOf(message.channel) >= 0) {
            let updateStatus = config.sql.update.channelStatus.format(setPhrase, message.channel);
            usClient.query(updateStatus, function(err, result) {
                if(err) {
                    MAIN.errorBotSay('ステータス更新時にエラー発生: ' + err);
                    console.log(err);
                    usClient.end();
                    return;
                }
                usClient.end();
            });
        } else {
            let selectchannelComposition = config.sql.channelCompositionFromAccountId.format(message.user);
            usClient.query(selectchannelComposition, function(err, channelCompostionResult) {
                if(err) {
                    MAIN.errorBotSay('ステータス変更時のチャンネル構成取得時にエラー発生: ' + err);
                    console.log(err);
                    usClient.end();
                    return;
                }
                if (channelCompostionResult.rowCount == 1) {
                    let updateStatus = config.sql.update.accountChannelStatus.format(setPhrase, channelCompostionResult.rows[0].channel_id, message.user);
                    usClient.query(updateStatus, function(err, result) {
                        if(err) {
                            MAIN.errorBotSay('ステータス更新時にエラー発生: ' + err);
                            console.log(err);
                            usClient.end();
                            return;
                        }
                        usClient.end();
                    });
                }
            });
        }
    });
}

MAIN.updateReviewStatus = function updateReviewStatus(passingSummary, passingQuestion, currentSummaryId, currentQuestion, targetChannelList){
    let ursClient = new pg.Client(connectionString);
    ursClient.connect((err) => {
        if (err) {
            console.log('error: ' + err);
            return;
        }

        let setPhrase = ``;
        if (passingSummary != null) {
            setPhrase = setPhrase + `passing_summary = ARRAY[${passingSummary}], `;
        }
        if (passingQuestion != null) {
            setPhrase = setPhrase + `passing_question = ARRAY[${passingQuestion}], `;
        }
        if (currentSummaryId != null) {
            setPhrase = setPhrase + `current_summary_id = ${currentSummaryId}, `;
        }
        if (currentQuestion != null) {
            setPhrase = setPhrase + `current_question = ${currentQuestion}, `;
        }
        setPhrase = setPhrase.substr(0, setPhrase.length-2);
        if (targetChannelList.indexOf(message.channel) >= 0) {
            let updateStatus = config.sql.review.update.channelStatus.format(setPhrase, message.channel);
            ursClient.query(updateStatus, function(err, result) {
                if(err) {
                    MAIN.errorBotSay('レビューステータス更新時にエラー発生: ' + err);
                    console.log(err);
                    ursClient.end();
                    return;
                }
                ursClient.end();
            });
        } else {
            let selectchannelComposition = config.sql.channelCompositionFromAccountId.format(message.user);
            ursClient.query(selectchannelComposition, function(err, channelCompostionResult) {
                if(err) {
                    MAIN.errorBotSay('レビューステータス変更時のチャンネル構成取得時にエラー発生: ' + err);
                    console.log(err);
                    ursClient.end();
                    return;
                }
                if (channelCompostionResult.rowCount == 1) {
                    let updateStatus = config.sql.review.update.accountChannelStatus.format(setPhrase, channelCompostionResult.rows[0].channel_id, message.user);
                    ursClient.query(updateStatus, function(err, result) {
                        if(err) {
                            MAIN.errorBotSay('レビューステータス更新時にエラー発生: ' + err);
                            console.log(err);
                            ursClient.end();
                            return;
                        }
                        ursClient.end();
                    });
                }
            });
        }
    });
}

MAIN.accoutAccessCountUp = function accoutAccessCountUp() {
    let aacClient = new pg.Client(connectionString);
    aacClient.connect((err) => {
        if (err) {
            console.log('error: ' + err);
            return;
        }
        let channelId = message.channel
        let accountId = message.user
        let selectchannelComposition = config.sql.channelCompositionFromChannelIdAndAccountId.format(channelId, accountId);
        aacClient.query(selectchannelComposition, function(err, channelCompositionResult) {
            if(err) {
                MAIN.errorBotSay('ユーザーアクセスカウントアップ時にエラー発生: ' + err);
                console.log(err);
                aacClient.end();
                return;
            }
            if (channelCompositionResult.rowCount) {
                let updateStatusAccessCount = config.sql.update.accessCountUpChannelMessage.format(channelId, accountId)
                aacClient.query(updateStatusAccessCount, function(err, result) {
                    if(err) {
                        MAIN.errorBotSay('アカウントチャンネルアクセスカウントアップ時にエラー発生: ' + err);
                        console.log(err);
                        aacClient.end();
                        return;
                    }
                    aacClient.end();
                });
            } else {
                let updateStatusAccessCount = config.sql.update.accessCountUpDirectMessage.format(accountId)
                aacClient.query(updateStatusAccessCount, function(err, result) {
                    if(err) {
                        MAIN.errorBotSay('アカウントアクセスカウントアップ時にエラー発生: ' + err);
                        console.log(err);
                        aacClient.end();
                        return;
                    }
                    aacClient.end();
                });
            }
        });
    });
}

/**
* ステータスの更新処理(引数がnullの項目は、更新されない)
*/
MAIN.botSay = function botSay(messageText, channel) {
    let tempMessage = String(messageText)
    if ( tempMessage.match(/\\n/)) {
        tempMessage = tempMessage.replace(/\\n/g,"\n");
    }
    bot.say({
        text: tempMessage,
        channel: channel
    });
} 

/**
* エラー発生時のメッセージ送信
*/
MAIN.errorBotSay = function errorBotSay(error_message) {
    console.log(error_message);
    MAIN.botSay('申し訳ございません。実行に失敗いたしました。。もう一度、異なる形式での入力をお願いします。'.channel);
}

/**
 * 指定されているチャンネルがターゲット一覧に存在するかチェック
 */
MAIN.isTargetChannel = function isTargetChannel(targetChannelList) {
    for (let channelId in targetChannelList) {
        if (channelId == message.channel) {
            return true
        }
    }
    return false;
}