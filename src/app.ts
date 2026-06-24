import express, { Application } from "express";
import { executeRouter } from "./routes/executeRouter.js";
import { discoveryRouter } from "./routes/discoveryRouter.js";

const app: Application = express();

// Middleware
app.use(express.json());

// Routes
app.use("/api/execute", executeRouter);
app.use("/api/discovery", discoveryRouter);

// Basic health-check route for infrastructure
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", service: "aventisia-crosair" });
});

export default app;
