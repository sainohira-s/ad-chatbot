var fs = require('fs');
var uuid = require('uuid/v4');
var readline = require('readline');

var fileMessageCsv = './db/message.csv';
var fileKeywordCsv = './db/keyword.csv';
var fileInsertSql = './db/insertTable.sql';

var rsMessage = fs.createReadStream(fileMessageCsv);
var rlMessage = readline.createInterface(rsMessage, {});

var columnsMessage = '';

fs.appendFileSync(fileInsertSql, 'DELETE FROM message;\n', 'utf-8');
fs.appendFileSync(fileInsertSql, 'DELETE FROM keyword;\n', 'utf-8');
rlMessage.on('line', function(lineMessage) {
    if(columnsMessage == null || columnsMessage == ''){
        columnsMessage = lineMessage;
    }
    else{
        var strUuid = uuid();
        var msgVal = lineMessage.split(',');
        var insertMessageSql = "INSERT INTO public.message(" + columnsMessage + ") VALUES ('" + strUuid.toString() + "'," + msgVal[1].replace(/;/g, ',') + "," + msgVal[2] + ");\n";
        console.log(insertMessageSql);
        fs.appendFileSync(fileInsertSql, insertMessageSql, 'utf-8');

        var columnsKeyword = '';
        var rsKeyword = fs.createReadStream(fileKeywordCsv);
        var rlKeyword = readline.createInterface(rsKeyword, {});
        rlKeyword.on('line', function(lineKeyword) {
            if(columnsKeyword == null || columnsKeyword == ''){
                columnsKeyword = lineKeyword;
            }
            else if(lineKeyword.indexOf(msgVal[0]) >= 0){
                var keyVal = lineKeyword.split(',');
                var insertKeywordSql = "INSERT INTO public.keyword(" + columnsKeyword + ") VALUES ('" + strUuid.toString() + "'," + keyVal[1].replace(/;/g, ',') + ");\n";
                console.log(insertKeywordSql);

                fs.appendFileSync(fileInsertSql, insertKeywordSql, 'utf-8');
            }
        });
    }
});
