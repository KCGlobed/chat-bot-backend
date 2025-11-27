import { ChromaClient } from "chromadb";

async function main() {
  const client = new ChromaClient({ host: "localhost", port: 8000 });
  const collections = await client.listCollections();
  console.log("Available collections:", collections);
}

main();
