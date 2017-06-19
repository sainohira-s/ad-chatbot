"use strict"
let MAIN = {};
exports.CANCEL = MAIN;

// ファイル内で共通して利用するプロパティを定義
MAIN.startController = function startController(controller) {
    controller.hears(['キャンセル', 'きゃんせる', 'cancel', 'やめる', 'やめて', '止める', '止めて'], 'ambient,direct_message,direct_mention,mention', (bot, message) => {
    });
};

