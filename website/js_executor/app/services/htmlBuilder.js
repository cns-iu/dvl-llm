const VIS_LIB_CDNS = `
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega@5"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega-lite@5"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega-embed@6"></script>
  <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <script src="https://code.highcharts.com/highcharts.js"></script>
  <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js"></script>
`;

function generateHtml(code) {
  return `
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Visualization</title>
      ${VIS_LIB_CDNS}
    </head>
    <body>
      <div id="viz"></div>
      <script>${code}</script>
    </body>
    </html>
  `;
}

module.exports = { generateHtml };
