import express from "express";
import { 
  createPaymentIntent,
  confirmOrder,
  getAllOrders,
  getOrderById,
  getUserOrders,
  deleteOrder,
  sendStripePublishableKey
} from "../controllers/order.controller";
import { authorizationRoles, isAuthenticated } from "../middleware/auth";

const orderRouter = express.Router();

orderRouter.post("/create-payment-intent", isAuthenticated, createPaymentIntent);
orderRouter.post("/confirm-order", isAuthenticated, confirmOrder);
orderRouter.get("/get-orders", isAuthenticated, authorizationRoles("admin"), getAllOrders);
orderRouter.get("/get-order/:id", isAuthenticated, getOrderById);
// In your order routes file
orderRouter.delete(
  "/delete-order/:id", 
  isAuthenticated, 
  authorizationRoles("admin"), 
  deleteOrder
);
orderRouter.get("/get-user-orders", isAuthenticated, getUserOrders);
orderRouter.get("/payment/stripepublishablekey", sendStripePublishableKey);

export default orderRouter;