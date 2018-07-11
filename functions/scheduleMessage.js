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
            if(resultSchedule.rowCount > 0){
                for(var i=0; i<resultSchedule.rowCount; i++){
                    console.log(resultSchedule.rows[i])
                    let cron = resultSchedule.rows[i].keyword;
                    let scheduleMessage = '';
                    if (cron != '0 30 9 * * 1,2,3,4,5' && !JSON.parse(cron)) {
                        scheduleMessage = resultSchedule.rows[i].message[Math.floor(Math.random() * resultSchedule.rows[i].message.length)];
                        setSchedule(bot, scheduleMessage, cron);
                    } else if (JSON.parse(cron)) {
                        let dateJson = JSON.parse(cron);
                        let infoJson = JSON.parse(resultSchedule.rows[i].message);
                        let scheduler = new schedule.scheduleJob("Good morning! Today's Question!", '0 1 18 ' + dateJson.date + ' *', function(){
                                    let clientSche = new pg.Client(conString);
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
                                    let title = infoJson.title;
                                    //let infoJson = JSON.parse('{"date":"11 7","selects":[{"text":"パン"},{"text":"ごはん"},{"text":"グラノーラ"},{"text":"食べない"}]}');
                                    let actions = []
                                    let enqResultJsons = []
                                    console.log(infoJson)
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
                                    resultAccounts.rows.forEach((account) => {
                                        bot.say({
                                            channel: 'C67KTAYMP',
                                            text: title,
                                            username: 'otameshi',
                                            icon_url: '',
                                            attachments:[{
                                                "fallback": "ボタン操作のできない端末またはブラウザです。",
                                                "callback_id": 'schedule',
                                                "color": config.color.selectingColor,
                                                "actions": actions
                                            }]
                                        });
                                    });
                                });
                            });
                        });
                        let schedulerAfter = new schedule.scheduleJob("Today's Question Result!", '10 1 18 ' + dateJson.date + ' *', function(){
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
                                        console.log(enqueteResultJson)
                                        let dataParam = 'dataJson=\\\{"data":[';
                                        enqueteResultJson.forEach((item, index) => {
                                            let jsonStr = JSON.stringify(item)
                                            jsonStr = jsonStr.replace(/{/,"\\\{")
                                            jsonStr = jsonStr.replace(/}/,"\\\}")
                                            dataParam += jsonStr + ','
                                        })
                                        dataParam = dataParam.slice(0, -1);
                                        dataParam += ']\\\}\\\&';

                                        let channelParam = 'channels=\\\{"channels":['
                                        resultChannel.rows.forEach((channelInfo, index) => {
                                            channelParam += '\\\{"name":"' + channelInfo.channel_id +'"\\\},'
                                        })
                                        channelParam = channelParam.slice(0, -1);
                                        channelParam += ']\\\}\\\&';
                                        let param = dataParam + channelParam + 'title=' + enqueteResult.rows[0].title.replace(/\?/,"\\\?") + '\\\&' + 'token=' + process.env.token + '\\\&'
                                        request({
                                            url: 'https://script.google.com/macros/s/AKfycbwxRAxt9FN3wzlvZpV4BUxx5KF3-u8-FrumEkJJxbpq/exec?' + param + 'access_token=' + process.env.g_token,
                                            method: 'GET',
                                            json:  true
                                        }, (err, response, body) => {
                                            if (err) {
                                                console.log('error入りました')
                                                request({
                                                    url: 'https://www.googleapis.com/oauth2/v4/token',
                                                    method: 'POST',
                                                    form:{
                                                        grant_type:'refresh_token',
                                                        client_id:'594646937602-otm65mc8pu947c0cmnh8hdfhp38o5moj.apps.googleusercontent.com',
                                                        client_secret:'XB7jJk6wsCHfwbLI-k0F6RKW',
                                                        refresh_token:process.env.refresh_token
                                                    },
                                                    json:  true
                                                }, (err, response, body) => {
                                                    process.env.g_token = body.access_token;
                                                    console.log('https://script.google.com/macros/s/AKfycbwxRAxt9FN3wzlvZpV4BUxx5KF3-u8-FrumEkJJxbpq/exec?' + param + 'access_token=' + process.env.g_token)
                                                    request({
                                                        url: 'https://script.google.com/macros/s/AKfycbwxRAxt9FN3wzlvZpV4BUxx5KF3-u8-FrumEkJJxbpq/exec?' + param + 'access_token=' + process.env.g_token,
                                                        method: 'GET',
                                                        json:  true
                                                    }, (err, response, body) => {
                                                        console.log(body);
                                                    });
                                                });
                                                client.end();
                                                return;
                                            }
                                            if (body.indexOf('Error') != -1) {
                                                console.log('body入りました')
                                                request({
                                                    url: 'https://www.googleapis.com/oauth2/v4/token',
                                                    method: 'POST',
                                                    form:{
                                                        grant_type:'refresh_token',
                                                        client_id:'594646937602-otm65mc8pu947c0cmnh8hdfhp38o5moj.apps.googleusercontent.com',
                                                        client_secret:'XB7jJk6wsCHfwbLI-k0F6RKW',
                                                        refresh_token:process.env.refresh_token
                                                    },
                                                    json:  true
                                                }, (err, response, body) => {
                                                    process.env.g_token = body.access_token;
                                                    request({
                                                        url: 'https://script.google.com/macros/s/AKfycbwxRAxt9FN3wzlvZpV4BUxx5KF3-u8-FrumEkJJxbpq/exec?' + param + 'access_token=' + process.env.g_token,
                                                        method: 'GET',
                                                        json:  true
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
                                        scheduleMessage = `Good morning everyone!! Today's inspirational quotes!~\n\n　　「 *${result.response.data[0].meigen[0]}* 」\n\n　(by ${result.response.data[0].auther[0]})`
                                        setSchedule(bot, scheduleMessage, cron);
                                    }
                                });
                            } else {
                                console.log(`Famous Quotes ERROR: ${err}`);
                            }
                        });
                    }
                }
            }
            return;
        });
    });
    return;
};

function setSchedule(bot, scheduleMessage, cron) {
    let scheduler = new schedule.scheduleJob(scheduleMessage, cron, function(){
        let scheText = this.name;
        if (scheText.match(/\\n/)) {
            scheText = scheText.replace(/\\n/g,'\n');
        }
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
                        text: scheText,
                        username: '',
                        icon_url: '',
                        attachments:[{
                            "fallback": "ボタン操作のできない端末またはブラウザです。",
                            "callback_id": 'schedule',
                            "color": 'result',
                            "actions": [{
                                "name": 'test',
                                "value": 'value',
                                "text": 'text1',
                                "type": "button",
                                "style": "primary"
                            },
                            {
                                "name": 'test',
                                "value": 'value',
                                "text": 'text2',
                                "type": "button",
                                "style": ""
                            }]
                        }]
                    });
                }
                clientSche.end();
            });
        });
    });
}