const express = require("express");
const router = express.Router();
const { generateHtml } = require("../services/htmlBuilder");
const { saveHtmlFile } = require("../utils/fileUtils");

router.post("/", async (req, res) => {
  const { code, story_id = "default", library = "vanilla" } = req.body;

  try {
    const html = generateHtml(code);
    const { filename, urlPath } = saveHtmlFile(html, story_id, library);
    res.json({ success: true, url: urlPath });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
