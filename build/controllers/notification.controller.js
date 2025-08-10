"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteOldNotifications = exports.updateNotification = exports.getNotifications = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const notification_Model_1 = __importDefault(require("../models/notification.Model"));
const node_cron_1 = __importDefault(require("node-cron"));
//get all notifications ---only admin
exports.getNotifications = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const notifications = await notification_Model_1.default.find().sort({ createdAt: -1 });
        res.status(201).json({
            success: true,
            notifications
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
//update notifications ---only admin
exports.updateNotification = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const notification = await notification_Model_1.default.findById(req.params.id);
        if (!notification) {
            return next(new ErrorHandler_1.default("Notification not found", 404));
        }
        else {
            notification.status ?
                (notification.status = 'read') : notification?.status;
        }
        await notification.save();
        const notifications = await notification_Model_1.default.find().sort({ createdAt: -1 });
        res.status(201).json({
            success: true,
            notification
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
//delete notifications ---only admin
exports.deleteOldNotifications = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        // Check if user is admin
        if (req.user?.role !== 'admin') {
            return next(new ErrorHandler_1.default("Only admins can perform this action", 403));
        }
        const result = await deleteNotificationsOlderThanOneMonth();
        res.status(200).json({
            success: true,
            message: `Deleted ${result.deletedCount} notifications older than one month`
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Function to delete notifications older than one month
const deleteNotificationsOlderThanOneMonth = async () => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    return await notification_Model_1.default.deleteMany({
        createdAt: { $lt: oneMonthAgo }
    });
};
// Schedule cron job to run on the 1st day of every month at midnight
node_cron_1.default.schedule('0 0 1 * *', async () => {
    try {
        const result = await deleteNotificationsOlderThanOneMonth();
    }
    catch (error) {
        console.error('Error in notification cleanup cron job:', error);
    }
}, {
    scheduled: true,
    timezone: "UTC" // Set your preferred timezone
});
