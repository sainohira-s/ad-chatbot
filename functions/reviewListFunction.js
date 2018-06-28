"use strict"
let MAIN = {};
exports.REVIEWLIST = MAIN;

let config = require('config');
let pg = require('pg');
let util = require('./utility.js').UTIL;

let bot;
let message;
let channelWordDic;
let targetChannelList;
let connectionString = process.env.connectionstring;

// ファイル内で共通して利用するプロパティを定義
MAIN.setProperty = function setProperty(slackBot, recieveMessage, rChannelWordDic, rTargetChannelList) {
    bot = slackBot;
    message = recieveMessage;
    channelWordDic = rChannelWordDic;
    targetChannelList = rTargetChannelList;
}

// レビュー一覧(タイトル)をメッセージで送る
MAIN.sendReviewTitleList = function sendReviewTitleList(specifyCallBackId) {
    bot.replyInteractive(message, {
        text: message.original_message.text,
        attachments: [{
            text: ':white_check_mark: ' + message.actions[0].value,
            color: config.color.selectedColor
        }]
    })
    // データベースから各フェーズのレビュー大枠の一覧を取得する
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
            var summaryInfoList = summaryResult.rows.filter(info =>{
                if ('Screen' == message.actions[0].name) {
                    // 画面設計
                    return 1 == info.type_id;
                } else if ('Test' == message.actions[0].name){
                    // 結合テスト設計
                    return 2 == info.type_id;
                } else if ('Program' == message.actions[0].name){
                    // プログラム設計
                    return 3 == info.type_id;
                }
                return false;
            });
            var actionsJson = [];
            summaryInfoList.forEach((summaryInfo, index) => {
                actionsJson.push(util.buttonActionJsonGenerator(String(summaryInfo.id), summaryInfo.summary, summaryInfo.summary));
            })
            var attachmentJson = util.attachmentJsonGeneratorForAction(specifyCallBackId, config.color.selectingColor, actionsJson)
            var interactiveJson = util.interactiveJsonGenerator('レビュー項目を選択してください。', attachmentJson)
            bot.reply(message, interactiveJson);
            ssrlClient.end();
        });
    });
}

// レビュー一覧(詳細)をメッセージで送る
MAIN.sendReviewDetailList = function sendReviewDetailList(statusResult, channelId, bot_message) {
    bot.replyInteractive(message, {
        text: message.original_message.text,
        attachments: [{
            text: ':white_check_mark: ' + message.actions[0].value,
            color: config.color.selectedColor,
        }]
    })

    // データベースから各フェーズのレビュー詳細一覧を取得する
    let ssrlClient = new pg.Client(connectionString);
    ssrlClient.connect((err) => {
        if (err) {
            console.log('error: ' + err);
        }
        let selectQuestionList = config.sql.review.questionListFromSummaryId.format(message.actions[0].name);
        ssrlClient.query(selectQuestionList, function(err, summaryResult) {
            if(err) {
                console.log('レビュー一覧(詳細)取得時にエラー発生: ' + err);
                ssrlClient.end();
                return;
            }
            let text = '';
            let tmpTitle = '';
            summaryResult.rows.forEach((result, index)=>{
                if (tmpTitle != result.title) {
                    if (text != '') {
                        text += '```\n'
                    }
                    tmpTitle = result.title;
                    text += '```■ ' + tmpTitle + '\n'
                }
                const question = result.question;
                text += '　　' + result.question_number + '. ' + question.replace(/\\n/g,"\n") + '\n';
            })
            text += '```'
            bot.reply(message, {
                text: "",
                attachments: [{
                    text: text,
                    color: config.color.resultColor
                }]
            });
            ssrlClient.end();
        });
    });
}
