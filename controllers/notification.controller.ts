import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import NotificationModel from "../models/notification.Model";
import cron from 'node-cron';

//get all notifications ---only admin
export const getNotifications = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const notifications = await NotificationModel.find().sort({ createdAt: -1 });
        res.status(201).json({
            success: true,
            notifications
        });


    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

//update notifications ---only admin
export const updateNotification = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const notification = await NotificationModel.findById(req.params.id);
        if (!notification) {
            return next(new ErrorHandler("Notification not found", 404));
        } else {
            notification.status ?
                (notification.status = 'read') : notification?.status;
        }
        await notification.save();
        const notifications = await NotificationModel.find().sort({ createdAt: -1 });

        res.status(201).json({
            success: true,
            notification
        });


    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

//delete notifications ---only admin
export const deleteOldNotifications = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Check if user is admin
        if (req.user?.role !== 'admin') {
            return next(new ErrorHandler("Only admins can perform this action", 403));
        }

        const result = await deleteNotificationsOlderThanOneMonth();

        res.status(200).json({
            success: true,
            message: `Deleted ${result.deletedCount} notifications older than one month`
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// Function to delete notifications older than one month
const deleteNotificationsOlderThanOneMonth = async () => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    return await NotificationModel.deleteMany({
        createdAt: { $lt: oneMonthAgo }
    });
};

// Schedule cron job to run on the 1st day of every month at midnight
cron.schedule('0 0 1 * *', async () => {
    try {
        const result = await deleteNotificationsOlderThanOneMonth();
    } catch (error) {
        console.error('Error in notification cleanup cron job:', error);
    }
}, {
    scheduled: true,
    timezone: "UTC" // Set your preferred timezone
});




