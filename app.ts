require('dotenv').config();
import express, { NextFunction, Response, Request } from "express";
export const app = express();
import cors from "cors";
import cookieParser from "cookie-parser";
import errorMiddleware from "./middleware/error";
import userRouter from "./routes/user.route";
import courseRouter from "./routes/course.route";
import orderRouter from "./routes/order.route";
import notificaionRoute from "./routes/notification.route";
import analyticsRouter from "./routes/analytics.route";
import layoutRouter from "./routes/layout.route";
import { rateLimit } from "express-rate-limit";

// ========== CRITICAL FIXES ==========

// 1. CORS MUST BE CONFIGURED FIRST
app.use(cors({
  origin: process.env.FRONTEND_URL || "https://elearning-web.netlify.app",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie']
}));

// 2. Handle preflight requests explicitly
app.options('*', cors({
  origin: process.env.FRONTEND_URL || "https://elearning-web.netlify.app",
  credentials: true,
}));

// 3. Body parsers (CORRECT ORDER)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 4. Cookie parser
app.use(cookieParser());

// 5. Rate limiter (FIXED CONFIGURATION)
const limiter = rateLimit({
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
app.use("/api/v1", limiter);

// ========== DEBUGGING MIDDLEWARE (Temporary) ==========
app.use((req: Request, res: Response, next: NextFunction) => {
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
app.use("/api/v1", userRouter);
app.use("/api/v1", courseRouter);
app.use("/api/v1", orderRouter);
app.use("/api/v1", notificaionRoute);
app.use("/api/v1", analyticsRouter);
app.use("/api/v1", layoutRouter);

// ========== TEST ROUTES ==========
// Test authentication
app.get("/api/v1/test-auth", (req: Request, res: Response) => {
  console.log('Test Auth Cookies:', req.cookies);
  
  if (req.cookies.access_token) {
    res.status(200).json({
      success: true,
      message: "Authentication cookies are present",
      cookies: Object.keys(req.cookies)
    });
  } else {
    res.status(401).json({
      success: false,
      message: "No authentication cookies found"
    });
  }
});

// Test CORS and cookies
app.get("/api/v1/test-cors", (req: Request, res: Response) => {
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
app.get("/api/v1/test", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "API is working",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Root route
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Welcome to E-Learning API",
    version: "1.0.0",
    docs: "/api/v1/docs"
  });
});

// ========== ERROR HANDLING ==========
// 404 handler
app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error middleware (MUST BE LAST)
app.use(errorMiddleware);

// Export app for server file
export default app;