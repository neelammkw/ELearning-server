import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import cloudinary from "cloudinary";
import LayoutModel, {BannerImageInput, BannerInput} from "../models/layout.model";

// Create layout
export const createLayout = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, faq, categories, banner } = req.body;
    
    const isTypeExist = await LayoutModel.findOne({ type });
    if (isTypeExist) {
      return next(new ErrorHandler(`${type} already exists`, 400));
    }

    if (type === "Banner") {
      if (!banner?.image || !banner?.title || !banner?.subTitle) {
        return next(new ErrorHandler("Please provide all banner fields", 400));
      }

      const myCloud = await cloudinary.v2.uploader.upload(banner.image, {
        folder: "layout",
      });

      const layout = await LayoutModel.create({
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
        return next(new ErrorHandler("Please add FAQ items", 400));
      }

      const layout = await LayoutModel.create({
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
        return next(new ErrorHandler("Please add categories", 400));
      }

      const layout = await LayoutModel.create({
        type: "Categories",
        categories,
      });

      return res.status(201).json({
        success: true,
        layout,
      });
    }

    return next(new ErrorHandler("Invalid layout type", 400));

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Edit layout
export const editLayout = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, faq, categories, banner } = req.body;

    const layout = await LayoutModel.findOne({ type });
    if (!layout) {
      return next(new ErrorHandler(`${type} not found`, 404));
    }

    if (type === "Banner") {
      if (banner.image && banner.image.startsWith('data:image')) {
        // Delete old image if exists
        if (layout.banner?.image?.public_id) {
          await cloudinary.v2.uploader.destroy(layout.banner.image.public_id);
        }

        const myCloud = await cloudinary.v2.uploader.upload(banner.image, {
          folder: "layout",
        });

        const bannerData: BannerInput = {
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


      } else {
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
        return next(new ErrorHandler("Please add FAQ items", 400));
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
        return next(new ErrorHandler("Please add categories", 400));
      }

      layout.categories = categories;
      await layout.save();
      return res.status(200).json({
        success: true,
        layout,
      });
    }

    return next(new ErrorHandler("Invalid layout type", 400));

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get layout by type
export const getLayoutByType = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.params;
    const layout = await LayoutModel.findOne({ type });
    res.status(200).json({
      success: true,
      layout,
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});