import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";

import path from "path";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve static React frontend in production
const frontendPath = path.join(process.cwd(), "artifacts/rental-app/dist/public");
app.use(express.static(frontendPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

export default app;
