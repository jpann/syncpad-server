var express = require('express');
var passport = require('passport');
var Strategy = require('passport-local').Strategy;
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var moment = require('moment');
var flash = require('connect-flash');
var fs = require('fs');
var rfs = require('rotating-file-stream');

var database = require('./database');

const SESSION_SECRET = process.env.SESSION_SECRET || 'keyboard cat';
const MIN_PASSWORD_LENGTH = process.env.MIN_PASSWORD_LENGTH || 10;

var index = require('./routes/index');
var api = require('./routes/api');
var editor = require('./routes/editor');

var app = express();

//
// Setup SessionStore
var session = require('express-session');
var SQLiteStore = require('connect-sqlite3')(session);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(flash());

// Logging
var logDirectory = path.join(__dirname, 'logs')
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory)
var accessLogStream = rfs('access.log',
    {
        interval: '1d', // rotate daily
        path: logDirectory
    });

app.use(logger('combined', { stream: accessLogStream }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//
// Setup session
app.use(session(
{
    store: new SQLiteStore({'db' : 'sessions', 'dir' : 'db' }),
    secret : SESSION_SECRET,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly : false }, // 1 week
    resave: false, 
    saveUninitialized: false,
    name : 'connect.sid'
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(function (req, res, next) 
{
   res.locals.version = process.env.npm_package_version || require('./package.json').version;
   res.locals.ip = req.headers['x-forwarded-for'] || req._remoteAddress;

   next();
});

//
// Config Passport 
passport.use(new Strategy(
    {
        passReqToCallback : true
    },
    function(req, username, password, cb)
    {
        database.validateUser(username, password, function(err, user)
        {
            if (err) 
            { 
                return cb(err, false, { "message" : err.message }); 
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

app.use('/', index);
app.use('/api', api);
app.use('/editor', editor);

// catch 404 and forward to error handler
app.use(function(req, res, next)
{
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function(err, req, res, next)
{
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
