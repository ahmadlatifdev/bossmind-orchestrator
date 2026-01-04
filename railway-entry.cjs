"use strict";

const { startServer } = require("./Server/server.cjs");

const PORT = process.env.PORT || 3000;

startServer(PORT);
