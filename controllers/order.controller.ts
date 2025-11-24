import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import OrderModel, { IOrder } from "../models/order.Model";
import UserModel from "../models/user.model";
import CourseModel from "../models/course.model";
import { sendMail } from "../utils/sendMail";
import NotificationModel from "../models/notification.Model";
import { getAllOrdersService } from "../services/order.service";
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// import { redis } from "../utils/redis";
import mongoose from "mongoose";

// Create a pending order when payment intent is created
export const createPaymentIntent = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId } = req.body;
    const userId = req.user?._id;

    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return next(new ErrorHandler("Valid Course ID is required", 400));
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    const course = await CourseModel.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    const courseExistInUser = user.courses.some((c: any) => 
      c._id && new mongoose.Types.ObjectId(c._id.toString()).equals(new mongoose.Types.ObjectId(courseId.toString()))
    );

    if (courseExistInUser) {
      return next(new ErrorHandler("You have already purchased this course", 400));
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

    if (typeof courseId !== 'string' || !mongoose.Types.ObjectId.isValid(courseId)) {
  return next(new ErrorHandler("Invalid Course ID format", 400));
}

if (typeof userId !== 'string' || !mongoose.Types.ObjectId.isValid(userId)) {
  return next(new ErrorHandler("Invalid User ID", 400));
}

// Then create the orderData with properly typed ObjectIds
const orderData: Partial<IOrder> = {
  courseId: new mongoose.Types.ObjectId(courseId as string),
  userId: new mongoose.Types.ObjectId(userId as string),
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

    const order = await OrderModel.create(orderData);

    res.status(201).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      orderId: order._id
    });

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

export const confirmOrder = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentIntentId, orderId } = req.body;
    
    if (!paymentIntentId || !orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return next(new ErrorHandler("Valid payment intent ID and order ID are required", 400));
    }

    const order = await OrderModel.findById(orderId);
    if (!order) {
      return next(new ErrorHandler("Order not found", 404));
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
    } catch (stripeError) {
      return next(new ErrorHandler("Failed to verify payment with Stripe", 500));
    }
    
    if (paymentIntent.id !== order.payment_info?.id) {
      return next(new ErrorHandler("Payment intent does not match order", 400));
    }

    if (paymentIntent.status !== 'succeeded') {
      return next(new ErrorHandler(`Payment not completed. Status: ${paymentIntent.status}`, 400));
    }

    const session = await mongoose.startSession();
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

      const user = await UserModel.findById(order.userId).session(session);
      if (user && !user.courses.some(c => c.courseId.toString() === order.courseId.toString())) {
        user.courses.push({ courseId: order.courseId.toString() });
        await user.save({ session });
        // await redis.set(user._id.toString(), JSON.stringify(user));
      }

      await CourseModel.findByIdAndUpdate(
        order.courseId, 
        { $inc: { purchased: 1 } },
        { session }
      );

      await session.commitTransaction();

      const course = await CourseModel.findById(order.courseId);
      await NotificationModel.create({
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
        
        sendMail({
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

    } catch (transactionError) {
      await session.abortTransaction();
      throw transactionError;
    } finally {
      session.endSession();
    }

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});
// Get all orders -- admin only
export const getAllOrders = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    getAllOrdersService(res);
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});

// Get order by ID -- admin only
export const getOrderById = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await OrderModel.findById(req.params.id)
      .populate('userId', '-password')
      .populate('courseId')
      .exec();

    if (!order) {
      return next(new ErrorHandler("Order not found", 404));
    }

    res.status(200).json({
      success: true,
      order
    });

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});

// Get user's orders
export const getUserOrders = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await OrderModel.find({ userId: req.user?._id })
      .populate('courseId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});

// Get Stripe publishable key
export const sendStripePublishableKey = CatchAsyncError(async (req: Request, res: Response) => {
  res.status(200).json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
  });
});
// Delete order -- admin only
// Delete order -- admin only
export const deleteOrder = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Validate order ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new ErrorHandler("Invalid order ID", 400));
    }

    // Find and delete the order
    const order = await OrderModel.findByIdAndDelete(id);
    if (!order) {
      return next(new ErrorHandler("Order not found", 404));
    }

    // If order was completed, decrement course purchased count
    if (order.status === 'completed') {
      await CourseModel.findByIdAndUpdate(order.courseId, {
        $inc: { purchased: -1 }
      });
      
      // Remove course from user's courses if it exists
      await UserModel.findByIdAndUpdate(order.userId, {
        $pull: { courses: { courseId: order.courseId } }
      });
    }

    // Invalidate Redis cache for this order
    // await redis.del(id);

    res.status(200).json({
      success: true,
      message: "Order deleted successfully"
    });

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});