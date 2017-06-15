'use strict';

const passwordHash = require('password-hash');
const db_file = process.env.DATABASE || './db/database.db';
const db = require('sqlite');

db.open(db_file, { Promise })

function getRole(role)
{
    if (role == 1)
    {
        return 'admin';
    }
    else if (role == 0)
    {
        return 'user';
    }
    else
    {
        return 'user';
    }
}

exports.updatePassword = function (id, password, callback)
{
    if (id === undefined)
        callback(new Error("Invalid ID."), null);

    if (password === undefined)
        callback(new Error("Invalid password."), null);

    var hashed_password = passwordHash.generate(password);

    db.run("UPDATE users SET password = ? WHERE user_id = ?", hashed_password, id)
        .then(function()
        {
            callback(null, id);
        })
        .catch(err => 
        {
            callback(err, null);
        });
}

exports.validateUser = function (username, password, callback)
{
    username = username.toLowerCase();

    db.get('SELECT id, username, password, role, max_clients, user_id, locked, addingdatetime FROM users WHERE username = ? AND locked <> 1', username)
        .then(function(row)
        {
            if (row == null || row == undefined || row == [])
            {
                callback(null, null);
            }
            else
            {
                var db_pass = row.password;
                var hashed_password = passwordHash.verify(password, db_pass);
                if (hashed_password)
                {
                    var locked = false;

                    if (row.locked == 1)
                        locked = true;
                    else
                        locked = false;
                    
                    callback(null, 
                    { 
                        "id": row.id, 
                        "username": row.username, 
                        "password": row.password, 
                        "max_clients" : row.max_clients, 
                        "user_id" : row.user_id, 
                        "addingdatetime" : row.addingdatetime, 
                        "locked" : locked, 
                        "role" : row.role 
                    });
                }
                else
                {
                    callback(null, null);
                }
            }
        });
}

exports.getUserById = function (id, callback)
{
    db.get('SELECT id, username, max_clients, user_id, password, locked, addingdatetime, role, lastconnecteddatetime  FROM users WHERE user_id = ?', id)
        .then(function(row)
        {
            if (row == null || row == undefined || row == [])
            {
                callback(new Error("No user found"), null);
            }
            else
            {
                var locked = false;

                if (row.locked == 1)
                    locked = true;
                else
                    locked = false;

                callback(null, 
                { 
                    "id": row.id, 
                    "username": row.username, 
                    "max_clients" : row.max_clients, 
                    "user_id" : row.user_id, 
                    "addingdatetime" : row.addingdatetime,
                    "locked" : locked, 
                    "role" : row.role ,
                    "lastconnecteddatetime" : row.lastconnecteddatetime
                });
            }
        });
}

