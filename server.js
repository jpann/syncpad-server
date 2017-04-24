'use strict';

var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);

var db;
var config;

let connectedClients = {};

app.get('/', function(req, res)
{
  res.sendStatus(200);
});

require('socketio-auth')(io, 
{
  authenticate: authenticate,
  postAuthenticate: postAuthenticate,
  timeout: 1000
});

function getSocketsInRoom(room)
{
  let sockets = [];

  try 
  {
    let socketObj = io.sockets.adapter.rooms[room].sockets;

    for (let id of Object.keys(socketObj)) 
    {
      sockets.push(io.sockets.connected[id]);
    }
  } 
  catch(e) 
  {
    console.log(`Attempted to access non-existent room: ${room}`);
  }

  return sockets;
}

function emitToOthersInRoomWithCallback(room, socketId, eventName, eventMessage, callback)
{
  var sockets = getSocketsInRoom(room);

  for (var i = 0; i < sockets.length; i++)
  {
    if (sockets[i].id == socketId)
      return;

    //sockets[i].emit(eventName, eventMessage, callback);
    sockets[i].emit(eventName, eventMessage);
  }
}

function addConnectedClient(socketId, data)
{
  if (!(socketId in connectedClients))
  {
    connectedClients[socketId] = data;
  }
}

function removeConnectedClient(socketId)
{
  if (!(socketId in connectedClients))
  {
    delete connectedClients[socketId];
  }
}

function authenticate(socket, data, callback)
{
  var username = data.username;
  var password = data.password;

  db.validate_user(username, password, callback);
}

function postAuthenticate(socket, data) 
{
  var username = data.username;
  var editor_room_id = data.editor_room_id;
  
  socket.client.user = username;
  socket.roomId = editor_room_id;

  console.log(`Authenticated: ${socket.client.user} [${socket.request.connection.remoteAddress}]; room '${socket.roomId}'.`);

  socket.join(socket.roomId);

  // Add to connectedClients
  addConnectedClient(socket.id, { "username" : username, "room" : [ socket.roomId ]});

  socket.broadcast.to(socket.roomId).emit('room:join', { "room" : socket.roomId, "user" : socket.client.user });

  // Emit to every other client in the room asking them to send back the latest text
  emitToOthersInRoomWithCallback(
    socket.roomId, 
    socket.id, 
    "text:latest", 
    {   
      "user" : username,
      "address" : socket.request.connection.remoteAddress,
      "id" : socket.id
    }, 
    function (data)
    {
      var m_text = data.text;
      var m_hostname = data.hostname;

      //TODO This entire text refresh needs to be thought out again.

      socket.emit('text:refresh', { "text" : m_text, "hostname" : m_hostname });
    });
}

io.on('connection', function(socket)
{
  console.log(`Connected: ${socket.handshake.address}.`);

  socket.on('disconnect', function()
  {
    console.log(`Disconnected: '${socket.client.user}' [${socket.request.connection.remoteAddress}].`);

    // Remove from connectedClients
    removeConnectedClient(socket.id);

    socket.broadcast.to(socket.roomId).emit('room:leave', { "room" : socket.roomId, "user" : socket.client.user });
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

    console.log('text: ' + JSON.stringify(msg));

    socket.broadcast.to(socket.roomId).emit('text', 
    { 
      "user" : m_user, 
      "text" : m_text, 
      "encrypted" : m_encrypted, 
      "hostname" : m_hostname 
    });
  });

  // Client 'is typing'
  socket.on('text:typing', function(msg)
  {
    var user = socket.client.user;
    var address = socket.request.connection.remoteAddress;
    var typing = msg.is_typing;
    var hostname = msg.hostname;

    socket.broadcast.to(socket.roomId).emit('text:typing', 
      { 
        "user" : user,
        "address" : address,
        "is_typing" : typing,
        "hostname" : hostname
      });
  });

  socket.on('text:refresh', function(msg)
  {
    var user = socket.client.user;
    var address = socket.request.connection.remoteAddress;
    var id = msg.id;
    var text = msg.text;

    console.log('text:refresh - ' + id);

    socket.broadcast.to(id).emit('text:refresh', { "text" : text, "hostname" : address });
  });
});

function start(port, configuration, database)
{
  config = configuration;
  db = database;

  http.listen(port, function()
  {
    console.log("Listening on *:" + port);
  });
}

function stop()
{
  io.close();
}

exports.start = start;
exports.stop = stop;