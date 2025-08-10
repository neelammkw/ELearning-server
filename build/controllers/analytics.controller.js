"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderAnalytics = exports.getCoursesAnalytics = exports.getUserAnalytics = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const analytics_generator_1 = require("../utils/analytics.generator");
const user_model_1 = __importDefault(require("../models/user.model"));
const course_model_1 = __importDefault(require("../models/course.model"));
const order_Model_1 = __importDefault(require("../models/order.Model"));
//get user analytics ---only admin
exports.getUserAnalytics = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const users = await (0, analytics_generator_1.generateLast12MonthsData)(user_model_1.default);
        res.status(200).json({
            success: true,
            message: "Users Analytics",
            users
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
//get courses analytics -- only for admin
exports.getCoursesAnalytics = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const monthlyData = await (0, analytics_generator_1.generateLast12MonthsData)(course_model_1.default);
        const totalCourses = await course_model_1.default.countDocuments();
        res.status(200).json({
            success: true,
            message: "Course Analytics",
            courses: {
                ...monthlyData,
                totalCourses // Add total course count
            }
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
//get order analytics -- only for admin
exports.getOrderAnalytics = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const orders = await (0, analytics_generator_1.generateLast12MonthsData)(order_Model_1.default);
        res.status(200).json({
            success: true,
            message: "Order Analytics",
            orders
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
