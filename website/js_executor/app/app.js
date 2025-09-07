const express = require("express");
const executeRoute = require("./routes/execute");
const path = require("path");
const fs = require("fs");

const app = express();

app.use((req, _res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

app.use(express.json({ limit: '5mb' }));  // or even '5mb' if needed
app.use("/execute", executeRoute);
// app.use("/static-output", express.static("output")); -- Divya commented this out as this being done in backend

app.get("/health", (req, res) => {
  const dataDir = "/app/data";
  const outDir = path.join(dataDir, "output");
  try {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const probe = path.join(outDir, `.health_${Date.now()}`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return res.json({ status: "ok" });
  } catch (e) {
    return res.status(503).json({ status: "unhealthy", error: String(e) });
  }
});

module.exports = app;
