import { Response, Request, NextFunction } from "express";
import { CatchAsyncError } from "./catchAsyncErrors";
import jwt, { JwtPayload } from "jsonwebtoken";
import ErrorHandler from "../utils/ErrorHandler";
import User from "../models/user.model";

// Authenticated user 
export const isAuthenticated = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const accessToken = req.cookies.access_token as string;
        if (!accessToken) {
            return next(new ErrorHandler("Please login to access this resource", 401));
        }

        const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN as string) as JwtPayload;

        if (!decoded || !decoded.id) {
            return next(new ErrorHandler("Access token is not valid", 401));
        }

        // DIRECT DATABASE FETCH - NO REDIS
        const user = await User.findById(decoded.id);
        if (!user) {
            return next(new ErrorHandler("Please login to access this resource", 401));
        }

        req.user = user;
        next();

    } catch (error: any) {
        return next(new ErrorHandler("Authentication failed: " + error.message, 401));
    }
});

export const authorizationRoles = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role || "")) {
            return next(new ErrorHandler(`Role: ${req.user?.role} is not allowed to access this resource`, 403));
        }
        next();
    }
}