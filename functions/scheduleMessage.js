'use strict';
var config = require('config');
var schedule = require('node-schedule');
var pg = require('pg');
let request = require('request');
let parseString = require('xml2js').parseString;
require('date-utils');

var conString = process.env.connectionstring;
var channelsList;

exports.says = function(bot) {
    let client = new pg.Client(conString);
    client.connect((err) => {
        if(err) {
            console.log('[scheduleMessage]DB connected failed.', err);
            return;
        }
        var scheduleListSql = config.sql.Schedule.messageList.format(config.messageType.regularWord.id);
        client.query(scheduleListSql, function(err, resultSchedule) {
            if(err) {
                console.log('[scheduleMessage]error running ScheduleList query.', err);
                client.end()
                return;
            }
            setSchedule(bot, '0 30 9 * * *');
            if(resultSchedule.rowCount > 0){
                for(var i=0; i<resultSchedule.rowCount; i++){
                    let cron = resultSchedule.rows[i].keyword;
                    if (JSON.parse(cron)) {
                        let dateJson = JSON.parse(cron);
                        let infoJson = JSON.parse(resultSchedule.rows[i].message);
                        console.log('スケジュール')
                        let scheduler = new schedule.scheduleJob("Good morning! Today's Question!", '0 13 5 ' + dateJson.date + ' *', function(){
                            let clientSche = new pg.Client(conString);
                            console.log('スケジュール2')
                            clientSche.connect((err) => {
                                if(err) {
                                    console.log('[scheduleMessage]DB connected failed.', err);
                                    clientSche.end();
                                    return;
                                }

                                clientSche.query(config.sql.accounts, function(err, resultAccounts) {
                                    if(err) {
                                        console.log('[scheduleMessage]error running ChannelList query.', err);
                                        clientSche.end()
                                        return;
                                    }
                                    console.log('スケジュール3')
                                    let title = infoJson.title;
                                    //let infoJson = JSON.parse('{"date":"11 7","selects":[{"text":"パン"},{"text":"ごはん"},{"text":"グラノーラ"},{"text":"食べない"}]}');
                                    let actions = []
                                    let enqResultJsons = []
                                    infoJson.selects.forEach((select, index) => {
                                        let action = {
                                                "name": index,
                                                "value": index,
                                                "text": select.text,
                                                "type": "button"
                                            }
                                        enqResultJsons.push({"text":select.text, "count": 0})
                                        actions.push(action);
                                    })

                                    let insert = config.sql.insert.enqueteResult.format(title, JSON.stringify(enqResultJsons));
                                    clientSche.query(insert, (err, result) => {
                                        if (err) {
                                            util.botSay('現在のステータス取得時にエラー発生: ' + err);
                                            clientSche.end();
                                            return;
                                        }
                                        clientSche.end();
                                    });
                                    console.log('スケジュール4')
                                    console.log('actions')
                                    resultAccounts.rows.forEach((account) => {
                                        if (false == account.reviewer_flg) {
                                            bot.say({
                                                channel: account.account_id,
                                                text: `Good morning! Today's Question! \n` + title,
                                                attachments:[{
                                                    "fallback": "ボタン操作のできない端末またはブラウザです。",
                                                    "callback_id": 'schedule',
                                                    "color": config.color.selectingColor,
                                                    "actions": actions
                                                }]
                                            });
                                        }
                                    });
                                });
                            });
                        });
                        let schedulerAfter = new schedule.scheduleJob("Today's Question Result!", '0 15 5 ' + dateJson.date + ' *', function(){
                            let clientSche = new pg.Client(conString);
                            clientSche.connect((err) => {
                                if(err) {
                                    console.log('[scheduleMessage]DB connected failed.', err);
                                    clientSche.end();
                                    return;
                                }

                                clientSche.query(config.sql.channels, function(err, resultChannel) {
                                    if(err) {
                                        console.log('[scheduleMessage]error running ChannelList query.', err);
                                        clientSche.end()
                                        return;
                                    }
                                    var select = config.sql.enqueteResult.format(infoJson.title);
                                    clientSche.query(select, function(err, enqueteResult) {
                                        if(err) {
                                            console.log('[scheduleMessage]error running ScheduleList query.', err);
                                            clientSche.end()
                                            return;
                                        }
                                        let enqueteResultJson = JSON.parse(enqueteResult.rows[0].result)
                                        let count = 0;
                                        let dataParam = '{"data":[';
                                        enqueteResultJson.forEach((item, index) => {
                                            count += item.count
                                            let jsonStr = JSON.stringify(item)
                                            jsonStr = jsonStr.replace(/{/,"{")
                                            jsonStr = jsonStr.replace(/}/,"}")
                                            dataParam += jsonStr + ','
                                        })
                                        dataParam = dataParam.slice(0, -1);
                                        dataParam += ']}';

                                        let channelParam = '{"channels":['
                                        resultChannel.rows.forEach((channelInfo, index) => {
                                            channelParam += '{"name":"' + channelInfo.channel_id +'"},'
                                        })
                                        let title = enqueteResult.rows[0].title + '(回答数: ' + count + ' )'
                                        channelParam = channelParam.slice(0, -1);
                                        channelParam += ']}';
                                        request({
                                            url: 'https://script.google.com/macros/s/AKfycbwxRAxt9FN3wzlvZpV4BUxx5KF3-u8-FrumEkJJxbpq/exec',
                                            method: 'POST',
                                            headers: {
                                                "Authorization": "Bearer " + process.env.g_token
                                            },
                                            form:{
                                                dataJson: dataParam,
                                                channels: channelParam,
                                                title: title,
                                                token: process.env.token
                                            },
                                        }, (err, response, body) => {
                                            if (body.indexOf('ファイルを開くことができません') != -1) {
                                                console.log('body入りました')
                                                request({
                                                    url: 'https://www.googleapis.com/oauth2/v4/token',
                                                    method: 'POST',
                                                    form:{
                                                        grant_type: 'refresh_token',
                                                        client_id: process.env.g_client_id,
                                                        client_secret: process.env.g_client_secret,
                                                        refresh_token:process.env.refresh_token
                                                    },
                                                    json:  true
                                                }, (err, response, body) => {
                                                    process.env.g_token = body.access_token;
                                                    request({
                                                        url: 'https://script.google.com/macros/s/AKfycbwxRAxt9FN3wzlvZpV4BUxx5KF3-u8-FrumEkJJxbpq/exec',
                                                        method: 'POST',
                                                        headers: {
                                                            "Authorization": "Bearer " + process.env.g_token
                                                        },
                                                        form:{
                                                            dataJson: dataParam,
                                                            channels: channelParam,
                                                            title: title,
                                                            token: process.env.token
                                                        },
                                                    }, (err, response, body) => {
                                                        console.log(body);
                                                    });
                                                });
                                                client.end();
                                                return;
                                            }
                                        });
                                    });
                                });
                            });
                        });
                    } else {
                        scheduleMessage = resultSchedule.rows[i].message[Math.floor(Math.random() * resultSchedule.rows[i].message.length)];
                        let scheduler = new schedule.scheduleJob(scheduleMessage, cron, function(){
                            let clientSche = new pg.Client(conString);
                            clientSche.connect((err) => {
                                if(err) {
                                    console.log('[scheduleMessage]DB connected failed.', err);
                                    clientSche.end();
                                    return;
                                }
                                clientSche.query(config.sql.channels, function(err, resultChannel) {
                                    if(err) {
                                        console.log('[scheduleMessage]error running ChannelList query.', err);
                                        clientSche.end()
                                        return;
                                    }

                                    for(var j=0; j<resultChannel.rowCount; j++){
                                        bot.say({
                                            channel: resultChannel.rows[j].name,
                                            text: this.name,
                                            username: '',
                                            icon_url: ''
                                        });
                                    }
                                    clientSche.end();
                                    return;
                                });
                            });
                        });
                    }
                }
            }
            return;
        });
    });
    return;
};

