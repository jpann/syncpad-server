'use strict';

require('dotenv').config()

const HTTP_PORT = process.env.HTTP_PORT || 80;
const SERVICE_PORT = process.env.SERVICE_PORT || 3000;
const DATABASE = process.env.DATABASE || './db/database.db';
const USE_SSL = process.env.USE_SSL || 'N';
const SSL_KEY = process.env.SSL_KEY || './certs/syncpad.pem';
const SSL_CERT = process.env.SSL_CERT || './certs/syncpad.crt';
const SECURE_KEY = process.env.SECURE_KEY || 'keyboard cat';

var config = require("./config.json");
var database = require('./database');

var io = require('./server').listen(
    SERVICE_PORT, 
    USE_SSL,
    SSL_KEY,
    SSL_CERT,
    config, 
    database);

var http = require('./httpServer').listen(
    HTTP_PORT, 
    USE_SSL,
    SSL_KEY,
    SSL_CERT,
    config, 
    database, 
    io);

