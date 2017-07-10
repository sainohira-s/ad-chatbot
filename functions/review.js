"use strict"
let MAIN = {};
exports.REVIEW = MAIN;

let config = require('config');
let util = require('./utility.js').UTIL;
let reviewList = require('./review_list.js').REVIEWLIST;
let reviewCheck = require('./review_check.js').REVIEWCHECK;

// レビューの段階によって処理を分ける
MAIN.reviewProcess = function reviewProcess(message, statusResult, channelId, bot_message) {
    switch (statusResult.rows[0].stage) {
    case 1:
        if (message.event != 'ambient') {
            reviewList.sendSummaryReviewList(statusResult, channelId, bot_message);
        }
        break;
    case 2:
        reviewList.sendTitleReviewList(channelId, statusResult);
        break;
    case 3:
        reviewCheck.reviewCheck(channelId, statusResult);
        break;
    default:
        break;
    }
}