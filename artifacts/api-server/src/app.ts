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
let frontendPath = path.join(process.cwd(), "artifacts/rental-app/dist/public");
if (process.cwd().endsWith("api-server")) {
  frontendPath = path.join(process.cwd(), "../../artifacts/rental-app/dist/public");
} else if (process.cwd().endsWith("Rental-Property-Manager")) {
  frontendPath = path.join(process.cwd(), "artifacts/rental-app/dist/public");
}

app.use(express.static(frontendPath));

// Fallback to index.html for all frontend routes
// Express 5 uses path-to-regexp v8 and requires /(.*) instead of *
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, "index.html"));
  } else {
    next();
  }
});

export default app;
