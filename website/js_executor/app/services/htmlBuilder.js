const VIS_LIB_CDNS = `
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega@5"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega-lite@5"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega-embed@6"></script>
  <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <script src="https://code.highcharts.com/highcharts.js"></script>
  <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js"></script>
`;


/**
 * Extracts the library name from a standardized filename_prefix.
 * Format: LLM-ProgrammingLang-Library-usNumber
 */
function extractLibraryFromPrefix(filenamePrefix) {
  const parts = filenamePrefix.split("-");
  return parts.length >= 3 ? parts[2].toLowerCase() : "vanilla";
}

function generateHtml(code, filenamePrefix) {
  const library = extractLibraryFromPrefix(filenamePrefix);
  const tag = library === "chartjs" ? "canvas" : "div";

  return `
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Visualization</title>
      ${VIS_LIB_CDNS}
    </head>
    <body>
     <${tag} id="viz"></${tag}>
      <script>
        window.addEventListener('DOMContentLoaded', () => {
          try {
            ${code}
          } catch (e) {
            // CORRECTED LINE: Log the error's stack trace as a string.
            console.error(e.stack);
          }
        });
      </script>
    </body>
    </html>
  `;
}

module.exports = { generateHtml };
