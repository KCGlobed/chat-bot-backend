import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { testConnection } from './database';
import OpenRouterService, { OpenRouterMessage } from './openrouter';
import { allPages } from './contant';

dotenv.config();

// Cloud Run sets PORT automatically. Default for local is 8080.
const PORT = Number(process.env.PORT) || 8080;

// Skip DB connection? Useful for Docker + Cloud Run tests.
const SKIP_DB = process.env.SKIP_DB === "true";

const app = express();
const openRouterService = new OpenRouterService();

// Track service readiness
let isDbConnected = false;
let embeddingsReady = false;

// ---------- Middleware ----------
app.use(helmet());

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://chatbot-62f67.web.app"]
        : ["http://localhost:3000", "https://chatbot-62f67.web.app"],
    credentials: true,
  })
);

app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ---------- Health Endpoints ----------
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
    dbConnected: isDbConnected,
    embeddingsReady,
  });
});

// ---------- Chat API ----------
app.post("/api/chat", async (req, res) => {
  try {
    const { user_id, message } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({
        error: "Missing required fields: user_id and message",
      });
    }

    if (typeof user_id !== "number" || typeof message !== "string") {
      return res.status(400).json({
        error: "Invalid data types: user_id must be a number and message must be a string",
      });
    }

    const reply = await openRouterService.generateReply(message, user_id);
    res.json({ reply });
  } catch (error) {
    console.error("❌ Chat endpoint error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ---------- Essay Verification API ----------
app.post("/api/essay-verify", async (req, res) => {
  try {
    const { user_input, explanation } = req.body;

    if (!user_input || !explanation) {
      return res.status(400).json({
        error: "Missing required fields: user_input and explanation",
      });
    }

    const messages: OpenRouterMessage[] = [
      {
        role: "system",
        content: `
          You compare two essays and output ONLY JSON:
          {
            "score": number,
            "reason": string
          }
        `,
      },
      {
        role: "user",
        content: `
          Compare the following two essays:

          User Essay:
          ${user_input}

          Reference Essay:
          ${explanation}

          Return ONLY JSON:
          {
            "score": number,
            "reason": string
          }
        `,
      },
    ];

    const raw = await openRouterService.verifyEssay(messages);

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return res.status(500).json({
        error: "AI returned invalid JSON",
        raw_response: raw,
      });
    }

    res.status(200).json({
      status: "success",
      score: parsed.score,
      reason: parsed.reason,
    });
  } catch (error: any) {
    console.error("❌ Essay verification error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message || "Unknown error",
    });
  }
});

// ---------- Error Handler ----------
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
  });
});

// ---------- 404 ----------
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not found",
    message: `Route ${req.originalUrl} not found`,
  });
});

// ---------- Startup Logic ----------
const startServer = async () => {
  try {
    // 1️⃣ Database connection (optional)
    if (!SKIP_DB) {
      console.log("🔍 Checking database connection...");
      isDbConnected = await testConnection();
      if (!isDbConnected) {
        console.error("❌ Failed to connect to database.");
        process.exit(1);
      }
      console.log("✅ Database connection successful");
    } else {
      console.log("⚠️ SKIP_DB=true — skipping DB connection check");
      isDbConnected = true;
    }

    // 2️⃣ Precompute embeddings
    console.log("⏳ Precomputing page embeddings...");
    await openRouterService.precomputePageEmbeddings(allPages);
    embeddingsReady = true;
    console.log("✅ Embeddings ready!");

    // 3️⃣ Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down");
  process.exit(0);
});

startServer();

export default app;
