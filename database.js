'use strict';

var passwordHash = require('password-hash');
var Guid = require('guid');
var db_file = process.env.DATABASE || './db/database.db';
var db = require('sqlite');

db.open(db_file, { Promise })

function generate_guid()
{
    var id = Guid.create();

    return id.value;
}

function add_user(username, password, isadmin, callback)
{
    if (username === undefined)
        callback(new Error("Username is not valid."), null);

    if (password === undefined)
        callback(new Error("Password is not valid."), null);

    var hashed_password = passwordHash.generate(password);

    // check if user exists
    db.get('SELECT username FROM users WHERE username = ?', username)
        .then(function(row)
        {
            if (row != undefined)
            {
                callback(new Error("User already exists."), null);
            }
            else
            {
                var guid = generate_guid();

                db.get("INSERT INTO users (username, password, isadmin, user_id) VALUES(?, ?, ?, ?)", username, hashed_password, isadmin, guid)
                    .then(function(err, data)
                    {
                        if (err)
                        {
                            callback(err, null);
                        }
                        else
                        {
                            callback(null, { "username" : username, "user_id" : guid } );
                        }
                    })
                    .catch(err => 
                    {
                        callback(err, null);
                    });
            }
        });
}

function del_user(id, callback)
{
    if (id === undefined)
        callback(new Error("Invalid ID"), null);

    // Check if we're deleting the last admin
    db.get('SELECT COUNT(*) cnt FROM users WHERE isadmin = 1 and user_id <> ?', id)
        .then(function(row)
        {
            if (row.cnt < 1)
            {
                callback(new Error("You cannot delete the only administrative user."), id);
            }
            else
            {
                db.run("DELETE FROM users WHERE user_id = ?", id)
                    .then(function()
                    {
                        callback(null, id);
                    })
                    .catch(err => 
                    {
                        callback(err, null);
                    });
            }
        });
}

function update_password(id, password, callback)
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

function update_user(id, max_clients, role, locked, callback)
{
    if (id === undefined)
        callback(new Error("Invalid ID."), null);

    if (max_clients === undefined)
        callback(new Error("Invalid max_clients."), null);

    if (role === undefined)
        role = 'user';
    
    if (locked === undefined)
        locked = false;

    if (locked == 1)
        locked = true;
    else
        locked = false;

    db.run("UPDATE users SET max_clients = ?, isadmin = ?, locked = ? WHERE user_id = ?", max_clients, role == 'admin' ? 1 : 0, locked, id)
        .then(function()
        {
            callback(null, id);
        })
        .catch(err => 
        {
            callback(err, null);
        });
}

function update_last_connection_datetime(id, datetime, callback)
{
    if (id === undefined)
        callback(new Error("Invalid ID."), null);

    if (datetime === undefined)
        callback(new Error("Invalid datetime."), null);

    db.run("UPDATE users SET lastconnecteddatetime = ? WHERE user_id = ?", datetime, id)
        .then(function()
        {
            callback(null, id);
        })
        .catch(err => 
        {
            callback(err, null);
        });
}

function validate_user(username, password, callback)
{
    db.get('SELECT id, username, password, isadmin, max_clients, user_id, locked, addingdatetime, CASE WHEN isadmin = 1 THEN \'admin\' ELSE \'user\' END role  FROM users WHERE username = ?', username)
        .then(function(row)
        {
            if (row == null || row == undefined || row == [])
            {
                callback(new Error("User not found."), null);
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

function validate_admin(username, password, callback)
{
    db.get('SELECT id, username, password, isadmin, max_clients, user_id, locked, addingdatetime, CASE WHEN isadmin = 1 THEN \'admin\' ELSE \'user\' END role  FROM users WHERE username = ? AND IsAdmin = 1', username)
        .then(function(row)
        {
            console.log("database: validate admin: " + row);

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

function get_user_by_id(id, callback)
{
    db.get('SELECT id, username, max_clients, user_id, password, locked, addingdatetime, CASE WHEN isadmin = 1 THEN \'admin\' ELSE \'user\' END role, lastconnecteddatetime  FROM users WHERE user_id = ?', id)
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

function get_users(callback)
{
    db.all('SELECT id, username, isadmin, max_clients, user_id, locked, addingdatetime, CASE WHEN isadmin = 1 THEN \'admin\' ELSE \'user\' END role, lastconnecteddatetime FROM users')
        .then(function(rows)
        {
            if (rows == null || rows == undefined || rows == [])
            {
                callback(err, null);
            }
            else
            {
                callback(null, rows);
            }
        });
}

exports.add_user = add_user;
exports.del_user = del_user;
exports.validate_user = validate_user;
exports.get_user_by_id = get_user_by_id;
exports.validate_admin = validate_admin;
exports.get_users = get_users;
exports.update_password = update_password;
exports.update_user = update_user;
exports.update_last_connection_datetime = update_last_connection_datetime;