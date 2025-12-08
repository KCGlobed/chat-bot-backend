export interface OpenRouterMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
export declare class OpenRouterService {
    private apiKey;
    private chroma;
    private openai;
    private openAiKey;
    private userHistories;
    private browser;
    private pageEmbeddingCache;
    private websiteCache;
    constructor();
    precomputePageEmbeddings(allPages: string[]): Promise<void>;
    embedText(text: string): Promise<number[]>;
    private chatCompletion;
    private fetchBlogAnswer;
    private fetchPdfAnswer;
    private fetchWebsiteLiveAnswer;
    generateReply(userMessage: string, userId: number): Promise<string>;
    verifyEssay(messages: OpenRouterMessage[]): Promise<string>;
}
export default OpenRouterService;
//# sourceMappingURL=openrouter.d.ts.map