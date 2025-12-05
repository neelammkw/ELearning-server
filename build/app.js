"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
require('dotenv').config();
const express_1 = __importDefault(require("express"));
exports.app = (0, express_1.default)();
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const error_1 = __importDefault(require("./middleware/error"));
const user_route_1 = __importDefault(require("./routes/user.route"));
const course_route_1 = __importDefault(require("./routes/course.route"));
const order_route_1 = __importDefault(require("./routes/order.route"));
const notification_route_1 = __importDefault(require("./routes/notification.route"));
const analytics_route_1 = __importDefault(require("./routes/analytics.route"));
const layout_route_1 = __importDefault(require("./routes/layout.route"));
const express_rate_limit_1 = require("express-rate-limit");
// ========== CRITICAL FIXES ==========
// 1. CORS MUST BE CONFIGURED FIRST
exports.app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "https://elearning-web.netlify.app",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie']
}));
// 2. Handle preflight requests explicitly
exports.app.options('*', (0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "https://elearning-web.netlify.app",
    credentials: true,
}));
// 3. Body parsers (CORRECT ORDER)
exports.app.use(express_1.default.json({ limit: "50mb" }));
exports.app.use(express_1.default.urlencoded({ extended: true, limit: "50mb" }));
// 4. Cookie parser
exports.app.use((0, cookie_parser_1.default)());
// 5. Rate limiter (FIXED CONFIGURATION)
const limiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyGenerator: (req) => {
        // Use IP address as key
        return req.ip || req.connection.remoteAddress || '';
    },
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
});
// Apply rate limiting to all API routes
exports.app.use("/api/v1", limiter);
// ========== DEBUGGING MIDDLEWARE (Temporary) ==========
exports.app.use((req, res, next) => {
    console.log(`\n=== ${new Date().toISOString()} ===`);
    console.log(`Incoming ${req.method} request to ${req.originalUrl}`);
    console.log('Origin:', req.headers.origin);
    console.log('Cookies:', req.cookies);
    console.log('Authorization:', req.headers.authorization);
    // Log cookies specifically for debugging
    if (req.cookies) {
        console.log('Cookie Details:');
        console.log('- access_token present:', !!req.cookies.access_token);
        console.log('- refresh_token present:', !!req.cookies.refresh_token);
    }
    next();
});
// ========== ROUTES ==========
exports.app.use("/api/v1", user_route_1.default);
exports.app.use("/api/v1", course_route_1.default);
exports.app.use("/api/v1", order_route_1.default);
exports.app.use("/api/v1", notification_route_1.default);
exports.app.use("/api/v1", analytics_route_1.default);
exports.app.use("/api/v1", layout_route_1.default);
// ========== TEST ROUTES ==========
// Test authentication
exports.app.get("/api/v1/test-auth", (req, res) => {
    console.log('Test Auth Cookies:', req.cookies);
    if (req.cookies.access_token) {
        res.status(200).json({
            success: true,
            message: "Authentication cookies are present",
            cookies: Object.keys(req.cookies)
        });
    }
    else {
        res.status(401).json({
            success: false,
            message: "No authentication cookies found"
        });
    }
});
// Test CORS and cookies
exports.app.get("/api/v1/test-cors", (req, res) => {
    // Set a test cookie
    res.cookie('test_cookie', 'test_value', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000
    });
    res.status(200).json({
        success: true,
        message: "CORS test endpoint",
        cookiesSent: !!req.cookies,
        origin: req.headers.origin
    });
});
// Simple test route
exports.app.get("/api/v1/test", (req, res) => {
    res.status(200).json({
        success: true,
        message: "API is working",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});
// Root route
exports.app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Welcome to E-Learning API",
        version: "1.0.0",
        docs: "/api/v1/docs"
    });
});
// ========== ERROR HANDLING ==========
// 404 handler
exports.app.use("*", (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});
// Error middleware (MUST BE LAST)
exports.app.use(error_1.default);
// Export app for server file
exports.default = exports.app;
