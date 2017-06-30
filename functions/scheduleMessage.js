'use strict';
var config = require('config');
var schedule = require('node-schedule');
var pg = require('pg');

var conString = process.env.connectionstring;
var channelsList;

exports.says = function(bot) {
    pg.connect(conString, function(err, client) {
        if(err) {
            console.log('[scheduleMessage]DB connected failed.', err);
            return;
        }
        var scheduleListSql = config.sql.Schedule.messageList.format(config.messagetype.RegularWord.id);
        client.query(scheduleListSql, function(err, resultSchedule) {
            if(err) {
                console.log('[scheduleMessage]error running ScheduleList query.', err);
                client.end()
                return;
            }
            if(resultSchedule.rowCount > 0){
                client.query(config.sql.channels, function(err, resultChannel) {
                    if(err) {
                        console.log('[scheduleMessage]error running ChannelList query.', err);
                        client.end()
                        return;
                    }
                    channelsList = resultChannel;
                    for(var i=0; i<resultSchedule.rowCount; i++){
                        new schedule.scheduleJob(resultSchedule.rows[i].message[0], resultSchedule.rows[i].keyword, function(){
                            for(var j=0; j<channelsList.rowCount; j++){
                                bot.say({
                                    channel: channelsList.rows[j].name,
                                    text: this.name,
                                    username: '',
                                    icon_url: ''
                                });
                            }
                        });
                    }
                });
            }
            client.end()
            return;
        });
    });
    return;
};
