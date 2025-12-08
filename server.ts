import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { testConnection } from './database';
import OpenRouterService, { OpenRouterMessage } from './openrouter';
import { allPages } from './contant';

dotenv.config();

const app = express();

// Cloud Run will inject PORT; default to 8080 for local/dev
const PORT = Number(process.env.PORT) || 8080;

// Track readiness of expensive startup tasks (DB + embeddings)
let isDbConnected = false;
let areEmbeddingsReady = false;

const openRouterService = new OpenRouterService();

// ---------- Middleware ----------

app.use(helmet());

// CORS: configurable via env, with sensible defaults for dev
// e.g. CORS_ORIGINS="https://yourdomain.com,https://otherdomain.com"
const corsOriginsEnv = process.env.CORS_ORIGINS;
let allowedOrigins: string[] | ((origin: string | undefined, cb: (err: Error | null, origin?: boolean) => void) => void);

if (corsOriginsEnv) {
  const origins = corsOriginsEnv.split(',').map(o => o.trim()).filter(Boolean);
  allowedOrigins = origins;
} else {
  // Default dev origins
  allowedOrigins = ['http://localhost:3000', 'http://localhost:5173'];
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------- Health endpoints ----------

// Basic health – good for quick checks
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// More detailed health – can be used for monitoring
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    dbConnected: isDbConnected,
    embeddingsReady: areEmbeddingsReady,
  });
});

// ---------- Routes ----------

app.post('/api/chat', async (req, res) => {
  try {
    const { user_id, message } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({
        error: 'Missing required fields: user_id and message are required',
      });
    }

    if (typeof user_id !== 'number' || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Invalid data types: user_id must be a number and message must be a string',
      });
    }

    const reply = await openRouterService.generateReply(message, user_id);
    res.json({ reply });
  } catch (error) {
    console.error('❌ Chat endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/essay-verify', async (req, res) => {
  try {
    const { user_input, explanation } = req.body;

    if (!user_input || !explanation) {
      return res.status(400).json({
        error: 'Missing required fields: user_input and explanation',
      });
    }

    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content: `
          You compare two essays and output ONLY JSON:
          {
            "score": number,   // similarity score between 0 and 100
            "reason": string   // detailed reasoning
          }
          Do NOT output anything else.
        `,
      },
      {
        role: 'user',
        content: `
          Compare the following two essays:

          📝 User Input Essay:
          ${user_input}

          📝 Explanation Essay:
          ${explanation}

          Return ONLY JSON in the required format:
          {
            "score": number,
            "reason": string
          }
        `,
      },
    ];

    const rawAiResponse = await openRouterService.verifyEssay(messages);

    let parsed: { score: number; reason: string };
    try {
      parsed = JSON.parse(rawAiResponse);
    } catch (err) {
      return res.status(500).json({
        error: 'AI returned invalid JSON',
        raw_response: rawAiResponse,
      });
    }

    return res.status(200).json({
      status: 'success',
      score: parsed.score,
      reason: parsed.reason,
    });
  } catch (error: any) {
    console.error('❌ Essay verification error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Unknown error',
    });
  }
});

// ---------- Error handlers ----------

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    });
  }
);

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`,
  });
});

// ---------- Server bootstrap ----------

const startServer = async () => {
  try {
    // 1️⃣ DB connection
    isDbConnected = await testConnection();
    if (!isDbConnected) {
      console.error('❌ Failed to connect to database. Server will not start.');
      process.exit(1);
    }

    // 2️⃣ Precompute embeddings for all pages
    console.log('⏳ Precomputing page embeddings...');
    await openRouterService.precomputePageEmbeddings(allPages);
    areEmbeddingsReady = true;
    console.log('✅ Page embeddings ready');

    // 3️⃣ Start HTTP server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();

export default app;
