"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserRoleService = exports.getAllUsersService = exports.getUserById = void 0;
const user_model_1 = __importDefault(require("../models/user.model"));
const getUserById = async (id, res) => {
    try {
        // DIRECT DATABASE FETCH - NO REDIS
        const user = await user_model_1.default.findById(id);
        if (user) {
            res.status(200).json({
                success: true,
                user
            });
        }
        else {
            res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
exports.getUserById = getUserById;
// Get All users
const getAllUsersService = async (res) => {
    try {
        const users = await user_model_1.default.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            users,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
exports.getAllUsersService = getAllUsersService;
// Update user role 
const updateUserRoleService = async (res, id, role) => {
    try {
        const user = await user_model_1.default.findByIdAndUpdate(id, { role }, { new: true });
        if (user) {
            res.status(200).json({
                success: true,
                user
            });
        }
        else {
            res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
exports.updateUserRoleService = updateUserRoleService;
