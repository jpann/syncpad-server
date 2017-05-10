module.exports.checkRole = function(role)
{
    return function(req, res, next)
    {
        if (req.user && req.user.role == role)
            next();
        else
            res.send(401, 'Unauthorized');
    };
};

module.exports.loggedIn = function(req, res, next) 
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