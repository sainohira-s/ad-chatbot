'use strict';
var config = require('config');
var schedule = require('node-schedule');
var pg = require('pg');

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
                    new schedule.scheduleJob(resultSchedule.rows[i].message[(Math.floor(Math.random() * resultSchedule.rows[0].message.length))], resultSchedule.rows[i].keyword, function(){
                        let text = this.name;
                        if ( text.match(/\\n/)) {
                            text = text.replace(/\\n/g,'\n');
                        }
                        let clientSche = new pg.Client(conString);
                        clientSche.connect((err) => {
                            if(err) {
                                console.log('[scheduleMessage]DB connected failed.', err);
                                return;
                            }
                            clientSche.query(config.sql.channels, function(err, resultChannel) {
                                if(err) {
                                    console.log('[scheduleMessage]error running ChannelList query.', err);
                                    client.end()
                                    return;
                                }
                                for(var j=0; j<resultChannel.rowCount; j++){
                                    bot.say({
                                        channel: resultChannel.rows[j].name,
                                        text: text,
                                        username: '',
                                        icon_url: ''
                                    });
                                }
                                clientSche.end();
                            });
                            
                        });
                    });
                }
            }
            client.end()
            return;
        });
    });
    return;
};
