require("dotenv").config();
import { Response } from "express";
import { IUser } from "../models/user.model";
import jwt from "jsonwebtoken"; // ADD THIS IMPORT

// Remove CookieOptions and use your existing ITokenOptions interface
interface ITokenOptions {
   expires: Date;
   maxAge: number;
   httpOnly: boolean;
   sameSite: 'lax' | 'strict' | 'none' | undefined;
   secure?: boolean;
}

const accessTokenExpire = parseInt(process.env.ACCESS_TOKEN_EXPIRE || "300", 10);
const refreshTokenExpire = parseInt(process.env.REFRESH_TOKEN_EXPIRE || "1200", 10);

export const accessTokenOptions: ITokenOptions = {
   expires: new Date(Date.now() + accessTokenExpire * 60 * 60 * 1000),
   maxAge: accessTokenExpire * 60 * 60 * 1000,
   httpOnly: true,
   sameSite: 'lax', // Changed from 'none' to 'lax' for better compatibility
   secure: process.env.NODE_ENV === "production", // Dynamic based on environment
};

export const refreshTokenOptions: ITokenOptions = {
   expires: new Date(Date.now() + refreshTokenExpire * 24 * 60 * 60 * 1000),
   maxAge: refreshTokenExpire * 24 * 60 * 60 * 1000,
   httpOnly: true,
   sameSite: 'lax', // Changed from 'none' to 'lax'
   secure: process.env.NODE_ENV === "production", // Dynamic based on environment
}

export const sendToken = (user: IUser, statusCode: number, res: Response) => {
    const accessToken = jwt.sign({ id: user._id }, process.env.ACCESS_TOKEN as string, {
        expiresIn: "5m",
    });

    const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN as string, {
        expiresIn: "3d",
    });

    // Use your existing ITokenOptions instead of CookieOptions
    const accessOptions: ITokenOptions = {
        expires: new Date(Date.now() + 15 * 60 * 1000), // 5 minutes
        maxAge: 15 * 60 * 1000,
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
   secure: process.env.NODE_ENV === "production",

    };

    const refreshOptions: ITokenOptions = {
        expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        maxAge: 3 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
   secure: process.env.NODE_ENV === "production",

    };

    res.cookie("access_token", accessToken, accessOptions);
    res.cookie("refresh_token", refreshToken, refreshOptions);

    res.status(statusCode).json({
        success: true,
        user,
        accessToken,
    });
};