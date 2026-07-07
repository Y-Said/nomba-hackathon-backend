

const bodyParser = require("body-parser")
const express = require("express")
const handlers = require("./lib/route.js")
const path = require('path');

const app = express()
const PORT = process.env.PORT || 3000

app.use('/static', express.static(path.join(__dirname, 'static')));
app.use(express.raw({ type: '*/*', limit: '10mb' }));


app.post("/checkout",handlers.checkOutOrder)
app.post("/webhook",handlers.webhook)
app.post("/get-today",handlers.getTodayPodcast)
app.post("/create-user",handlers.createUser)
//app.get("/test", (req,res) => res.send("TEst"))

app.listen(PORT,() => console.log("server running ",PORT));


