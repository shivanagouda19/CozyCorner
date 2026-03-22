const config = require("../config");

const LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

const currentLevel = LEVELS[config.logging.level] ?? LEVELS.info;

const writeLog = (level, message, meta = {}) => {
    if ((LEVELS[level] ?? LEVELS.info) > currentLevel) {
        return;
    }

    const payload = {
        ts: new Date().toISOString(),
        level,
        message,
        ...meta,
    };

    const serialized = JSON.stringify(payload);
    if (level === "error") {
        console.error(serialized);
        return;
    }

    console.log(serialized);
};

module.exports = {
    error: (message, meta) => writeLog("error", message, meta),
    warn: (message, meta) => writeLog("warn", message, meta),
    info: (message, meta) => writeLog("info", message, meta),
    debug: (message, meta) => writeLog("debug", message, meta),
};
