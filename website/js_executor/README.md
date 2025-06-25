## JS Visualization Executor

A microservice that accepts JavaScript code for visualizations (Plotly, D3.js, Vega, etc.), wraps it in an HTML template, and serves it via a static endpoint.

## How It Works

- Accepts `POST /execute` with JS code, story ID, and library
- Wraps code in HTML with preloaded CDN libraries
- Saves HTML to `/output/{story_id}/{library}/`
- Serves files at `/static-output/...`

## Getting Started

```bash
npm install
npm run dev
```

curl -X POST http://localhost:5003/execute \
-H "Content-Type: application/json" \
-d "{\"code\":\"Plotly.newPlot('viz', [{x: [1,2], y: [3,4]}])\",\"story_id\":\"US1\",\"library\":\"plotly\"}"

http://localhost:5003/static-output/US1/plotly/viz_xyz.html
