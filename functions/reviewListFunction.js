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

                let selectAccountStatus = config.sql.accountChannelStatus.format(message.user);
                ssrlClient.query(selectAccountStatus, function(err, accountStatusResult) {
                    if (err) {
                        console.log('自信が所属するチャンネルの検索時にエラー発生: ' + err);
                        ssrlClient.end();
                        return;
                    }
                    if (accountStatusResult.rowCount == 0) {
                        bot.reply(message, 'sai-botのいるチャンネルに所属していません。')
                        ssrlClient.end();
                    } else {
                        if (accountStatusResult.rows[0].account_reviewer_flg) {
                            displayForReviewer(bot, message, ssrlClient, summaryResult, questionListResult);
                            return;
                        }
                        
                        let existChannel = false;
                        accountStatusResult.rows.some((accountStatus) => {
                            if (accountStatus.channel_id == message.channel){
                                existChannel = true;
                                displayButtonForReviewStatusCheckForPhase(bot, message, ssrlClient, message.channel, summaryResult, questionListResult, specifyCallBackId, existChannel);
                                return existChannel;
                            }
                        })

                        if (false == existChannel) {
                            let channelId = accountStatusResult.rows[0].channel_id
                            displayButtonForReviewStatusCheckForPhase(bot, message, ssrlClient, channelId, summaryResult, questionListResult, specifyCallBackId, existChannel);
                        }
                    }
                });
            });
        });
    });
}

// レビュー一覧(詳細)をメッセージで送る
MAIN.sendReviewDetailList = function sendReviewDetailList() {
    // データベースから各フェーズのレビュー詳細一覧を取得する
    let ssrlClient = new pg.Client(connectionString);
    ssrlClient.connect((err) => {
        if (err) {
            console.log('error: ' + err);
        }
        let selectQuestionList = config.sql.review.questionListFromSummaryId.format(message.actions[0].name);
        ssrlClient.query(selectQuestionList, function(err, questionListResult) {
            if(err) {
                console.log('レビュー一覧(詳細)取得時にエラー発生: ' + err);
                ssrlClient.end();
                return;
            }

            let selectAccountStatus = config.sql.accountChannelStatus.format(message.user);
            ssrlClient.query(selectAccountStatus, function(err, accountStatusResult) {
                if (err) {
                    console.log('自信が所属するチャンネルの検索時にエラー発生: ' + err);
                    ssrlClient.end();
                    return;
                }
                if (accountStatusResult.rowCount == 0) {
                    bot.reply(message, 'saibotのいるチャンネルに所属していません。')
                } else {
                    let existChannel = false;
                    accountStatusResult.rows.some((accountStatus) => {
                        if (accountStatus.channel_name == message.channel){
                            existChannel = true;
                            displayButtonForReviewStatusCheckForSummaryButton(bot, message, ssrlClient, message.channel, questionListResult, accountStatusResult);
                            return true;
                        }
                    });

                    if (false == existChannel) {
                        let channelId = accountStatusResult.rows[0].channel_id;
                        displayButtonForReviewStatusCheckForSummaryButton(bot, message, ssrlClient, channelId, questionListResult, accountStatusResult);
                    }
                }
            });
        });
    });
}

