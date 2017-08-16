'use strict';
var config = require('config');
var schedule = require('node-schedule');
var pg = require('pg');
let request = require('request');
let parseString = require('xml2js').parseString;

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
                    let cron = resultSchedule.rows[i].keyword;
                    let scheduleMessage = '';
                    if (resultSchedule.rows[i].keyword != '0 30 9 * * 1,2,3,4,5') {
                        scheduleMessage = resultSchedule.rows[i].message[Math.floor(Math.random() * resultSchedule.rows[i].message.length)];
                        setSchedule(bot, scheduleMessage, cron);
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
                        icon_url: ''
                    });
                }
                clientSche.end();
            });
        });
    });
}