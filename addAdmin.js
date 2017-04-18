var database = require('./database');
var args = process.argv.slice(2);

if (args.length < 2)
    return;

var username = args[0];
var password = args[1];

var added = database.add_user(username, password, false);
