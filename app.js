if (process.env.NODE_ENV != "production") {
require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
// const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";
const MONGO_URL_ATLASDB = process.env.ATLASDB;
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate"); // help to make templte
const ExpressError = require("./utils/ExpressError"); // import the coustom error 
const listingsRouter = require("./routes/listing.js") // import the router
const reviewRouter = require("./routes/review.js")// import the router
const userRouter = require("./routes/user.js")// import the router
const profileRouter = require("./routes/profile.js")
const session = require("express-session"); //this is used for create session
const { MongoStore } = require('connect-mongo');
const flash = require("connect-flash");   // this is for flashing a message
const passport = require("passport");// this is for hashing password and many more
const LocalStrategy = require("passport-local"); // A strategy tells Passport how to authenticate a user. in this case it is localstrategy
const User = require("./models/user.js");

main().then(() => {
    console.log("connected to DB");
}).catch(err => {
    console.log(err);
})

async function main() {
    await mongoose.connect(MONGO_URL_ATLASDB);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));// for req.params used to get id from url
app.use(express.json());
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const store = MongoStore.create({
    mongoUrl: MONGO_URL_ATLASDB,
    crypto:
    {
        secret: process.env.SECRET,
    },
    touchAfter: 24 * 3600,
});

store.on("error", (err) => {
    console.log("ERROR in MONGO SESSION STORE", err);
});

//cookie is created by the express-session middlewar
const sessionOptions = {
    store,
    secret: process.env.SECRET,// Used to sign the session ID 
    resave: false,// Prevents saving session again if nothing changed
    saveUninitialized: true, //true → session created for every visitor //false → session created only when data is stored
    cookie: {//Controls session cookie behavior.
        expires: Date.now() + 1000 * 60 * 60 * 24 * 3,
        maxAge: 1000 * 60 * 60 * 24 * 3,
        httpOnly: true
    },
};
app.get("/", (req, res) => {
    res.send(`<a href="/listings">Go to Listings</a>`);
});
app.use(session(sessionOptions));//Creates sessions for , actually generates and sends the session cookie to the browser
app.use(flash());

app.use(passport.initialize())//This initializes Passport authentication middleware.
app.use(passport.session())//This connects Passport with Express sessions. Keeps the user logged in across requests.
passport.use(new LocalStrategy(User.authenticate()))//Uses the Local Strategy (username + password login).

passport.serializeUser(User.serializeUser());//user ID is stored, not the entire user object.
passport.deserializeUser(User.deserializeUser());//retrieve user from DB

//This middleware makes flash messages available to all EJS templates.
app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.err = req.flash("err");
    res.locals.currUser = req.user;
    next();
})  

app.use("/listings", listingsRouter)
app.use("/listings/:id/reviews", reviewRouter)
app.use("/", userRouter)
app.use("/", profileRouter)

//err mmiddileware
app.use((req, res, next) => {
    next(new ExpressError(404, "Page Not Found!"));
});

app.use((err, req, res, next) => {
    let { status = 500, message = "Something went wrong!" } = err;
    res.render("error.ejs", { err })
    // res.status(status).send(message);
});

app.listen(8080, () => {
    console.log("port 8080");
})