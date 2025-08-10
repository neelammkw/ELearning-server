// order.service.ts
import { NextFunction, Response } from "express";
import OrderModel from "../models/order.Model";

export const newOrder = async (data: { courseId: string; userId: string }) => {
    const order = await OrderModel.create(data);
    return order;
};
// Get All Orders

export const getAllOrdersService = async (res: Response) => {
  try {
    const orders = await OrderModel.find()
      .sort({ createdAt: -1 })
      .populate({
        path: 'userId',
        select: 'name email avatar', // Only get name and email from user
      })
      .populate({
        path: 'courseId', // Only get name and price from course
      });

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
};