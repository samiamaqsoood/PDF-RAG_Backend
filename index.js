import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Queue } from "bullmq";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from '@langchain/qdrant';
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();
const PORT = 8000;

const api_key = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
if (!api_key) {
    console.error("Error: Set OPENAI_API_KEY in .env or as an environment variable.");
    process.exit(1);
}
// OpenRouter keys start with sk-or-; use their API base
const baseURL = "https://openrouter.ai/api/v1";

const client = new OpenAI({
    apiKey: api_key,
    baseURL: baseURL,
});

const queue = new Queue("file-uploader-queue", {
    connection:{
        host:'localhost',
        port: 6379
    }
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, './uploads')
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null,`${uniqueSuffix}-${file.originalname}`)
    }
  })
  
 const upload = multer({ storage: storage })

const app = express();
app.use(cors());

app.get('/',(req,res) => {
    return res.json({status : "All Good!"})
});

app.post('/upload/pdf', upload.single('pdf'), async (req,res)=>{
    await queue.add('file-ready',JSON.stringify({
        filename: req.file.originalname,
        destination: req.file.destination,
        path: req.file.path
    }))
    return res.json({message:'uploaded'});
});

app.get('/chat',async (req,res) => {
    const userQuery = req.query.message;

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

      const retriever = vectorStore.asRetriever({
        k: 2,
      });
      const result = await retriever.invoke(userQuery);

      const SYSTEM_PROMPT = `You are a helpful AI assistant who answers user quries based on the context provided by PDF file.
      context :
      ${JSON.stringify(result)}`

      const chatResult = await client.chat.completions.create({
        model: "openai/gpt-oss-120b:free",
        messages: [
            {role:"system", content:SYSTEM_PROMPT},
            {role:"user", content: userQuery}
        ],
    })

      return res.json({
        result: chatResult.choices[0].message.content,
        docs: result,
      })
})
app.listen(PORT, (error) =>{
    if(error){
        console.log("can't connect to port 8000")
    }
    else {
        console.log(`Server satarted on PORT ${PORT}`)
    }
})