const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const DATA_DIR = "/app/data";
const OUTPUT_DIR = path.join(DATA_DIR, "output");

function saveHtmlFile(html, storyId, library) {
  const filename = `viz_${uuidv4().slice(0, 8)}.html`;
  const dir = path.join(OUTPUT_DIR, storyId, library);
  fs.mkdirSync(dir, { recursive: true });

  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, html);

  return {
    filename,
    output_html_path: filepath,
    // urlPath: `/static-output/${storyId}/${library}/${filename}`,
  };
}
