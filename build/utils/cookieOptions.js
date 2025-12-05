"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCookieOptions = exports.getClearCookieOptions = exports.getCookieOptions = void 0;
const getCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
    };
};
exports.getCookieOptions = getCookieOptions;
const getClearCookieOptions = () => {
    return {
        ...(0, exports.getCookieOptions)(),
        expires: new Date(0),
    };
};
exports.getClearCookieOptions = getClearCookieOptions;
// Alternative: Simple inline fix without creating a separate file
exports.clearCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    expires: new Date(0),
};
