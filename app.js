if (process.env.NODE_ENV != "production") {
require("dotenv").config();
}

const express = require("express");
const app = express();
const config = require("./config");
const mongoose = require("mongoose");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const csrf = require("@dr.pogodin/csurf");
const sanitizeHtml = require("sanitize-html");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate"); // help to make templte
const AppError = require("./errors/AppError");
const logger = require("./utils/logger");
const requestLogger = require("./Middleware/requestLogger");
const errorHandler = require("./Middleware/errorHandler");
const listingsRouter = require("./routes/listing.js") // import the router
const reviewRouter = require("./routes/review.js")// import the router
const userRouter = require("./routes/user.js")// import the router
const profileRouter = require("./routes/profile.js")
const bookingRouter = require("./routes/booking.js")
const session = require("express-session"); //this is used for create session
const { MongoStore } = require('connect-mongo');
const flash = require("connect-flash");   // this is for flashing a message
const passport = require("passport");// this is for hashing password and many more
const LocalStrategy = require("passport-local"); // A strategy tells Passport how to authenticate a user. in this case it is localstrategy
const User = require("./models/user.js");

const isProduction = config.app.isProduction;

main().then(() => {
    logger.info("db.connected", { mongoUrl: config.db.mongoUrl });
}).catch(err => {
    logger.error("db.connection.failed", { message: err.message, stack: err.stack });
})

async function main() {
    await mongoose.connect(config.db.mongoUrl);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.disable("x-powered-by");
app.use(express.urlencoded({ extended: true, limit: "20kb", parameterLimit: 200 }));// for req.params used to get id from url
app.use(express.json({ limit: "20kb" }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Define safe defaults so shared layout includes never crash on missing locals.
app.use((req, res, next) => {
    res.locals.currUser = null;
    res.locals.success = [];
    res.locals.error = [];
    res.locals.err = [];
    res.locals.csrfToken = "";
    next();
});

app.use(requestLogger);

if (isProduction) {
    app.set("trust proxy", 1);
}

const generalLimiter = rateLimit({
    windowMs: config.security.rateLimitWindowMs,
    max: config.security.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests from this IP. Please try again in a few minutes.",
});

const authLimiter = rateLimit({
    windowMs: config.security.rateLimitWindowMs,
    max: config.security.authRateLimitMax,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many login/signup attempts. Please wait and try again.",
});

app.use(generalLimiter);
app.use(["/login", "/signup"], authLimiter);

app.use(
    helmet({
        crossOriginResourcePolicy: false,
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://api.mapbox.com"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net", "https://api.mapbox.com", "https://cdnjs.cloudflare.com"],
                imgSrc: ["'self'", "data:", "blob:", "https:"],
                fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
                connectSrc: ["'self'", "https://api.mapbox.com", "https://*.mapbox.com"],
                workerSrc: ["'self'", "blob:"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"],
                formAction: ["'self'"],
                upgradeInsecureRequests: isProduction ? [] : null,
            },
        },
    })
);

const sanitizeNoSqlKeys = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeNoSqlKeys(item));
    }

    if (value && typeof value === "object") {
        const cleaned = {};

        for (const key of Object.keys(value)) {
            if (key.startsWith("$")) continue;

            const safeKey = key.includes(".") ? key.replace(/\./g, "_") : key;
            cleaned[safeKey] = sanitizeNoSqlKeys(value[key]);
        }

        return cleaned;
    }

    return value;
};

app.use((req, res, next) => {
    if (req.body && typeof req.body === "object") {
        req.body = sanitizeNoSqlKeys(req.body);
    }

    if (req.params && typeof req.params === "object") {
        req.params = sanitizeNoSqlKeys(req.params);
    }

    next();
});
app.use((req, res, next) => {
    const queryString = req.originalUrl.includes("?") ? req.originalUrl.split("?")[1] : "";
    if (!queryString) return next();

    const params = new URLSearchParams(queryString);
    const seen = new Set();

    for (const key of params.keys()) {
        if (seen.has(key)) {
            return next(new AppError(`Duplicate query parameter is not allowed: ${key}`, 400));
        }
        seen.add(key);
    }

    return next();
});

const sanitizeRequestPayload = (payload) => {
    if (typeof payload === "string") {
        return sanitizeHtml(payload, { allowedTags: [], allowedAttributes: {} }).trim();
    }

    if (Array.isArray(payload)) {
        return payload.map((item) => sanitizeRequestPayload(item));
    }

    if (payload && typeof payload === "object") {
        const sanitized = {};
        for (const key of Object.keys(payload)) {
            sanitized[key] = sanitizeRequestPayload(payload[key]);
        }
        return sanitized;
    }

    return payload;
};

app.use((req, res, next) => {
    if (req.body && typeof req.body === "object" && Object.keys(req.body).length) {
        req.body = sanitizeRequestPayload(req.body);
    }
    next();
});

const store = MongoStore.create({
    mongoUrl: config.db.mongoUrl,
    crypto:
    {
        secret: config.session.secret,
    },
    touchAfter: 24 * 3600,
    ttl: Math.floor(config.session.maxAgeMs / 1000),
});

store.on("error", (err) => {
    logger.error("session.store.error", { message: err.message, stack: err.stack });
});

//cookie is created by the express-session middlewar
const sessionOptions = {
    name: config.session.name,
    store,
    secret: config.session.secret,// Used to sign the session ID 
    resave: false,// Prevents saving session again if nothing changed
    saveUninitialized: false, //true → session created for every visitor //false → session created only when data is stored
    proxy: isProduction,
    cookie: {//Controls session cookie behavior.
        expires: Date.now() + config.session.maxAgeMs,
        maxAge: config.session.maxAgeMs,
        httpOnly: true,
        sameSite: config.session.sameSite,
        secure: config.session.secureCookies,
    },
};
app.get("/", (req, res) => {
    res.send(`<a href="/listings">Go to Listings</a>`);
});
app.use(session(sessionOptions));//Creates sessions for , actually generates and sends the session cookie to the browser
app.use(flash());

const csrfProtection = csrf();
app.use((req, res, next) => {
    const isMultipartRequest = req.is("multipart/form-data");
    if (isMultipartRequest) {
        return next();
    }

    return csrfProtection(req, res, next);
});

app.use(passport.initialize())//This initializes Passport authentication middleware.
app.use(passport.session())//This connects Passport with Express sessions. Keeps the user logged in across requests.
passport.use(new LocalStrategy(User.authenticate()))//Uses the Local Strategy (username + password login).

passport.serializeUser(User.serializeUser());//user ID is stored, not the entire user object.
passport.deserializeUser(User.deserializeUser());//retrieve user from DB

// Make the logged-in user available in every EJS template.
app.use((req, res, next) => {
    res.locals.currUser = req.user;
    next();
});

// This middleware makes flash messages available to all EJS templates.
app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.err = req.flash("err");
    res.locals.csrfToken = typeof req.csrfToken === "function" ? req.csrfToken() : "";
    next();
});

app.use("/listings", listingsRouter)
app.use("/listings/:id/reviews", reviewRouter)
app.use("/listings/:id/bookings", bookingRouter)
app.use("/bookings", bookingRouter)
app.use("/", userRouter)
app.use("/", profileRouter)

//err mmiddileware
app.use((req, res, next) => {
    next(new AppError("Page Not Found!", 404));
});

app.use(errorHandler);

app.listen(config.app.port, () => {
    logger.info("app.started", { port: config.app.port, env: config.app.env });
})