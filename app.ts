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
import {rateLimit} from "express-rate-limit";

// Rate limiter - should be at the top
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});

// Apply rate limiting to all requests
app.use(limiter);

// Body parser middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS configuration
app.use(cors({ 
  origin: "https://elearning-web.netlify.app", 
  credentials: true 
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 Incoming ${req.method} request to ${req.path}`);
  console.log('📍 Origin:', req.headers.origin);
  next();
});

// Health check route - should be before other routes
app.get("/api/v1/health", (req: Request, res: Response, next: NextFunction) => {
  res.status(200).json({
    success: true,
    message: "API is working and healthy",
    timestamp: new Date().toISOString()
  });
});

// Test route
app.get("/test", (req: Request, res: Response, next: NextFunction) => {
  res.status(200).json({
    success: true,
    message: "API is working",
  });
});

// Routes
app.use("/api/v1", userRouter, courseRouter, orderRouter, notificaionRoute, analyticsRouter, layoutRouter);

// 404 handler - should be after all routes
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error middleware - should be last
app.use(errorMiddleware);

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  // Don't exit process in production, just log
  if (process.env.NODE_ENV === 'development') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});