var express = require('express');
var passport = require('passport');
var moment = require('moment');
var _ = require('underscore');
var router = express.Router();

var utils = require('./../utils.js');
var routerUtil = require('./routeUtil');
var database = require('./../database');

const MIN_PASSWORD_LENGTH = process.env.MIN_PASSWORD_LENGTH || 10;

router.post('/login',
    passport.authenticate('local'),
    function(req, res) 
    {
        var sid = req.sessionID;

        res.json({ 'sid' : sid });
    });

router.get('/logout',
    function(req, res)
    {
        req.logout();
    });

router.post('/profile/update',
    require('connect-ensure-login').ensureLoggedIn(),
    function(req, res, next)
    {
        var password = req.body.password;
        var user_id = req.user.user_id;

        try
        {
            req.checkBody('password', 'Password is too short.').notEmpty().isMinLength(MIN_PASSWORD_LENGTH);

            var errors = req.validationErrors();

            if (errors)
            {
                var msg = "";

                errors.forEach(function(element) {
                    msg += element.msg;
                });

                res.json({ "status": "error", "message": msg });
            }
            else
            {
                database.updatePassword(user_id, password, function(err, id)
                {
                    if (!err)
                    {
                        res.json({ "status": "success", "id": id });
                    }
                    else
                    {
                        res.json({ "status": "error", "message": err.message });
                    }
                });
            }
            
        }
        catch (err)
        {
            console.log(err);

            res.status(500).json({ "status": "error", "message": err.message });
        }
    });

router.get('/listClients',
    require('connect-ensure-login').ensureLoggedIn(),
    checkRole('admin'),
    function(req, res, next)
    {
        try
        {
            var io = req.app.get('socketio');

            // get list of clients
            var sockets = Object.keys(io.sockets.sockets);
            var clients = [];

            for (var i = 0; i < sockets.length; i++)
            {
                var socketId = sockets[i];
                var client = io.sockets.connected[socketId];

                if (client)
                {
                    var connectedTime = client.client.connectedTime;
                    var lastUpdateTime = client.client.lastUpdateTime;

                    var client_addr = client.handshake.headers["x-real-ip"] || client.request.connection.remoteAddress;

                    var remoteAddress = utils.getIpAddress(client_addr); 

                    clients.push(
                    {
                        "roomId" : client.roomId,
                        "socketId" : socketId,
                        "username" : client.username,
                        "rooms" : Object.keys(client.rooms),
                        "remoteAddress" : remoteAddress,
                        "namespace" : client.nsp.name,
                        "connectedTime" : connectedTime,
                    });
                }
            }

            res.json(clients);
            
        }
        catch (err)
        {
            console.log(err);

            res.status(500).json({ "status": "error", "message": err.message });
        }
    });

router.get('/users/:roomId',
    //require('connect-ensure-login').ensureLoggedIn(),
    function(req, res, next)
    {
        try
        {
            var roomId = req.params.roomId;
            
            if (!roomId)
            {
                res.status(500).json({ "status": "error", "message": "Invalid roomId" });
            }

            var io = req.app.get('socketio');

            // get list of clients
            var sockets = Object.keys(io.sockets.adapter.rooms[roomId].sockets);

            var clients = [];

            for (var i = 0; i < sockets.length; i++)
            {
                var socketId = sockets[i];
                var socket = io.sockets.connected[socketId];

                if (socket)
                {
                    var connectedTime = socket.client.connectedTime;
                    var lastUpdateTime = socket.client.lastUpdateTime;

                    var client_addr = socket.handshake.headers["x-real-ip"] || socket.request.connection.remoteAddress;

                    var remoteAddress = utils.getIpAddress(client_addr); 

                    clients.push(
                    {
                        "roomId" : socket.roomId,
                        "username" : socket.username,
                        "connectedTime" : connectedTime,
                        "lastUpdateTime" : lastUpdateTime,
                    });
                }
            }

            res.json(clients);
        }
        catch (err)
        {
            console.log(err);

            res.status(500).json({ "status": "error", "message": err.message });
        }
    });

module.exports = router;

function checkRole(role)
{
    return function(req, res, next)
    {
        if (req.user && req.user.role == role)
            next();
        else
            res.send(401, 'Unauthorized');
    };
};
