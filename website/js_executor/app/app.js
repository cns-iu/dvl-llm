const express = require("express");
const executeRoute = require("./routes/execute");

const app = express();
app.use(express.json());
app.use("/execute", executeRoute);
app.use("/static-output", express.static("output"));

module.exports = app;
