import { ChromaClient } from "chromadb";
import { crawlBlogs } from "./kcglobed";
import OpenRouterService from "../openrouter";

const client = new ChromaClient({
    host: "localhost",
    port: 8000,
    ssl: false,
});
const openrouter = new OpenRouterService()

export async function updateBlogIndex() {
    const blogs = await crawlBlogs();

    const collection = await client.getOrCreateCollection({
        name: "kcglobed_blogs",
        embeddingFunction: {
            generate: async (texts: string[]) => {
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
