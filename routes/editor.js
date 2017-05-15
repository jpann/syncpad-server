var express = require('express');
var passport = require('passport');
var CryptoJS = require("crypto-js");
var shortid = require('shortid');

var _ = require('underscore');

var router = express.Router();

var utils = require('./../utils.js');
var routerUtil = require('./routeUtil');

const ROOMID_MIN_LENGTH = process.env.ROOMID_MIN_LENGTH || 8;

function checkIfRoomExists(roomId, io)
{
    let socketObj = io.sockets.adapter.rooms;

    for (let id of Object.keys(socketObj))
    {
        if (id == roomId)
            return true;
    }

    return false;
}

function cleanRoomId(id)
{
    const roomId = id.toLowerCase().replace(/[^A-Za-z0-9]/g, '-');
    if (roomId.length >= 50)
    {
        return roomId.substr(0, 50);
    }

    return roomId;
}

function createRoom(req, res)
{
    var roomId = cleanRoomId(shortid.generate());
    
    console.log("Created new room: " + roomId);

    res.redirect(`/editor/${roomId}`);
}

router.get('/',
    require('connect-ensure-login').ensureLoggedIn(),
    function(req, res, next)
    {
        try
        {
            createRoom(req, res);
        }
        catch (err)
        {
            next(err);
        }
    });

/*
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
*/

router.get('/:roomId',
    require('connect-ensure-login').ensureLoggedIn(),
    function(req, res, next)
    {
        try
        {
            const roomId = req.params.roomId || false;

            if (roomId.length < ROOMID_MIN_LENGTH)
                res.redirect('/editor');

            var io = req.app.get('socketio');

            res.render('editor/editor',
                {
                    'user': req.user,
                    'roomId': roomId,
                    'sid': req.sessionID
                });
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