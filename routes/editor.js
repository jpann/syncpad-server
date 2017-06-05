var express = require('express');
var CryptoJS = require("crypto-js");
var shortid = require('shortid');
var hri = require('human-readable-ids').hri;
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
    const roomId = id.toLowerCase().replace(/[^A-Za-z0-9\-]/g, '-');
    if (roomId.length >= 50)
    {
        return roomId.substr(0, 50);
    }

    return roomId;
}

function createRoom(req, res)
{
    var baseUrl = req.baseUrl;

    var id = hri.random();

    if (baseUrl.toLowerCase() == '/e')
    {
        id = shortid.generate();
    }

    var roomId = cleanRoomId(id);

    console.log("Created new room: " + roomId);

    res.redirect(`/editor/${roomId}`);
}

router.get('/',
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

router.get('/:roomId',
    function(req, res, next)
    {
        try
        {
            const roomId = req.params.roomId || false;

            if (roomId.length < ROOMID_MIN_LENGTH)
                res.redirect('/editor');

            var io = req.app.get('socketio');

            var roomExists = checkIfRoomExists(roomId, io);

            res.render('editor/editor',
                {
                    'roomId': roomId,
                    'roomExists' : roomExists
                });
        }
        catch (err)
        {
            next(err);
        }
    });

module.exports = router;
