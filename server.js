'use strict';

var express = require("express");
var app = express();
var fs = require('fs');
var async = require('async');
var utils = require('./utils.js');
var moment = require('moment');
var io = require("socket.io");
var database;
var config;

//
// Socket.io 
//
let connectedClients = [];

function getSocketsInRoom(room)
{
    let sockets = [];

    try 
    {
        let socketObj = io.sockets.adapter.rooms[room].sockets;

        for (let id of Object.keys(socketObj)) 
        {
            var socket = io.sockets.connected[id];

            if (socket)
            {
                sockets.push(io.sockets.connected[id]);
            }
        }
    }
    catch (e) 
    {
        console.log(`Attempted to access non-existent room: ${room}`);
    }

    return sockets;
}

function emitToOthersInRoom(room, socketId, eventName, eventMessage)
{
    var sockets = getSocketsInRoom(room);

    for (var i = 0; i < sockets.length; i++)
    {
        if (sockets[i].id == socketId)
            return;

        sockets[i].emit(eventName, eventMessage);
    }
}

function emitToOthersInRoomWithCallback(room, socketId, eventName, eventMessage, callback)
{
    var sockets = getSocketsInRoom(room);

    for (var i = 0; i < sockets.length; i++)
    {
        if (sockets[i].id == socketId)
            return;

        sockets[i].emit(eventName, eventMessage);
    }
}

function addConnectedClient(socket)
{
    if (!socket)
        return;

    if (!(socket in connectedClients))
    {
        connectedClients.push(socket);
    }
}

function removeConnectedClient(socket)
{
    if (connectedClients.indexOf(socket) != -1)
    {
        connectedClients.splice(connectedClients.indexOf(socket), 1);
    }
}

function getClientCount(username)
{
    var count = 0;

    for (var i = 0; i < connectedClients.length; i++)
    {
        if (username.toLowerCase() == connectedClients[i].client.user.toLowerCase())
        {
            count++;
        }
    }

    return count;
}

function updateLastConnectionDateTime(socket, datetime)
{
    database.update_last_connection_datetime(socket.client.user_id, datetime, function(err, id)
    {
        if (err)
        {
            console.log("error: " + err.message);
        }
    });
}

function authenticate(socket, data, callback)
{
    var username = data.username;
    var password = data.password;

    database.validate_user(username, password, function(err, user)
        {
            if (err || !user)
            {
                callback(err, null);
            }
            else
            {
                if (user.locked)
                {
                    callback(new Error("Account locked."), null);
                }
                
                socket.client.user_id = user.user_id;

                //callback(null, user);

                var numberOfClients = connectedClients.reduce(function(p,c)
                {
                    if (username.toLowerCase() == c.client.user.toLowerCase())
                    {
                        p++;
                    }

                    return p;
                }, 0);

                if (numberOfClients > user.max_clients)
                {
                    console.log("Max clients reached.");

                    callback(new Error("Max clients reached."), null);
                }
                else
                {
                    callback(null, user);
                }
            }
        });
}

function postAuthenticate(socket, data) 
{
    var username = data.username;
    var editor_room_id = data.editor_room_id;

    socket.client.user = username;
    socket.roomId = editor_room_id;
    socket.client.connectedTime = moment(new Date()).format();
    socket.client.lastUpdateTime = moment(new Date()).format();

    console.log(`Authenticated: ${socket.client.user} [${utils.getIpAddress(socket.request.connection.remoteAddress)}]; room '${socket.roomId}'.`);

    socket.join(socket.roomId);

    // Add to connectedClients
    addConnectedClient(socket);

    // Update last connection date time
    updateLastConnectionDateTime(socket, moment(new Date()).format());

    socket.broadcast.to(socket.roomId).emit('room:join', { "room": socket.roomId, "user": socket.client.user });

    // Emit to every other client in the room asking them to send back a text:refresh with the latest text
    emitToOthersInRoom(
        socket.roomId,
        socket.id,
        "text:latest",
        {
            "user": username,
            "address": utils.getIpAddress(socket.request.connection.remoteAddress),
            "id": socket.id
        });
}

function listen(
    port, 
    use_ssl,
    ssl_key,
    ssl_cert,
    configuration, 
    db)
{
    config = configuration;
    database = db;

    var http;

    if (use_ssl == 'Y')
    {
        //TODO Fix this
        var options = 
        {
            key : fs.readFileSync(ssl_key),
            cert : fs.readFileSync(ssl_cert)
        };

        var https = require("https");
        http = https.createServer(options, app);
    }
    else
    {
        http = require("http").Server(app);
    }

    io = require("socket.io")(http);

    require('socketio-auth')(io,
        {
            authenticate: authenticate,
            postAuthenticate: postAuthenticate,
            timeout: 1000
        });

    io.on('connection', function(socket)
    {
        console.log(`Connected: ${utils.getIpAddress(socket.request.connection.remoteAddress)}.`);

        socket.on('disconnect', function()
        {
            console.log(`Disconnected: '${socket.client.user}' [${utils.getIpAddress(socket.request.connection.remoteAddress)}].`);

            // Remove from connectedClients
            removeConnectedClient(socket);

            // Update last connection date time
            updateLastConnectionDateTime(socket, moment(new Date()).format());

            socket.broadcast.to(socket.roomId).emit('room:leave', { "room": socket.roomId, "user": socket.client.user });
        });

        // Client message
        socket.on('client_message', function(msg)
        {
            var address = socket.handshake.address;

            io.in(socket.roomId).emit('client_message', msg);
        });

        // Client text update
        socket.on('text', function(msg)
        {
            var m_user = socket.client.user;
            var m_text = msg.text;
            var m_hostname = msg.hostname;
            var m_encrypted = msg.encrypted;

            socket.broadcast.to(socket.roomId).emit('text',
                {
                    "user": m_user,
                    "text": m_text,
                    "encrypted": m_encrypted,
                    "hostname": m_hostname
                });
        });

        // Client 'is typing'
        socket.on('text:typing', function(msg)
        {
            var user = socket.client.user;
            var address = utils.getIpAddress(socket.request.connection.remoteAddress);
            var typing = msg.is_typing;
            var hostname = msg.hostname;

            socket.client.lastUpdateTime = new Date();

            socket.broadcast.to(socket.roomId).emit('text:typing',
                {
                    "user": user,
                    "address": address,
                    "is_typing": typing,
                    "hostname": hostname
                });
        });

        socket.on('text:refresh', function(msg)
        {
            var user = socket.client.user;
            var address = utils.getIpAddress(socket.request.connection.remoteAddress);
            var id = msg.id;
            var text = msg.text;

            socket.broadcast.to(id).emit('text:refresh', { "text": text, "hostname": address });
        });
    });

    http.listen(port, function()
    {
        console.log("Service Listening on *:" + port);
    });

    return io;
}

function stop()
{
    io.close();
}

exports.listen = listen;
exports.stop = stop;