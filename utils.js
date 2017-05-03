'use strict';

exports.getIpAddress = function(remoteAddress)
{
    var ipAddress = remoteAddress.substring(remoteAddress.lastIndexOf(':') + 1);

    return ipAddress
}
