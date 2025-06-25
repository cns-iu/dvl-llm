const app = require("./app/app");
const PORT = 5003;
app.listen(PORT, () =>
  console.log(`JS Executor running at http://localhost:${PORT}`)
);
