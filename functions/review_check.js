"use strict"
let MAIN = {};
exports.REVIEWCHECK = MAIN;

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

// レビューの段階によって処理を分ける
MAIN.reviewCheck = function reviewCheck(channelId, statusResult) {
    if (targetChannelList.indexOf(channelId) == -1) {
        let selectAccountChannelStatus = config.sql.review.accountChannelStatusFromAccountId.format(message.user)
        client.query(selectAccountChannelStatus, (err, accountChannelStatusResult) => {
            if (err) {
                util.errorBotSay('レビューチェック実施(レビューステータス取得)時のデータ取得時にエラー発生: ' + err);
                client.end();
                return;
            }
            let selectSummay;
            let firstFlg = false;
            let currentSummaryId = accountChannelStatusResult.rows[0].current_summary_id
            if (currentSummaryId == 0) {
                selectSummay = config.sql.review.summaryFromKeyword.format(message.text)
                firstFlg = true;
            } else {
                selectSummay = config.sql.review.summaryFromId.format(currentSummaryId)
            }
            client.query(selectSummay, (err, summaryResult) => {
                if (err) {
                    util.errorBotSay('レビューチェック実施(サマリー取得)時のデータ取得時にエラー発生: ' + err);
                    client.end();
                    return;
                }
                if (firstFlg) {
                    channelWordDic[channelId] = ""
                    if (message.text.match(/OK/i)) {
                        channelWordDic[channelId] = 'OK';
                    } else if (message.text.match(/NG/i)) {
                        channelWordDic[channelId] = 'NG';
                    }
                    
                    if (summaryResult.rowCount == 0){
                        util.botSay('1つの項目を選択してください。', channelId);
                        return;
                    } else if (summaryResult.rowCount > 1){
                        util.botSay('複数の選択が確認されました。もう一度、選択してください。', channelId);
                        return;
                    }
                }
                indicateQuestion(summaryResult, accountChannelStatusResult, channelId);
            });
        });
    }
}

