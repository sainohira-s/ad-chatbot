"use strict"
let MAIN = {};
exports.REVIEW = MAIN;

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

// 初回：レビューの質問を送信
MAIN.sendReviewQuestionDetailList = function sendReviewQuestionDetailList() {
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
            ssrlClient.end();
        }
        let select = config.sql.review.accountChannelStatusFromAccountId.format(message.user)
        ssrlClient.query(select, function(err, questionPassingResult) {
            if(err) {
                console.log('回答状況取得時にエラー発生: ' + err);
                ssrlClient.end();
                return;
            }
            let selectQuestionList = config.sql.review.questionListFromSummaryId.format(message.actions[0].name);
            ssrlClient.query(selectQuestionList, function(err, questionListResult) {
                if(err) {
                    console.log('レビュー一覧(詳細)取得時にエラー発生: ' + err);
                    ssrlClient.end();
                    return;
                }

                let attachmentsJson = []
                let text = '';
                questionListResult.rows.some((questionInfo) => {
                    if (!text.match(questionInfo.title)) {
                        if (text != ''){
                            text += '```\n'
                        }
                        text += '■ *' + questionInfo.title + '*\n ```'
                    }

                    let questionText = '  ' + questionInfo.question_number + '. ' + questionInfo.question.replace(/\\n/g,"\n");
                    text += questionText + '\n';
                })


                text += '```';
                console.log(text)
                attachmentsJson.push(util.attachmentJsonGeneratorForText(text, config.color.resultColor));

                let summaryId = questionListResult.rows[0].summary_id;
                let categoryId = questionListResult.rows[0].category_id;
                let name = String(summaryId) + '_' + String(categoryId)

                let select = config.sql.review.accountChannelStatusFromAccountId.format(message.user)
                ssrlClient.query(select, function(err, questionPassingResult) {
                    if(err) {
                        console.log('回答状況取得時にエラー発生: ' + err);
                        ssrlClient.end();
                        return;
                    }
                    let questionListSelect = config.sql.review.questionListForCategoryId.format(categoryId)
                    ssrlClient.query(questionListSelect, function(err, questionListResult) {
                        if(err) {
                            console.log('回答状況取得時にエラー発生: ' + err);
                            ssrlClient.end();
                            return;
                        }

                        let isPassed = false;
                        questionListResult.rows.some((questionInfo) => {
                            questionPassingResult.rows[0].passing_question.some((qustionPassing) =>{ 
                                if (summaryId == qustionPassing.match(/[0-9]*/)[0]|0) {
                                    isPassed = questionInfo.question_id == qustionPassing.match(/[0-9]*$/)[0]|0;
                                    return isPassed;
                                }
                            })
                            return false == isPassed
                        })

                        if (isPassed){
                            attachmentsJson.push(buttonAttachmentGenarator(name, 'クリア', 'Clear', 'danger', 'clearReview', config.color.resultColor));
                        } else {
                            attachmentsJson.push(buttonAttachmentGenarator(name, 'OK', 'OK', 'primary', 'checkedReview', config.color.selectingColor));
                        }
                        bot.reply(message, {
                            text: '以下のチェック項目を確認し、回答してください。 (計:' +　questionListResult.rows.length + '問 )',
                            attachments: attachmentsJson
                        });
                        ssrlClient.end();
                    });
                });
            });
        });
    });
}

