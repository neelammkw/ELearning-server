"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const order_controller_1 = require("../controllers/order.controller");
const auth_1 = require("../middleware/auth");
const orderRouter = express_1.default.Router();
orderRouter.post("/create-payment-intent", auth_1.isAuthenticated, order_controller_1.createPaymentIntent);
orderRouter.post("/confirm-order", auth_1.isAuthenticated, order_controller_1.confirmOrder);
orderRouter.get("/get-orders", auth_1.isAuthenticated, (0, auth_1.authorizationRoles)("admin"), order_controller_1.getAllOrders);
orderRouter.get("/get-order/:id", auth_1.isAuthenticated, order_controller_1.getOrderById);
// In your order routes file
orderRouter.delete("/delete-order/:id", auth_1.isAuthenticated, (0, auth_1.authorizationRoles)("admin"), order_controller_1.deleteOrder);
orderRouter.get("/get-user-orders", auth_1.isAuthenticated, order_controller_1.getUserOrders);
orderRouter.get("/payment/stripepublishablekey", order_controller_1.sendStripePublishableKey);
exports.default = orderRouter;
