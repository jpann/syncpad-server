var express = require('express');
var passport = require('passport');
var CryptoJS = require("crypto-js");
var shortid = require('shortid');

var _ = require('underscore');

var router = express.Router();

var utils = require('./../utils.js');
var routerUtil = require('./routeUtil');

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

    //const room = { 'roomId': roomId };

    //editorRooms.push(room);
    
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
            var io = req.app.get('socketio');

            const roomId = req.params.roomId || false;

            //let roomExists = _.findWhere(editorRooms, { 'roomId': roomId }) || false;
            let roomExists = checkIfRoomExists(roomId, io);

            /*
            if (roomExists)
            {
            */
                console.log(`Room ${roomId} exists. Joining room.`);

                res.render('editor/editor',
                    {
                        'user': req.user,
                        'roomId': roomId,
                        'sid': req.sessionID
                    });
            /*
            }
            else
            {
                console.log(`Room ${roomId} DOESNT exist. Joining room.`);

                res.redirect('/editor');
            }
            */
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