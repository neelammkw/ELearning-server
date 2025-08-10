import express from "express";
import { authorizationRoles, isAuthenticated } from "../middleware/auth";
import { getNotifications, updateNotification } from "../controllers/notification.controller";
import { updateAccessToken } from "../controllers/user.controller";
const notificationRoute = express.Router();

notificationRoute.get("/get-all-notifications", updateAccessToken, isAuthenticated,authorizationRoles("admin"), getNotifications);
notificationRoute.put("/update-notification/:id", updateAccessToken, isAuthenticated,authorizationRoles("admin"), updateNotification);

export default notificationRoute;