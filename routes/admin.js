const express = require('express');
const passport = require('passport');
const flash = require('connect-flash');
const moment = require('moment');
const router = express.Router();
const database = require('./../database');
const utils = require('./../utils.js');
const sanitizeHtml = require('sanitize-html');

const MIN_PASSWORD_LENGTH = process.env.MIN_PASSWORD_LENGTH || 10;

router.get('/',
    loggedIn,
    function(req, res, next)
    {
        try
        {
            res.render('admin/home', { 'user' : req.user });
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

        var e = req.flash('error');
        var success = req.flash('setup-success');

        database.adminExists(function(admin_exists)
        {
            if (admin_exists == true)
            {
                res.render('admin/login', { 'errors' :  e, 'success' : success });
            }
            else
            {
                var e = req.flash('setup-error');
                
                res.render('admin/createAdminUser', { 'errors' :  e });
            }
        });
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
        res.render('admin/profile', 
        { 
            'user' : req.user
        });
    });

router.post('/setup',
    function(req, res, next)
    {
        var password = req.body.password;
        var username = req.body.username;

        if (!username || !password)
        {
            req.flash('setup-error', "Invalid user data.");

            res.redirect('/admin/login');
        }
        else
        {
            if (password.length < MIN_PASSWORD_LENGTH)
            {
                req.flash('setup-error', "Password is too short.");

                res.redirect('/admin/login');
            }

            password = sanitizeHtml(password);
            username = sanitizeHtml(username);

            database.addAdminUser(username, password, function(err, data)
            {
                if (err)
                {
                    req.flash('setup-error', err.message);

                    res.redirect('/admin/login');
                }
                else
                {
                    req.flash('setup-success', "Admin login created.");

                    res.redirect('/admin/login');
                }
            });
        }
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