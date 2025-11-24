import User from "../models/user.model";
import { Response } from "express";

export const getUserById = async (id: string, res: Response) => {
    try {
        // DIRECT DATABASE FETCH - NO REDIS
        const user = await User.findById(id);
        if (user) {
            res.status(200).json({
                success: true,
                user
            });
        } else {
            res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Get All users
export const getAllUsersService = async (res: Response) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            users,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Update user role 
export const updateUserRoleService = async (res: Response, id: string, role: string) => {
    try {
        const user = await User.findByIdAndUpdate(id, { role }, { new: true });
        if (user) {
            res.status(200).json({
                success: true,
                user
            });
        } else {
            res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}