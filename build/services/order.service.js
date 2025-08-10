"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllOrdersService = exports.newOrder = void 0;
const order_Model_1 = __importDefault(require("../models/order.Model"));
const newOrder = async (data) => {
    const order = await order_Model_1.default.create(data);
    return order;
};
exports.newOrder = newOrder;
// Get All Orders
const getAllOrdersService = async (res) => {
    try {
        const orders = await order_Model_1.default.find()
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
    }
    catch (error) {
        throw new Error(error.message);
    }
};
exports.getAllOrdersService = getAllOrdersService;
