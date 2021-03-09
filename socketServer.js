const moment = require('moment');
const _ = require('underscore');
const shortid = require('shortid');
const CryptoJS = require("crypto-js");
const passwordHash = require('password-hash');
const Moniker = require('moniker');
const utils = require('./utils.js');
const database = require('./database');
const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');

const ROOMID_MIN_LENGTH = process.env.ROOMID_MIN_LENGTH || 8;
const ROOM_PASSCODE_MIN_LENGTH = process.env.ROOM_PASSCODE_MIN_LENGTH || 6;

var sockets = {};

sockets.init = function(server)
{
    let connectedClients = [];

    let rooms = [];

    var names = Moniker.generator([Moniker.adjective, 'data/names.txt'],
    {
        'glue' : '_'
    });

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

        console.log(`checkIfRoomExists - roomId=${roomId}; roomExists=${roomExists}`)

        return roomExists;
    }

    function getRoom(roomId)
    {
        var room = _.findWhere(rooms, { 'roomId' : roomId });

        return room;
    }

    function verifyRoomPasscode(roomId, passcode)
    {
        var room = _.findWhere(rooms, { 'roomId' : roomId });

        if (room)
        {
            //var verifyPassword = passwordHash.verify(password, room.password);
            if (passcode == room.passcode)
            {
                return true;
            }
        }

        return false;
    }

    function joinRoom(roomId, clientData, passcode)
    {
        console.log(`joinRoom - roomId = ${roomId} -passcode=${passcode}`)

        if (!roomId || !passcode)
            return null;

        var roomExists = checkIfRoomExists(roomId);
        console.log(`joinRoom - roomExists = ${roomExists}`)

        if (roomExists)
        {
            console.log(`${roomId} - Room exists`)
            if (verifyRoomPasscode(roomId, passcode))
            {
                console.log(`${roomId} - Passcode verified`)
                return room = addClientToRoom(roomId, clientData);
            }
            else
            {
                return undefined;
            }
        }
        else
        {
            if (!passcode || passcode.length < ROOM_PASSCODE_MIN_LENGTH)
                return null;

            // Create new room
            var room = createRoom(roomId, passcode);

            addClientToRoom(room.roomId, clientData);

            return room;
        }
    }

    function createRoom(roomId, passcode)
    {
        console.log(`createRoom - roomId=${roomId}; passcode=${passcode}`)

        var key = CryptoJS.lib.WordArray.random(128 / 8).toString();

        console.log(`${roomId} - Creating room with key ${key}`)
        
        var room = 
        {
            'roomId' : roomId,
            'passcode' : passcode,
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

    function addClientToRoom(roomId, clientData)
    {
        var clientId = clientData.clientId;
        var username = clientData.username;

        var room = _.findWhere(rooms, { 'roomId' : roomId });

        if (room)
        {
            var clientExists = _.findWhere(room.clients, { 'clientId' : clientId }) || false;

            if (!clientExists)
            {
                console.log(`${roomId} - Client '${clientId}' doesnt exist in room`)

                room.clients.push({ 'clientId' : clientId, 'username' : username });
            }
            else
            {
                console.log(`${roomId} - Client '${clientId}' exists in room`)
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

    function usernameExistsInRoom(roomId, username)
    {
        var room = _.findWhere(rooms, { 'roomId' : roomId });

        if (room)
        {
            var usernameExists = _.findWhere(room.clients, { 'username' : username }) || false;

            if (usernameExists)
                return true;
            else
                return false;
        }
    }

    // socket.io setup
    //let io = require('socket.io').listen(server);
    let io = require('socket.io')(server);

    // 
    // Get roomId from handshake and set it on the socket
    io.use(function(socket, next)
    {
        var roomId = socket.handshake.query.roomId;

        console.log(`roomId: ${roomId}.`);

        if (roomId && roomId.length >= ROOMID_MIN_LENGTH)
        {
            socket.roomId = roomId;

            return next();
        }

        next(new Error('RoomId invalid'));
    });

    io.on('connection', function(socket)
    {
        var client_addr = socket.handshake.headers["x-real-ip"] || socket.request.connection.remoteAddress;

        console.log(`Connected: ${utils.getIpAddress(client_addr)}.`);

        var roomId = socket.roomId;

        //
        // Request room passcode
        var roomId = socket.roomId;
        var clientId = socket.id;

        socket.emit('room:auth', 
            {
                'roomId' : roomId,
            },
            function(data)
            {
                var passcode = data.passcode;

                // Generate random username
                var user = names.choose();

                var room = joinRoom(roomId, { 'clientId' : clientId, 'username' : user }, passcode);

                if (room)
                {
                    postAuthentication(socket, room, user);
                }
                else
                {
                    socket.emit('unauthorized', 
                    { 
                        'message' : `Unable to join room. Invalid room passcode or passcode length is less than ${ROOM_PASSCODE_MIN_LENGTH}.`,
                        'roomId' : roomId
                    });

                    socket.roomId = undefined;

                    socket.disconnect(true);
                }
            });

        socket.on('disconnect', function()
        {
            var client_addr = socket.handshake.headers["x-real-ip"] || socket.request.connection.remoteAddress;

            var address = utils.getIpAddress(client_addr);
            console.log(`Disconnected: '${socket.username}' [${address}].`);

            if (socket.roomId != undefined)
            {
                // Remove from connectedClients
                removeConnectedClient(socket);
                removeClientFromRoom(socket.roomId, socket.id);

                socket.broadcast.to(socket.roomId).emit('room:leave', 
                { 
                    "room": socket.roomId, 
                    "user": socket.username
                });
            }
        });

        // Client text update
        socket.on('text', function(msg)
        {
            var m_user = socket.username;
            var m_text = msg.text;

            socket.client.lastUpdateTime = moment.utc().format();

            socket.broadcast.to(socket.roomId).emit('text',
                {
                    "user": m_user,
                    "text": m_text,
                });
        });

        // Client 'is typing'
        socket.on('text:typing', function(msg)
        {
            var user = socket.username;
            var client_addr = socket.handshake.headers["x-real-ip"] || socket.request.connection.remoteAddress;
            var address = utils.getIpAddress(client_addr);

            socket.client.lastUpdateTime = moment.utc().format();

            socket.broadcast.to(socket.roomId).emit('text:typing',
                {
                    "user": user,
                });
        });

        socket.on('text:refresh', function(msg)
        {
            var user = socket.username;
            var client_addr = socket.handshake.headers["x-real-ip"] || socket.request.connection.remoteAddress;

            var address = utils.getIpAddress(client_addr);
            var id = msg.id;
            var text = msg.text;

            socket.broadcast.to(id).emit('text:refresh', { "text": text });
        });

        // Get list of users in room by RoomId
        socket.on('users:list', function(msg, ack)
        {
            var roomId = socket.roomId;

            if (!roomId)
                ack(null);

            var sockets = Object.keys(io.sockets.adapter.rooms[roomId].sockets);

            var clients = [];

            for (var i = 0; i < sockets.length; i++)
            {
                var socketId = sockets[i];
                var client_socket = io.sockets.connected[socketId];

                if (client_socket)
                {
                    var connectedTime = client_socket.client.connectedTime;
                    var lastUpdateTime = client_socket.client.lastUpdateTime;

                    var client_addr = client_socket.handshake.headers["x-real-ip"] || client_socket.request.connection.remoteAddress;

                    var remoteAddress = utils.getIpAddress(client_addr); 

                    clients.push(
                    {
                        "roomId" : client_socket.roomId,
                        "username" : client_socket.username,
                        "connectedTime" : connectedTime,
                        "lastUpdateTime" : lastUpdateTime,
                    });
                }
            }

            ack(clients);
        });

        socket.on('chat:msg', function(data)
        {
            var username = socket.username;
            var msg = data.message;

            // Decrypt message and sanitize
            var room = _.findWhere(rooms, { 'roomId' : socket.roomId });
            if (room)
            {
                var de_msg = CryptoJS.AES.decrypt(msg, room.key).toString(CryptoJS.enc.Utf8);
                de_msg = sanitizeHtml(de_msg, 
                {
                    allowedTags: [ 'b', 'i', 'strong']
                });

                if (!de_msg)
                    return;

                msg = CryptoJS.AES.encrypt(de_msg, room.key).toString();
            }

            io.in(socket.roomId).emit('chat:msg',
                {
                    "user": username,
                    "message" : msg
                });
        });

        socket.on('chat:name change', function(data, ack)
        {
            var username = data.username;

            username = sanitizeHtml(username, 
            {
                allowedTags: []
            });

            if (usernameExistsInRoom(socket.roomId, username))
            {
                ack("Username already exists", { 'username' : socket.username });
            }
            else
            {
                socket.username = username;

                ack(null, { 'username' : username });
            }
        });
    });

    //
    // Functions
    function postAuthentication(socket, room, user)
    {
        var client_addr = socket.handshake.headers["x-real-ip"] || socket.request.connection.remoteAddress;

        var address = utils.getIpAddress(client_addr);

        // Generate random username
        //var user = names.choose();
        var roomId = socket.roomId;

        socket.username = user;

        socket.client.connectedTime = moment.utc().format();
        socket.client.lastUpdateTime = moment.utc().format();

        console.log(`Authenticated: ${socket.username} [${socket.id}]; room '${socket.roomId}'.`);

        // Elliptic Curve Diffie-Hellman key exchange
        var server = crypto.createECDH('secp521r1');
        server.generateKeys('hex');
        var publickey = server.getPublicKey('hex');

        // Do key exchange
        socket.emit('auth:exchange', 
        {
            'roomId' : roomId,
            'key' : publickey,
        }, function(data)
        {
            var client_publickey = data.key;

            // Secret key is used to encrypt the room's AES encryption key and passcode
            var secret_key = server.computeSecret(client_publickey, 'hex', 'hex');
            
            // Encrypt room's AES encryption key using secret key generated by the key exchange
            var encrypted_key = CryptoJS.AES.encrypt(room.key, secret_key).toString();
            
            // Encrypt room's passcode using secret key generated by the key exchange
            var encrypted_passcode = CryptoJS.AES.encrypt(room.passcode, secret_key).toString();
            
            // Emit that the client is authenticated, and send the encrypted room key and passcode
            socket.emit('authenticated',
            {
                "roomId" : roomId,
                'key' : encrypted_key,
                'passcode' : encrypted_passcode,
                'username' : socket.username
            });

            socket.join(socket.roomId);

            // Add to connectedClients
            addConnectedClient(socket);

            socket.broadcast.to(socket.roomId).emit('room:join', 
            { 
                "room": socket.roomId, 
                "user": socket.username,
            });

            // Emit to every other client in the room asking them to send back a text:refresh with the latest text
            emitToOthersInRoom(
                socket.roomId,
                socket.id,
                "text:latest",
                {
                    "user": socket.username,
                    "id": socket.id
                });
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
            if (username.toLowerCase() == connectedClients[i].username.toLowerCase())
            {
                count++;
            }
        }

        return count;
    }

    return io;
}

module.exports = sockets;