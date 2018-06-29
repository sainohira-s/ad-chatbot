"use strict"

if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

let Botkit = require('botkit');
let config = require('config');
let pg = require('pg');
let async = require('async');
let request = require('request');

// function定義ファイルの読み込み
let util = require('./functions/utility.js').UTIL;
let reviewList = require('./functions/reviewListFunction.js').REVIEWLIST;
let review = require('./functions/reviewFunction.js').REVIEW;
let selfMsg = require('./functions/selfishMessage.js');
let reviewCheck = require('./functions/review_check.js').REVIEWCHECK;
let scMsg = require('./functions/scheduleMessage.js');
let botPlacement = require('./functions/botPlacement.js');

let controller = Botkit.slackbot({
    debug: false,
}).configureSlackApp(
  {
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    scopes: ['bot'],
  }
);

// 各班ごとに受け取ったワードを一時的に格納するディレクトリ
let channelWordDic = {}

// PostgreSQL
let connectionString = process.env.connectionstring;
let client = new pg.Client(connectionString);

// チャットボットが追加されているチャンネルののリストを生成
let targetChannelList;
client.connect((err) => {
    if (err) {
        console.log('error: ' + err);
        return;
    }
    targetChannelList = [];
    let selectChannels = config.sql.channels;
    client.query(selectChannels, (err, channelsResult) => {
        if (err) {
            console.log(err)
            client.end();
            return;
        }
        channelsResult.rows.forEach((channelInfo, index, array) => {
            targetChannelList.push(channelInfo.channel_id);
        });
        client.end();
    });
});

// controller定義ファイルの読み込み
let cancelController = require('./controller/cancelController.js').CANCEL;
cancelController.startController(connectionString, controller, channelWordDic);
let manageController = require('./controller/manageController.js').MANAGE;
manageController.startController(connectionString, controller, channelWordDic);
let famousQuotesController = require('./controller/famousQuotesController.js').FAMOUSQUOTES;
famousQuotesController.startController(controller);
let reviewListController = require('./controller/reviewListController.js').REVIEWLIST;
reviewListController.startController(connectionString, controller, channelWordDic);
let reviewController = require('./controller/reviewController.js').REVIEW;
reviewController.startController(connectionString, controller, channelWordDic);

let bot = controller.spawn({
    token: process.env.token
}).startRTM(function(err, bot, payload){
    if (err) {
        throw new Error(err);
    }
    scMsg.says(bot);
});

controller.setupWebserver(process.env.port,function(err, webserver) {
  controller.createWebhookEndpoints(controller.webserver)
  controller.createHomepageEndpoint(controller.webserver)

  controller.createOauthEndpoints(controller.webserver,function(err,req,res) {
    if (err) {
      res.status(500).send('ERROR: ' + err);
    } else {
      res.send('Success!');
    }
  });
});

controller.on('interactive_message_callback', function(bot, message) {
    // **************
    // レビュー一覧操作
    // **************
    if ('reviewList' == message.callback_id){
        // レビュー一覧のタイトルを表示
        reviewList.setProperty(bot, message, channelWordDic, targetChannelList);
        reviewList.sendReviewTitleList('reviewListDetails');
        return;
    } else if ('reviewListDetails' == message.callback_id) {
        // レビュー一覧の詳細を表示 
        reviewList.setProperty(bot, message, channelWordDic, targetChannelList);
        reviewList.sendReviewDetailList();
        return;
    }

    // **************
    // レビュー回答操作
    // **************
    if ('startReviewList' == message.callback_id) {
        // レビュー一覧のタイトルを表示
        reviewList.setProperty(bot, message, channelWordDic, targetChannelList);
        reviewList.sendReviewTitleList('startReviewListDetails');
        return;
    } else if ('startReviewListDetails' == message.callback_id) {
        // レビュー開始
        review.setProperty(bot, message, channelWordDic, targetChannelList);
        review.sendReviewQuestionDetailList();
        return;
    } else if ('nextStepReview' == message.callback_id) {
        // 「次へ」押下後の処理
        review.setProperty(bot, message, channelWordDic, targetChannelList);
        review.sendReviewQuestionDetailListForNextStep();
        return;
    } else if ('checkedReview' == message.callback_id) {
        // 「OK」「NG」押下後の処理
        review.setProperty(bot, message, channelWordDic, targetChannelList);
        review.sendReviewQuestionDetailListForAns();
        return;
    }

    bot.replyInteractive(message, {
        text: '...',
        attachments: [
            {
                title: 'My buttons',
                callback_id: '123',
                attachment_type: 'default',
                actions: [
                    {
                        "name":"yes",
                        "text": "Yes!",
                        "value": "yes",
                        "type": "button",
                    },
                    {
                       "text": "No!",
                        "name": "no",
                        "value": "delete",
                        "style": "danger",
                        "type": "button",
                        "confirm": {
                          "title": "Are you sure?",
                          "text": "This will do something!",
                          "ok_text": "Yes",
                          "dismiss_text": "No"
                        }
                    }
                ]
            }
        ]
    });
});


controller.on('create_bot',function(bot,config) {

//   if (_bots[bot.config.token]) {
//     // already online! do nothing.
//   } else {
//     bot.startRTM(function(err) {

//       if (!err) {
//         trackBot(bot);
//       }

//       bot.startPrivateConversation({user: config.createdBy},function(err,convo) {
//         if (err) {
//           console.log(err);
//         } else {
//           convo.say('I am a bot that has just joined your team');
//           convo.say('You must now /invite me to a channel so that I can be of use!');
//         }
//       });
//     });
//   }
});

