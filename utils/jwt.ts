require("dotenv").config();
import { Response } from "express";
import { IUser } from "../models/user.model";
import jwt from "jsonwebtoken";

interface ITokenOptions {
   expires: Date;
   maxAge: number;
   httpOnly: boolean;
   sameSite: 'lax' | 'strict' | 'none' | undefined;
   secure?: boolean;
}

// Parse environment variables correctly
const accessTokenExpire = parseInt(process.env.ACCESS_TOKEN_EXPIRE || "5", 10); // 5 minutes
const refreshTokenExpire = parseInt(process.env.REFRESH_TOKEN_EXPIRE || "3", 10); // 3 days

export const accessTokenOptions: ITokenOptions = {
   expires: new Date(Date.now() + accessTokenExpire * 60 * 1000), // minutes to milliseconds
   maxAge: accessTokenExpire * 60 * 1000,
   httpOnly: true,
   sameSite: 'lax',
   secure: process.env.NODE_ENV === "production",
};

export const refreshTokenOptions: ITokenOptions = {
   expires: new Date(Date.now() + refreshTokenExpire * 24 * 60 * 60 * 1000), // days to milliseconds
   maxAge: refreshTokenExpire * 24 * 60 * 60 * 1000,
   httpOnly: true,
   sameSite: 'lax',
   secure: process.env.NODE_ENV === "production",
}

export const sendToken = (user: IUser, statusCode: number, res: Response) => {
    const accessToken = jwt.sign({ id: user._id }, process.env.ACCESS_TOKEN as string, {
        expiresIn: `${accessTokenExpire}m`, // Match cookie expiration
    });

    const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN as string, {
        expiresIn: `${refreshTokenExpire}d`, // Match cookie expiration
    });

    res.cookie("access_token", accessToken, accessTokenOptions);
    res.cookie("refresh_token", refreshToken, refreshTokenOptions);

    res.status(statusCode).json({
        success: true,
        user,
        accessToken,
    });
};