const express = require('express');
const passport = require('passport');
const moment = require('moment');
const _ = require('underscore');
const router = express.Router();
const utils = require('./../utils.js');
const database = require('./../database');
const sanitizeHtml = require('sanitize-html');

const MIN_PASSWORD_LENGTH = process.env.MIN_PASSWORD_LENGTH || 10;

router.post('/update-profile',
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
                password = sanitizeHtml(password);
                
                database.updateAdminPassword(user_id, password, function(err, id)
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

router.get('/list-clients',
    require('connect-ensure-login').ensureLoggedIn(),
    utils.checkRole('admin'),
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
    
module.exports = router;
