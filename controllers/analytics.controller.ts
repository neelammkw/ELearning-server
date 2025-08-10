import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import { generateLast12MonthsData } from "../utils/analytics.generator";
import User from "../models/user.model";
import CourseModel from "../models/course.model";
import OrderModel from "../models/order.Model";

//get user analytics ---only admin
export const getUserAnalytics = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const users = await generateLast12MonthsData(User);

        res.status(200).json({
            success: true,
            message: "Users Analytics",
            users
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

//get courses analytics -- only for admin
export const getCoursesAnalytics = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const monthlyData = await generateLast12MonthsData(CourseModel);
        const totalCourses = await CourseModel.countDocuments();
        
        res.status(200).json({
            success: true,
            message: "Course Analytics",
            courses: {
                ...monthlyData,
                totalCourses // Add total course count
            }
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

//get order analytics -- only for admin

export const getOrderAnalytics = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orders = await generateLast12MonthsData(OrderModel);

        res.status(200).json({
            success: true,
            message: "Order Analytics",
            orders
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});