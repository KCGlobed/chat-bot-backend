import 'dotenv/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ChromaClient } from 'chromadb';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';

function getEnv(name: string, fallback?: string): string {
    const value = process.env[name] ?? fallback;
    if (!value) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}

async function fetchWebsiteText(url: string): Promise<{ text: string; title: string }> {
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        // Extract main text from the page
        const text = $('body').text().replace(/\s+/g, ' ').trim();
        const title = $('title').text() || url;

        return { text, title };
    } catch (err) {
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

    const client = new ChromaClient({ host: chromaHost, port: chromaPort, ssl: chromaSsl });
    const embeddings = new OpenAIEmbeddings({ apiKey: openaiApiKey });

    const collection = await client.getOrCreateCollection({
        name: collectionName,
        embeddingFunction: {
            generate: async (texts: string[]) => embeddings.embedDocuments(texts),
        },
    });

    const splitter = new RecursiveCharacterTextSplitter({
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

        const ids: string[] = [];
        const metadatas: Record<string, any>[] = [];

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
async function queryWebsiteCollection(query: string, topK = 3) {
    const chromaHost = getEnv('CHROMA_HOST', 'localhost');
    const chromaPort = Number(getEnv('CHROMA_PORT', '8000'));
    const chromaSsl = getEnv('CHROMA_SSL', 'false') === 'true';
    const collectionName = getEnv('CHROMA_WEBSITE_COLLECTION', 'kcglobed_websites');

    const client = new ChromaClient({ host: chromaHost, port: chromaPort, ssl: chromaSsl });
    const collection = await client.getOrCreateCollection({ name: collectionName });

    const results = await collection.query({ queryTexts: [query], nResults: topK });

    if (results.documents && results.documents[0].length > 0) {
        return results.documents[0]
            .map((doc: any, i: number) => {
                const meta = results.metadatas?.[0]?.[i] as any;
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

export { ingestWebsites, queryWebsiteCollection };
