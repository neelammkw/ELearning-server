"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
require("dotenv").config();
const dbUrl = process.env.DB_URL || "";
const connectDB = async () => {
    try {
        const { connection } = await mongoose_1.default.connect(dbUrl);
        console.log(`✅ Database connected with ${connection.host}`);
    }
    catch (error) {
        console.error(`❌ Database connection error: ${error.message}`);
        setTimeout(connectDB, 5000); // Retry connection after 5 seconds
    }
};
exports.default = connectDB;
