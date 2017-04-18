'use strict';

var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);

var db;
var config;

app.get('/', function(req, res)
{
  res.sendStatus(200);
});

require('socketio-auth')(io, {
  authenticate: authenticate,
  postAuthenticate: postAuthenticate,
  timeout: 1000
});


function authenticate(socket, data, callback)
{
  var username = data.username;
  var password = data.password;

  db.validate_user(username, password, callback);
}

function postAuthenticate(socket, data) 
{
  var username = data.username;
  var room = username;

  socket.client.user = username;
  socket.roomId = room;

  socket.join(room);

  console.log("Authenticated: " + username);

  socket.broadcast.to(socket.roomId).emit('client_message', { uname : "SERVER", message: "* " + socket.client.user + " connected *" });
}

io.on('connection', function(socket)
{
  socket.on('disconnect', function()
  {
    console.log(socket.client.user + " disconnected");

     socket.broadcast.to(socket.roomId).emit('client_message', { uname : "SERVER", message: "* " + socket.client.user + " disconnected *" });
  });

  // Client message
  socket.on('client_message', function(msg)
  {
    var address = socket.handshake.address;

    //console.log(msg.uname + " (Socket.User: " + socket.client.user + "; roomId: " + socket.roomId + ")> " + msg.message);

    io.in(socket.roomId).emit('client_message', msg);
  });

  // Client text update
  socket.on('text', function(msg)
  {
    var m_user = socket.client.user;
    var m_text = msg.text;
    var m_hostname = msg.hostname;
    var m_encrypted = msg.encrypted;

    //console.log("TEXT (Socket.User: " + socket.client.user + "; roomId: " + socket.roomId + "; encrypted: " + m_encrypted + ")> " + m_text);

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
    var address = socket.handshake.address;
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
})

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