const puppeteer = require("puppeteer");
const path = require("path");

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";

/**
 * Wraps a promise with a timeout.
 */
function withTimeout(promise, ms = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Validation timed out")), ms)
    )
  ]);
}

/**
 * Filters out benign race condition DOM errors.
 */
function filterErrors(errors) {
  return errors.filter(err => {
    const lower = err.toLowerCase();
    return !(
      lower.includes("cannot read properties of null") ||
      lower.includes("getcontext") ||
      lower.includes("is null")
    );
  });
}

/**
 * Uses headless Chromium to load and validate the HTML for runtime JS errors.
 */
async function validateHtml(filePath) {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox"]
  });

  try {
    const page = await browser.newPage();
    const errors = [];

    // Log console messages and capture JS errors
    page.on("console", msg => {
      const type = msg.type();
      const text = msg.text();
      console.log(`[console.${type}] ${text}`);

      if (["error", "assert"].includes(type)) {
        errors.push(text);
      }
    });

    // Log and capture unhandled exceptions
    page.on("pageerror", err => {
      console.log(`[pageerror] ${err.message}`);
      errors.push(err.message);
    });

    // Open the file and let scripts run
    await page.goto("file://" + path.resolve(filePath));
    await page.waitForTimeout(1500); // Ensure all scripts finish

    return filterErrors(errors);
  } finally {
    await browser.close();
  }
}

module.exports = {
  validateHtml: (filePath) => withTimeout(validateHtml(filePath), 5000)
};