// Handle events related to the websocket connection to Slack
controller.on('rtm_open',function(bot) {
  console.log('** The RTM api just connected!');
});

controller.on('rtm_close',function(bot) {
  console.log('** The RTM api just closed');
  // you may want to attempt to re-open
});

controller.hears('', 'ambient,direct_message,direct_mention,mention', (bot, message) => {
    // SQLクエリに影響する文字列を置換
    message.text = message.text.replace(/'/g,"''");
    let channelId = message.channel;
    let accountId = message.user;

    client = new pg.Client(connectionString);
    client.connect((err) => {
        if (err) {
            console.log('error: ' + err);
            return;
        }
        // Utilityのプロパティ設定
        util.setProperty(bot, message, client);
        util.accoutAccessCountUp();

        let selectStatus = config.sql.channelStatus.format(channelId);
        // ダイレクトメッセージで受けた場合
        if (targetChannelList.indexOf(message.channel) == -1) {
             selectStatus = config.sql.accountChannelStatus.format(accountId);
        }
        client.query(selectStatus, (err, statusResult) => {
            if (err) {
                util.botSay('現在のステータス取得時にエラー発生: ' + err);
                client.end();
                return;
            }
            if (statusResult.rowCount > 0){
                // 現在のステータスにより処理を分ける
                switch (statusResult.rows[0].current_type_id) {
                case config.messageType.message.id:
                    // ノンステータス
                    let selectMessage = config.sql.messageSearch.format(message.text)
                    client.query(selectMessage, (err, resultMessage) => {
                        if(err) {
                            console.log('現在のステータスが0ときのメッセージ取得時にエラー発生: ' + err);
                            client.end();
                            return;
                        }
                        if (resultMessage.rowCount == 1){
                            // Messageの持つステータスにより処理を分ける
                            switch (resultMessage.rows[0].type_id) {
                            case config.messageType.message.id:
                                // 連続した対話が発生していない場合の処理
                                if (message.event != 'ambient') {
                                    // ボットに向けた発言に対する処理
                                    selfMsg.replyMessage(bot, message, resultMessage);
                                }
                                break;
                            case config.messageType.selfReviewList.id:
                                // レビュー一覧に関する対話が発生している場合
                                if (message.event != 'ambient') {
                                    util.updateStatus(2, 2, targetChannelList);
                                    reviewList.setProperty(bot, message, channelWordDic, targetChannelList)
                                    review.reviewProcess(message, statusResult, channelId, resultMessage.rows[0].message[0])
                                } else {
                                    util.botSay('メンションもしくは、ダイレクトメッセージから始めてください。', message.channel);
                                }
                                break;
                            case config.messageType.selfReviewCheck.id:
                                // レビューチェックの対話がしている場合
                                if (message.event == 'direct_message') {
                                    util.updateStatus(3, 3, targetChannelList);
                                    reviewList.setProperty(bot, message, channelWordDic, targetChannelList)
                                    reviewCheck.setProperty(bot, message, channelWordDic, targetChannelList)
                                    review.reviewProcess(message, statusResult, channelId, resultMessage.rows[0].message[0])
                                } else {
                                    util.botSay('ダイレクトメッセージからのみ利用可能です。', message.channel);
                                }
                                break;
                            case config.messageType.regularWord.id:
                                break;
                            case config.messageType.channelMessage.id:
                                selfMsg.replyMessage(bot, message, resultMessage);
                            default :
                            }
                            client.end();
                        } else if (resultMessage.rowCount > 1) {
                            client.end();
                            if (message.event != 'ambient') {
                                util.botSay('(んー、なんと答えるのがべきなのか...。。:disappointed_relieved:)\n端的に話してくれると嬉しいな！', message.channel);
                            }
                        } else {
                            client.end();
                            if (message.event != 'ambient') {
                                request({
                                    url: 'https://api.a3rt.recruit-tech.co.jp/talk/v1/smalltalk',
                                    method: 'POST',
                                    form: { apikey: process.env.a3rt_talk_apikey, query: message.text },
                                    json:  true
                                }, (err, response, body) => {
                                    if (body.status == 0) {
                                        bot.reply(message, `${body.results[0].reply}`);
                                    } else {
                                        console.log(`TalkAPI ERROR: ${err}`);
                                    }
                                });
                            }
                        }
                    });
                    break;
                case config.messageType.selfReviewList.id:
                    // レビューリスト確認機能操作中ステータス
                    reviewList.setProperty(bot, message, channelWordDic, targetChannelList)
                    review.reviewProcess(message, statusResult, channelId, null)
                    client.end();
                    break;
                case config.messageType.selfReviewCheck.id:
                    // レビューチェック開始
                    reviewList.setProperty(bot, message, channelWordDic, targetChannelList)
                    reviewCheck.setProperty(bot, message, channelWordDic, targetChannelList)
                    review.reviewProcess(message, statusResult, channelId, null)
                    client.end();
                   break;
                default: 
                    client.end();
                    break;
                }
            }
        });
    });
});

controller.hears('',['bot_channel_join'],function(bot, message) {
    botPlacement.joinChannel(bot, message, targetChannelList);
});

controller.hears('',['user_channel_join'],function(bot, message) {
    botPlacement.accountJoin(bot, message);
});

//Stringにformatファンクションを追加
if (String.prototype.format == undefined) {
  String.prototype.format = function(arg)
  {
    let rep_fn = undefined;
    if (typeof arg == "object") {
      rep_fn = function(m, k) { return arg[k]; }
    }
    else {
      let args = arguments;
      rep_fn = function(m, k) { return args[ parseInt(k) ]; }
    }
    return this.replace( /\{(\w+)\}/g, rep_fn );
  }
}