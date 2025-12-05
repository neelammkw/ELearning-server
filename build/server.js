"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server.ts or index.ts
const app_1 = require("./app");
const db_1 = __importDefault(require("./utils/db"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Connect to database
(0, db_1.default)();
// Start server
const PORT = process.env.PORT || 8000;
const server = app_1.app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
    console.log(`🍪 Cookie sameSite: ${process.env.NODE_ENV === 'production' ? 'none' : 'lax'}`);
});
// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
    console.log(`Error: ${err.message}`);
    console.log("Shutting down server due to unhandled promise rejection");
    server.close(() => {
        process.exit(1);
    });
});
// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
    console.log(`Error: ${err.message}`);
    console.log("Shutting down server due to uncaught exception");
    process.exit(1);
});
