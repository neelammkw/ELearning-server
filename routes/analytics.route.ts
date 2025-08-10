import express from "express";
import { authorizationRoles, isAuthenticated } from "../middleware/auth";
import { isatty } from "tty";
import { getCoursesAnalytics, getOrderAnalytics, getUserAnalytics } from "../controllers/analytics.controller";

const analyticsRouter = express.Router();

analyticsRouter.get("/get-users-analytics", isAuthenticated, authorizationRoles("admin"), getUserAnalytics);
analyticsRouter.get("/get-orders-analytics", isAuthenticated, authorizationRoles("admin"), getOrderAnalytics);
analyticsRouter.get("/get-courses-analytics", isAuthenticated, authorizationRoles("admin"), getCoursesAnalytics);

export default analyticsRouter;