function indicateQuestion(summaryResult, accountChannelStatusResult, channelId) {
    let currentSummaryId = summaryResult.rows[0].id
    let currentCategotyId = summaryResult.rows[0].category_id
    let summaryTitleCategory = summaryResult.rows[0].category_id
    let passingQuestionList = accountChannelStatusResult.rows[0].passing_question
    let passingQuestionIdList = []
    passingQuestionList.forEach((value, index) => {
        if (value.match(`${currentSummaryId}_`)){
            passingQuestionIdList.push(parseInt(value.replace(`${currentSummaryId}_`, '')));
        } else if (value.match(`0_0`)){
            passingQuestionIdList.push(0);
        }
    });
    let selectQuestionListForTitle = config.sql.review.questionListForTitle.format(currentCategotyId);
    if (channelWordDic[channelId] == 'OK') {
        selectQuestionListForTitle = config.sql.review.okQuestionListForTitle.format(currentCategotyId, passingQuestionIdList);
    } else if (channelWordDic[channelId] == 'NG') {
        selectQuestionListForTitle = config.sql.review.ngQuestionListForTitle.format(currentCategotyId, passingQuestionIdList);
    }
    client.query(selectQuestionListForTitle, (err, questionListForTitleResult) => {
        if(err) {
            util.errorBotSay('レビューチェック実施(質問一覧取得)時のデータ取得時にエラー発生: ' + err);
            client.end();
            return;
        }
        if (!questionListForTitleResult.rowCount) {
            util.botSay('該当する項目がありませんでした。もう一度入力してください。', channelId);
            return;
        }

        let text = '';
        let questionNumber = parseInt(accountChannelStatusResult.rows[0].current_question);
        if (accountChannelStatusResult.rows[0].current_summary_id == 0) {
            text = text + '`' + summaryResult.rows[0].summary + '` のレビューチェック(全 `' + questionListForTitleResult.rowCount + '` 項目)を開始します。OK/NGで回答してください。';
            questionNumber = parseInt(questionListForTitleResult.rowCount - 1 );
            text = text + '\n' + questionListForTitleResult.rows[questionNumber].title_number + '. *' + questionListForTitleResult.rows[questionNumber].title + '* \n';
            text = text + '```\n        ' + questionListForTitleResult.rows[questionNumber].title_number +'-' + questionListForTitleResult.rows[questionNumber].question_number +'. ' + questionListForTitleResult.rows[questionNumber].question + '\n```';
            util.botSay(text, channelId);
            util.updateReviewStatus(null, null, currentSummaryId, questionNumber, targetChannelList);
        } else {
            let judge = false;
            if (message.text.match(/OK/i) && message.text.match(/NG/i)) {
                util.botSay('OKかNGか判断できませんでした。もう一度入力をお願いします。', channelId);
                return;                        
            } else if (message.text.match(/OK/i)) {
                judge = true;
            } else if (message.text.match(/NG/i)) {
                judge = false;
            } else {
                util.botSay('OKか、NGで答えてください。(「キャンセル」で途中終了も可能です。)', channelId);
                return;
            }
            let passingQuestion = currentSummaryId + "_" + questionListForTitleResult.rows[questionNumber].question_id;
            let passingQuestionList = accountChannelStatusResult.rows[0].passing_question;
            let index = passingQuestionList.indexOf(passingQuestion);
            if (index >= 0) {
                if (!judge) {
                    passingQuestionList.splice(index, 1);
                }
            } else {
                if (judge){
                    passingQuestionList.push(passingQuestion);
                }
            }
            let passingQuestionListStr = fromArrayToString(passingQuestionList);
            let setPhrase = `passing_question = ARRAY[${passingQuestionListStr}]`;
            let updatePassingQuestion = config.sql.review.update.accountChannelStatus.format(setPhrase, accountChannelStatusResult.rows[0].channel_id, message.user);
            client.query(updatePassingQuestion, (err, result) => {
                if(err) {
                    util.errorBotSay('レビュー質問一覧更新時にエラー発生: ' + err);
                    client.end();
                    return;
                }
                questionNumber = questionNumber - 1;
                if (questionNumber == -1) {
                    channelWordDic[channelId] = '';
                    util.updateStatus(1, 1, targetChannelList);
                    util.updateReviewStatus(null, null, 0, 0, targetChannelList);
                    MAIN.updateReviewSummaryResult(accountChannelStatusResult, channelId, currentSummaryId, false);
                    return;
                }
                if (questionNumber == questionListForTitleResult.rowCount -1) {
                    text = text + '\n' + questionListForTitleResult.rows[questionNumber].title_number + '. *' + questionListForTitleResult.rows[questionNumber].title + '* \n';
                } else if (questionListForTitleResult.rows[questionNumber].title_number != questionListForTitleResult.rows[Number(questionNumber+1)].title_number) {
                    text = text + '\n' + questionListForTitleResult.rows[questionNumber].title_number + '. *' + questionListForTitleResult.rows[questionNumber].title + '* \n';
                }

                text = text + '```\n        ' + questionListForTitleResult.rows[questionNumber].title_number +'-' + questionListForTitleResult.rows[questionNumber].question_number +'. ' + questionListForTitleResult.rows[questionNumber].question + '\n```';
                util.botSay(text, channelId);
                util.updateReviewStatus(null, null, null, questionNumber, targetChannelList);
            });
        }
    });
}

