'use strict';

const _ = require('underscore');
const moment = require('moment');
const Moniker = require('moniker');
const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');
const CryptoJS = require("crypto-js");
const utils = require('./utils.js');

const ROOMID_MIN_LENGTH = process.env.ROOMID_MIN_LENGTH || 8;
const ROOM_PASSCODE_MIN_LENGTH = process.env.ROOM_PASSCODE_MIN_LENGTH || 6;

class Room 
{
    constructor(io = {}, roomId = {}, passcode = {})
    {
        this.roomId = roomId;
        this.clients = [];
        this.key = null;
        this.passcode = passcode;

        this.names = Moniker.generator([Moniker.adjective, 'names.txt'],
        {
            'glue' : '_'
        });

        const thisIO = io.of(this.roomId);

        io.on('connection', function(socket)
        {
            
        });
    }

    verifyPasscode(passcode)
    {
        if (passcode == this.passcode)
        {
            return true;
        }
        else
        {
            return false;
        }
    }

    addClientToRoom(clientData)
    {
        var clientId = clientData.clientId;
        var username = clientData.username;

        var clientExists = _.findWhere(room.clients, { 'clientId' : clientId }) || false;
    
        if (!clientExists)
        {
            console.log(`${roomId} - Client '${clientId}' doesnt exist in room`)

            this.clients.push({ 'clientId' : clientId, 'username' : username });
        }
        else
        {
            console.log(`${roomId} - Client '${clientId}' exists in room`)
        }
    }

    removeUserFromRoom(clientId)
    {
        this.clients = _.without(this.clients, _.findWhere(this.clients, { 'clientId' : clientId }));
        
        if (this.clients.length < 1)
        {
            // Emit to remove room
        }
    }

    userExists(username)
    {
        var usernameExists = _.findWhere(this.clients, { 'username' : username }) || false;

        if (usernameExists)
            return true;
        else
            return false;
    }


}

exports.Room = Room;