import User from "../models/user.model";
import { Response } from "express";
import { redis } from "../utils/redis";
export const getUserById = async (id: string, res: Response) => {
    const userJson = await redis.get(id);
    if (userJson) {
        const user = JSON.parse(userJson);
        res.status(201).json({
            suceess: true,
            user
        })
    }
}
// Get All users
export const getAllUsersService = async (res: Response) => {
    const users = await User.find().sort({ createAt: -1 });
    res.status(201).json({
        success: true,
        users,
    })
}
//update user role 
export const updateUserRoleService = async (res: Response, id: string, role: string) => {
    const user = await User.findByIdAndUpdate(id, { role }, { new: true })
    res.status(201).json({
        success: true,
        user
    })
}