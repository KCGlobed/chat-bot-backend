import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { testConnection } from './database';
import OpenRouterService, { OpenRouterMessage } from './openrouter';
import { allPages } from './contant';
import { excelRedraft } from './features/ExcelRedraft';
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });
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
    origin: "*",
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


app.post(
  "/api/redraft-esxcel-question",
  upload.single("file"),
  excelRedraft
);

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
You are an automated essay comparator. You will compare two texts (a User Essay and a Reference Essay) and OUTPUT ONLY a single JSON object (no explanatory text, no markdown, nothing else):

{
  "score": number,   // integer or float between 0 and 10 (higher is better)
  "reason": string   // short explanation (1-3 sentences) of how score was derived
}

Important rules:
1. ALWAYS output Valid JSON only. If you cannot produce valid JSON, output nothing.
2. Score range: 0 (completely incorrect) to 10 (excellent match). Fractions are allowed (e.g. 7.5).
3. Use the rubric below to compute the score. Be consistent and concise in the reason.
4. Be robust to short or partial user answers: if the user's text is short but contains the **key entities or numeric amounts** (for example: debit/credit entries, balances, currency amounts, totals, years, percentages), treat those matches as highly significant and give a positive score even when prose is short.
5. Numerical matches (exact amounts, totals, debit/credit values) are high-weight signals and should strongly influence the score — they should compensate for missing wording if present in user text.
6. Consider synonyms, paraphrases, and reorderings as matches (e.g., "budget slack" ~ "deliberate understatement of revenues or overstatement of costs").
7. Do NOT penalize for minor punctuation, casing, or small grammatical differences.
8. If the reference contains specific numbers (amounts) and the user repeats those numbers or shows logically equivalent numbers (e.g., 1000 vs 1,000), consider them matched.
9. If the user omits some details but captures the core idea and numeric facts, give a moderate-to-high score; if numeric facts match exactly, increase the score further.
10. If the user writes extra incorrect numeric facts that contradict the reference, penalize accordingly.

Scoring rubric (suggested weights — apply reasonably):
- Content / Concept match: 50% — Are the main ideas present and correct?
- Numeric / Entity match: 40% — Do the amounts, debit/credit labels, totals and key entities match?
- Clarity & Completeness: 10% — Readability and whether critical steps are missing.

Produce a concise reason explaining which aspects matched or failed (mention numeric matches or missing key concepts). Examples (for your internal guidance — still output only JSON):

Example 1 -> Good numeric match:
User Essay: "Total debit 5000, credit 5000. Budget slack is understating revenue."
Reference: "Budget slack: deliberate understatement of revenues... Debit 5000, Credit 5000."
Output: {"score": 9.0, "reason":"Core concept correct; numeric debit/credit (5000) match exactly — minor wording differences."}

Example 2 -> Short but numeric present:
User Essay: "Debit: 2000; Credit: 2000."
Reference: "Explain how debits and credits balance (2000) and affect profit."
Output: {"score": 7.0, "reason":"Numeric entries match and indicate understanding of balancing; explanation is brief/missing conceptual details."}

Example 3 -> Contradiction:
User Essay: "Debit 3000, Credit 4000."
Reference: "Debit 3000, Credit 3000."
Output: {"score": 3.0, "reason":"Numeric values contradict reference (credit mismatch); concept partially present but facts differ."}
`
      },
      {
        role: "user",
        content: `
Compare the following two essays and RETURN ONLY JSON with keys "score" and "reason":

User Essay:
${user_input}

Reference Essay:
${explanation}

Scoring instructions:
- Follow the system instructions above exactly.
- If numeric amounts, debit/credit labels, totals, or other explicit data in either text match, treat them as strong positive evidence.
- If the user provides logically equivalent numbers (e.g., formatted differently) treat them as matches.
- If the user provides contradicting numeric facts, lower the score and explain the contradiction in the reason.
- Be brief and precise in the reason (1-3 sentences).
`
      }
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
