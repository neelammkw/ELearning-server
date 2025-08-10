import { app } from "./app";
import { initSocketServer } from "./socketServer";
import http from 'http';
require("dotenv").config();
import connectDB from "./utils/db";
import { v2 as cloudinary } from "cloudinary";
// const server = http.createServer(app);

//cloudinary config
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET_KEY,

})
// initSocketServer(server);

app.listen(process.env.PORT, () => {
    console.log(`Server is connected with port ${process.env.PORT}`);
    connectDB();
})