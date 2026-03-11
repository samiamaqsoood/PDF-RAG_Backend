import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Queue } from "bullmq";
const PORT = 8000;

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
})

app.post('/upload/pdf', upload.single('pdf'), async (req,res)=>{
    await queue.add('file-ready',JSON.stringify({
        filename: req.file.originalname,
        destination: req.file.destination,
        path: req.file.path
    }))
    return res.json({message:'uploaded'});
})
app.listen(PORT, (error) =>{
    if(error){
        console.log("can't connect to port 8000")
    }
    else {
        console.log(`Server satarted on PORT ${PORT}`)
    }
})