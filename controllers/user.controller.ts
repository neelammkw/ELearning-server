require('dotenv').config();
import { Request, Response, NextFunction } from "express";
import User, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import ejs from "ejs";
import path from "path";
import { sendMail } from "../utils/sendMail";
import cloudinary from "cloudinary";
import { accessTokenOptions, refreshTokenOptions, sendToken } from "../utils/jwt";
// import { redis } from "../utils/redis"
import { getAllUsersService, getUserById, updateUserRoleService } from "../services/user.service";
import mongoose from "mongoose";

interface IRegistrationBody {
    name?: string;
    email: string;
    password: string;
    avatar?: string;
    role?: string;  
}



export const registrationUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {

    try {
        const { name, email, password, role } = req.body;

        if (!req.body) {
            return next(new ErrorHandler("Request body is missing", 400));
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return next(new ErrorHandler("Invalid email format", 400));
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) return next(new ErrorHandler("User already exists", 400));
        if (process.env.NODE_ENV === 'development') {
            const user = await User.create({ name, email, password , role});
            return res.status(201).json({
                success: true,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });
        }

        // Production flow with activation

        const user: IRegistrationBody = {
            name,
            email,
            password,
            role
        };
        await User.create({
            name,
            email,
            password,
            role: role || 'user' ,
            avatar: {
                public_id: "default",
                url: "https://placeholder.com/avatar.png"
            }
        });

        const activationToken = createActiveToken(user);
        const activationCode = activationToken.activationCode;

        const data = { user: { name: user.name }, activationCode };
        const templatePath = path.join(__dirname, "../mails/activation-mail.ejs");
        const html = await ejs.renderFile(templatePath, data);


        try {
            await sendMail({
                email: user.email,
                subject: "Activate your account",
                template: "activation-mail.ejs",
                data,
            })
            res.status(201).json({
                success: true,
                message: `Please check your email: ${user.email} to activate your account!`,
                activationToken: activationToken.token,
            });

        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }

    } catch (error: any) {
        next(new ErrorHandler(error.message, 400));
    }
});
interface IActivationToken {
    token: string;
    activationCode: string;
}
export const createActiveToken = (user: any): IActivationToken => {
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const token = jwt.sign({
        user, activationCode
    }, process.env.ACTIVATION_SECRET as Secret, {
        expiresIn: "5m",

    });
    return { token, activationCode }
}
interface IActivationRequest {
    activation_token: string;
    activation_code: string;
}

export const activateUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        // 1. Validate request body
        const { activation_token, activation_code } = req.body as IActivationRequest;
        if (!activation_token || !activation_code) {
            return next(new ErrorHandler("Activation token and code are required", 400));
        }

        // 2. Verify JWT token
        let decoded: { user: IUser; activationCode: string };
        try {
            decoded = jwt.verify(
                activation_token,
                process.env.ACTIVATION_SECRET as string
            ) as { user: IUser; activationCode: string };
        } catch (jwtError) {
            return next(new ErrorHandler("Invalid or expired activation token", 401));
        }

        // 3. Validate activation code
        if (decoded.activationCode !== activation_code) {
            return next(new ErrorHandler("Invalid activation code", 400));
        }

        // 4. Extract user data
        const { name, email, password } = decoded.user;

        // 5. Check for existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return next(new ErrorHandler("Email already exists", 409)); // 409 Conflict
        }

        // 6. Create new user (with hashed password - ensure this is done in User model)
        const user = await User.create({
            name,
            email,
            password // Ensure password is hashed in User model pre-save hook
        });

        // 7. Respond with success (consider omitting sensitive data)
        res.status(201).json({
            success: true,
            message: "Account activated successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error: any) {
        // Log the error for debugging
        console.error('Activation error:', error);
        return next(new ErrorHandler(error.message || "Account activation failed", 500));
    }
});


//Login User

interface ILoginRequest {
    email: string;
    password: string;
}
export const loginUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body as ILoginRequest;
        if (!email || !password) {
            return next(new ErrorHandler("Please enter email and password", 400));
        }
        const user = await User.findOne({ email }).select("+password");
        if (!user) {
            return next(new ErrorHandler("Invalid email or password", 400));
        }
        const isPasswordMatch = await user.comparePassword(password);
        if (!isPasswordMatch) {
            return next(new ErrorHandler("Invalid email or password", 400));
        }
        sendToken(user, 200, res);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

export const logoutUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.cookie("access_token", "", { maxAge: 1 });
        res.cookie("refresh_token", "", { maxAge: 1 });
        const userId = (req.user?._id as string | mongoose.Types.ObjectId).toString();

        // await redis.del(userId);
        res.status(200).json({
            success: true,
            message: "Logged out successfully"
        })
    }
    catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});
