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
            if (password.length < MIN_PASSWORD_LENGTH)
                throw new Error("Password is too short.");

            database.updatePassword(user_id, password, function(err, id)
            {
                if (!err)
                {
                    res.json({ "status": "success", "id": id });
                }
                else
                {
                    res.status(500).json({ "status": "error", "message": err.message });
                }
            });
        }
        catch (err)
        {
            console.log(err);

            res.status(500).json({ "status": "error", "message": err.message });
        }
    });

router.get('/listUsers',
    require('connect-ensure-login').ensureLoggedIn(),
    checkRole('admin'),
    function(req, res, next)
    {
        try
        {
            database.getUsers(function(err, users)
            {
                if (!err)
                {
                    res.json(users);
                }
            });
        }
        catch (err)
        {
            next(err);

            res.status(500).json({ "status": "error", "message": err.message });
        }
    });

router.post('/addUser',
    require('connect-ensure-login').ensureLoggedIn(),
    checkRole('admin'),
    function(req, res) 
    {
        var username = req.body.username;
        var password = req.body.password;

        try
        {
            if (password.length < MIN_PASSWORD_LENGTH)
                res.status(500).json({ "status": "error", "message": "Password is too short."});

            database.addUser(username, password, false, function(err, user)
            {
                if (!err)
                {
                    res.json({ "status": "success", "user": user });
                }
                else
                {
                    res.contentType('json');
                    res.status(500).json({ "status": "error", "message": err.message });
                }
            });
        }
        catch (err)
        {
            console.log(err);

            res.status(500).json({ "status": "error", "message": err.message });
        }
    });

router.post('/delUser',
    require('connect-ensure-login').ensureLoggedIn(),
    checkRole('admin'),
    function(req, res, next)
    {
        var user_id = req.body.id;

        try
        {
            database.delUser(user_id, function(err, id)
            {
                if (err)
                {
                    res.status(500).json({ "status": "error", "message": err.message });
                }
                else
                {
                    res.json({ "result": id });
                }
            });
        }
        catch (err)
        {
            console.log(err);
            res.status(500).json({ "status": "error", "message": err.message });
        }
    });

router.post('/updateUser',
    require('connect-ensure-login').ensureLoggedIn(),
    checkRole('admin'),
    function(req, res, next)
    {
        var user_id = req.body.id;
        var password = req.body.password;

        try
        {
            if (password.length < MIN_PASSWORD_LENGTH)
                throw new Error("Password is too short.");

            database.updatePassword(user_id, password, function(err, id)
            {
                if (!err)
                {
                    res.json({ "status": "success", "id": id });
                }
                else
                {
                    res.status(500).json({ "status": "error", "message": err.message });
                }
            });
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
                    var connectedTime = moment(client.client.connectedTime);
                    var lastUpdateTime = moment(client.client.lastUpdateTime);

                    var client_addr = client.handshake.headers["x-real-ip"] || client.request.connection.remoteAddress;

                    var remoteAddress = utils.getIpAddress(client_addr); 

                    clients.push(
                    {
                        "roomId" : client.roomId,
                        "socketId" : socketId,
                        "username" : client.client.user.username,
                        "rooms" : Object.keys(client.rooms),
                        "remoteAddress" : remoteAddress,
                        "user_id" : client.client.user.user_id,
                        "namespace" : client.nsp.name,
                        "connectedTime" : connectedTime.format('YYYY MM DD, h:mm:ss a'),
                        "lastUpdateTime" : lastUpdateTime.format('YYYY MM DD, h:mm:ss a'),
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

router.post('/updateUserProfile',
    require('connect-ensure-login').ensureLoggedIn(),
    checkRole('admin'),
    function(req, res, next)
    {
        var user_id = req.body.id;
        var max_clients = req.body.max_clients;
        var role = req.body.role;
        var locked = req.body.locked;

        try
        {
            if (!max_clients || max_clients <= 1)
                throw new Error("Invalid max clients.");

            if (!role || (role.toLowerCase() != 'admin' && role.toLowerCase() != 'user'))
                role = 'user';

            if (!locked)
                locked = false;

            database.updateUser(user_id, max_clients, role, locked, function(err, id)
            {
                if (!err)
                {
                    res.json({ "status": "success", "id": id });
                }
                else
                {
                    res.status(500).json({ "status": "error", "message": err.message });
                }
            });
        }
        catch (err)
        {
            console.log(err);

            res.status(500).json({ "status": "error", "message": err.message });
        }
    });

router.get('/users/:roomId',
    require('connect-ensure-login').ensureLoggedIn(),
    function(req, res, next)
    {
        try
        {
            var roomId = req.params.roomId;
            var userId = req.user.user_id;
            
            if (!roomId)
            {
                res.status(500).json({ "status": "error", "message": "Invalid roomId" });
            }

            var io = req.app.get('socketio');

            // get list of clients
            var sockets = Object.keys(io.sockets.adapter.rooms[roomId].sockets);
            var userInRoom = _.find(sockets, function(id)
            {
                var socket = io.sockets.connected[id];

                if (socket.client.user.user_id == userId)
                {
                    return true;
                }
            });

            if (!userInRoom)
            {
                res.status(500).json({ "status": "error", "message": "Only users in the room can do this action." });
            }

            var clients = [];

            for (var i = 0; i < sockets.length; i++)
            {
                var socketId = sockets[i];
                var socket = io.sockets.connected[socketId];

                if (socket)
                {
                    var connectedTime = moment(socket.client.connectedTime);
                    var lastUpdateTime = moment(socket.client.lastUpdateTime);

                    var client_addr = socket.handshake.headers["x-real-ip"] || socket.request.connection.remoteAddress;

                    var remoteAddress = utils.getIpAddress(client_addr); 

                    clients.push(
                    {
                        "roomId" : socket.roomId,
                        "username" : socket.client.user.username,
                        "remoteAddress" : remoteAddress,
                        "user_id" : socket.client.user.user_id,
                        "connectedTime" : connectedTime.format('YYYY MM DD, h:mm:ss a'),
                        "lastUpdateTime" : lastUpdateTime.format('YYYY MM DD, h:mm:ss a'),
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

function loggedIn(req, res, next) 
{
    if (req.user) 
    {
        next();
    }
    else 
    {
        res.redirect('/login');
    }
}