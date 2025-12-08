"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestWebsites = ingestWebsites;
exports.queryWebsiteCollection = queryWebsiteCollection;
require("dotenv/config");
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const chromadb_1 = require("chromadb");
const text_splitter_1 = require("langchain/text_splitter");
const openai_1 = require("@langchain/openai");
function getEnv(name, fallback) {
    const value = process.env[name] ?? fallback;
    if (!value) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}
async function fetchWebsiteText(url) {
    try {
        const { data } = await axios_1.default.get(url);
        const $ = cheerio.load(data);
        // Extract main text from the page
        const text = $('body').text().replace(/\s+/g, ' ').trim();
        const title = $('title').text() || url;
        return { text, title };
    }
    catch (err) {
        console.error(`❌ Error fetching ${url}:`, err);
        return { text: '', title: url };
    }
}
async function ingestWebsites() {
    const openaiApiKey = getEnv('OPENAI_API_KEY');
    const chromaHost = getEnv('CHROMA_HOST', 'localhost');
    const chromaPort = Number(getEnv('CHROMA_PORT', '8000'));
    const chromaSsl = getEnv('CHROMA_SSL', 'false') === 'true';
    const collectionName = getEnv('CHROMA_WEBSITE_COLLECTION', 'kcglobed_websites');
    const urls = [
        'https://www.irs.gov/',
        'https://in.imanet.org/',
        'https://www.aicpa-cima.com/',
        'https://nasba.org/'
    ];
    const client = new chromadb_1.ChromaClient({ host: chromaHost, port: chromaPort, ssl: chromaSsl });
    const embeddings = new openai_1.OpenAIEmbeddings({ apiKey: openaiApiKey });
    const collection = await client.getOrCreateCollection({
        name: collectionName,
        embeddingFunction: {
            generate: async (texts) => embeddings.embedDocuments(texts),
        },
    });
    const splitter = new text_splitter_1.RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 100,
        separators: ['\n\n', '\n', ' ', ''],
    });
    for (const url of urls) {
        console.log(`Fetching: ${url}`);
        const { text, title } = await fetchWebsiteText(url);
        if (!text.trim()) {
            console.warn(`⚠️ No text found at ${url}, skipping.`);
            continue;
        }
        const chunks = await splitter.splitText(text);
        console.log(`Split into ${chunks.length} chunks.`);
        const ids = [];
        const metadatas = [];
        for (let i = 0; i < chunks.length; i++) {
            ids.push(`${url}::${i}`);
            metadatas.push({ url, title, chunkIndex: i });
        }
        await collection.add({ ids, documents: chunks, metadatas });
        console.log(`✅ Ingested ${chunks.length} chunks from ${url}`);
    }
    console.log('🎉 All websites ingested successfully!');
}
// Query function
async function queryWebsiteCollection(query, topK = 3) {
    const chromaHost = getEnv('CHROMA_HOST', 'localhost');
    const chromaPort = Number(getEnv('CHROMA_PORT', '8000'));
    const chromaSsl = getEnv('CHROMA_SSL', 'false') === 'true';
    const collectionName = getEnv('CHROMA_WEBSITE_COLLECTION', 'kcglobed_websites');
    const client = new chromadb_1.ChromaClient({ host: chromaHost, port: chromaPort, ssl: chromaSsl });
    const collection = await client.getOrCreateCollection({ name: collectionName });
    const results = await collection.query({ queryTexts: [query], nResults: topK });
    if (results.documents && results.documents[0].length > 0) {
        return results.documents[0]
            .map((doc, i) => {
            const meta = results.metadatas?.[0]?.[i];
            return `📌 From **${meta.title}** (${meta.url}):\n${doc}`;
        })
            .join('\n\n');
    }
    return 'No relevant content found in website knowledge base.';
}
// Run ingestion if called directly
if (require.main === module) {
    ingestWebsites().catch(err => {
        console.error('❌ Ingestion error:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=ingest-website.js.map