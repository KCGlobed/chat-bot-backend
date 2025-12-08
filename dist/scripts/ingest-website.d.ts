import 'dotenv/config';
declare function ingestWebsites(): Promise<void>;
declare function queryWebsiteCollection(query: string, topK?: number): Promise<string>;
export { ingestWebsites, queryWebsiteCollection };
//# sourceMappingURL=ingest-website.d.ts.map