export const updateAccessToken = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const refresh_token = req.cookies.refresh_token as string;
        const decoded = jwt.verify(refresh_token,
            process.env.REFRESH_TOKEN as string) as JwtPayload;
        const message = 'Could not refresh token';
        if (!decoded) {
            return next(new ErrorHandler(message, 400));
        }
        
        // FIX: Use decoded.id instead of User._id
        const user = await User.findById(decoded.id);
        if (!user) {
            return next(new ErrorHandler("User not found", 404));
        }

        const accessToken = jwt.sign({ id: user._id }, process.env.ACCESS_TOKEN as string, { expiresIn: "15m" });
        const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN as string, { expiresIn: "3d" });

        req.user = user;

        res.cookie("access_token", accessToken, accessTokenOptions);
        res.cookie("refresh_token", refreshToken, refreshTokenOptions);

        next();

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

export const getUserInfo = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req.user?._id as string | mongoose.Types.ObjectId).toString();

        getUserById(userId, res);

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

interface ISocialAuthBody {
    email: string;
    name: string;
    avatar: string;
}
//social Auth
export const socialAuth = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, name, avatar } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            const newUser = await User.create({ email, name, avatar });
            sendToken(newUser, 200, res);
        } else {
            sendToken(user, 200, res);

        }
    }
    catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

export const updateUserInfo = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name } = req.body;
        const userId = (req.user?._id as string | mongoose.Types.ObjectId).toString();

        const user = await User.findById(userId);
        // if (email && user) {
        //     const isEmailExist = await User.findOne({ email });
        //     if (isEmailExist) {
        //         return next(new ErrorHandler("Email already exist", 400));
        //     }
        //     user.email = email;

        // }
        if (name && user) {
            user.name = name;
        }
        await user?.save();
        // await redis.set(userId, JSON.stringify(user));
        res.status(201).json({
            success: true,
            user,
        })

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});
interface IUpdatePassword {
    oldPassword: string;
    newPassword: string;
}
export const updatePassword = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { oldPassword, newPassword } = req.body as IUpdatePassword;
        if (!oldPassword || !newPassword) {
            return next(new ErrorHandler("Please enter old and new password", 400))
        }

        const user = await User.findById(req.user?._id).select("+password");
        if (user?.password === undefined) {
            return next(new ErrorHandler("Invalid user", 400))
        }
        const isPasswordMatch = await user?.comparePassword(oldPassword);
        if (!isPasswordMatch) {
            return next(new ErrorHandler("Invalid old password", 400));
        }
        user.password = newPassword;
        await user.save();
        // await redis.set(req.user?._id as string, JSON.stringify(user));

        res.status(201).json({
            success: true,
            user,
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

//update profile picture
interface IUpdateProfilePicture {
    avatar: string;
}
export const updateProfilePicture = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { avatar } = req.body;
        const userId = req.user?._id?.toString();
        const user = await User.findById(userId);
        if (avatar && user) {
            if (user?.avatar?.public_id) {
                await cloudinary.v2.uploader.destroy(user?.avatar?.public_id);
                const myCloud = await cloudinary.v2.uploader.upload(avatar, {
                    folder: "avatars",
                    width: 150,
                });
                user.avatar = {
                    public_id: myCloud.public_id,
                    url: myCloud.secure_url,
                }
            } else {
                const myCloud = await cloudinary.v2.uploader.upload(avatar, {
                    folder: "avatars",
                    width: 150,
                });
                user.avatar = {
                    public_id: myCloud.public_id,
                    url: myCloud.secure_url,
                }
            }
        }
        await user?.save();
        // await redis.set(userId as string, JSON.stringify(user));

        res.status(200).json({
            success: true,
            user
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

//Get All users

export const getAllUsers = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        getAllUsersService(res);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

// update user role -- only for admin

export const updateUserRole = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, role } = req.body
    
    if (!email) {
      return next(new ErrorHandler("User email is required", 400))
    }

    if (!role) {
      return next(new ErrorHandler("Role is required", 400))
    }

    // Prevent modifying yourself
    if (email === req.user.email) {
      return next(new ErrorHandler("You can't change your own role", 400))
    }
    
    // Validate role
    if (!['admin', 'user'].includes(role)) {
      return next(new ErrorHandler("Invalid role", 400))
    }
    
    // Update user by email
    const user = await User.findOneAndUpdate(
      { email },
      { role },
      { new: true, runValidators: true }
    )
    
    if (!user) {
      return next(new ErrorHandler("User not found", 404))
    }

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    })
  } catch (error: any) {
    next(new ErrorHandler(error.message, 500))
  }
})
//Delete uer --only for admin
export const deleteUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) {
            return next(new ErrorHandler("User not found", 404));
        }
        await user.deleteOne({ id });
        // await redis.del(id);
        res.status(200).json({
            success: true,
            message: "User deleted successfully"
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});