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
                let tmpTitle = '';
                questionListResult.rows.some((questionInfo) => {
                    if (tmpTitle != questionInfo.title) {
                        if (tmpTitle != '') {
                            let name = String(questionInfo.summary_id) +'_'+ String(questionInfo.title_number)
                            attachmentsJson.push(buttonAttachmentGenarator(name, '次へ', 'NextStep', '', 'nextStepReview', config.color.attentionColor));
                            return true;
                        }
                        tmpTitle = questionInfo.title
                        let text = '■ *' + tmpTitle + '*'
                        let attachmentForTitle = util.attachmentJsonGeneratorForText(text, config.color.resultColor);
                        attachmentsJson.push(attachmentForTitle);
                    }

                    let questionText = questionInfo.question_number + '. ' + questionInfo.question.replace(/\\n/g,"\n");
                    let attachmentForQuestion = util.attachmentJsonGeneratorForText(questionText, config.color.resultColor);
                    let passingQuestionList = questionPassingResult.rows[0].passing_question;
                    let passingFlag = false;
                    passingQuestionList.some((passingQuestion) => {
                        let summaryId = passingQuestion.match(/[0-9]*/)[0]|0;
                        let questionId= passingQuestion.match(/[0-9]*$/)[0]|0;
                        if (summaryId == questionInfo.summary_id) {
                            if (questionId == questionInfo.question_id){
                                passingFlag = true;
                                return passingFlag;
                            }
                        }
                    })
                    attachmentsJson.push(attachmentForQuestion);
                    if (passingFlag) {
                        let attachmentForText = util.attachmentJsonGeneratorForText('`OK`' , config.color.resultColor);
                        attachmentsJson.push(attachmentForText);
                    } else {
                        let name = String(questionInfo.summary_id) + '_' + String(questionInfo.question_id);
                        attachmentsJson.push(buttonAttachmentGenarator(name, 'OK', 'OK', 'primary', 'checkedReview', config.color.selectingColor));
                    }
                })

                let clearSummaryId = questionListResult.rows[0].summary_id;
                let clearCategoryId = questionListResult.rows[0].category_id;
                if (!attachmentsJson[attachmentsJson.length -1].actions || attachmentsJson[attachmentsJson.length -1].actions[0].value != "NextStep") {
                    let name = String(clearSummaryId) + '_' + String(clearCategoryId)
                    attachmentsJson.push(buttonAttachmentGenarator(name, 'クリア', 'Clear', 'danger', 'clearReview', config.color.resultColor));
                }

                bot.reply(message, {
                    text: '以下のチェック項目を確認し、回答してください。 (計:' +　questionListResult.rows.length + '問 )',
                    attachments: attachmentsJson
                });
                ssrlClient.end();
            });
        });
    });
}

// 「次へ」押下：レビューの質問を送信
MAIN.sendReviewQuestionDetailListForNextStep = function sendReviewQuestionDetailListForNextStep(statusResult, channelId, bot_message) {
    // データベースから各フェーズのレビュー詳細一覧を取得する
    let ssrlClient = new pg.Client(connectionString);
    ssrlClient.connect((err) => {
        if (err) {
            console.log('error: ' + err);
            ssrlClient.end();
        }
        let summaryId = message.actions[0].name.match(/[0-9]*/)[0]|0;
        let titleNumber = message.actions[0].name.match(/[0-9]*$/)[0]|0;
        let select = config.sql.review.accountChannelStatusFromAccountId.format(message.user)
        ssrlClient.query(select, function(err, questionPassingResult) {
            if(err) {
                console.log('回答状況取得時にエラー発生: ' + err);
                ssrlClient.end();
                return;
            }
            let selectQuestionList = config.sql.review.questionListFromSummaryId.format(summaryId);
            ssrlClient.query(selectQuestionList, function(err, questionListResult) {
                if(err) {
                    console.log('レビュー一覧(詳細)取得時にエラー発生: ' + err);
                    ssrlClient.end();
                    return;
                }
                let attachmentsJson = []
                let tmpTitle = '';
                let categoryId = "";
                questionListResult.rows.some((questionInfo) => {
                    categoryId = questionInfo.category_id;
                    if (tmpTitle != questionInfo.title) {
                        if (tmpTitle != '' && titleNumber < questionInfo.title_number) {
                            let name = String(questionInfo.summary_id) +'_'+ String(questionInfo.title_number)
                            attachmentsJson.push(buttonAttachmentGenarator(name, '次へ', 'NextStep', '', 'nextStepReview', config.color.attentionColor));
                            return true;
                        }
                        tmpTitle = questionInfo.title
                        let text = '■ *' + tmpTitle + '*'
                        let attachmentForTitle = util.attachmentJsonGeneratorForText(text, config.color.resultColor);
                        attachmentsJson.push(attachmentForTitle);
                    }

                    let questionText = questionInfo.question_number + '. ' + questionInfo.question.replace(/\\n/g,"\n");
                    let attachmentForQuestion = util.attachmentJsonGeneratorForText(questionText, config.color.resultColor);
                    let passingQuestionList = questionPassingResult.rows[0].passing_question;
                    let passingFlag = false;
                    passingQuestionList.some((passingQuestion) => {
                        let summaryId = passingQuestion.match(/[0-9]*/)[0]|0;
                        let questionId= passingQuestion.match(/[0-9]*$/)[0]|0;
                        if (summaryId == questionInfo.summary_id) {
                            if (questionId == questionInfo.question_id){
                                passingFlag = true;
                                return passingFlag;
                            }
                        }
                    })
                    attachmentsJson.push(attachmentForQuestion);
                    if (passingFlag) {
                        let attachmentForText = util.attachmentJsonGeneratorForText('`OK`' , config.color.resultColor);
                        attachmentsJson.push(attachmentForText);
                    } else {
                        let name = String(questionInfo.summary_id) + '_' + String(questionInfo.question_id)
                        attachmentsJson.push(buttonAttachmentGenarator(name, 'OK', 'OK', 'primary', 'checkedReview', config.color.selectingColor));
                    }
                })

                if (!attachmentsJson[attachmentsJson.length -1].actions || attachmentsJson[attachmentsJson.length -1].actions[0].value != "NextStep") {
                    let name = String(summaryId) +'_'+ String(categoryId)
                    attachmentsJson.push(buttonAttachmentGenarator(name, 'クリア', 'Clear', 'danger', 'clearReview', config.color.resultColor));
                }

                bot.replyInteractive(message, {
                    text: '以下のチェック項目を確認し、回答してください。 (計:' +　questionListResult.rows.length + '問 )',
                    attachments: attachmentsJson
                });
                ssrlClient.end();
            });
        });
    });
}

