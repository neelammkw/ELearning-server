"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/upload.ts
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const cloudinary_1 = __importDefault(require("cloudinary"));
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const router = express_1.default.Router();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({ storage });
router.post("/upload", upload.single("file"), (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    if (!req.file)
        return next(new ErrorHandler_1.default("No file provided", 400));
    const result = await cloudinary_1.default.v2.uploader.upload_stream({
        folder: "courses",
        resource_type: req.file.mimetype.startsWith("video") ? "video" : "image",
    }, (error, result) => {
        if (error)
            return next(new ErrorHandler_1.default(error.message, 400));
        res.status(200).json({
            public_id: result?.public_id,
            url: result?.secure_url,
        });
    });
    // Pipe the buffer to Cloudinary
    const stream = result;
    stream.end(req.file.buffer);
}));
exports.default = router;
