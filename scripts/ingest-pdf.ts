import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { ChromaClient } from 'chromadb';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import pdfParse from 'pdf-parse';

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function readPdf(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text || '';
}

async function main() {
  const fileArg = './data.pdf';
  if (!fileArg) {
    console.error('Usage: npm run ingest:pdf -- <path-to-pdf>');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const openaiApiKey = getEnv('OPENAI_API_KEY');
  const chromaHost = getEnv('CHROMA_HOST', 'localhost');
  const chromaPort = getEnv('CHROMA_PORT', '8000');
  const chromaSsl = getEnv('CHROMA_SSL', 'false') === 'true';
  const collectionName = getEnv('CHROMA_PDF_COLLECTION', 'kcglobed_pdfs');

  const client = new ChromaClient({ host: chromaHost, port: Number(chromaPort), ssl: chromaSsl });

  const embeddings = new OpenAIEmbeddings({
    apiKey: openaiApiKey,
    model: 'text-embedding-3-small',
    dimensions: undefined,
  });

  const collection = await client.getOrCreateCollection({
    name: collectionName,
    metadata: { source: 'pdf', created_at: new Date().toISOString() },
    embeddingFunction: {
      generate: async (texts: string[]) => {
        return embeddings.embedDocuments(texts);
      },
    },
  });

  console.log(`Reading PDF: ${filePath}`);
  const fullText = await readPdf(filePath);
  if (!fullText.trim()) {
    console.error('PDF contains no extractable text.');
    process.exit(1);
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
    separators: ['\n\n', '\n', ' ', ''],
  });

  const chunks = await splitter.splitText(fullText);
  console.log(`Chunks: ${chunks.length}`);

  const baseId = path.basename(filePath);
  const ids: string[] = [];
  const metadatas: Record<string, any>[] = [];

  for (let i = 0; i < chunks.length; i++) {
    ids.push(`${baseId}::${i}`);
    metadatas.push({ file: baseId, index: i, path: filePath });
  }

  await collection.add({ ids, documents: chunks, metadatas });
  console.log(`✅ Ingested ${chunks.length} chunks into collection "${collectionName}"`);
}

main().catch((err) => {
  console.error('Ingestion error:', err);
  process.exit(1);
});


