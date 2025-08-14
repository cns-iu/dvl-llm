const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = "/app/data/output";

function saveHtmlFile(html, filename_prefix) {
  const filepath = path.join(OUTPUT_DIR, `${filename_prefix}.html`);
  fs.writeFileSync(filepath, html);
  return filepath;
}

module.exports = { saveHtmlFile };