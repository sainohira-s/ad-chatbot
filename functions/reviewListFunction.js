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
        let typeId = message.actions[0].name
        console.log(typeId)
        let selectSummaryList = config.sql.review.summaryListByTypeId.format(typeId);
        ssrlClient.query(selectSummaryList, function(err, summaryResult) {
            if (err) {
                console.log('レビュー一覧(サマリー)取得時にエラー発生: ' + err);
                ssrlClient.end();
                return;
            }
            let selectQuestionListFromSummaryType = config.sql.review.questionListFromSummaryType.format(typeId);
            ssrlClient.query(selectQuestionListFromSummaryType, function(err, questionListResult) {
                if (err) {
                    console.log('レビュー一覧(質問一覧)取得時にエラー発生: ' + err);
                    ssrlClient.end();
                    return;
                }
                let selectAccountChannelStatus = config.sql.review.accountChannelStatus.format(message.channel);
                ssrlClient.query(selectAccountChannelStatus, function(err, accountChannelStatusResult) {
                    if (err) {
                        console.log('パスされたレビュー項目取得時にエラー発生: ' + err);
                        ssrlClient.end();
                        return;
                    }
                    let questionGroupList = []
                    let questionGroup = []
                    let summaryId = 0
                    questionListResult.rows.forEach((questionInfo, index) => {
                        if (questionInfo.summary_id != summaryId && index != 0) {
                            questionGroupList.push(questionGroup)
                            questionGroup = []
                        }
                        questionGroup.push(questionInfo)
                        summaryId = questionInfo.summary_id;
                    })
                    questionGroupList.push(questionGroup)

                    let passingSummaryList = [];
                    accountChannelStatusResult.rows.forEach((accountInfo, index) => {
                        let passingSummaryForAccount = [];
                        let accountPassingQuestion = accountInfo.passing_question;
                        questionGroupList.forEach((questionGroup) => {
                            let flag = false;
                            questionGroup.some((questionInfo) => {
                                accountPassingQuestion.some((passingQuestion) => {
                                    flag = questionInfo.question_id == passingQuestion.match(/[0-9]*$/)[0]|0;
                                    return flag;
                                })
                                return false == flag;
                            })
                            passingSummaryForAccount.push(flag);
                        })
                        passingSummaryList.push(passingSummaryForAccount);
                    });

                    let tmpPassingSummary = [];
                    passingSummaryList.forEach((passingSummary) => {
                        if (tmpPassingSummary.length != 0) {
                            tmpPassingSummary = tmpPassingSummary.map((summaryStatus, index) => {
                                return summaryStatus && passingSummary[index]
                            })
                        } else {
                            tmpPassingSummary = passingSummary
                        }
                    })

                    var actionsJson = [];
                    summaryResult.rows.forEach((summaryInfo, index) => {
                        let checkText = '';
                        if (tmpPassingSummary[index]) {
                            checkText = ':white_check_mark:'
                        }
                        actionsJson.push(util.buttonActionJsonGenerator(String(summaryInfo.id), summaryInfo.summary, checkText + summaryInfo.summary, ""));
                    })
                    var attachmentJson = util.attachmentJsonGeneratorForAction(specifyCallBackId, config.color.selectingColor, actionsJson)
                    var interactiveJson = util.interactiveJsonGenerator('レビュー状況を確認したいタイトルを選択してください。', attachmentJson)
                    bot.reply(message, interactiveJson);
                    ssrlClient.end();
                });
            });
        });
    });
}

// レビュー一覧(詳細)をメッセージで送る
MAIN.sendReviewDetailList = function sendReviewDetailList(statusResult, channelId, bot_message) {
    // データベースから各フェーズのレビュー詳細一覧を取得する
    let ssrlClient = new pg.Client(connectionString);
    ssrlClient.connect((err) => {
        if (err) {
            console.log('error: ' + err);
        }
        let selectQuestionList = config.sql.review.questionListFromSummaryId.format(message.actions[0].name);
        console.log(selectQuestionList)
        ssrlClient.query(selectQuestionList, function(err, questionListResult) {
            if(err) {
                console.log('レビュー一覧(詳細)取得時にエラー発生: ' + err);
                ssrlClient.end();
                return;
            }
            
            let selectAccontChannel = config.sql.review.accountChannelStatus.format(message.channel);
            ssrlClient.query(selectAccontChannel, function(err, accountsStatusResult) {
                if(err) {
                    console.log('アカウントのレビューチェック状況取得時にエラー発生: ' + err);
                    ssrlClient.end();
                    return;
                }
                let questionList = questionListResult.rows;
                let attachmentJson = message.original_message.attachments;
                attachmentJson.length = 1;
                attachmentJson[0].color = config.color.selectedColor;
                attachmentJson[0].actions.map((action) => {
                    if (action.name == message.actions[0].name) {
                        action.style = "primary";
                    } else {
                        action.style = "";
                    }
                    return action;
                })
                attachmentJson.push({
                    text: 'レビューチェック完了メンバーは以下のとおりです。',
                    color: config.color.resultColor
                })

                accountsStatusResult.rows.forEach((accountInfo, index) => {
                    let accountPassingQuestion = accountInfo.passing_question;
                    let flag = false;
                    questionList.some((questionInfo, index) => {
                        accountPassingQuestion.some((passingQuestion) => {
                            flag = questionInfo.question_id == passingQuestion.match(/[0-9]*$/)[0]|0;
                            return flag;
                        })
                        return false == flag;
                    });

                    if (flag) {
                        attachmentJson.push({
                            text: '  ・' + accountInfo.name,
                            color: config.color.resultColor
                        })
                    }
                });

                if (attachmentJson.length == 2) {
                    attachmentJson[1] = {
                        text: 'レビューチェックを完了している方はいません。',
                        color: config.color.resultColor
                    }
                }

                bot.replyInteractive(message, {
                    text: message.original_message.text,
                    attachments: attachmentJson
                })
                ssrlClient.end();
            });
        });
    });
}
