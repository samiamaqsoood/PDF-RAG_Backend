import { Worker } from 'bullmq';
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from '@langchain/qdrant';
import { Document } from '@langchain/core/documents';
import { TokenTextSplitter } from "@langchain/textsplitters";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import dotenv from "dotenv";
import path from 'node:path';
dotenv.config();

const api_key = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
if (!api_key) {
    console.error("Error: Set OPENAI_API_KEY in .env or as an environment variable.");
    process.exit(1);
}
// OpenRouter keys start with sk-or-; use their API base
const baseURL = "https://openrouter.ai/api/v1";

const worker = new Worker(
    'file-uploader-queue',
     async job => {
        try {
            console.log('Job' ,job.data)
            const filenew = JSON.parse(job.data);
            console.log("file new:", filenew);
            
            /*
            PATH : data.path,
            read the pdf from path,
            call the openai embedding model for every chunk,
            store the chunk in qdrant db
            */
     
            // Load the pdf
            // const filePath = path.resolve(filenew.path);
            // console.log("Resolved file path:", filePath);
            // console.log("Original path:", filenew.path);
            const loader = new PDFLoader(filenew.path);
            const docs = await loader.load();
     
         //    const splitter = new TokenTextSplitter({ 
         //     encodingName: "cl100k_base", 
         //     chunkSize: 100, 
         //     chunkOverlap: 0
         //  })
         //    const texts = splitter.splitText(docs);
         //    console.log(texts);
     
         // const client = new QdrantClient({url: 'http://localhost:6333'});
     
         // const embeddings = new OpenAIEmbeddings({
         //     apiKey: api_key,
         //     baseURL: baseURL,
         //   });
     
         //   const vectorStore = await QdrantVectorStore.fromDocuments(
         //     docs,
         //     embeddings,
         //      {
         //         client,
         //         collectionName: 'pdf-docs'
         //   });
     
         const embeddings = new OpenAIEmbeddings({
             model: "openai/text-embedding-3-small",
             apiKey: api_key,
             baseURL: baseURL,

             configuration: {
                baseURL: "https://openrouter.ai/api/v1",
                defaultHeaders: {
                  "HTTP-Referer": "http://localhost:8000",
                  "X-Title": "pdf-rag-app"
                }
              }
           });
           
           const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
             url: process.env.QDRANT_URL,
             collectionName: "langchainjs-testing",
           });
           await vectorStore.addDocuments(docs);
           console.log("All docs are added to qdrant DB!")
        }
        catch (err) {
            console.error("Worker failed:", err)
          }
      
       
      }, 
  { concurrency: 100 ,
  connection: {
        host:'localhost',
        port: 6379
    }
}); 
