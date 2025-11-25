     import express from "express";
     import { loginUser, registrationUser, logoutUser, updateAccessToken, getUserInfo, socialAuth, updateUserInfo, updatePassword, updateProfilePicture, getAllUsers, updateUserRole, deleteUser} from "../controllers/user.controller";
     import {activateUser} from "../controllers/user.controller";
     import { authorizationRoles, isAuthenticated } from "../middleware/auth";


     const userRouter = express.Router();

     userRouter.post('/registration', registrationUser);
     userRouter.post('/activate-user', activateUser);
     userRouter.post('/login', loginUser);
     userRouter.get('/logout', isAuthenticated,
          logoutUser);
     //authorizationRoles("admin")
     userRouter.get("/refresh", updateAccessToken );
     userRouter.get("/me", updateAccessToken, isAuthenticated, getUserInfo);
     userRouter.post("/social-auth", socialAuth);
     userRouter.put("/update-userinfo", updateAccessToken, isAuthenticated, updateUserInfo);
     userRouter.put("/update-user-password", updateAccessToken, isAuthenticated, updatePassword);

     userRouter.put("/update-user-avatar", updateAccessToken, isAuthenticated, updateProfilePicture);
     userRouter.get("/get-users", updateAccessToken, isAuthenticated, authorizationRoles("admin"), getAllUsers);
     userRouter.put("/update-user-role", updateAccessToken, isAuthenticated,authorizationRoles("admin"), updateUserRole);
     userRouter.delete("/delete-user/:id", updateAccessToken, isAuthenticated,authorizationRoles("admin"), deleteUser);

     export default userRouter;
