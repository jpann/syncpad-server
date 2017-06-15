'use strict';

exports.getIpAddress = function(remoteAddress)
{
    var ipAddress = remoteAddress.substring(remoteAddress.lastIndexOf(':') + 1);

    // If ipAddress is 1, then they are connecting from the web editor
    if (ipAddress == "1")
    {
        ipAddress = "Web Editor";
    }

    return ipAddress
}

exports.checkRole = function(role)
{
    return function(req, res, next)
    {
        if (req.user && req.user.role == role)
            next();
        else
            res.send(401, 'Unauthorized');
    };
}