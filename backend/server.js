require("dotenv").config()

const app = require('./src/app.js')

const connectDB = require("./src/config/db.js")

connectDB()

app.listen(2000,()=>{
    console.log(`server is running at port 2000`)
})

