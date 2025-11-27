// types.ts
export interface Tool {
    name: string;
    description: string;
    execute: (input: any) => Promise<any>;
    schema: any
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dot = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
    return dot / (magA * magB);
  }
  
