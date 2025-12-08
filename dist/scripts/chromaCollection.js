"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chromadb_1 = require("chromadb");
async function main() {
    const client = new chromadb_1.ChromaClient({ host: "localhost", port: 8000 });
    const collections = await client.listCollections();
    console.log("Available collections:", collections);
}
main();
//# sourceMappingURL=chromaCollection.js.map