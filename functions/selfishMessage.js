'use strict';
var config = require('config');
var pg = require('pg');
let request = require('request');
let fs = require('fs');

exports.replyMessage = function(bot, message, resultMessage) {
    if(resultMessage.rowCount > 0){
        if(resultMessage.rows[0].message.length > 1){
            let text = resultMessage.rows[0].message[(Math.floor(Math.random() * resultMessage.rows[0].message.length))].replace(/\\n/g,'\n');
            let imageTagReg = /image_/
            // messageに「image_」が含まれている場合画像を送信。
            if (text.match(imageTagReg)) {
                let imageName = text.replace(imageTagReg,'');
                var url = `https://s3-ap-northeast-1.amazonaws.com/ad-chatbot/${imageName}.png`;
                request(
                    {method: 'GET', url: url, encoding: null},
                    (error, response, body) => {
                        if(!error && response.statusCode === 200) {
                            fs.writeFileSync(`./${imageName}.png`, body, 'binary');
                            fs.readFile(`./${imageName}.png`, function(err,data){
                                if(err) throw err;
                                bot.api.files.upload({
                                                    file: fs.createReadStream(`./${imageName}.png`),
                                                    filename: `test.png`,
                                                    channels: message.channel
                                                },function(err,res) {
                                                    if (err) console.log(err)
                                                    fs.unlinkSync(`./${imageName}.png`);
                                                })
                                });
                            }
                    }
                );
            } else {
                bot.reply(message, text);
            }
        } else {
            bot.reply(message, resultMessage.rows[0].message[0].replace(/\\n/g,'\n'));
        }
    }
    return;
};
