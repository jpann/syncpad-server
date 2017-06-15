const express = require('express');
const passport = require('passport');
const flash = require('connect-flash');
const moment = require('moment');
const router = express.Router();
const database = require('./../database');
const utils = require('./../utils.js');

router.get('/',
    loggedIn,
    function(req, res, next)
    {
        try
        {
            res.render('home', { user: req.user });
        }
        catch (err)
        {
            next(err);
        }
    });

router.get('/login',
    function(req, res)
    {
        var referrer = req.header('Referer');

        var e = req.flash('error')
        res.render('login', { errors :  e});
    });

router.post('/login',
    passport.authenticate('local',
        {
            successReturnToOrRedirect: '/admin',
            failureRedirect: '/admin/login',
            failureFlash: true
        }));

router.get('/logout',
    function(req, res)
    {
        req.logout();
        res.redirect('/admin');
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

module.exports = router;

function loggedIn(req, res, next) 
{
    if (req.user) 
    {
        next();
    }
    else 
    {
        res.redirect('/admin/login');
    }
}