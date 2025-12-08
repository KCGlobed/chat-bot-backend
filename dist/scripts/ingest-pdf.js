"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chromadb_1 = require("chromadb");
const text_splitter_1 = require("langchain/text_splitter");
const openai_1 = require("@langchain/openai");
const pdf_parse_1 = __importDefault(require("pdf-parse"));
function getEnv(name, fallback) {
    const value = process.env[name] ?? fallback;
    if (!value) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}
async function readPdf(filePath) {
    const buffer = fs_1.default.readFileSync(filePath);
    const data = await (0, pdf_parse_1.default)(buffer);
    return data.text || '';
}
async function main() {
    const fileArg = './data.pdf';
    if (!fileArg) {
        console.error('Usage: npm run ingest:pdf -- <path-to-pdf>');
        process.exit(1);
    }
    const filePath = path_1.default.resolve(process.cwd(), fileArg);
    if (!fs_1.default.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }
    const openaiApiKey = getEnv('OPENAI_API_KEY');
    const chromaHost = getEnv('CHROMA_HOST', 'localhost');
    const chromaPort = getEnv('CHROMA_PORT', '8000');
    const chromaSsl = getEnv('CHROMA_SSL', 'false') === 'true';
    const collectionName = getEnv('CHROMA_PDF_COLLECTION', 'kcglobed_pdfs');
    const client = new chromadb_1.ChromaClient({ host: chromaHost, port: Number(chromaPort), ssl: chromaSsl });
    const embeddings = new openai_1.OpenAIEmbeddings({
        apiKey: openaiApiKey,
        model: 'text-embedding-3-small',
        dimensions: undefined,
    });
    const collection = await client.getOrCreateCollection({
        name: collectionName,
        metadata: { source: 'pdf', created_at: new Date().toISOString() },
        embeddingFunction: {
            generate: async (texts) => {
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
    const splitter = new text_splitter_1.RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 100,
        separators: ['\n\n', '\n', ' ', ''],
    });
    const chunks = await splitter.splitText(fullText);
    console.log(`Chunks: ${chunks.length}`);
    const baseId = path_1.default.basename(filePath);
    const ids = [];
    const metadatas = [];
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
//# sourceMappingURL=ingest-pdf.js.map