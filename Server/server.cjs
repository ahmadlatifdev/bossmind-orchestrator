import express from "express";
import routes from "./routes/index.cjs";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: "2mb" }));

app.use("/", routes);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[BossMind] server listening on http://0.0.0.0:${PORT}`);
});
