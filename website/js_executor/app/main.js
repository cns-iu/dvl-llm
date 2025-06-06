const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 5003;

const DATA_DIR = "/app/data";
const OUTPUT_DIR = path.join(DATA_DIR, "output");

app.use(bodyParser.json({ limit: "5mb" }));

app.post("/execute", async (req, res) => {
  try {
    const code = req.body.code;

    if (!code || code.trim() === "") {
      return res.status(400).json({
        status: "error",
        stderr: "Code field is empty",
      });
    }

    const uid = uuidv4().slice(0, 8);
    const outputFile = path.join(OUTPUT_DIR, `js_output_${uid}.html`);

    // Write raw HTML directly to output file
    fs.writeFileSync(outputFile, code);

    return res.json({
      status: "success",
      output_html_path: outputFile,
    });

  } catch (err) {
    return res.status(500).json({
      status: "error",
      stderr: err.toString(),
    });
  }
});

app.listen(PORT, () => {
  console.log(`JS Executor running on port ${PORT}`);
});