// utils/cookieOptions.ts
import { CookieOptions } from 'express';

export const getCookieOptions = (): CookieOptions => {
  const isProduction = process.env.NODE_ENV === "production";
  
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  };
};

export const getClearCookieOptions = (): CookieOptions => {
  return {
    ...getCookieOptions(),
    expires: new Date(0),
  };
};

// Alternative: Simple inline fix without creating a separate file
export const clearCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  expires: new Date(0),
};