function setSchedule(bot, cron) {
    console.log("aaa1")
    let scheduler = new schedule.scheduleJob('Message', cron, function(){
        console.log("aaa2")
        let clientSche = new pg.Client(conString);
        clientSche.connect((err) => {
            if(err) {
                console.log('[scheduleMessage]DB connected failed.', err);
                clientSche.end();
                return;
            }
            clientSche.query(config.sql.channels, function(err, resultChannel) {
                if(err) {
                    console.log('[scheduleMessage]error running ChannelList query.', err);
                    clientSche.end()
                    return;
                }
                console.log("aaa3")
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
                                let scheText = `Good morning everyone!! Today's inspirational quotes!~\n\n　　「 *${result.response.data[0].meigen[0]}* 」\n\n　(by ${result.response.data[0].auther[0]})`
                                if (scheText.match(/\\n/)) {
                                    scheText = scheText.replace(/\\n/g,'\n');
                                }
                                for(var j=0; j<resultChannel.rowCount; j++){
                                    bot.say({
                                        channel: resultChannel.rows[j].name,
                                        text: scheText,
                                        username: '',
                                        icon_url: ''
                                    });
                                }
                            }
                        });
                    } else {
                        console.log(`Famous Quotes ERROR: ${err}`);
                    }
                });
                
                clientSche.end();
            });
        });
    });
}