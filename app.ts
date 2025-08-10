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

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({ 
  origin: process.env.ORIGIN || "http://localhost:3000", 
  credentials: true 
}));
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
standardHeaders: 'draft-7',
legacyHeaders: false,
})
app.use((req, res, next) => {
  console.log(`Incoming ${req.method} request to ${req.path}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});
// Routes
app.use("/api/v1", userRouter, courseRouter, orderRouter, notificaionRoute, analyticsRouter, layoutRouter);

// Test route
app.get("/test", (req: Request, res: Response, next: NextFunction) => {
    res.status(200).json({
        success: true,
        message: "API is working",
    });
});

//  middleware calls
app.use(limiter);
app.use(errorMiddleware);

// Server listening should be in your server.ts/index.ts file