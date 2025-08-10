// routes/upload.ts
import express from "express";
import multer from "multer";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import cloudinary from "cloudinary";
import ErrorHandler from "../utils/ErrorHandler";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post(
  "/upload",
  upload.single("file"),
  CatchAsyncError(async (req, res, next) => {
    if (!req.file) return next(new ErrorHandler("No file provided", 400));

    const result = await cloudinary.v2.uploader.upload_stream(
      {
        folder: "courses",
        resource_type: req.file.mimetype.startsWith("video") ? "video" : "image",
      },
      (error, result) => {
        if (error) return next(new ErrorHandler(error.message, 400));
        res.status(200).json({
          public_id: result?.public_id,
          url: result?.secure_url,
        });
      }
    );

    // Pipe the buffer to Cloudinary
    const stream = result;
    stream.end(req.file.buffer);
  })
);

export default router;
