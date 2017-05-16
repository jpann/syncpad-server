var moment = require('moment');
var session = require('express-session');
var SQLiteStore = require('connect-sqlite3')(session);
var passportSocketIo = require("passport.socketio");
var cookieParser = require('cookie-parser');
var async = require('async');

var _ = require('underscore');
var shortid = require('shortid');
var CryptoJS = require("crypto-js");
var passwordHash = require('password-hash');

var utils = require('./utils.js');
var database = require('./database');

const SESSION_SECRET = process.env.SESSION_SECRET || 'keyboard cat';
const ROOMID_MIN_LENGTH = process.env.ROOMID_MIN_LENGTH || 8;
const ROOM_PASSWORD_MIN_LENGTH = process.env.ROOM_PASSWORD_MIN_LENGTH || 6;

var sockets = {};

sockets.init = function(server)
{
    let connectedClients = [];

    let rooms = [];

    //
    // Rooms code
    function checkIfRoomExists(roomId)
    {
        var roomExists = _.find(rooms, function(room)
        {
            if (room.roomId == roomId)
            {
                return true;
            }
        });

        return roomExists;
    }

    function getRoom(roomId)
    {
        var room = _.findWhere(rooms, { 'roomId' : roomId });

        return room;
    }

    function verifyRoomPassword(roomId, password)
    {
        var room = _.findWhere(rooms, { 'roomId' : roomId });

        if (room)
        {
            //var verifyPassword = passwordHash.verify(password, room.password);
            if (password == room.password)
            {
                return true;
            }
        }

        return false;
    }

    function joinRoom(roomId, clientId, password)
    {
        if (checkIfRoomExists(roomId))
        {
            if (verifyRoomPassword(roomId, password))
            {
                return room = addClientToRoom(roomId, clientId);
            }
            else
            {
                return undefined;
            }
        }
        else
        {
            if (password < ROOM_PASSWORD_MIN_LENGTH)
                return null;

            // Create new room
            var room = createRoom(roomId, password);

            addClientToRoom(room.roomId, clientId);

            return room;
        }
    }

    function createRoom(roomId, password)
    {
        var rnd_password = shortid.generate();
        var key = CryptoJS.lib.WordArray.random(128 / 8).toString();

        var room = 
        {
            'roomId' : roomId,
            'password' : password,
            'key' : key,
            'clients' : []
        };

        rooms.push(room);

        return room;
    }

    function removeRoom(roomId)
    {
        var clientCount = _.find(rooms, function(room)
        {
            if (room.roomId == roomId)
            {
                return clientCount = room.clients.length;
            }

            return 0;
        });

        if (clientCount <= 0)
            rooms = _.without(rooms, _.findWhere(rooms, { 'roomId' : roomId }));
    }

    function addClientToRoom(roomId, clientId)
    {
        var room = _.findWhere(rooms, { 'roomId' : roomId });

        if (room)
        {
            var clientExists = _.findWhere(room.clients, { 'clientId' : clientId }) || false;

            if (!clientExists)
            {
                room.clients.push({ 'clientId' : clientId  });
            }

            return room;
        }
        else
        {
            return undefined;
        }
    }

    function removeClientFromRoom(roomId, clientId)
    {
        var room = _.findWhere(rooms, { 'roomId' : roomId });

        if (room)
        {
            room.clients = _.without(room.clients, _.findWhere(room.clients, { 'clientId' : clientId }));
            
            if (room.clients.length < 1)
            {
                removeRoom(roomId);
            }
        }
    }

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

        if (roomId && roomId.length >= ROOMID_MIN_LENGTH)
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
            if (username.toLowerCase() == c.client.user.username.toLowerCase())
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
        var client_addr = socket.handshake.headers["x-real-ip"] || socket.request.connection.remoteAddress;

        console.log(`Connected: ${utils.getIpAddress(client_addr)}.`);

        var roomId = socket.roomId;

        //
        // Request room password
        var roomId = socket.roomId;
        var clientId = socket.id;

        socket.emit('room:auth', 
            {
                'roomId' : roomId
            },
            function(data)
            {
                var password = data.password;

                var room = joinRoom(roomId, clientId, password);

                if (room)
                {
                    postAuthentication(socket, room);
                }
                else
                {
                    socket.emit('unauthorized', 
                    { 
                        'message' : `Unable to join room. Invalid room password or password length is less than ${ROOM_PASSWORD_MIN_LENGTH}.`,
                        'roomId' : roomId
                    });

                    socket.disconnect(true);
                }
            });

        socket.on('disconnect', function()
        {
            var client_addr = socket.handshake.headers["x-real-ip"] || socket.request.connection.remoteAddress;


            var address = utils.getIpAddress(client_addr);
            console.log(`Disconnected: '${socket.request.user.username}' [${address}].`);

            // Remove from connectedClients
            removeConnectedClient(socket);
            removeClientFromRoom(socket.roomId, socket.id);

            // Update last connection date time
            //updateLastConnectionDateTime(socket.request.user.user_id, moment(new Date()).format());

            socket.broadcast.to(socket.roomId).emit('room:leave', 
            { 
                "room": socket.roomId, 
                "user": socket.request.user.username,
                "address" : address
            });
        });

        // Client text update
        socket.on('text', function(msg)
        {
            var m_user = socket.request.user.username;
            var m_text = msg.text;
            var m_hostname = msg.hostname;
            var m_encrypted = msg.encrypted;

            //console.log(`text: user: ${user}; m_text: ${m_text}`)

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
            var client_addr = socket.handshake.headers["x-real-ip"] || socket.request.connection.remoteAddress;
            var address = utils.getIpAddress(client_address);

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
            var user = socket.request.user.username;
            var client_addr = socket.handshake.headers["x-real-ip"] || socket.request.connection.remoteAddress;

            var address = utils.getIpAddress(client_addr);
            var id = msg.id;
            var text = msg.text;

            socket.broadcast.to(id).emit('text:refresh', { "text": text, "hostname": address });
        });
    });

    //
    // Functions
    function postAuthentication(socket, room)
    {
        var client_addr = socket.handshake.headers["x-real-ip"] || socket.request.connection.remoteAddress;

        var address = utils.getIpAddress(client_addr);

        var user = socket.request.user;
        var roomId = socket.roomId;

        socket.client.user = user;
        socket.client.connectedTime = moment(new Date()).format();
        socket.client.lastUpdateTime = moment(new Date()).format();

        console.log(`Authenticated: ${socket.request.user.username} [${address}]; room '${socket.roomId}'.`);

        //var room = getRoom(roomId);

        socket.emit('authenticated',
        {
            "roomId" : roomId,
            'key' : room.key,
            'password' : room.password
        });

        socket.join(socket.roomId);

        // Add to connectedClients
        addConnectedClient(socket);

        // Update last connection date time
        updateLastConnectionDateTime(socket.request.user.user_id, moment(new Date()).format());

        socket.broadcast.to(socket.roomId).emit('room:join', 
        { 
            "room": socket.roomId, 
            "user": socket.request.user.username,
            "address" : address
        });

        // Emit to every other client in the room asking them to send back a text:refresh with the latest text
        emitToOthersInRoom(
            socket.roomId,
            socket.id,
            "text:latest",
            {
                "user": socket.request.user.username,
                "address": address,
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
            if (username.toLowerCase() == connectedClients[i].client.user.username.toLowerCase())
            {
                count++;
            }
        }

        return count;
    }

    return io;
}

module.exports = sockets;