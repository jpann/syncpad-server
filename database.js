'use strict';

const passwordHash = require('password-hash');
const db_file = process.env.DATABASE || './db/database.db';
const db = require('sqlite');
const Guid = require('guid');

db.open(db_file, { Promise })

function generate_guid()
{
    var id = Guid.create();

    return id.value;
}

exports.adminExists = function(callback)
{
    db.get('SELECT COUNT(id) AS cnt FROM admins')
        .then(function(row)
        {
            if (row == null || row == undefined || row == [])
            {
                callback(false);
            }
        
            if (row.cnt > 0)
            {
                callback(true);
            }
            else
            {
                callback(false);
            }
        });
}

exports.addAdminUser = function(username, password, callback)
{
    if (username === undefined)
        callback(new Error("Invalid username."), null);

    if (password === undefined)
        callback(new Error("Invalid password."), null);

    db.get('SELECT id FROM admins WHERE lower(username) = ?', username.toLowerCase())
        .then(function(row)
        {
            if (row == null || row == undefined || row == [])
            {
                var hashed_password = passwordHash.generate(password);
                var guid = generate_guid();                
                
                db.get("INSERT INTO admins (username, password, user_id) VALUES(?, ?, ?)", username, hashed_password, guid)
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
            else
            {
               callback(new Error("User already exists."), null);
            }
        });
}

exports.updateAdminPassword = function (id, password, callback)
{
    if (id === undefined)
        callback(new Error("Invalid ID."), null);

    if (password === undefined)
        callback(new Error("Invalid password."), null);

    var hashed_password = passwordHash.generate(password);

    db.run("UPDATE admins SET password = ? WHERE user_id = ?", hashed_password, id)
        .then(function()
        {
            callback(null, id);
        })
        .catch(err => 
        {
            callback(err, null);
        });
}

exports.validateAdminUser = function (username, password, callback)
{
    username = username.toLowerCase();

    db.get('SELECT id, username, password, user_id, addingdatetime FROM admins WHERE lower(username) = ?', username.toLowerCase())
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
                    callback(null, 
                    { 
                        "id": row.id, 
                        "username": row.username, 
                        "password": row.password, 
                        "user_id" : row.user_id, 
                        "addingdatetime" : row.addingdatetime
                    });
                }
                else
                {
                    callback(null, null);
                }
            }
        });
}

exports.getAdminUserById = function (id, callback)
{
    db.get('SELECT id, username, user_id, password, addingdatetime, lastconnecteddatetime FROM admins WHERE user_id = ?', id)
        .then(function(row)
        {
            if (row == null || row == undefined || row == [])
            {
                callback(new Error("No user found"), null);
            }
            else
            {
                callback(null, 
                { 
                    "id": row.id, 
                    "username": row.username, 
                    "user_id" : row.user_id, 
                    "addingdatetime" : row.addingdatetime,
                    "lastconnecteddatetime" : row.lastconnecteddatetime
                });
            }
        });
}

