var moment = require('moment');
var session = require('express-session');
var SQLiteStore = require('connect-sqlite3')(session);
var passportSocketIo = require("passport.socketio");
var cookieParser = require('cookie-parser');
var async = require('async');

var utils = require('./utils.js');
var database = require('./database');

const SESSION_SECRET = process.env.SESSION_SECRET || 'keyboard cat';

var sockets = {};

sockets.init = function(server)
{
    let connectedClients = [];

    // socket.io setup
    let io = require('socket.io').listen(server);

    // Passport session
    io.use(passportSocketIo.authorize({
        key:          'connect.sid', 
        secret:       SESSION_SECRET,
        store:         new SQLiteStore({'db' : 'sessions', 'dir' : 'db' }), 
        success:      onAuthorizeSuccess, 
        fail:         onAuthorizeFail,     
    }));

    // 
    // Get roomId from handshake and set it on the socket
    io.use(function(socket, next)
    {
        var roomId = socket.handshake.query.roomId;

        if (roomId)
        {
            socket.roomId = roomId;

            return next();
        }

        next(new Error('RoomId invalid'));
    });

    function onAuthorizeSuccess(data, accept)
    {
        var socket = data.socket;
        var user = data.user;

        console.log(`Socket onAuthorizeSuccess: user=${user.username}`);

        var username = user.username;
        var editor_room_id = socket.RoomId;

        /*
        // 
        // Check if max connections is exceeded
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

            accept(new Error("Max clients reached."));
        }
        */

        accept();
    }

    function onAuthorizeFail(data, message, error, accept)
    {
        var socket = data.socket;

        console.log('failed connection to socket.io:', message);

        accept(new Error(message));
    }

    io.on('connection', function(socket)
    {
        console.log(`Connected: ${utils.getIpAddress(socket.request.connection.remoteAddress)}.`);

        var roomId = socket.roomId;

        socket.emit('authenticated');

        postAuthentication(socket);

        socket.on('disconnect', function()
        {
            console.log(`Disconnected: '${socket.request.user.username}' [${utils.getIpAddress(socket.request.connection.remoteAddress)}].`);

            // Remove from connectedClients
            removeConnectedClient(socket);

            // Update last connection date time
            //updateLastConnectionDateTime(socket.request.user.user_id, moment(new Date()).format());

            socket.broadcast.to(socket.roomId).emit('room:leave', { "room": socket.roomId, "user": socket.request.user.username });
        });

        // Client text update
        socket.on('text', function(msg)
        {
            var m_user = socket.request.user.username;
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
            var user = socket.request.user.username;
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
            var user = socket.client.username;
            var address = utils.getIpAddress(socket.request.connection.remoteAddress);
            var id = msg.id;
            var text = msg.text;

            socket.broadcast.to(id).emit('text:refresh', { "text": text, "hostname": address });
        });
    });

    //
    // Functions
    function postAuthentication(socket)
    {
        var user = socket.request.user;

        socket.client.connectedTime = moment(new Date()).format();
        socket.client.lastUpdateTime = moment(new Date()).format();

        console.log(`Authenticated: ${socket.request.user.username} [${utils.getIpAddress(socket.request.connection.remoteAddress)}]; room '${socket.roomId}'.`);

        socket.join(socket.roomId);

        // Add to connectedClients
        addConnectedClient(socket);

        // Update last connection date time
        updateLastConnectionDateTime(socket.request.user.user_id, moment(new Date()).format());

        socket.broadcast.to(socket.roomId).emit('room:join', { "room": socket.roomId, "user": socket.request.user.username });

        // Emit to every other client in the room asking them to send back a text:refresh with the latest text
        emitToOthersInRoom(
            socket.roomId,
            socket.id,
            "text:latest",
            {
                "user": socket.request.user.username,
                "address": utils.getIpAddress(socket.request.connection.remoteAddress),
                "id": socket.id
            });
    }
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

    function updateLastConnectionDateTime(user_id, datetime)
    {
        database.updateClientLastConnectionDateTime(user_id, datetime, function(err, id)
        {
            if (err)
            {
                console.log("error: " + err.message);
            }
        });
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

}

module.exports = sockets;