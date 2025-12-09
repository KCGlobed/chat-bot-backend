import axios from 'axios';
import dotenv from 'dotenv';
import { ChromaClient } from "chromadb";
import OpenAI from "openai";
import { buildToolContext, TOOLS } from './tools';
import { WebBrowser } from "langchain/tools/webbrowser";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { allPages } from './contant';
import { cosineSimilarity } from './utils';
import pLimit from "p-limit";
dotenv.config();
interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }[];
}
export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
export class OpenRouterService {
  private apiKey: string;
  private chroma: ChromaClient;
  private openai: OpenAI;
  private openAiKey: string
  private userHistories: Map<number, OpenRouterMessage[]> = new Map();
  private browser: WebBrowser
  private pageEmbeddingCache: Map<string, number[]> = new Map();
  private websiteCache: Map<string, string> = new Map();
  constructor() {

    const lcModel = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });
    const embeddings = new OpenAIEmbeddings();
    this.browser = new WebBrowser({ model: lcModel, embeddings });
    this.openAiKey = process.env.OPENAI_API_KEY || '';
    this.openai = new OpenAI({
      apiKey: this.openAiKey,
    })
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.chroma = new ChromaClient({
      host: "localhost",
      port: 8000,
      ssl: false,
    });

    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY is required");
    }
  }
  async precomputePageEmbeddings(allPages: string[]) {
    for (const url of allPages) {
      if (!this.pageEmbeddingCache.has(url)) {
        const embedding = await this.embedText(url);
        this.pageEmbeddingCache.set(url, embedding);
      }
    }
    console.log("✅ All page embeddings precomputed");
  }

  async embedText(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  }


  private async chatCompletion(
    messages: OpenRouterMessage[],
    model: string = "gpt-4.1"
  ): Promise<string> {
    try {
      const response = await axios.post<OpenAIResponse>(
        "https://api.openai.com/v1/chat/completions",
        {
          model,
          messages,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openAiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content;
      }

      throw new Error("No response from OpenRouter API");
    } catch (error) {
      console.error("❌ OpenRouter API error:", error);
      if (axios.isAxiosError(error)) {
        throw new Error(
          `OpenRouter API error: ${error.response?.status
          } - ${error.response?.data?.error?.message || error.message}`
        );
      }
      throw new Error("Failed to get response from OpenRouter API");
    }
  }

  private async fetchBlogAnswer(query: string): Promise<string | null> {
    try {
      const collection = await this.chroma.getOrCreateCollection({
        name: "kcglobed_blogs",
        embeddingFunction: {
          generate: async (texts: string[]) => {
            console.log("Embedding with OpenRouter (query):", texts);
            return Promise.all(texts.map((t) => this.embedText(t)));
          },
        },
      });

      const results = await collection.query({
        queryTexts: [query],
        nResults: 3,
      });

      if (results.documents && results.documents[0].length > 0) {
        return results.documents[0]
          .map((doc: any, i: number) => {
            const meta = results.metadatas?.[0]?.[i];
            return `📌 **${meta?.title}**\n🔗 ${meta?.url}\n${doc}`;
          })
          .join("\n\n");
      }

      return null;
    } catch (err) {
      console.error("❌ Blog fetch error:", err);
      return null;
    }
  }

  private async fetchPdfAnswer(query: string): Promise<string | null> {
    try {
      const collection = await this.chroma.getOrCreateCollection({
        name: "kcglobed_pdfs",
        embeddingFunction: {
          generate: async (texts: string[]) => {
            console.log("Embedding with OpenRouter (PDF query):", texts);
            return Promise.all(texts.map((t) => this.embedText(t)));
          },
        },
      });

      const results = await collection.query({
        queryTexts: [query],
        nResults: 3,
      });

      if (results.documents && results.documents[0].length > 0) {
        return results.documents[0]
          .map((doc: any, i: number) => {
            const meta = results.metadatas?.[0]?.[i];
            return `📖 From PDF (chunk ${i + 1}):\n${doc}`;
          })
          .join("\n\n");
      }

      return null;
    } catch (err) {
      console.error("❌ PDF fetch error:", err);
      return null;
    }
  }

  private async fetchWebsiteLiveAnswer(query: string, urls: string[]): Promise<string | null> {
    // Return cached result if exists
    if (this.websiteCache.has(query)) return this.websiteCache.get(query)!;

    // Embed the query
    const queryEmbedding = await this.embedText(query);

    // Compute similarity with precomputed page embeddings
    const similarities = urls
      .map(url => ({
        url,
        sim: cosineSimilarity(queryEmbedding, this.pageEmbeddingCache.get(url) || [])
      }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 5); // top 5 relevant pages

    const limit = pLimit(3); // max 3 concurrent browser requests
    const tasks = similarities.map(({ url }) =>
      limit(async () => {
        try {
          const result = await this.browser.invoke(`"${url}","${query}"`);
          if (result && !result.includes("Not found")) {
            return `✅ Found on <a href="${url}">${url}</a><br/><pre>${result}</pre>`;
          }
        } catch (err) {
          console.error(`❌ Error browsing ${url}:`, err);
        }
        return null;
      })
    );

    const results = await Promise.all(tasks);
    const firstMatch = results.find((r: any) => r !== null) ?? null;

    // Cache result for future
    if (firstMatch) this.websiteCache.set(query, firstMatch);

    return firstMatch;
  }

  async generateReply(userMessage: string, userId: number): Promise<string> {
    const blogContext = await this.fetchBlogAnswer(userMessage);
    const pdfContext = await this.fetchPdfAnswer(userMessage);

    const liveWebsiteContext = await this.fetchWebsiteLiveAnswer(userMessage, allPages);
    let combinedContext = "";
    // if (blogContext) combinedContext += `\n\n📰 Blog context:\n${blogContext}`;
    if (pdfContext) combinedContext += `\n\n📖 PDF context:\n${pdfContext}`;
    if (liveWebsiteContext) combinedContext += `🌐 Live website context:\n${liveWebsiteContext}\n\n`;
    const history: OpenRouterMessage[] = this.userHistories.get(userId) ?? [];

    const systemMessage: OpenRouterMessage = {
      role: "system",
      content: `
    👋 Hello! You are **Kc GlobedBot**, a knowledgeable finance assistant.  
    You specialize in US CPA, US CMA, US Taxation, Accounting, and all finance-related topics.  
    
    💡 Your main role:  
    - Always provide answers related to **finance, accounting, taxation, courses, subjects, chapters, and finance education**.  
    - You also act as a **RAG (Retrieval-Augmented Generation) assistant**, so if there is contextual blog knowledge available, you should incorporate it naturally in your answers.  
    
    🛠 Tool usage instructions:  
    If the user asks about **courses, subjects, course-subject mappings, chapters, or subject-chapter mappings**,  
    you MUST respond with a JSON **tool call** in this exact format:
    
    {
      "tool": "<tool_name>", 
      "sql": "SELECT ..."
    }
    
    ✅ Available tools dynamically detected:  
    ${buildToolContext()}
      ✅ Available tables:
      - questions_questioncontents
      - questions_questionoptions
      - questions_testquestions
      - questions_questionexhibits
      - questions_simulationquestionanswers
      - questions_mocktesthelps
      - courses_topics
      - courses_chapters
      - courses_subjects
      - courses_course

    ⚠️ Rules for tools:  
    - Only SELECT queries are allowed.  
    - Only allowed columns should be accessed.  
    - For course-subject queries, always return **subject names instead of IDs**.  
    - Never invent data — always fetch from the database when relevant.  
  📚 Context:  
    📚 Internal Context (for grounding only, do NOT mention explicitly in answers):  
      ${combinedContext || "No external context available."}

      ⚠️ Rules:  
      - Always use the provided context (blogs, PDFs) as the **primary source of truth**.  
      - If the context is available, ground your answer strictly in it. Do not invent details.  
      - If the context does not answer the question, politely say that the information is not available in the knowledge base.  
      - Only fall back to your general knowledge if **no context is provided at all**.  


    
    📝 Style guidelines for answers:  
    - Be descriptive and explanatory, like a finance instructor.  
    - Use examples if necessary, especially for accounting, taxation, or course-related queries.  
    - Keep all answers **finance-focused**.  
    - If the question is unrelated to finance courses or content, answer politely but do not include unrelated topics.  
    
    Your responses should always in the html with proper style and indentation and other html style factor, sound **authoritative, professional, and finance-oriented**, and only call tools when necessary.
      `
    };


    const newUserMessage: OpenRouterMessage = { role: "user", content: userMessage };
    const messages: OpenRouterMessage[] = [systemMessage, ...history, newUserMessage];

    const reply = await this.chatCompletion(messages);

    // ✅ Detect tool call
    if (reply.startsWith("{") && reply.includes('"tool":')) {
      try {
        const toolCall = JSON.parse(reply);
        const toolName = toolCall.tool;
        const sql = toolCall.sql;

        const tool = TOOLS[toolName];
        if (!tool) {
          throw new Error(`Unknown tool: ${toolName}`);
        }

        const result = await tool.execute({ sql });

        if (result.error) throw new Error(result.error);

        // ✅ Natural reply from DB result
        return await this.chatCompletion([
          { role: "system", content: "Convert SQL query results into a clear natural language answer for the user. Always show subject names if available." },
          { role: "user", content: `User asked: "${userMessage}". SQL result: ${JSON.stringify(result.rows)}` },
        ]);

      } catch (err: any) {
        console.error("⚠️ Tool execution failed, fallback:", err.message || err);

        return await this.chatCompletion([
          { role: "system", content: "You are a helpful finance LMS assistant. Database tool failed, but still answer naturally without mentioning failure." },
          { role: "user", content: `Original question: "${userMessage}"` },
        ]);
      }
    }
    return reply;
  }
  public async verifyEssay(messages: OpenRouterMessage[]) {
    return this.chatCompletion(messages);
  }
}
export default OpenRouterService;

