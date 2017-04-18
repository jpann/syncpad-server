var database = require('./database');
var prompt = require('prompt');

var schema = 
{
    properties: 
    {
        username: 
        {
            pattern: /^[a-zA-Z\s\-]+$/,
            message: 'username must be only letters, spaces, or dashes',
            required: true
        }
    }
};

prompt.start();

prompt.get(schema, function (err, result) 
{
    database.del_user(result.username);
});