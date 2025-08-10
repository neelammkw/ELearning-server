"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteOrder = exports.sendStripePublishableKey = exports.getUserOrders = exports.getOrderById = exports.getAllOrders = exports.confirmOrder = exports.createPaymentIntent = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const order_Model_1 = __importDefault(require("../models/order.Model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const course_model_1 = __importDefault(require("../models/course.model"));
const sendMail_1 = require("../utils/sendMail");
const notification_Model_1 = __importDefault(require("../models/notification.Model"));
const order_service_1 = require("../services/order.service");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const redis_1 = require("../utils/redis");
const mongoose_1 = __importDefault(require("mongoose"));
// Create a pending order when payment intent is created
exports.createPaymentIntent = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { courseId } = req.body;
        const userId = req.user?._id;
        if (!courseId || !mongoose_1.default.Types.ObjectId.isValid(courseId)) {
            return next(new ErrorHandler_1.default("Valid Course ID is required", 400));
        }
        const user = await user_model_1.default.findById(userId);
        if (!user) {
            return next(new ErrorHandler_1.default("User not found", 404));
        }
        const course = await course_model_1.default.findById(courseId);
        if (!course) {
            return next(new ErrorHandler_1.default("Course not found", 404));
        }
        const courseExistInUser = user.courses.some((c) => c._id && new mongoose_1.default.Types.ObjectId(c._id.toString()).equals(new mongoose_1.default.Types.ObjectId(courseId.toString())));
        if (courseExistInUser) {
            return next(new ErrorHandler_1.default("You have already purchased this course", 400));
        }
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(course.price * 100),
            currency: "INR",
            description: `Export of digital education service: ${course.name} (HS/SAC Code: 998316)`,
            metadata: {
                courseId: course._id.toString(),
                userId: user._id.toString(),
                export_type: "digital_service",
                service_type: "online_education",
                hs_code: "998316",
                sac_code: "998316"
            },
            shipping: {
                name: user.name,
                address: {
                    line1: "Digital Service",
                    city: "N/A",
                    postal_code: "000000",
                    country: "IN"
                }
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });
        if (typeof courseId !== 'string' || !mongoose_1.default.Types.ObjectId.isValid(courseId)) {
            return next(new ErrorHandler_1.default("Invalid Course ID format", 400));
        }
        if (typeof userId !== 'string' || !mongoose_1.default.Types.ObjectId.isValid(userId)) {
            return next(new ErrorHandler_1.default("Invalid User ID", 400));
        }
        // Then create the orderData with properly typed ObjectIds
        const orderData = {
            courseId: new mongoose_1.default.Types.ObjectId(courseId),
            userId: new mongoose_1.default.Types.ObjectId(userId),
            totalAmount: course.price,
            paymentMethod: 'card',
            status: 'pending',
            payment_info: {
                id: paymentIntent.id,
                status: paymentIntent.status,
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency,
            },
            export_details: {
                description: `Export of online course: ${course.name}`,
                hs_code: "998316",
                sac_code: "998316",
                is_export: true,
                service_type: "online_education"
            }
        };
        const order = await order_Model_1.default.create(orderData);
        res.status(201).json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            orderId: order._id
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.confirmOrder = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { paymentIntentId, orderId } = req.body;
        if (!paymentIntentId || !orderId || !mongoose_1.default.Types.ObjectId.isValid(orderId)) {
            return next(new ErrorHandler_1.default("Valid payment intent ID and order ID are required", 400));
        }
        const order = await order_Model_1.default.findById(orderId);
        if (!order) {
            return next(new ErrorHandler_1.default("Order not found", 404));
        }
        if (order.status === 'completed') {
            return res.status(200).json({
                success: true,
                message: "Order is already completed",
                order
            });
        }
        let paymentIntent;
        try {
            paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        }
        catch (stripeError) {
            return next(new ErrorHandler_1.default("Failed to verify payment with Stripe", 500));
        }
        if (paymentIntent.id !== order.payment_info?.id) {
            return next(new ErrorHandler_1.default("Payment intent does not match order", 400));
        }
        if (paymentIntent.status !== 'succeeded') {
            return next(new ErrorHandler_1.default(`Payment not completed. Status: ${paymentIntent.status}`, 400));
        }
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            order.status = 'completed';
            order.payment_info = {
                ...order.payment_info,
                status: paymentIntent.status,
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency,
                updatedAt: new Date()
            };
            await order.save({ session });
            const user = await user_model_1.default.findById(order.userId).session(session);
            if (user && !user.courses.some(c => c.courseId.toString() === order.courseId.toString())) {
                user.courses.push({ courseId: order.courseId.toString() });
                await user.save({ session });
                await redis_1.redis.set(user._id.toString(), JSON.stringify(user));
            }
            await course_model_1.default.findByIdAndUpdate(order.courseId, { $inc: { purchased: 1 } }, { session });
            await session.commitTransaction();
            const course = await course_model_1.default.findById(order.courseId);
            await notification_Model_1.default.create({
                user: order.userId,
                title: "Order Completed",
                message: `Your order for ${course?.name || 'a course'} has been completed`,
            });
            if (user && course) {
                const mailData = {
                    order: {
                        _id: order._id.toString().slice(0, 6),
                        name: course.name,
                        price: order.payment_info?.amount,
                        date: new Date().toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        }),
                    },
                    user: {
                        name: user.name,
                        email: user.email
                    }
                };
                (0, sendMail_1.sendMail)({
                    email: user.email,
                    subject: "Order Confirmation",
                    template: "order-confirmation.ejs",
                    data: mailData
                }).catch(console.error);
            }
            res.status(200).json({
                success: true,
                order
            });
        }
        catch (transactionError) {
            await session.abortTransaction();
            throw transactionError;
        }
        finally {
            session.endSession();
        }
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Get all orders -- admin only
exports.getAllOrders = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        (0, order_service_1.getAllOrdersService)(res);
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
// Get order by ID -- admin only
exports.getOrderById = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const order = await order_Model_1.default.findById(req.params.id)
            .populate('userId', '-password')
            .populate('courseId')
            .exec();
        if (!order) {
            return next(new ErrorHandler_1.default("Order not found", 404));
        }
        res.status(200).json({
            success: true,
            order
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
// Get user's orders
exports.getUserOrders = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const orders = await order_Model_1.default.find({ userId: req.user?._id })
            .populate('courseId')
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            orders
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
// Get Stripe publishable key
exports.sendStripePublishableKey = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res) => {
    res.status(200).json({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });
});
// Delete order -- admin only
// Delete order -- admin only
exports.deleteOrder = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { id } = req.params;
        // Validate order ID
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            return next(new ErrorHandler_1.default("Invalid order ID", 400));
        }
        // Find and delete the order
        const order = await order_Model_1.default.findByIdAndDelete(id);
        if (!order) {
            return next(new ErrorHandler_1.default("Order not found", 404));
        }
        // If order was completed, decrement course purchased count
        if (order.status === 'completed') {
            await course_model_1.default.findByIdAndUpdate(order.courseId, {
                $inc: { purchased: -1 }
            });
            // Remove course from user's courses if it exists
            await user_model_1.default.findByIdAndUpdate(order.userId, {
                $pull: { courses: { courseId: order.courseId } }
            });
        }
        // Invalidate Redis cache for this order
        await redis_1.redis.del(id);
        res.status(200).json({
            success: true,
            message: "Order deleted successfully"
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
