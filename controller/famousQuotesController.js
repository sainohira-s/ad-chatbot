"use strict"
let MAIN = {};
exports.FAMOUSQUOTES = MAIN;
let pg = require('pg');
let config = require('config');
let request = require('request');
let parseString = require('xml2js').parseString;

let util = require('../functions/utility.js').UTIL;

let controller;

// ファイル内で共通して利用するプロパティを定義
MAIN.startController = function startController(cController) {
    controller = cController;
    controller.hears(['名言', 'famous quotes', 'めいげん'], 'ambient,direct_message,direct_mention,mention', (bot, message) => {
        util.setProperty(bot, message, null);
        request({
            url: 'http://meigen.doodlenote.net/api?c=1',
            method: 'GET',
            json:  true
        }, (err, response, body) => {
            if (err == null) {
                parseString(body, (err, result) => {
                    if(err) {
                        console.log(`Famous Quotes ERROR: ${err}`);
                    } else {
                        util.botSay(`「 *${result.response.data[0].meigen[0]}* 」\\n\\n　(by ${result.response.data[0].auther[0]})`, message.channel);
                    }
                });
            } else {
                console.log(`Famous Quotes ERROR: ${err}`);
            }
        });
    });
};
