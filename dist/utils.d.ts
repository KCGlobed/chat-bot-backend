export interface Tool {
    name: string;
    description: string;
    execute: (input: any) => Promise<any>;
    schema: any;
}
export declare function cosineSimilarity(vecA: number[], vecB: number[]): number;
//# sourceMappingURL=utils.d.ts.map