"use strict"

// 消したいチャンネル・アカウントを指定(チャンネルに該当するアカウントを全て削除される)
let channelList = []
let accountList = []
let connectionString = '';

let pg = require('pg');

console.log("start");
accountList.forEach((accountName, index) => {
    channelList.forEach((channelName, index) => {
        let client = new pg.Client(connectionString);
        client.connect((err) => {
            if (err) {
                console.log('error: ' + err);
                return;
            }
            let selectChannelComposition = `select * from channel_Composition as cc inner join account as ac on cc.account_id = ac.account_id where name='${accountName}';`
            client.query(selectChannelComposition, (err, resultChannelComposition) => {
                if (err) {
                    console.log(err)
                    client.end();
                    return;
                }
                console.log(resultChannelComposition.rows);
                let deleteReviewAccountChannelStatus = `delete from review_account_channel_status 
                                                        where id = (select id from channel_composition as cc inner join account as ac on cc.account_id = ac.account_id 
                                                        inner join channel as ch on ch.channel_id = cc.channel_id where ac.name='${accountName}' and ch.name='${channelName}');`
                let deleteAccountChannelStatus = `delete from account_channel_status 
                                                where id = (select id from channel_composition as cc inner join account as ac on cc.account_id = ac.account_id 
                                                inner join channel as ch on ch.channel_id = cc.channel_id where ac.name='${accountName}' and ch.name='${channelName}');`
                let deleteChannelComposition = `delete from channel_composition 
                                                where id = (select id from channel_composition as cc inner join account as ac on cc.account_id = ac.account_id 
                                                inner join channel as ch on ch.channel_id = cc.channel_id where ac.name='${accountName}' and ch.name='${channelName}');`
                let deleteAccount = `delete from account where name='${accountName}';`
                if (resultChannelComposition.rowCount > 1) {
                    let deleteAccountRelation = deleteReviewAccountChannelStatus + deleteAccountChannelStatus + deleteChannelComposition;
                    client.query(deleteAccountRelation, (err, result) => {
                        if (err) {
                            console.log(err)
                            client.end();
                            return;
                        }
                        console.log(result);
                        client.query(selectChannelComposition, (err, resultChannelCompositionForAccountDelete) => {
                            if (err) {
                                console.log(err)
                                client.end();
                                return;
                            }
                            if (resultChannelCompositionForAccountDelete.rowCount == 0) {
                                let deleteAccount = `delete from account where name='${accountName}';`
                                client.query(deleteAccountRelation, (err, result) => {
                                    if (err) {
                                        console.log(err)
                                        client.end();
                                        return;
                                    }
                                    console.log(result);
                                });
                            }
                        });
                    });
                } else if (resultChannelComposition.rowCount == 1) {
                    let deleteAccountRelation = deleteReviewAccountChannelStatus + deleteAccountChannelStatus + deleteChannelComposition + deleteAccount;
                    client.query(deleteAccountRelation, (err, result) => {
                        if (err) {
                            console.log(err)
                            client.end();
                            return;
                        }
                    });
                } else if (resultChannelComposition.rowCount == 0) {
                    client.query(deleteAccount, (err, result) => {
                        if (err) {
                            console.log(err)
                            client.end();
                            return;
                        }
                    });
                }
            });
        });
    });
});