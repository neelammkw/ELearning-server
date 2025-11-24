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
exports.isAuthenticated = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const accessToken = req.cookies.access_token;
        if (!accessToken) {
            return next(new ErrorHandler_1.default("Please login to access this resource", 401));
        }
        const decoded = jsonwebtoken_1.default.verify(accessToken, process.env.ACCESS_TOKEN);
        if (!decoded || !decoded.id) {
            return next(new ErrorHandler_1.default("Access token is not valid", 401));
        }
        // DIRECT DATABASE FETCH - NO REDIS
        const user = await user_model_1.default.findById(decoded.id);
        if (!user) {
            return next(new ErrorHandler_1.default("Please login to access this resource", 401));
        }
        req.user = user;
        next();
    }
    catch (error) {
        return next(new ErrorHandler_1.default("Authentication failed: " + error.message, 401));
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
