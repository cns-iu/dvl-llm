const express = require("express");
const executeRoute = require("./routes/execute");

const app = express();
app.use(express.json({ limit: '5mb' }));  // or even '5mb' if needed
app.use("/execute", executeRoute);
// app.use("/static-output", express.static("output")); -- Divya commented this out as this being done in backend

module.exports = app;