function displayButtonForReviewStatusCheckForPhase(bot, message, ssrlClient, channelId, summaryResult, questionListResult, specifyCallBackId, existChannel) {
    let selectAccountChannelStatus = config.sql.review.accountChannelStatus.format(channelId);
    ssrlClient.query(selectAccountChannelStatus, function(err, reviewAccountChannelStatusResult) {
        if (err) {
            console.log('パスされたレビュー項目取得時にエラー発生: ' + err);
            ssrlClient.end();
            return;
        }

        // SummaryId別で質問群をグループ分けする
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

        // 各アカウントの回答状況からサマリーあたりの回答状況を確認する
        let passingSummaryList = [];
        reviewAccountChannelStatusResult.rows.forEach((accountInfo, index) => {
            if (existChannel) {
                // チャンネルからのメッセージのとき
                let passingSummaryForAccount = [];
                let accountPassingQuestion = accountInfo.passing_question;
                questionGroupList.forEach((questionGroup) => {
                    let flag = false;
                    questionGroup.some((questionInfo) => {
                        accountPassingQuestion.some((passingQuestion) => {
                            flag = questionInfo.summary_id + '_' + questionInfo.question_id == passingQuestion;
                            return flag;
                        })
                        return false == flag;
                    })
                    passingSummaryForAccount.push(flag);
                })
                passingSummaryList.push(passingSummaryForAccount);
            } else {
                // ダイレクトメッセージのとき
                if (accountInfo.account_id == message.user) {
                    // チャンネルからのメッセージのとき
                    let passingSummaryForAccount = [];
                    let accountPassingQuestion = accountInfo.passing_question;
                    questionGroupList.forEach((questionGroup) => {
                        let flag = false;
                        questionGroup.some((questionInfo) => {
                            accountPassingQuestion.some((passingQuestion) => {
                                flag = questionInfo.summary_id + '_' + questionInfo.question_id == passingQuestion;
                                return flag;
                            })
                            return false == flag;
                        })
                        passingSummaryForAccount.push(flag);
                    })
                    passingSummaryList.push(passingSummaryForAccount);
                }
            }
        });

        // 各アカウントの回答状況をすり合わせる(全アカウントが回答していれば、ボタンにチェックマークをつける)
        let tmpPassingSummary = [];
        passingSummaryList.forEach((passingSummary, summaryIndex) => {
            if (0 == summaryIndex) {
                tmpPassingSummary = passingSummary
            } else {
                tmpPassingSummary = passingSummary.map((isPassing, passingIndex) => {
                    return tmpPassingSummary[passingIndex] && isPassing
                })
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
}

function displayButtonForReviewStatusCheckForSummaryButton(bot, message, ssrlClient, channelId, questionListResult, accountStatusResult) {
    let selectAccontChannel = config.sql.review.accountChannelStatus.format(channelId);
    ssrlClient.query(selectAccontChannel, function(err, accountsStatusResult) {
        if(err) {
            console.log('アカウントのレビューチェック状況取得時にエラー発生: ' + err);
            ssrlClient.end();
            return;
        }
        let questionList = questionListResult.rows;
        let attachmentJson = message.original_message.attachments;
        let listLength = 0;
        attachmentJson.forEach((attachment, index) => {
            if (attachment.actions){
                listLength = index + 1;
            }
        })

        attachmentJson.length = listLength;
        for (var i=0; i < listLength; i++) {
            attachmentJson[i].color = config.color.selectedColor;
            attachmentJson[i].actions.map((action) => {
                if (action.name == message.actions[0].name) {
                    action.style = "primary";
                } else {
                    action.style = "";
                }
                return action;
            })
        }

        attachmentJson.push({
            text: 'レビューチェック完了メンバーは以下のとおりです。',
            color: config.color.resultColor
        })

        accountsStatusResult.rows.forEach((accountInfo, index) => {
            let accountPassingQuestion = accountInfo.passing_question;
            let flag = false;
            questionList.some((questionInfo, index) => {
                accountPassingQuestion.some((passingQuestion) => {
                    flag = questionInfo.summary_id + '_' + questionInfo.question_id == passingQuestion;
                    return flag;
                })
                return false == flag;
            });

            if (flag) {
                attachmentJson.push({
                    text: '・' + accountInfo.name,
                    color: config.color.resultColor
                })
            }
        });
        
        if (attachmentJson.length == listLength + 1) {
            attachmentJson.length = listLength
            attachmentJson[listLength + 1] = {
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
}

function displayForReviewer(bot, message, ssrlClient, summaryResult, questionListResult) {
    let selectAccountChannelStatusList = config.sql.review.accountChannelStatusList;
    ssrlClient.query(selectAccountChannelStatusList, function(err, reviewAccountChannelStatusListResult) {
        if (err) {
            console.log('パスされたレビュー項目取得時にエラー発生: ' + err);
            ssrlClient.end();
            return;
        }

        // 全アカウンのチャンネルによるグループ分け
        let currentChannelId = "";
        let channelInfo = []
        let channelGroup = []
        let reviewTargetChannle = process.env.reviewTargetChannel;
        let reviewTargetChannelList = reviewAccountChannelStatusListResult.rows.filter((row) => {
            return reviewTargetChannle.indexOf(row.channel_name) > -1;
        })

        reviewTargetChannelList.forEach((accountInfo) => {
            if (currentChannelId != "" && currentChannelId != accountInfo.channel_id) {
                channelGroup.push(channelInfo);
                channelInfo = [];
            }
            channelInfo.push(accountInfo);
            currentChannelId = accountInfo.channel_id;
        })
        channelGroup.push(channelInfo);

        let attachments = []
        // SummaryId別で質問群をグループ分けする
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
        
        channelGroup.forEach((channelInfo) => {
            // 各アカウントの回答状況からサマリーあたりの回答状況を確認する
            let passingSummaryList = [];
            channelInfo.some((accountInfo) => {
                let passingSummaryForAccount = [];
                let accountPassingQuestion = accountInfo.passing_question;
                questionGroupList.forEach((questionGroup) => {
                    let flag = false;
                    questionGroup.some((questionInfo) => {
                        accountPassingQuestion.some((passingQuestion) => {
                            flag = questionInfo.summary_id + '_' + questionInfo.question_id == passingQuestion;
                            return flag;
                        })
                        return false == flag;
                    })
                    passingSummaryForAccount.push(flag);
                })
                passingSummaryList.push(passingSummaryForAccount);
            })

            // 各アカウントの回答状況をすり合わせる(全アカウントが回答していれば、ボタンにチェックマークをつける)
            let tmpPassingSummary = [];
            passingSummaryList.forEach((passingSummary, summaryIndex) => {
                if (0 == summaryIndex) {
                    tmpPassingSummary = passingSummary
                } else {
                    tmpPassingSummary = passingSummary.map((isPassing, passingIndex) => {
                        return tmpPassingSummary[passingIndex] && isPassing
                    })
                }
            })
            console.log(channelInfo)
            var attachmentJson = util.attachmentJsonGeneratorForText("*■" + channelInfo[0].channel_name + '*', config.color.resultColor)
            attachments.push(attachmentJson);

            var actionsJson = [];
            summaryResult.rows.forEach((summaryInfo, index) => {
                let text = ""
                if (tmpPassingSummary[index]) {
                    text += ':white_check_mark:'
                } else {
                    text += ':white_large_square:'
                }
                text += ' ' + summaryInfo.summary;
                var attachmentJson = util.attachmentJsonGeneratorForText(text, config.color.resultColor)
                attachments.push(attachmentJson);
            })
        })

        let interactiveJson = {
            "text" : "各班のレビュー状況は以下の通りです。",
            "attachments": attachments
        }

        bot.reply(message, interactiveJson);
        ssrlClient.end();
    });
}