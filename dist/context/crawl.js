"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBlogIndex = updateBlogIndex;
const chromadb_1 = require("chromadb");
const kcglobed_1 = require("./kcglobed");
const openrouter_1 = __importDefault(require("../openrouter"));
const client = new chromadb_1.ChromaClient({
    host: "localhost",
    port: 8000,
    ssl: false,
});
const openrouter = new openrouter_1.default();
async function updateBlogIndex() {
    const blogs = await (0, kcglobed_1.crawlBlogs)();
    const collection = await client.getOrCreateCollection({
        name: "kcglobed_blogs",
        embeddingFunction: {
            generate: async (texts) => {
                console.log("Embedding with OpenRouter:", texts);
                return Promise.all(texts.map((t) => openrouter.embedText(t)));
            },
        },
    });
    for (const blog of blogs) {
        const text = `${blog.title} ${blog.snippet}`;
        await collection.add({
            ids: [blog.url],
            documents: [text],
            metadatas: [{ title: blog.title, url: blog.url }],
        });
    }
    console.log("✅ Blog index updated with OpenRouter embeddings!");
}
//# sourceMappingURL=crawl.js.map