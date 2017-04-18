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
        },
        password: 
        {
            required: true
        }
    }
};

prompt.start();

prompt.get(schema, function (err, result) 
{
    var added = database.add_user(result.username, result.password, false);

    if (added)
    {
        console.log("Added user '" + result.username + "'.");
    }
    else
    {
        console.log("User '"+ result.username + "' already exists.");
    }
});