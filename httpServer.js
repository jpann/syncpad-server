'use strict';

var fs = require('fs');
var express = require("express");
var passport = require('passport');
var Strategy = require('passport-local').Strategy;
var bodyparser = require('body-parser');
var moment = require('moment');
var utils = require('./utils.js');

const SESSION_SECRET = process.env.SESSION_SECRET || 'keyboard cat';

var database;
var config;
var socket;

// Setup
var app = express();

app.use(express.static('public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));

app.use(require('express-session')({ secret: SESSION_SECRET, resave: false, saveUninitialized: false }));

app.use(passport.initialize());
app.use(passport.session());

const minPasswordLength = 6;

//
// Passport
// 
passport.use(new Strategy(
    function(username, password, cb)
    {
        database.validateUser(username, password, function(err, user)
        {
            if (err) 
            { 
                return cb(err); 
            }

            if (!user) 
            { 
                return cb(null, false); 
            }

            if (user)
            {
                return cb(null, user);
            }
        });
    }
));

//
// Configure password authenticated session persistence.
//
passport.serializeUser(function(user, cb)
{
    cb(null, user.user_id);
});

passport.deserializeUser(function(id, cb)
{
    database.getUserById(id, function(err, user)
    {
        if (err) 
        {
            return cb(err);
        }
        cb(null, user);
    });
});

//
// HTTP Routes
// 
//var http = require("http").Server(app);
var checkRole = function(role)
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

app.get('/',
    loggedIn,
    function(req, res, next) 
    {
        res.render('home', { "user": req.user });
    });

app.get('/login',
    function(req, res)
    {
        res.render('login');
    });

app.post('/login',
    passport.authenticate('local', { failureRedirect: '/login' }),
    function(req, res) 
    {
        res.redirect('/');
    });

app.get('/logout',
    function(req, res)
    {
        req.logout();
        res.redirect('/');
    });

app.get('/profile',
    require('connect-ensure-login').ensureLoggedIn(),
    function(req, res)
    {
        res.render('profile', { "user": req.user });
    });

app.get('/profile/:id',
    require('connect-ensure-login').ensureLoggedIn(),
    checkRole('admin'),
    function(req, res)
    {
        var user_id = req.params.id;

        try
        {
            database.getUserById(user_id, function(err, user)
            {
                if (!err && user)
                {
                    res.render('editUser', { "edit_user": user, "user": req.user });
                }
                else
                {
                    res.redirect('/listUsers', { "user": req.user });
                }
            });
        }
        catch (err)
        {
            console.log(err);

            res.status(500).send('Error')
            next(err);
        }
    });

app.get('/users',
    require('connect-ensure-login').ensureLoggedIn(),
    checkRole('admin'),
    function(req, res, next)
    {
        try
        {
            res.render('listUsers', { user: req.user });
        }
        catch (err)
        {
            next(err);
        }
    });

app.get('/clients',
    require('connect-ensure-login').ensureLoggedIn(),
    checkRole('admin'),
    function(req, res, next)
    {
        try
        {
            res.render('clientsList', { user: req.user });
        }
        catch (err)
        {
            next(err);
        }
    });

//
// API
//
app.post('/api/profile/update',
    require('connect-ensure-login').ensureLoggedIn(),
    function(req, res, next)
    {
        var password = req.body.password;
        var user_id = req.user.user_id;

        try
        {
            if (password.length < minPasswordLength)
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

app.get('/api/listUsers',
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

app.post('/api/addUser',
    require('connect-ensure-login').ensureLoggedIn(),
    checkRole('admin'),
    function(req, res) 
    {
        var username = req.body.username;
        var password = req.body.password;

        try
        {
            if (password.length < minPasswordLength)
                throw new Error("Password is too short.");

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

app.post('/api/delUser',
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

app.post('/api/updateUser',
    require('connect-ensure-login').ensureLoggedIn(),
    checkRole('admin'),
    function(req, res, next)
    {
        var user_id = req.body.id;
        var password = req.body.password;

        try
        {
            if (password.length < minPasswordLength)
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

app.get('/api/listClients',
    require('connect-ensure-login').ensureLoggedIn(),
    checkRole('admin'),
    function(req, res, next)
    {
        try
        {
            // get list of clients
            var sockets = Object.keys(socket.sockets.sockets);
            var clients = [];

            for (var i = 0; i < sockets.length; i++)
            {
                var socketId = sockets[i];
                var client = socket.sockets.connected[socketId];

                if (client)
                {
                    var connectedTime = moment(client.client.connectedTime);
                    var lastUpdateTime = moment(client.client.lastUpdateTime);

                    var remoteAddress = utils.getIpAddress(client.client.conn.remoteAddress);

                    clients.push(
                    {
                        "roomId" : client.roomId,
                        "socketId" : socketId,
                        "username" : client.client.user,
                        "rooms" : Object.keys(client.rooms),
                        "remoteAddress" : remoteAddress,
                        "user_id" : client.client.user_id,
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

app.post('/api/updateUserProfile',
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

exports.listen = function(
    port, 
    use_ssl,
    ssl_key,
    ssl_cert,
    configuration, 
    db, 
    io)
{
    database = db;
    config = configuration;
    socket = io;

    var http;
    
    if (use_ssl == 'Y')
    {
        //TODO Fix this
        var options = 
        {
            key : fs.readFileSync(ssl_key),
            cert : fs.readFileSync(ssl_cert)
        };

        var https = require("https");
        http = https.createServer(options, app);
    }
    else
    {
        http = require("http").Server(app);
    }

    http.listen(port, function()
    {
        console.log("Web Server Listening on *:" + port);
    });

    return app;
}

exports.stop = function()
{
    http.stop();
}