var express = require('express');
var passport = require('passport');
var flash = require('connect-flash');
var moment = require('moment');

var router = express.Router();
var database = require('./../database');
var utils = require('./../utils.js');

/* GET home page. */
router.get('/',
    loggedIn,
    function(req, res, next)
    {
        res.render('home', { "user": req.user });
    });

router.get('/login',
    function(req, res)
    {
        var referrer = req.header('Referer');

        var e = req.flash('loginMessage')
        res.render('login', { errors :  e});
    });

router.post('/login',
    passport.authenticate('local',
        {
            successReturnToOrRedirect: '/',
            failureRedirect: '/login',
            failureFlash: true
        }));

router.get('/logout',
    function(req, res)
    {
        req.logout();
        res.redirect('/');
    });

router.get('/profile',
    require('connect-ensure-login').ensureLoggedIn(),
    function(req, res)
    {
        res.render('profile', 
        { 
            "user": req.user
        });
    });

router.get('/profile/:id',
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

router.get('/users',
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

router.get('/clients',
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