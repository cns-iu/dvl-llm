const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { validateHtml } = require("../utils/htmlValidator");

const FORBIDDEN_KEYWORDS = [
  "require('child_process')",
  "eval",
  "process.env",
  "process.kill",
  "process.exit",
   "fs.rm",
  "fs.rmdir",
  "fs.unlink",
  "fs.symlink",
  "fs.chmod",
  "fs.chown",
];

const TEMP_SCRIPT_DIR = "/tmp/js-executor";

router.post("/", async (req, res) => {
  const { code, filename_prefix } = req.body;

  if (!code || !filename_prefix) {
    return res.status(400).json({
      status: "error",
      error_code: 2000,
      error_message: "Service Level Error: 'code' and 'filename_prefix' are required.",
    });
  }

  // --- Security Check ---
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (code.includes(keyword)) {
      return res.status(400).json({
        status: "error",
        error_code: 1200,
        error_message: `Security Violation: Forbidden keyword '${keyword}' detected.`,
        details: { stdout: "", stderr: "" }
      });
    }
  }

  // --- Ensure Temp Directory Exists ---
  if (!fs.existsSync(TEMP_SCRIPT_DIR)) {
    fs.mkdirSync(TEMP_SCRIPT_DIR, { recursive: true });
  }

  const tempScriptPath = path.join(TEMP_SCRIPT_DIR, `temp-script-${filename_prefix}.js`);
  const expectedHtmlPath = `/app/data/output/${filename_prefix}`;

  try {
    // --- Save JS Script to Temporary File ---
    fs.writeFileSync(tempScriptPath, code, "utf8");

    // --- Execute the JS File with NODE_PATH for module resolution ---
    const execCommand = `NODE_PATH=/app/node_modules node ${tempScriptPath}`;
    exec(execCommand, { cwd: '/app', timeout: 300000 }, async (error, stdout, stderr) => {
      if (error) {
        return res.status(400).json({
          status: "error",
          error_code: 1000,
          error_message: "Code Execution Error: The script failed during execution.",
          details: { stdout, stderr }
        });
      }

      // --- Check Output File Existence ---
      console.log('Checking for file:', expectedHtmlPath);
      console.log('Files in output directory:', fs.readdirSync("/app/data/output"));
      if (!fs.existsSync(expectedHtmlPath)) {
        return res.status(500).json({
          status: "error",
          error_code: 1100,
          error_message: "Logical Error: The script ran without crashing but did not create the expected output file.",
          details: {
            stdout,
            stderr: "Expected output HTML file was not generated."
          }
        });
      }

      // --- Optional Runtime HTML Validation ---
      const validationErrors = await validateHtml(expectedHtmlPath);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          status: "error",
          error_code: 1000,
          error_message: "Code Execution Error: The output HTML contains JS runtime or syntax errors.",
          details: {
            stdout,
            stderr: validationErrors.join("\n")
          }
        });
      }

      // --- Success ---
      return res.json({
        status: "success",
        code,
        output_html_path: expectedHtmlPath
      });
    });

  } catch (err) {
    return res.status(500).json({
      status: "error",
      error_code: 2000,
      error_message: "Service Level Error: The executor service encountered a problem.",
      details: {
        stdout: "",
        stderr: err.message
      }
    });
  }
});

module.exports = router;