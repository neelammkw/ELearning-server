"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizationRoles = exports.isAuthenticated = void 0;
const catchAsyncErrors_1 = require("./catchAsyncErrors");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const user_model_1 = __importDefault(require("../models/user.model"));
// Authenticated user 
// export const isAuthenticated = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
//     try {
//         const accessToken = req.cookies.access_token as string;
//         if (!accessToken) {
//             return next(new ErrorHandler("Please login to access this resource", 401));
//         }
//         const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN as string) as JwtPayload;
//         if (!decoded || !decoded.id) {
//             return next(new ErrorHandler("Access token is not valid", 401));
//         }
//         // DIRECT DATABASE FETCH - NO REDIS
//         const user = await User.findById(decoded.id);
//         if (!user) {
//             return next(new ErrorHandler("Please login to access this resource", 401));
//         }
//         req.user = user;
//         next();
//     } catch (error: any) {
//         return next(new ErrorHandler("Authentication failed: " + error.message, 401));
//     }
// });
exports.isAuthenticated = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const accessToken = req.cookies.access_token;
        console.log('isAuthenticated - access token present:', !!accessToken);
        if (!accessToken) {
            console.log('No access token found in cookies');
            return next(new ErrorHandler_1.default("Please login to access this resource", 401));
        }
        const decoded = jsonwebtoken_1.default.verify(accessToken, process.env.ACCESS_TOKEN);
        if (!decoded || !decoded.id) {
            console.log('Invalid access token');
            return next(new ErrorHandler_1.default("Access token is not valid", 401));
        }
        const user = await user_model_1.default.findById(decoded.id);
        if (!user) {
            console.log('User not found for ID:', decoded.id);
            return next(new ErrorHandler_1.default("Please login to access this resource", 401));
        }
        req.user = user;
        next();
    }
    catch (error) {
        console.error('Authentication error:', error.message);
        if (error.name === 'TokenExpiredError') {
            return next(new ErrorHandler_1.default("Access token expired", 401));
        }
        if (error.name === 'JsonWebTokenError') {
            return next(new ErrorHandler_1.default("Invalid access token", 401));
        }
        return next(new ErrorHandler_1.default("Authentication failed", 401));
    }
});
const authorizationRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role || "")) {
            return next(new ErrorHandler_1.default(`Role: ${req.user?.role} is not allowed to access this resource`, 403));
        }
        next();
    };
};
exports.authorizationRoles = authorizationRoles;