// 「OK」「NG」押下：レビューの質問を送信 (From ダイレクトメッセージ)
MAIN.sendReviewQuestionDetailListForAns = function sendReviewQuestionDetailListForAns(statusResult, channelId, bot_message) {
    let ssrlClient = new pg.Client(connectionString);
    ssrlClient.connect((err) => {
        if (err) {
            console.log('error: ' + err);
            ssrlClient.end();
        }
        let accountId = message.user
        let summaryId = message.actions[0].name.match(/[0-9]*/)[0]|0;
        let questionNumber = message.actions[0].name.match(/[0-9]*$/)[0]|0;
        let passingId = summaryId + '_' + questionNumber;
        
        let select = config.sql.review.accountChannelStatusFromAccountId.format(accountId)
        ssrlClient.query(select, function(err, questionPassingResult) {
            if(err) {
                console.log('回答状況取得時にエラー発生: ' + err);
                ssrlClient.end();
                return;
            }
            
            let passingQuestionList = questionPassingResult.rows[0].passing_question;
            console.log(passingQuestionList)
            let isSame = false;
            passingQuestionList.some((passingQuestion) => {
                isSame = passingQuestion == passingId;
                return isSame;
            })
            if (false == isSame) {
                passingQuestionList.push(passingId);
            }

            // ユーザーの回答状況を更新
            let update = config.sql.review.update.accountChannelPassingQuestion.format(util.arrayToString(passingQuestionList), accountId);
            console.log(update)
            ssrlClient.query(update, function(err, result) {
                if(err) {
                    console.log('回答状況更新時にエラー発生: ' + err);
                    ssrlClient.end();
                    return;
                }
                let interactiveJson = message.original_message
                let attachments = interactiveJson.attachments
                let flag = false;
                attachments = attachments.map((attachment) => {
                    let attachmentJson = JSON.parse(JSON.stringify(attachment));
                    if (attachment.actions) {
                        attachment.actions.forEach((action, index) => {
                            if (action.name == passingId) {
                                if (false == flag) {
                                    attachmentJson = {
                                        "text": '`' + message.actions[0].value + '`',
                                        "color": config.color.resultColor
                                    }
                                } 
                                flag = true;
                            }
                        })
                    }
                    return attachmentJson;
                })
                interactiveJson.attachments = attachments
                bot.replyInteractive(message, interactiveJson);
                ssrlClient.end();
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
                    attachments = attachments.map((attachment) => {
                        if (attachment.text && false == (attachment.text == '`OK`' || attachment.text.indexOf('■') != -1)) {
                            questionNumber += 1
                        }
                        console.log(questionNumber)
                        if (attachment.text == '`OK`') {
                            let actionsJson = [{
                                "name":"",
                                "text": "OK",
                                "value": "OK",
                                "type": "button",
                                "style": "primary"
                            }]
                            actionsJson[0].name = String(summaryId) + '_' + String(questionListResult.rows[questionNumber-1].question_id);
                            let attachmentForAction = util.attachmentJsonGeneratorForAction('checkedReview', config.color.selectingColor, actionsJson);
                            return attachmentForAction;
                        }
                        return attachment;
                    })
                    interactiveJson.attachments = attachments
                    attachments.forEach((attachment) => {
                        console.log(attachment)
                    })
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