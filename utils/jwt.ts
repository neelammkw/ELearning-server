// utils/jwt.ts
require("dotenv").config();
import { Response } from "express";
import { IUser } from "../models/user.model";
import jwt from "jsonwebtoken";

// Define proper type for cookie options
interface ITokenOptions {
  expires: Date;
  maxAge: number;
  httpOnly: boolean;
  sameSite: 'lax' | 'strict' | 'none' | boolean;
  secure?: boolean;
}

export const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : ("lax" as const),
  };
};

export const accessTokenOptions: ITokenOptions = {
  expires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
  maxAge: 15 * 60 * 1000,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : ("lax" as const),
};

export const refreshTokenOptions: ITokenOptions = {
  expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
  maxAge: 3 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : ("lax" as const),
};

export const sendToken = (user: IUser, statusCode: number, res: Response) => {
  const accessToken = jwt.sign(
    { id: user._id },
    process.env.ACCESS_TOKEN as string,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN as string,
    { expiresIn: "3d" }
  );

  // Set cookies with consistent options
  res.cookie("access_token", accessToken, accessTokenOptions);
  res.cookie("refresh_token", refreshToken, refreshTokenOptions);

  res.status(statusCode).json({
    success: true,
    user,
    accessToken,
  });
};