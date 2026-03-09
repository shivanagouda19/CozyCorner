module.exports = (req, res, next)=>{
    if (!req.isAuthenticated()) {  //req.isAuthenticated() is provided by passort to check is uder is logined
        req.session.redirectUrl= req.originalUrl;
        req.flash("error", "you must be logged in to create listing!");
        return res.redirect("/login");
    }
    next();
}

module.exports.saveRedirectUrl = (req, res, next)=> {
    if (req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};