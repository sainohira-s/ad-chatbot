"use strict"
let MAIN = {};
exports.REVIEWLIST = MAIN;

let config = require('config');
let util = require('./utility.js').UTIL;

let bot;
let client;
let message;
let channelWordDic;
let targetChannelList;
// ファイル内で共通して利用するプロパティを定義
MAIN.setProperty = function setProperty(slackBot, recieveMessage, pgClient, rChannelWordDic, rTargetChannelList) {
    bot = slackBot;
    client = pgClient;
    message = recieveMessage;
    channelWordDic = rChannelWordDic;
    targetChannelList = rTargetChannelList;
}

// レビュー一覧(サマリー)をメッセージで送る
MAIN.sendSummaryReviewList = function sendSummaryReviewList(statusResult, channelId, bot_message) {
    let accountId = message.user;
    let selectAccount = config.sql.accountFromAccountId.format(accountId);
    client.query(selectAccount, function(err, accountResult) {
        if(err) {
            util.errorBotSay('レビュー一覧(サマリー)取得後のアカウント情報取得時にエラー発生: ' + err);
            client.end();
            return;
        }
        if(accountResult.rowCount == 1) {
            if (accountResult.rows[0].reviewer_flg) {
                sendReviewSummaryListAll(message);
                return;
            }
            let selectSummaryList = config.sql.review.summaryList;
            client.query(selectSummaryList, function(err, summaryResult) {
                if(err) {
                    util.errorBotSay('レビュー一覧(サマリー)取得時にエラー発生: ' + err);
                    client.end();
                    return;
                }
                if(targetChannelList.indexOf(message.channel) >= 0) {
                    formatReviewListForChannel(statusResult, summaryResult, bot_message)
                } else {
                    formatReviewListForAccountChannel(statusResult, summaryResult, bot_message);
                }
            });
        }
    });
}

// チャンネルからレビュー一覧参照時のフォーマット作成
function formatReviewListForChannel(statusResult, summaryResult, bot_message) {
    let selectChannelStatus = config.sql.review.channelStatus.format(message.channel);
    client.query(selectChannelStatus, function(err, channelStatusResult) {
        if(err) {
            util.errorBotSay('レビュー一覧(サマリー)取得時のchannelStatusResultでエラー発生: ' + err);
            client.end();
            return;
        }
        let selectAccountChannelReviewStatusForChannel = config.sql.review.accountChannelStatus.format(channelStatusResult.rows[0].channel_id);
        client.query(selectAccountChannelReviewStatusForChannel, function(err, accountChannelReviewStatusResult) {
            if(err) {
                util.errorBotSay('全ユーザーのステータス取得(サマリー)取得時にエラー発生: ' + err)
                client.end();
                return;
            }
            let text = bot_message + '\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
            let passing_summary_list = statusResult.rows[0].passing_summary
            summaryResult.rows.forEach((summaryInfo, index) => {
                let channelPassingSummaryFlag = false
                let userNames = '';
                accountChannelReviewStatusResult.rows.forEach((userStatus, index) => {
                    userStatus.passing_summary.forEach((summaryId, index) => {
                        if (summaryInfo.id == summaryId) {
                            userNames = userNames + userStatus.name + ', '
                            return;
                        }
                    });
                });
                let passingSummaryFlag = false
                if (channelStatusResult.rows[0].passing_summary.indexOf(summaryInfo.id.toString()) >= 0) {
                    passingSummaryFlag = true
                }
                userNames = (userNames)?'(' + userNames.substr(0, userNames.length-2) + ')':'';
                let flagText = (passingSummaryFlag)?':white_check_mark:':':white_large_square:'            
                text = text + '\n ' + flagText + '  '+ summaryInfo.id + '.  *' + summaryInfo.summary + '*  ' + userNames;
            });
            text = text + '\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
            util.botSay(text, message.channel)
            client.end();
        });
    });
}

