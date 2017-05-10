var express = require('express');
var passport = require('passport');
var CryptoJS = require("crypto-js");
var _ = require('underscore');

var router = express.Router();

var utils = require('./../utils.js');
var routerUtil = require('./routeUtil');

var editorRooms = [];

function createRoom(req)
{
    var io = req.app.get('socketio');

    var roomId = CryptoJS.lib.WordArray.random(128 / 8).toString();
    var room = { 'roomId': roomId };

    return room;
}

router.get('/',
    require('connect-ensure-login').ensureLoggedIn(),
    function(req, res, next)
    {
        try
        {
            res.render('editor/editorSetup', { user: req.user });
        }
        catch (err)
        {
            next(err);
        }
    });

router.post('/',
    require('connect-ensure-login').ensureLoggedIn(),
    function(req, res, next)
    {
        try
        {
            var key = req.body.encryption_key;
            if (!key)
                res.redirect('/editor');

            // 1. Create random room Id
            const room = createRoom(req);

            editorRooms.push(room);
            req.session['key'] = key;

            res.redirect(`/editor/${room.roomId}`);
        }
        catch (err)
        {
            next(err);
        }
    });

router.get('/:roomId',
    require('connect-ensure-login').ensureLoggedIn(),
    function(req, res, next)
    {
        try
        {
            var roomId = req.params.roomId;

            var encryption_key = req.session['key'];

            if (!encryption_key)
                res.redirect('/editor');

            let roomExists = _.findWhere(editorRooms, { 'roomId': roomId }) || false;
            if (roomExists)
            {
                res.render('editor/editor',
                    {
                        'user': req.user.username,
                        'roomId': roomId,
                        'key': encryption_key,
                        'sid': req.sessionID
                    });
            }
            else
            {
                res.redirect('/editor');
            }

        }
        catch (err)
        {
            next(err);
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