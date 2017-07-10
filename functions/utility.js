"use strict"
let MAIN = {};
exports.UTIL = MAIN;
let config = require('config');

let bot;
let client;
let message;

// ファイル内で共通して利用するプロパティを定義
MAIN.setProperty = function setProperty(slackBot, recieveMessage, pgClient) {
    bot = slackBot;
    client = pgClient;
    message = recieveMessage;
}

/**
* ステータスの更新処理(引数がnullの項目は、更新されない)
*/
MAIN.updateStatus = function updateStatus(currentTypeId, stage, targetChannelList) {
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
        client.query(updateStatus, function(err, result) {
            if(err) {
                MAIN.errorBotSay('ステータス更新時にエラー発生: ' + err);
                client.end();
                return;
            }
        });
    } else {
        let selectchannelComposition = config.sql.channelCompositionFromAccountId.format(message.user);
        client.query(selectchannelComposition, function(err, channelCompostionResult) {
            if(err) {
                MAIN.errorBotSay('ステータス変更時のチャンネル構成取得時にエラー発生: ' + err);
                client.end();
                return;
            }
            if (channelCompostionResult.rowCount == 1) {
                let updateStatus = config.sql.update.accountChannelStatus.format(setPhrase, channelCompostionResult.rows[0].channel_id, message.user);
                client.query(updateStatus, function(err, result) {
                    if(err) {
                        MAIN.errorBotSay('ステータス更新時にエラー発生: ' + err);
                        client.end();
                        return;
                     }
                });
            }
        });
    }
}

MAIN.updateReviewStatus = function updateReviewStatus(passingSummary, passingQuestion, currentSummaryId, currentQuestion, targetChannelList){
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
        client.query(updateStatus, function(err, result) {
            if(err) {
                MAIN.errorBotSay('レビューステータス更新時にエラー発生: ' + err);
                client.end();
                return;
            }
        });
    } else {
        let selectchannelComposition = config.sql.channelCompositionFromAccountId.format(message.user);
        client.query(selectchannelComposition, function(err, channelCompostionResult) {
            if(err) {
                MAIN.errorBotSay('レビューステータス変更時のチャンネル構成取得時にエラー発生: ' + err);
                client.end();
                return;
            }
            if (channelCompostionResult.rowCount == 1) {
                let updateStatus = config.sql.review.update.accountChannelStatus.format(setPhrase, channelCompostionResult.rows[0].channel_id, message.user);
                client.query(updateStatus, function(err, result) {
                    if(err) {
                        MAIN.errorBotSay('レビューステータス更新時にエラー発生: ' + err);
                        client.end();
                        return;
                     }
                });
            }
        });
    }
}

MAIN.accoutAccessCountUp = function accoutAccessCountUp() {
    let channelId = message.channel
    let accountId = message.user
    let selectchannelComposition = config.sql.channelCompositionFromChannelIdAndAccountId.format(channelId, accountId);
    client.query(selectchannelComposition, function(err, channelCompositionResult) {
        if(err) {
            MAIN.errorBotSay('ユーザーアクセスカウントアップ時にエラー発生: ' + err);
            client.end();
            return;
        }
        if (channelCompositionResult.rowCount) {
            let updateStatusAccessCount = config.sql.update.accessCountUpChannelMessage.format(channelId, accountId)
            client.query(updateStatusAccessCount, function(err, result) {
                if(err) {
                    MAIN.errorBotSay('アカウントチャンネルアクセスカウントアップ時にエラー発生: ' + err);
                    client.end();
                    return;
                }
            });
        } else {
            let updateStatusAccessCount = config.sql.update.accessCountUpDirectMessage.format(accountId)
            client.query(updateStatusAccessCount, function(err, result) {
                if(err) {
                    MAIN.errorBotSay('アカウントアクセスカウントアップ時にエラー発生: ' + err);
                    client.end();
                    return;
                }
            });
        }
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
    MAIN.botSay(error_message , 'U5E0ZUTUM');
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