MAIN.updateReviewSummaryResult= function updateReviewSummaryResult(oldStatusResult, channelId, summaryId, isCancel) {
    let selectChannelStatus = config.sql.review.accountChannelStatusFromAccountId.format(message.user)
    client.query(selectChannelStatus, (err, statusResult) => {
        if(err) {
            util.errorBotSay('レビューサマリーアップデート時のステータス確認時にエラー発生: ' + err);
            client.end();
            return;
        }
        let selectQuestionListFromSummaryId = config.sql.review.questionListFromSummaryId.format(summaryId)
        client.query(selectQuestionListFromSummaryId, (err, questionListResult) => {
            if(err) {
                util.errorBotSay('レビューサマリーアップデート時の質問リスト取得時にエラー発生: ' + err);
                client.end();
                return;
            }
            let text = 'セルフレビューチェック終了です。お疲れ様でした。\n'
            // 全ユーザーの情報(ステータス)を取得
            let selectSummaryAndQuestionListFromAccountId = config.sql.review.summaryAndQuestionListFromAccountId.format(oldStatusResult.rows[0].channel_id)
            client.query(selectSummaryAndQuestionListFromAccountId, (err, summaryAndQuestionListResult) => {
                if(err) {
                    util.errorBotSay('ユーザーのステータス更新時のユーザーステータス取得時にエラー発生: ' + err);
                    client.end();
                    return;
                }
                // 全ユーザーの中からユーザーの情報を抽出
                let summaryIdStr;
                let accountName;
                let accountChannelId;
                let accountChannelName;
                let accountPassingSummaryList;
                let accountPassingQuestionList;
                let channelPassingSummaryList;
                let channelPassingQuestionList;
                summaryAndQuestionListResult.rows.forEach((accountStatusInfo, index) => {
                    if (accountStatusInfo.account_id == message.user) {
                        summaryIdStr= summaryId.toString();
                        accountName = accountStatusInfo.account_name;
                        accountChannelId = accountStatusInfo.channel_id;
                        accountChannelName = accountStatusInfo.channel_name;
                        accountPassingSummaryList = accountStatusInfo.a_passing_summary;
                        accountPassingQuestionList = accountStatusInfo.a_passing_question;
                        channelPassingSummaryList = accountStatusInfo.c_passing_summary;
                        channelPassingQuestionList = accountStatusInfo.c_passing_question;
                    }
                });
                
                // サマリーに該当する全質問のリストを生成
                let questionList = [];
                let allOkFlag = true;
                questionListResult.rows.forEach((questionInfo, index) => {
                    let question = questionInfo.question_id;
                    questionList.push(`${summaryId}_${question}`);
                    if (accountPassingQuestionList.indexOf(`${summaryId}_${question}`) == -1 && allOkFlag) {
                        allOkFlag = false;
                    }
                })
                
                // 全て合格の場合
                if (allOkFlag) {
                    // 班チャンネル以外からのメッセージの場合
                    if (accountPassingSummaryList.indexOf(questionListResult.rows[0].summary_id.toString()) == -1) {
                        accountPassingSummaryList.push(summaryId);
                    }
                    let setPhrase = `passing_summary = ARRAY[${accountPassingSummaryList}]`
                    let updatePassingSummary = config.sql.review.update.accountChannelStatus.format(setPhrase, oldStatusResult.rows[0].channel_id, message.user)
                    client.query(updatePassingSummary, (err, result) => {
                        if(err) {
                            util.errorBotSay('レビューサマリー更新時にエラー発生: ' + err);
                            client.end();
                            return;
                        }
                    });
                    // 班全員が合格しているのかチェック
                    let allPassingFlag = true;
                    summaryAndQuestionListResult.rows.forEach((accountStatusInfo, index) => {
                        questionList.forEach((question, index) => {
                            if (accountStatusInfo.a_passing_question.indexOf(question) == -1) {
                                allPassingFlag = false;
                                return;
                            }
                        });
                        if (allPassingFlag == false) {
                            return;
                        }
                    });

                    if (isCancel) {
                        return;
                    } else {
                        if (allPassingFlag) {
                            // 班全員が合格場合
                            if (channelPassingSummaryList.indexOf(`${summaryIdStr}`) == -1) {
                                // 班のステータスが合格状態でない場合
                                // 合格したサマリーを更新するためのリストを生成
                                channelPassingSummaryList.push(summaryId)
                                
                                // ユーザーの回答を元にチャンネルのレビュー合格ステータスを更新
                                // 指定されたサマリーに該当する合格項目を抽出
                                let passingQuestionListForSummary = accountPassingQuestionList.filter((passingQuestion, index, array) => {
                                    return passingQuestion.match(`${summaryId}_`);
                                });
                                // チャンネルの合格ステータスに存在しない項目を追加
                                passingQuestionListForSummary.forEach((passingQuestion, index) => {
                                    if (channelPassingQuestionList.indexOf(passingQuestion) == -1) {
                                        channelPassingQuestionList.push(passingQuestion);
                                    }
                                });
                                let passingQuestionListStr = fromArrayToString(channelPassingQuestionList);

                                let setPhraseForReviewChannelStatus = `passing_summary = ARRAY[${channelPassingSummaryList}]`
                                // 班のチャンネルのステータスを合格へ更新する
                                let updateReviewChannelStatus = config.sql.review.update.channelStatus.format(setPhraseForReviewChannelStatus, accountChannelId);
                                client.query(updateReviewChannelStatus, (err, result) => {
                                    if(err) {
                                        util.errorBotSay('ユーザーのステータス更新時の全ユーザーステータス取得時にエラー発生: ' + err);
                                        client.end();
                                        return;
                                    }
                                    let selectChanelFromReviewerFlg = config.sql.channelFromReviewerFlg.format('true')
                                    client.query(selectChanelFromReviewerFlg, (err, resultChanelFromReviewerFlg) => {
                                        if(err) {
                                            util.errorBotSay('レビューアーへ通知処理(レビュー完了)時にエラー発生: ' + err);
                                            client.end();
                                            return;
                                        }
                                        if (resultChanelFromReviewerFlg.rowCount > 0) {
                                            resultChanelFromReviewerFlg.rows.forEach((channelInfo,index) =>{
                                                util.botSay(accountChannelName + 'が `' + questionListResult.rows[0].summary + '` のセルフレビューチェックを完了しました。', channelInfo.channel_id);
                                            });
                                        }
                                    });
                                    util.botSay(accountName + 'さんが `' + questionListResult.rows[0].summary + '` のセルフレビューチェックを完了しました。', accountChannelId)
                                    text = text + '\n班員に `'+ questionListResult.rows[0].summary + '` のセルフレビューチェックが完了したことを通知しました。';
                                    util.botSay(text + '\n班全員がセルフレビューチェックを完了したため、レビュアーメンバーのチャンネルに完了した旨を通知しました。', channelId);
                                    client.end();
                                    return;
                                });
                            // 既に合格している場合                                    
                            } else {
                                util.botSay(text + '所属されている班では `'+ questionListResult.rows[0].summary + '` は既に合格しているので、レビュアーと班員への通知は不要ですね。', channelId);
                                client.end();
                                return;
                            }
                        } else {
                            bot.startConversation(message, (err, convo) => {
                                convo.ask(
                                    'チャンネルで合格判定にしますか？ はい/いいえ\n(レビューアチームに合格したことを通知します。)',
                                    [
                                        {
                                            pattern: 'はい',
                                            callback: (response, convo) => {
                                                convo.say('チャンネルを合格に更新しました。');
                                                updateChannelPassingSummary(channelId, accountChannelId, accountChannelName, accountName, summaryId, channelPassingSummaryList, channelPassingQuestionList, accountPassingQuestionList, questionListResult, text);
                                                convo.next();
                                            }
                                        },
                                        {
                                            pattern: 'いいえ',
                                            callback: (response, convo) => {
                                                convo.say('では、他のメンバーの合格を待ちますね。');
                                                util.botSay(accountName + 'さんが `' + questionListResult.rows[0].summary + '` のセルフレビューチェックを完了しました。', accountChannelId)
                                                util.botSay(text + '\n班員に `'+ questionListResult.rows[0].summary + '` のセルフレビューチェックが完了したことをお伝えました。', channelId);
                                                client.end();
                                                convo.next();
                                            }
                                        },
                                        {
                                            default: true,
                                            callback: (response, convo) => {
                                                convo.say('`はい` か `いいえ` でお願いします。 :bow: ');
                                                convo.repeat();
                                                convo.next();
                                            }
                                        }
                                    ]);
                            });
                            return;
                        }
                    }
                } else {
                    //　不合格項目がある場合
                    let questionInfoList = questionListResult.rows
                    // 全質問のIDリスト
                    let questionIdList = [];
                    questionInfoList.forEach((questionInfo) => {
                        questionIdList.push(questionInfo.question_id)
                    });
                    // OK判定の質問IDリスト
                    let passingQuestionIdList = []
                    statusResult.rows[0].passing_question.forEach((value) => {
                        if (value.match(`${summaryId}_`)) {
                            let questionId = value.replace(`${summaryId}_`, '')
                            passingQuestionIdList.push(parseInt(questionId))    
                        }
                    });
                    // NG判定の質問IDリスト
                    let nonPassingQuestionIdList = questionIdList.filter((questionId, index) => {
                        return !(passingQuestionIdList.indexOf(questionId) >= 0)
                    });
                    text = text + '`' + questionListResult.rows[0].summary + '` のNGだった項目は以下のとおりです。\n\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ \n'
                    questionInfoList.forEach((questionInfo) => {
                        if (nonPassingQuestionIdList.indexOf(questionInfo.question_id) >= 0) {
                            if (!text.match(questionInfo.title)) {
                                text = text + '\n\n ' + questionInfo.title_number + '. *' + questionInfo.title + '*'
                            }
                            let flagText = ':white_large_square:'
                            let questionText = questionInfo.question
                            if (questionText.match(/\\n/)) {
                                questionText = questionText.replace(/\\n/g, '\n');
                                questionText = questionText.replace(/→/g, '→');
                            }
                            text = text + '\n        ' + flagText + '   ' + questionInfo.title_number +'-' + questionInfo.question_number +'. ' + questionText
                        }
                    });
                    text = text + '\n\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'

                    let accountChannelPassingSummary = accountPassingSummaryList.indexOf(`${summaryIdStr}`)
                    let channelPassingSummary = channelPassingSummaryList.indexOf(`${summaryIdStr}`)
                    // 既に合格していた場合(個人)
                    if (accountChannelPassingSummary >= 0) {
                        accountPassingSummaryList.splice(accountChannelPassingSummary, 1)
                        let setPhraseForReviewChannelStatus = `passing_summary = ARRAY[${accountPassingSummaryList}]` 
                        console.log(setPhraseForReviewChannelStatus)
                        let updateAccountChannelStatus = config.sql.review.update.accountChannelStatus.format(setPhraseForReviewChannelStatus, accountChannelId, message.user);
                        client.query(updateAccountChannelStatus, (err, result) => {
                            if(err) {
                                util.errorBotSay('ユーザーのステータス更新時の全ユーザーステータス取得時にエラー発生: ' + err);
                                client.end();
                                return;
                            }
                            // 既に合格していた場合(チャンネル)
                            if (channelPassingSummary >= 0 && !isCancel) {
                                // 不合格となった質問一覧(サマリー)を更新する
                                channelPassingSummaryList.splice(channelPassingSummary, 1)
                                let setPhraseForReviewChannelStatus = `passing_summary = ARRAY[${channelPassingSummaryList}]` 
                                let updateChannelStatus = config.sql.review.update.channelStatus.format(setPhraseForReviewChannelStatus, accountChannelId);
                                client.query(updateChannelStatus, (err, result) => {
                                    if(err) {
                                        util.errorBotSay('ユーザーのステータス更新時の全ユーザーステータス取得時にエラー発生: ' + err);
                                        client.end();
                                        return;
                                    }
                                    let selectChanelFromReviewerFlg = config.sql.channelFromReviewerFlg.format('true')
                                    client.query(selectChanelFromReviewerFlg, (err, resultChanelFromReviewerFlg) => {
                                        if(err) {
                                            util.errorBotSay('レビューアーへ通知処理(レビュー不合格完了)時にエラー発生: ' + err);
                                            client.end();
                                            return;
                                        }
                                        if (resultChanelFromReviewerFlg.rowCount > 0) {
                                            resultChanelFromReviewerFlg.rows.forEach((channelInfo,index) => {
                                                util.botSay(text + '\n' + accountChannelName + 'が `' + questionListResult.rows[0].summary + '` のセルフレビューチェック(個人)で不合格がでたため【合格 → 不合格】になりました。', channelInfo.channel_id)
                                            });
                                        }
                                    });
                                    util.botSay(text + '\n班の合格ステータスが不合格に変更されたことをレビュアーメンバーへ通知しました。', channelId)
                                    client.end();
                                    return;
                                });
                            } else {
                                client.end();
                                return;
                            }
                        });
                    } else {
                        util.botSay(text, channelId)
                    }
                }
            });
        });
    });
}