// ダイレクトメッセージからレビュー一覧参照時のフォーマット作成
function formatReviewListForAccountChannel(statusResult, summaryResult, bot_message) {
    let selectChannelCompositionFromAccountId = config.sql.channelCompositionFromAccountId.format(message.user);
    client.query(selectChannelCompositionFromAccountId, function(err, channelCompositionFromAccountIdResult) {
        if(err) {
            util.errorBotSay('レビュー一覧(サマリー)取得時のchannelCompositionFromAccountIdResultでエラー発生: ' + err);
            client.end();
            return;
        }
        if (channelCompositionFromAccountIdResult.rowCount == 1) {
            let selectAccountChannelReviewStatusForChannel = config.sql.review.accountChannelStatus.format(channelCompositionFromAccountIdResult.rows[0].channel_id);
            client.query(selectAccountChannelReviewStatusForChannel, function(err, accountChannelReviewStatusResult) {
                if(err) {
                    util.errorBotSay('全ユーザーのステータス取得(サマリー)取得時にエラー発生: ' + err)
                    client.end();
                    return;
                }
                let text = bot_message + '\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
                let passing_summary_list = statusResult.rows[0].passing_summary
                summaryResult.rows.forEach((summaryInfo, index) => {
                    let channelPassingSummaryFlag = false
                    let userPassingSummaryFlag = false
                    let userNames = '';
                    accountChannelReviewStatusResult.rows.forEach((userStatus, index) => {
                        userStatus.passing_summary.forEach((summaryId, index) => {
                            if (summaryInfo.id == summaryId) {
                                if (userStatus.account_id == message.user) {
                                    userPassingSummaryFlag = true
                                }
                                userNames = userNames + userStatus.name + ', '
                                return;
                            }
                        });
                    });
                    userNames = (userNames)?'(' + userNames.substr(0, userNames.length-2) + ')':'';
                    let flagText = (userPassingSummaryFlag)?':white_check_mark:':':white_large_square:'
                    text = text + '\n ' + flagText + '  '+ summaryInfo.id + '.  *' + summaryInfo.summary + '*  ' + userNames;
                });
                text = text + '\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
                util.botSay(text, message.channel)
                client.end();
            });
        } else {
            //複数の班に所属していた場合
        }
    });
}

// レビュータイトルと質問の一覧をメッセージで送る
MAIN.sendTitleReviewList = function sendTitleReviewList(channelId, statusResult) {
    let selectQuestionList = config.sql.review.questionList.format(message.text);
    client.query(selectQuestionList, (err, questionListResult) => {
        if (err) {
            util.errorBotSay('レビューチェック実施(サマリー取得)時のデータ取得時にエラー発生: ' + err);
            client.end();
            return;
        }

        if (!questionListResult.rowCount) {
            util.botSay("一致するレビュー一覧がありません。もう一度入力してください。", message.channel)
            return;
        }

        let passingQuestion;
        if(targetChannelList.indexOf(message.channel) >= 0) {
            let selectChannelStatus = config.sql.review.channelStatus.format(message.channel);
            client.query(selectChannelStatus, function(err, channelStatusResult) {
                if(err) {
                    util.errorBotSay('チャンネルのレビューステータス取得時にエラー発生: ' + err)
                    client.end();
                    return;
                }
                passingQuestion = channelStatusResult.rows[0].passing_question;
                formatQuestionList(channelId, questionListResult, passingQuestion);
            }); 

        } else {
            let selectAccountChannelReviewStatusForChannelFromAccountId = config.sql.review.accountChannelStatusFromAccountId.format(message.user);
            client.query(selectAccountChannelReviewStatusForChannelFromAccountId, function(err, accountChannelReviewStatusResult) {
                if(err) {
                    util.errorBotSay('全ユーザーのレビューステータス取得時にエラー発生: ' + err)
                    client.end();
                    return;
                }
                if (accountChannelReviewStatusResult.rowCount == 1) {
                    passingQuestion = accountChannelReviewStatusResult.rows[0].passing_question;
                    formatQuestionList(channelId, questionListResult, passingQuestion);
                } else {
                    //複数の班に所属していた場合
                }
            }); 
        }
    });
}

