export declare const TOOLS: Record<string, {
    execute: (params: {
        sql: string;
    }) => Promise<{
        rows: any[];
        error?: string;
    }>;
}>;
export declare function buildToolContext(): string;
//# sourceMappingURL=index.d.ts.map