// 「OK」押下：レビューの質問を送信 (From ダイレクトメッセージ)
MAIN.sendReviewQuestionDetailListForAns = function sendReviewQuestionDetailListForAns(statusResult, channelId, bot_message) {
    let ssrlClient = new pg.Client(connectionString);
    ssrlClient.connect((err) => {
        if (err) {
            console.log('error: ' + err);
            ssrlClient.end();
        }
        let accountId = message.user
        let summaryId = message.actions[0].name.match(/[0-9]*/)[0]|0;
        let categoryId = message.actions[0].name.match(/[0-9]*$/)[0]|0;
        //let passingId = summaryId + '_' + categoryId;
        
        let select = config.sql.review.accountChannelStatusFromAccountId.format(accountId)
        ssrlClient.query(select, function(err, questionPassingResult) {
            if(err) {
                console.log('回答状況取得時にエラー発生: ' + err);
                ssrlClient.end();
                return;
            }
            let questionListSelect = config.sql.review.questionListForCategoryId.format(categoryId)
            ssrlClient.query(questionListSelect, function(err, questionListResult) {
                if(err) {
                    console.log('回答状況取得時にエラー発生: ' + err);
                    ssrlClient.end();
                    return;
                }
                let passingQuestionList = questionPassingResult.rows[0].passing_question;
                let isSame = false;
                questionListResult.rows.some((questionInfo) => {
                    passingQuestionList.some((passingQuestion) => {
                        let passingSummaryId = passingQuestion.match(/[0-9]*/)[0]|0;
                        if (passingSummaryId == summaryId) {
                             isSame = questionInfo.question_id == passingQuestion.match(/[0-9]*$/)[0]|0;
                             return isSame;
                        }
                    })

                    if (isSame) {
                        return isSame;
                    }

                    passingQuestionList.push(summaryId + '_' + questionInfo.question_id);
                })
                console.log(passingQuestionList)
                // ユーザーの回答状況を更新
                let update = config.sql.review.update.accountChannelPassingQuestion.format(util.arrayToString(passingQuestionList), accountId);
                console.log(update)
                ssrlClient.query(update, function(err, result) {
                    if(err) {
                        console.log('回答状況更新時にエラー発生: ' + err);
                        ssrlClient.end();
                        return;
                    }
                    ssrlClient.end();
                    let interactiveJson = message.original_message;
                    let attachments = interactiveJson.attachments;
                    attachments[1] = buttonAttachmentGenarator(summaryId + '_' + categoryId, 'クリア', 'Clear', 'danger', 'clearReview', config.color.resultColor);
                    interactiveJson.attachments = attachments;
                    bot.replyInteractive(message, interactiveJson);
                });
            });
        });
    });
}

// Clearボタン押下時の処理
MAIN.sendReviewQuestionDetailListForClear = function sendReviewQuestionDetailListForClear(statusResult, channelId, bot_message) {
    let ssrlClient = new pg.Client(connectionString);
    ssrlClient.connect((err) => {
        if (err) {
            console.log('error: ' + err);
            ssrlClient.end();
        }
        let accountId = message.user
        let summaryId = message.actions[0].name.match(/[0-9]*/)[0]|0;
        let categoryId = message.actions[0].name.match(/[0-9]*$/)[0]|0;
        let passingId = summaryId + '_' + categoryId;
        let select = config.sql.review.accountChannelStatusFromAccountId.format(accountId)
        ssrlClient.query(select, function(err, questionPassingResult) {
            if(err) {
                console.log('回答状況取得時にエラー発生: ' + err);
                ssrlClient.end();
                return;
            }
            
            let passingQuestionList = questionPassingResult.rows[0].passing_question;

            // ユーザーの回答状況を更新
            let select = config.sql.review.questionListForCategoryId.format(categoryId);
            ssrlClient.query(select, function(err, questionListResult) {
                if(err) {
                    console.log('タイトル時にエラー発生: ' + err);
                    ssrlClient.end();
                    return;
                }
                let questionList = passingQuestionList;
                questionListResult.rows.forEach((question) => {
                    passingQuestionList.some((passingQuestion, index) => {
                        let isSame = summaryId + '_' + question.question_id == passingQuestion;
                        if (isSame) {
                            questionList.splice(index, 1);
                        }
                        return isSame;
                    })    
                })

                // ユーザーの回答状況を更新
                let update = config.sql.review.update.accountChannelPassingQuestion.format(util.arrayToString(questionList), accountId);
                ssrlClient.query(update, function(err, result) {
                    if(err) {
                        console.log('回答状況更新時にエラー発生: ' + err);
                        ssrlClient.end();
                        return;
                    }
                    let interactiveJson = message.original_message
                    let attachments = interactiveJson.attachments
                    let questionNumber = 0;
                    attachments[1] = buttonAttachmentGenarator(summaryId + '_' + categoryId, 'OK', 'OK', 'primary', 'checkedReview', config.color.selectingColor);
                    interactiveJson.attachments = attachments
                    bot.replyInteractive(message, interactiveJson);
                    ssrlClient.end();
                });
            });
        });
    });
}

function buttonAttachmentGenarator(name, text, value, style, callback_id, attachmentColor) {
    let actionsJsonForClear = [{
        "name": name,
        "text": text,
        "value": value,
        "type": "button",
        "style": style
    }]
    return util.attachmentJsonGeneratorForAction(callback_id, attachmentColor, actionsJsonForClear);
}