function formatQuestionList(channelId, questionListResult, passingQuestion) {
    // 一致する項目がない場合
    if (!questionListResult.rowCount) {
        util.botSay('その内容と一致する項目は見当たらないため、もう一度入力をお願いします:bow:', message.channel);
        client.end();
        return;
    }

    let summaryId = questionListResult.rows[0].summary_id;
    // 複数の項目が選択されていた場合
    for (let i in questionListResult.rows) {
        if (questionListResult.rows[i].summary_id != summaryId) {
            util.botSay('複数の選択が確認されました。もう一度、選択してください。', message.channel);
            client.end();
            return;
        }
    }
    let useQuestionList = questionListResult.rows;
    let passingQuestionList = passingQuestion.filter((question, index, array) => {
        return (question.match(`${summaryId}_`))
    });
    // サマリーに該当する全質問のリストを生成
    let questionList = [];
    questionListResult.rows.forEach((questionInfo, index) => {
        let question = questionInfo.question_id;
        questionList.push(`${summaryId}_${question}`);
    })

    let notPassingQuestionList = questionList.concat();
    passingQuestion.forEach((question, index) => {
        let questionIndex = useQuestionList.indexOf(question)
        if (questionIndex >= 0) {
            notPassingQuestionList.splice(questionIndex, 1)
        }
    });
    // メッセージ文作成
    let text = '*' + questionListResult.rows[0].summary + '* のレビューチェック一覧です。';
    text = text + '\n\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ ';
    questionListResult.rows.forEach((questionInfo, index) => {
        // 合格した項目かチェック
        let showQuestionFlag = false

        passingQuestionList.forEach((question, index) => {
            let questionId = question.replace(`${summaryId}_`, '')
            if (questionInfo.question_id == questionId) {
                showQuestionFlag = true
                return;
            }
        });
        
        let flagText = '';
        let flagStrike = '';
        if (targetChannelList.indexOf(message.channel) == -1) {
            flagText = ':white_large_square:';
            if (showQuestionFlag) {
                flagText = ':white_check_mark:';
                flagStrike = '~';
            }
        }
        
        let question_text = questionInfo.question;
        if ( question_text.match(/\\n/)) {
            question_text = question_text.replace(/\\n/g, flagStrike + '\n');
            question_text = question_text.replace(/→/g, flagStrike + '→');
        }

        // 質問項目の作成
        function questionTextGenerate() {
            if (index == 0){
                text = text + '\n\n ' + questionInfo.title_number + '. *' + questionInfo.title + '*';
            } else if (questionInfo.title_number != questionListResult.rows[index-1].title_number) {
                text = text + '\n\n ' + questionInfo.title_number + '. *' + questionInfo.title + '*';
            }
            text = text + '\n        ' + flagText + '   '+ flagStrike + questionInfo.title_number +'-' + questionInfo.question_number +'. ' + question_text + flagStrike;
        }

        if (message.text.match(/OK/i) && message.text.match(/NG/i)) {
            questionTextGenerate();
        } else if (message.text.match(/OK/i)) {
            if (showQuestionFlag) {
                questionTextGenerate();
            }
        } else if (message.text.match(/NG/i)) {
            if (showQuestionFlag == false) {
                questionTextGenerate();
            }
        } else {
            questionTextGenerate();
        }
    });
    text = text + '\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~';
    util.botSay(text, message.channel);
    util.updateStatus(1, 1, targetChannelList);
}

function sendReviewSummaryListAll (message) {
    let selectSummaryList = config.sql.review.summaryList;
    client.query(selectSummaryList, function(err, summaryResult) {
        if(err) {
            util.errorBotSay('レビュアーサマリー一覧取得時にエラー発生: ' + err);
            client.end();
            return;
        }
        let channelStatusForReviewer = config.sql.review.channelStatusForReviewer.format(message.user)
        client.query(channelStatusForReviewer, function(err, channelStatusForReviewerResult) {
            if(err) {
                util.errorBotSay('レビュー全班一覧取得時にエラー発生: ' + err);
                client.end();
                return;
            }
            let text = '各班のレビュー状況です。\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~';
            channelStatusForReviewerResult.rows.forEach((channelStatus, index) => {
                let groupId = channelStatus.group_id;
                let memberListText = ''
                let accountChannelStatus = config.sql.review.accountChannelStatus.format(channelStatus.channel_id)                
                client.query(accountChannelStatus, function(err, allAccountStatusResult) {
                    if(err) {
                        util.errorBotSay('班員一覧取得時にエラー発生: ' + err);
                        client.end();
                        return;
                    }
                    allAccountStatusResult.rows.forEach((AccountStatusResult, index, array) => {
                        memberListText = memberListText + AccountStatusResult.name +', '
                    })
                    memberListText = memberListText.substr( 0, memberListText.length-2 );
                    let channelName = channelStatus.name;
                    text = text + `\n \`${channelName}\`  (${memberListText})`;
                    summaryResult.rows.forEach((summaryInfo, index) => {
                        let flagText = (channelStatus.passing_summary.indexOf(summaryInfo.id.toString()) >= 0)?':white_check_mark:':':white_large_square:';
                        text = text + '\n ' + flagText + '  '+ summaryInfo.id + '.  *' + summaryInfo.summary + '*';
                    })
                    text = text + '\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~';
                    if ((channelStatusForReviewerResult.rowCount - 1)  == index) {
                        util.botSay(text, message.channel);
                    }
                    util.updateStatus(1, 1, targetChannelList);
                });
            })
        });
    });
}