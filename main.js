'use strict';

const PORT = 3000;

var config = require("./config.json");
var server = require("./server");
var database = require('./database');

server.start(PORT, config, database);
