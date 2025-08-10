import { Response, Request, NextFunction } from "express";
import { CatchAsyncError } from "./catchAsyncErrors";
import jwt, { JwtPayload } from "jsonwebtoken";
import ErrorHandler from "../utils/ErrorHandler";
import {redis} from "../utils/redis";


//authenticated user 
export const isAuthenticated = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const accessToken = req.cookies.access_token as string;
    if(!accessToken) {
        return next(new ErrorHandler("Please login to access this resource", 400));
    }
    const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN as string) as JwtPayload;

    if(!decoded || !decoded.id) {
        return next(new ErrorHandler("access token is not valid", 400));
    }
    const user = await redis.get(decoded.id);
    // console.log('User from Redis:', user); 
    if(!user ) {
        return next(new ErrorHandler("Please login to access this resource", 400));
    }
    req.user = JSON.parse(user);
    // console.log('Request user set to:', req.user); 
    next();

});

export const authorizationRoles = (...roles: string[]) => {
    return (req:Request, res:Response, next:NextFunction) => {
        if(!roles.includes(req.user?.role || "")) {
            return next(new ErrorHandler (`Role: ${req.user?.role} is not allowed to access this resource`, 403))
        }
        next();
    }
}