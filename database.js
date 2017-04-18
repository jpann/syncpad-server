'use strict';

var passwordHash = require('password-hash');
var sqlite3 = require('sqlite3');

var db_file = "./db/database.db";

var db = new sqlite3.Database(db_file);

function add_user(username, password, isadmin)
{
    if (username === undefined)
        return;

    if (password === undefined)
        return;

    var hashed_password = passwordHash.generate(password);

    // check if user exists
    db.get('SELECT username FROM users WHERE username = ?', username, function(err, row)
    {
        if (row != undefined)
        {
            return false;
        }
        else
        {
            var stmt = db.prepare("INSERT INTO users (username, password, isadmin) VALUES(?, ?, ?)");
            stmt.run(username, hashed_password, isadmin);

            return true;
        }
    });
}

function del_user(username)
{
    if (username === undefined)
        return;

    var stmt = db.prepare("DELETE FROM users WHERE username = ?");
    stmt.run(username);
}

function validate_user(username, password, callback)
{
    db.get('SELECT username, password FROM users WHERE username = ?', username, function(err, row)
    {
        if (row == null || row == undefined || row == [])
        {
            callback(new Error("Not authorized"), false);
        }
        else
        {
            var db_pass = row.password;
            var hashed_password = passwordHash.verify(password, db_pass);
            if (hashed_password)
            {
                callback(null, true);
            }
            else
            {
                callback(new Error("Not authorized"), false);
            }
        }
    });
}

exports.add_user = add_user;
exports.del_user = del_user;
exports.validate_user = validate_user;