function updateChannelPassingSummary(channelId, accountChannelId, accountChannelName, accountName, summaryId, channelPassingSummaryList, channelPassingQuestionList, accountPassingQuestionList, questionListResult, text) {
    // 合格したサマリーを更新するためのリストを生成
    channelPassingSummaryList.push(summaryId)

    // ユーザーの回答を元にチャンネルのレビュー合格ステータスを更新
    // 指定されたサマリーに該当する合格項目を抽出
    let passingQuestionListForSummary = accountPassingQuestionList.filter((passingQuestion, index, array) => {
        return passingQuestion.match(`${summaryId}_`);
    });
    // チャンネルの合格ステータスに存在しない項目を追加
    passingQuestionListForSummary.forEach((passingQuestion, index) => {
        if (channelPassingQuestionList.indexOf(passingQuestion) == -1) {
            channelPassingQuestionList.push(passingQuestion);
        }
    });
    let passingQuestionListStr = fromArrayToString(channelPassingQuestionList);

    let setPhraseForReviewChannelStatus = `passing_summary = ARRAY[${channelPassingSummaryList}]`
    // 班のチャンネルのステータスを合格へ更新する
    let updateReviewChannelStatus = config.sql.review.update.channelStatus.format(setPhraseForReviewChannelStatus, accountChannelId);
    client.query(updateReviewChannelStatus, (err, result) => {
        if(err) {
            util.errorBotSay('ユーザーのステータス更新時の全ユーザーステータス取得時にエラー発生: ' + err);
            client.end();
            return;
        }
        let selectChanelFromReviewerFlg = config.sql.channelFromReviewerFlg.format('true')
        client.query(selectChanelFromReviewerFlg, (err, resultChanelFromReviewerFlg) => {
            if(err) {
                util.errorBotSay('レビューアーへ通知処理(個人レビュー完了)時にエラー発生: ' + err);
                client.end();
                return;
            }
            if (resultChanelFromReviewerFlg.rowCount > 0) {
                resultChanelFromReviewerFlg.rows.forEach((channelInfo,index) => {
                    util.botSay(accountChannelName + 'が `' + questionListResult.rows[0].summary + '` のセルフレビューチェックを完了しました。', channelInfo.channel_id);
                });
            }
        });
        util.botSay(accountName + 'さんが `' + questionListResult.rows[0].summary + '` のセルフレビューチェックを完了しました。', accountChannelId)
        text = text + '\n班員に `'+ questionListResult.rows[0].summary + '` のセルフレビューチェックが完了したことを通知しました。';
        util.botSay(text + '\n班全員がセルフレビューチェックを完了したため、レビュアーメンバーのチャンネルに完了した旨を通知しました。', channelId);
        client.end();
        return;
    });
}

function fromArrayToString(arrayList) {
    let arrayListStr = ''
    arrayList.forEach((value) => {
        arrayListStr = arrayListStr + `'${value}', `
    });
    arrayListStr = (arrayListStr)?arrayListStr.substr(0, arrayListStr.length-2):`''` ;
    return arrayListStr
}