"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLayoutByType = exports.editLayout = exports.createLayout = void 0;
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const cloudinary_1 = __importDefault(require("cloudinary"));
const layout_model_1 = __importDefault(require("../models/layout.model"));
// Create layout
exports.createLayout = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { type, faq, categories, banner } = req.body;
        const isTypeExist = await layout_model_1.default.findOne({ type });
        if (isTypeExist) {
            return next(new ErrorHandler_1.default(`${type} already exists`, 400));
        }
        if (type === "Banner") {
            if (!banner?.image || !banner?.title || !banner?.subTitle) {
                return next(new ErrorHandler_1.default("Please provide all banner fields", 400));
            }
            const myCloud = await cloudinary_1.default.v2.uploader.upload(banner.image, {
                folder: "layout",
            });
            const layout = await layout_model_1.default.create({
                type: "Banner",
                banner: {
                    image: {
                        public_id: myCloud.public_id,
                        url: myCloud.secure_url,
                    },
                    title: banner.title,
                    subTitle: banner.subTitle,
                    description: banner.description,
                },
            });
            return res.status(201).json({
                success: true,
                layout,
            });
        }
        if (type === "FAQ") {
            if (!faq || faq.length === 0) {
                return next(new ErrorHandler_1.default("Please add FAQ items", 400));
            }
            const layout = await layout_model_1.default.create({
                type: "FAQ",
                faq,
            });
            return res.status(201).json({
                success: true,
                layout,
            });
        }
        if (type === "Categories") {
            if (!categories || categories.length === 0) {
                return next(new ErrorHandler_1.default("Please add categories", 400));
            }
            const layout = await layout_model_1.default.create({
                type: "Categories",
                categories,
            });
            return res.status(201).json({
                success: true,
                layout,
            });
        }
        return next(new ErrorHandler_1.default("Invalid layout type", 400));
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Edit layout
exports.editLayout = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { type, faq, categories, banner } = req.body;
        const layout = await layout_model_1.default.findOne({ type });
        if (!layout) {
            return next(new ErrorHandler_1.default(`${type} not found`, 404));
        }
        if (type === "Banner") {
            if (banner.image && banner.image.startsWith('data:image')) {
                // Delete old image if exists
                if (layout.banner?.image?.public_id) {
                    await cloudinary_1.default.v2.uploader.destroy(layout.banner.image.public_id);
                }
                const myCloud = await cloudinary_1.default.v2.uploader.upload(banner.image, {
                    folder: "layout",
                });
                const bannerData = {
                    image: {
                        public_id: myCloud.public_id,
                        url: myCloud.secure_url,
                    },
                    title: banner.title,
                    subTitle: banner.subTitle,
                    description: banner.description,
                };
                // layout.banner = {
                //     ...layout.banner,
                //     ...bannerData
                // };
            }
            else {
                layout.banner = {
                    ...layout.banner,
                    title: banner.title,
                    subTitle: banner.subTitle,
                    description: banner.description,
                };
            }
            await layout.save();
            return res.status(200).json({
                success: true,
                layout,
            });
        }
        if (type === "FAQ") {
            if (!faq || faq.length === 0) {
                return next(new ErrorHandler_1.default("Please add FAQ items", 400));
            }
            layout.faq = faq;
            await layout.save();
            return res.status(200).json({
                success: true,
                layout,
            });
        }
        if (type === "Categories") {
            if (!categories || categories.length === 0) {
                return next(new ErrorHandler_1.default("Please add categories", 400));
            }
            layout.categories = categories;
            await layout.save();
            return res.status(200).json({
                success: true,
                layout,
            });
        }
        return next(new ErrorHandler_1.default("Invalid layout type", 400));
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// Get layout by type
exports.getLayoutByType = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { type } = req.params;
        const layout = await layout_model_1.default.findOne({ type });
        res.status(200).json({
            success: true,
            layout,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
