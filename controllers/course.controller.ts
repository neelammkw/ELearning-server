import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary";
import { getAllCoursesService } from "../services/course.service";
import CourseModel from "../models/course.model";
import { redis } from "../utils/redis";
import mongoose, { Types } from "mongoose";
import ejs from "ejs";
import path from "path";
import { sendMail } from "../utils/sendMail";
import NotificationModel from "../models/notification.Model";
import formidable from 'formidable';
import fs from 'fs';
import UserModel, { IUser } from "../models/user.model";
import { ICourseData , IReview, ICourse, IComment} from "../models/course.model";

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
interface IFormData {
  fields: formidable.Fields;
  files: formidable.Files;
}

// Interface for course data
interface ICourseInput {
  name: string;
  description: string;
  price: number;
  level: string;
  thumbnail?: {
    public_id: string;
    url: string;
  };
  demoUrl?: {
    public_id: string;
    url: string;
  };
  courseData?: ICourseData[];
  [key: string]: any;
}
interface ICommentReply {
  user: Types.ObjectId | IUser;
  reply: string;
  createdAt: Date;
}

interface IReviewReply {
  user: Types.ObjectId | IUser;
  comment: string;
  createdAt: Date;
}

// Helper function to handle formidable parsing
const parseForm = async (req: Request): Promise<IFormData> => {
  return new Promise((resolve, reject) => {
    const form = formidable({
      multiples: true,
      maxFileSize: 500 * 1024 * 1024,
      keepExtensions: true,
      filter: ({ mimetype }) => {
        return !!mimetype && (mimetype.includes('image') || mimetype.includes('video'));
      }
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
      } else {
        resolve({ fields, files });
      }
    });
  });
};

export const uploadCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const form = formidable({
      multiples: true,
      maxFileSize: 500 * 1024 * 1024,
      keepExtensions: true,
      filter: ({ mimetype }) => {
        return !!mimetype && (mimetype.includes('image') || mimetype.includes('video'));
      }
    });

    form.parse(req, async (err, fields, files) => {
      try {
        if (err) {
          console.error('Formidable error:', err);
          return next(new ErrorHandler("Failed to parse form data", 400));
        }

        // Handle courseData field (could be string or array)
        let courseDataStr: string;
        if (Array.isArray(fields.courseData)) {
          courseDataStr = fields.courseData[0];
        } else if (typeof fields.courseData === 'string') {
          courseDataStr = fields.courseData;
        } else {
          console.error('Invalid courseData field type:', typeof fields.courseData);
          return next(new ErrorHandler("Course data is required", 400));
        }

        // Parse course data
        let courseData;
        try {
          courseData = JSON.parse(courseDataStr);
        } catch (parseError) {
          console.error('Failed to parse courseData:', courseDataStr);
          return next(new ErrorHandler("Invalid course data format", 400));
        }

        // Validate required fields
        const requiredFields = ['name', 'description', 'price', 'level'];
        const missingFields = requiredFields.filter(field => !courseData[field]);
        if (missingFields.length > 0) {
          return next(new ErrorHandler(`Missing required fields: ${missingFields.join(', ')}`, 400));
        }

        // Process thumbnail
        if (!files.thumbnail) {
          return next(new ErrorHandler("Thumbnail is required", 400));
        }
        const thumbnail = Array.isArray(files.thumbnail) ? files.thumbnail[0] : files.thumbnail;
        const thumbnailResult = await cloudinary.v2.uploader.upload(thumbnail.filepath, {
          folder: "course-thumbnails",
        });
        courseData.thumbnail = {
          public_id: thumbnailResult.public_id as string,
          url: thumbnailResult.secure_url as string,
        };
        fs.unlinkSync(thumbnail.filepath);

        // Process demo video (if provided)
        if (files.demoUrl) {
          const demoVideo = Array.isArray(files.demoUrl) ? files.demoUrl[0] : files.demoUrl;
          const demoResult = await cloudinary.v2.uploader.upload(demoVideo.filepath, {
            folder: "course-demos",
            resource_type: "video",
          });
          courseData.demoUrl = {
            public_id: demoResult.public_id,
            url: demoResult.secure_url,
          };
          fs.unlinkSync(demoVideo.filepath);
        }

        // Process course videos
        if (courseData.courseData && Array.isArray(courseData.courseData)) {
          for (let i = 0; i < courseData.courseData.length; i++) {
            const fileKey = `video_${i}`;
            if (files[fileKey]) {
              const videoFile = Array.isArray(files[fileKey]) ? files[fileKey][0] : files[fileKey];
              const videoResult = await cloudinary.v2.uploader.upload(videoFile.filepath, {
                folder: "course-videos",
                resource_type: "video",
              });
              courseData.courseData[i].videoUrl = {
                public_id: videoResult.public_id,
                url: videoResult.secure_url,
              };
              fs.unlinkSync(videoFile.filepath);
            }
          }
        }

        // Create course
        const course = await CourseModel.create(courseData);
        // await redis.del('allCourses');

        res.status(201).json({
          success: true,
          course,
        });

      } catch (error: any) {
        // Cleanup any uploaded files
        if (files) {
          Object.values(files).forEach(file => {
            const filesToDelete = Array.isArray(file) ? file : [file];
            filesToDelete.forEach(f => {
              if (f.filepath && fs.existsSync(f.filepath)) {
                fs.unlinkSync(f.filepath);
              }
            });
          });
        }

        console.error('Course creation error:', error);
        return next(new ErrorHandler(error.message, 500));
      }
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return next(new ErrorHandler('Internal server error', 500));
  }
});
export const editCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();

    const form = formidable({
      multiples: true,
      keepExtensions: true,
      filter: ({ mimetype }) => {
        return !!mimetype && (mimetype.includes('image') || mimetype.includes('video'));
      }
    });

    form.parse(req, async (err, fields, files) => {
      try {
        if (err) {
          console.error('Formidable error:', err);
          await session.abortTransaction();
          return next(new ErrorHandler("Failed to parse form data", 400));
        }

        
        // Parse course data
        let courseData;
        try {
          const courseDataStr = Array.isArray(fields.courseData) ? fields.courseData[0] : fields.courseData;
          courseData = JSON.parse(courseDataStr);
        } catch (parseError) {
          console.error('Failed to parse courseData:', parseError);
          await session.abortTransaction();
          return next(new ErrorHandler("Invalid course data format", 400));
        }

        const courseId = req.params.id;
        
        // Find course with session
        const existingCourse = await CourseModel.findById(courseId).session(session);
        if (!existingCourse) {
          console.error('Course not found:', courseId);
          await session.abortTransaction();
          return next(new ErrorHandler("Course not found", 404));
        }

        // Process thumbnail if provided
        if (files.thumbnail) {
          // Delete old thumbnail if exists
          if (existingCourse.thumbnail?.public_id) {
            await cloudinary.v2.uploader.destroy(existingCourse.thumbnail.public_id);
          }

          const thumbnail = Array.isArray(files.thumbnail) ? files.thumbnail[0] : files.thumbnail;
          const thumbnailResult = await cloudinary.v2.uploader.upload(thumbnail.filepath, {
            folder: "course-thumbnails",
          });
          courseData.thumbnail = {
            public_id: thumbnailResult.public_id as string,
            url: thumbnailResult.secure_url as string,
          };
          fs.unlinkSync(thumbnail.filepath);
        } else {
          courseData.thumbnail = existingCourse.thumbnail;
        }

        // Process demo video if provided
        if (files.demoUrl) {
          // Delete old demo video if exists
          if (existingCourse.demoUrl?.public_id) {
            await cloudinary.v2.uploader.destroy(existingCourse.demoUrl.public_id, { resource_type: 'video' });
          }

          const demoVideo = Array.isArray(files.demoUrl) ? files.demoUrl[0] : files.demoUrl;
          const demoResult = await cloudinary.v2.uploader.upload(demoVideo.filepath, {
            folder: "course-demos",
            resource_type: "video",
          });
          courseData.demoUrl = {
            public_id: demoResult.public_id,
            url: demoResult.secure_url,
          };
          fs.unlinkSync(demoVideo.filepath);
        } else {
          courseData.demoUrl = existingCourse.demoUrl;
        }

        // Process course videos
        if (courseData.courseData && Array.isArray(courseData.courseData)) {
          for (let i = 0; i < courseData.courseData.length; i++) {
            const content = courseData.courseData[i];
            const fileKey = `video_${i}`;

            // Find existing content to preserve data
            const existingContent = existingCourse.courseData.find(c => 
              c._id && content._id && c._id.toString() === content._id.toString()
            );

            // Preserve existing content data
            if (existingContent) {
              content.reviews = existingContent.reviews || [];
              content.questions = existingContent.questions || [];
              content.likes = existingContent.likes || [];
              content.dislikes = existingContent.dislikes || [];
            }

            // Process video if provided
            if (files[fileKey]) {
              // Delete old video if exists
              // if (existingContent?.videoUrl?.public_id) {
              //   await cloudinary.v2.uploader.destroy(existingContent.videoUrl.public_id, { resource_type: 'video' });
              // }

              const videoFile = Array.isArray(files[fileKey]) ? files[fileKey][0] : files[fileKey];
              const videoResult = await cloudinary.v2.uploader.upload(videoFile.filepath, {
                folder: "course-videos",
                resource_type: "video",
              });
              content.videoUrl = {
                public_id: videoResult.public_id,
                url: videoResult.secure_url,
              };
              fs.unlinkSync(videoFile.filepath);
            } else if (existingContent?.videoUrl) {
              // Keep existing video if not updated
              content.videoUrl = existingContent.videoUrl;
            }
          }
        }

        const updatedCourse = await CourseModel.findByIdAndUpdate(
          courseId,
          { $set: courseData },
          { 
            new: true,
            session,
            populate: {
              path: 'reviews.user',
              select: 'name avatar role'
            }
          }
        ).lean();

        if (!updatedCourse) {
          console.error('Failed to update course');
          throw new Error('Course update failed');
        }

        await redis.del(courseId);
        await redis.del('allCourses');

        // Commit transaction after all operations succeed
        await session.commitTransaction();

        res.status(200).json({
          success: true,
          course: updatedCourse,
        });

      } catch (error: any) {
        console.error('Error during course update:', {
          error: error.message,
          stack: error.stack,
        });

        // Ensure transaction is aborted on error
        if (session.inTransaction()) {
          await session.abortTransaction();
        }

        // Cleanup any uploaded files
        if (files) {
          Object.values(files).forEach(file => {
            const filesToDelete = Array.isArray(file) ? file : [file];
            filesToDelete.forEach(f => {
              if (f.filepath && fs.existsSync(f.filepath)) {
                fs.unlinkSync(f.filepath);
              }
            });
          });
        }

        return next(new ErrorHandler(error.message, 500));
      } finally {
        session.endSession();
      }
    });
  } catch (error: any) {
    console.error('Unexpected error in editCourse:', {
      error: error.message,
      stack: error.stack,
    });
    
    // Ensure session is properly cleaned up
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    
    return next(new ErrorHandler('Internal server error', 500));
  }
});

export const getSingleCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {

  try {
    const courseId = req.params.id;
    // const isCacheExist = await redis.get(courseId);
    // if (isCacheExist) {
    //   const course = JSON.parse(isCacheExist);
    //   res.status(200).json({
    //     success: true,
    //     course,
    //   });
    // }
    // else {
    const course = await CourseModel.findById(req.params.id);
    // const course = await CourseModel.findById(req.params.id).select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");
    await redis.set(courseId, JSON.stringify(course), 'EX', 604800);

    res.status(200).json({
      success: true,
      course,
    });
    // }
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});
// get all course --- without purchasing

// export const getAllCourses = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     // const isCacheExist = await redis.get("allCourses");

//     // if (!isCacheExist) {
//     const courses = await CourseModel.find()
//       .select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links")
//       .populate({
//         path: 'reviews.user',
//         select: 'name email avatar', // Only include these fields
//         options: { lean: true }
//       });
//     await redis.set("allCourses", JSON.stringify(courses));
//     res.status(200).json({
//       success: true,
//       courses,
//     });
//     // } else {
//     //     res.status(200).json({
//     //         success: true,
//     //         courses: JSON.parse(isCacheExist),
//     //     });
//     // }
//   } catch (error: any) {
//     return next(new ErrorHandler(error.message, 400));
//   }
// });

export const getAllCourses = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Try to get from Redis cache first
    let courses;
    try {
      const cachedCourses = await redis.get("allCourses");
      if (cachedCourses) {
        courses = JSON.parse(cachedCourses);
        console.log('Courses loaded from Redis cache');
      }
    } catch (redisError) {
      console.warn('Redis cache error, falling back to database:', redisError);
      // Continue to database query if Redis fails
    }

    // If not in cache or Redis failed, fetch from database
    if (!courses) {
      courses = await CourseModel.find()
        .select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links")
        .populate({
          path: 'reviews.user',
          select: 'name email avatar',
          options: { lean: true }
        });

      // Try to cache the result, but don't fail if Redis is down
      try {
        await redis.set("allCourses", JSON.stringify(courses), 'EX', 604800); // 7 days expiration
        console.log('Courses cached in Redis');
      } catch (cacheError) {
        console.warn('Failed to cache courses in Redis:', cacheError);
        // Continue without caching - the request should still succeed
      }
    }

    res.status(200).json({
      success: true,
      courses,
    });
  } catch (error: any) {
    console.error('Error in getAllCourses:', error);
    return next(new ErrorHandler(error.message, 400));
  }
});
//get course content -- only for valid user
export const getCourseByUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {

    const userCourseList = req.user?.courses;

    const courseId = req.params.id;

    if (!userCourseList || userCourseList.length === 0) {
      return next(new ErrorHandler("You are not eligible to access this course", 404));
    }

    // Changed to check courseId instead of _id
    const courseExists = userCourseList.find((course: any) => course.courseId.toString() === courseId);

    if (!courseExists) {
      return next(new ErrorHandler("You are not eligible to access this course", 404));
    }

    const course = await CourseModel.findById(courseId);

    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    const content = course.courseData;

    res.status(200).json({
      success: true,
      content,
    });
  } catch (error: any) {
    console.error('Error in getCourseByUser:', error);
    return next(new ErrorHandler(error.message, 400));
  }
});
export const getUserCourses = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.id;
      console.log('[Backend] getUserCourses started for user:', userId);

      // Validate userId
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return next(new ErrorHandler("Invalid user ID", 400));
      }

      const user = await UserModel.findById(userId).populate({
        path: 'courses.courseId',
        select: '-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links'
      });
      
      console.log('[Backend] Found user:', user ? user._id : 'null');
      
      if (!user) {
        console.log('[Backend] User not found');
        return next(new ErrorHandler("User not found", 404));
      }

      const userCourses = user.courses;
      console.log('[Backend] User courses from DB:', userCourses);
      
      if (!userCourses || userCourses.length === 0) {
        console.log('[Backend] No courses found for user');
        return res.status(200).json({
          success: true,
          courses: []
        });
      }

      // Map the courses with progress information
      const coursesWithProgress = userCourses.map((course: any) => {
        return {
          ...course.courseId._doc, // Spread the course document
          progress: course.progress || 0 // Include progress (typo fixed from 'prograss' to 'progress')
        };
      });

      console.log('[Backend] Final courses with progress:', coursesWithProgress);

      res.status(200).json({
        success: true,
        courses: coursesWithProgress
      });
    } catch (error: any) {
      console.error('[Backend] Error in getUserCourses:', error);
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
// add question in course
interface IAddQuestionData {
  question: string;
  courseId: string;
  contentId: string;
}

export const addQuestion = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question, courseId, contentId }: IAddQuestionData = req.body;

    const course = await CourseModel.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return next(new ErrorHandler("Invalid content id", 400));
    }

    const courseContent = course?.courseData?.find((item: any) =>
      item._id.equals(contentId)
    );

    if (!courseContent) {
      return next(new ErrorHandler("Invalid content id", 400));
    }

    const newQuestion: IComment = {
      user: req.user._id,
      question,
      questionReplies: [],
      createdAt: new Date()
    } as IComment;

    if (!courseContent.questions) {
      courseContent.questions = [];
    }
    courseContent.questions.push(newQuestion);

    await NotificationModel.create({
      user: req.user?._id,
      title: "New Question Received",
      message: `You have a new question in ${courseContent.title}`,
    });
    
    await course.save();

    res.status(200).json({
      success: true,
      course,
    });

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});

//add answer in course question 
interface IAddAnswerData {
  answer: string;
  courseId: string;
  contentId: string;
  questionId: string;
}

export const addAnswer = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { answer, courseId, contentId, questionId }: IAddAnswerData = req.body;

    // Validate course exists
    const course = await CourseModel.findById(courseId);

    // Validate content ID format
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return next(new ErrorHandler("Invalid content id", 400));
    }

    // Find the course content section
    const courseContent = course?.courseData?.find((item: any) =>
      item._id.equals(contentId)
    );

    if (!courseContent) {
      return next(new ErrorHandler("Invalid content id", 400));
    }

    const question = courseContent?.questions?.find((item: any) => item._id.equals(questionId));
    if (!question) {
      return next(new ErrorHandler("Invalid question id:", 400));
    }
    // Create new question object
    const newAnswer: any = {
      user: req.user,
      answer,
    };


    question.questionReplies.push(newAnswer);

    // Save the updated course
    await course?.save();
    await NotificationModel.create({
      user: req.user?._id,
      title: "New Question Reply Received",
      message: `You have a new question reply in ${courseContent.title}`
    });
    if (req.user?._id === question.user._id) {
      await NotificationModel.create({
        user: req.user?._id,
        title: "New Question Reply Received",
        message: `You have a new question reply in ${courseContent.title}`
      });

    } else {
      const data = {
        name: question.user.name,
        title: courseContent.title,
      }
      const html = await ejs.renderFile(path.join(__dirname, "../mails/estion-reply.ejs"), data);
      try {
        await sendMail({
          email: question.user.email,
          subject: "Question Reply",
          template: "question-reply.ejs",
          data,
        });

      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }
    }
    res.status(200).json({
      success: true,
      course,
    });

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});
// add review in course 
interface IAddReviewData {
  review: string;
  courseId: string;
  rating: number;
  userId: string;
}
export const addReview = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userCourseList = req.user?.courses;
    const courseId = req.params.id;

    // Check if user purchased the course
    const courseExists = userCourseList?.some(
      (course: any) => course.courseId.toString() === courseId.toString()
    );

    if (!courseExists) {
      return next(new ErrorHandler("You must purchase the course to review", 403));
    }

    const course = await CourseModel.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    const { review, rating } = req.body;

    // Validate review data
    if (!review || !rating) {
      return next(new ErrorHandler("Review and rating are required", 400));
    }
    if (rating < 1 || rating > 5) {
      return next(new ErrorHandler("Rating must be between 1 and 5", 400));
    }

    const reviewData = {
      user: req.user._id,
      rating: Number(rating),
      comment: review,
      commentReplies: [],
      createdAt: new Date(),
    } ;

    // Initialize reviews array if it doesn't exist
    if (!course.reviews) {
      course.reviews = [];
    }

    course.reviews.push(reviewData as IReview);

    // Calculate average rating
    const totalRatings = course.reviews.reduce((sum, item) => sum + item.rating, 0);
    course.ratings = totalRatings / course.reviews.length;

    await course.save();

    // Invalidate cache
    await redis.del(courseId);
    await redis.del('allCourses');

    res.status(200).json({
      success: true,
      course
    });

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});
//add reply in review

interface IAddReviewData {
  comment: string;
  courseId: string;
  reviewId: string;
}
export const addReplyToReview = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { comment, courseId, reviewId } = req.body as IAddReviewData;
    const course = await CourseModel.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }
    const review = course?.reviews?.find((rev: any) => rev._id.toString() === reviewId);
    if (!review) {
      return next(new ErrorHandler("Review not found", 404));
    }
    const replyData: any = {
      user: req.user,
      comment
    };
    // if(!review.commentReplies) {
    //     review.commentReplies = [];
    // }
    review.commentReplies?.push(replyData);
    await course?.save();
    res.status(200).json({
      success: true,
      course,
    });


  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});

//Get All course -- only for admin
export const getAllCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {

    getAllCoursesService(res);
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});
export const getAdminAllCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {

    getAllCoursesService(res);
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});
export const deleteCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const course = await CourseModel.findById(id);
    if (!course) {
      return next(new ErrorHandler("User not found", 404));
    }
    if (course.thumbnail?.public_id) {
      await cloudinary.v2.uploader.destroy(course.thumbnail.public_id);
    }
    await course.deleteOne({ id });
    await redis.del(id.toString())
    res.status(200).json({
      success: true,
      message: "Course deleted successfully"
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});
export const checkCourseEnrollment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?._id;
    const courseId = req.params.id;


    if (!userId) {
      console.error('No user ID found in request')
      return next(new ErrorHandler("User ID missing", 400));
    }

    if (!courseId) {
      console.error('No course ID found in request')
      return next(new ErrorHandler("Course ID missing", 400));
    }

    const user = await UserModel.findById(userId).lean();

    if (!user) {
      console.error('User not found in database')
      return next(new ErrorHandler("User not found", 404));
    }


    // Create a Set to track unique course IDs
    const uniqueCourseIds = new Set();

    // Filter out duplicates and check enrollment
    const isEnrolled = user.courses.some((course: any) => {
      if (!course.courseId) {
        console.warn('Course entry missing courseId:', course)
        return false
      }

      const courseIdStr = course.courseId.toString();
      if (uniqueCourseIds.has(courseIdStr)) {
        return false;
      }
      uniqueCourseIds.add(courseIdStr);

      const isMatch = courseIdStr === courseId;
      return isMatch;
    });


    res.status(200).json({
      success: true,
      isEnrolled,
    });

  } catch (error: any) {
    console.error('Error in enrollment check:', error)
    return next(new ErrorHandler(error.message, 500));
  }
};
export const checkLectureCompletion = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, courseId, lectureId } = req.query;

    if (!userId || !courseId || !lectureId) {
      return next(new ErrorHandler('Missing required fields', 400));
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return next(new ErrorHandler('User not found', 404));
    }

    const course = user.courses.find(
      (c: any) => c.courseId.toString() === courseId
    );

    if (!course) {
      return next(new ErrorHandler('Course not found for this user', 404));
    }

    // const isCompleted = course.completedLectures?.some(
    //   (id: Types.ObjectId) => id.toString() === lectureId
    // );

    res.status(200).json({
      success: true,
      // isCompleted: isCompleted || false
    });

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});
// In your course.controller.ts
// export const markLectureCompleted = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const { userId, courseId, lectureId } = req.body;


//     // Validate input
//     if (!userId || !courseId || !lectureId) {
//       console.error('Missing required fields');
//       return next(new ErrorHandler('Missing required fields', 400));
//     }

//     // Find user and update completed lectures
//     const user = await User.findById(userId).select('+courses +completedLectures');
//     if (!user) {
//       console.error('User not found:', userId);
//       return next(new ErrorHandler('User not found', 404));
//     }


//     // Check if user has purchased the course
//     const courseExists = user.courses.some(
//       (course: any) => course.courseId.toString() === courseId
//     );

//     if (!courseExists) {
//       console.error('Course not found in user purchases:', courseId);
//       return next(new ErrorHandler('User has not purchased this course', 403));
//     }

//     // Initialize completedLectures if undefined
//     if (!user.completedLectures) {
//       user.completedLectures = [];
//     }

//     // Add lecture to completed lectures if not already there
//     if (!user.completedLectures.includes(lectureId)) {
//       user.completedLectures.push(lectureId);
//       await user.save();
//       console.log('Lecture marked as completed:', lectureId);
//     } else {
//       console.log('Lecture already marked as completed');
//     }

//     res.status(200).json({
//       success: true,
//       message: 'Lecture marked as completed'
//     });

//   } catch (error: any) {
//     console.error('Error in markLectureCompleted:', error);
//     return next(new ErrorHandler(error.message, 500));
//   }
// });
// Like a video
export const likeVideo = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId, contentId } = req.params;
    const userId = req.user?.id;
    // const userId = new mongoose.Types.ObjectId(req.user?._id);


    // Find the course
    const course = await CourseModel.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    // Find the content item (which contains the video)
    const contentItem = course.courseData.find(item =>
      item._id.toString() === contentId
    );

    if (!contentItem) {
      return next(new ErrorHandler("Content not found", 404));
    }

    // Initialize likes/dislikes if undefined
    if (!contentItem.likes) {
      contentItem.likes = [];
    }
    if (!contentItem.dislikes) {
      contentItem.dislikes = [];
    }

    // Check if user already liked
    const alreadyLiked = contentItem.likes.includes(userId);
    const alreadyDisliked = contentItem.dislikes.includes(userId);

    if (alreadyLiked) {
      // Remove like
      contentItem.likes = contentItem.likes.filter(id => id.toString() !== userId.toString());
    } else {
      // Add like and remove dislike if exists
      contentItem.likes.push(userId);
      if (alreadyDisliked) {
        contentItem.dislikes = contentItem.dislikes.filter(id => id.toString() !== userId.toString());
      }
    }

    // Mark as modified and save
    course.markModified("courseData");
    await course.save();

    res.status(200).json({
      success: true,
      message: alreadyLiked ? "Like removed" : "Content liked",
      likes: contentItem.likes.length,
      dislikes: contentItem.dislikes.length,
      isLiked: !alreadyLiked,
      isDisliked: false
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message || "Internal Server Error", 500));
  }
});
export const dislikeVideo = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId, contentId } = req.params;
    const userId = req.user?.id;

    // Find the course
    const course = await CourseModel.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    // Find the content item
    const contentItem = course.courseData.find(item =>
      item._id.toString() === contentId
    );

    if (!contentItem) {
      return next(new ErrorHandler("Content not found", 404));
    }

    // Initialize dislikes/likes if undefined
    if (!contentItem.dislikes) {
      contentItem.dislikes = [];
    }
    if (!contentItem.likes) {
      contentItem.likes = [];
    }

    // Check if user already disliked
    const alreadyDisliked = contentItem.dislikes.includes(userId);
    const alreadyLiked = contentItem.likes.includes(userId);

    if (alreadyDisliked) {
      // Remove dislike
      contentItem.dislikes = contentItem.dislikes.filter(id => id.toString() !== userId.toString());
    } else {
      // Add dislike and remove like if exists
      contentItem.dislikes.push(userId);
      if (alreadyLiked) {
        contentItem.likes = contentItem.likes.filter(id => id.toString() !== userId.toString());
      }
    }

    // Mark as modified and save
    course.markModified("courseData");
    await course.save();

    res.status(200).json({
      success: true,
      message: alreadyDisliked ? "Dislike removed" : "Content disliked",
      likes: contentItem.likes.length,
      dislikes: contentItem.dislikes.length,
      isLiked: false,
      isDisliked: !alreadyDisliked
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message || "Internal Server Error", 500));
  }
});
// Add video review

export const addVideoReview = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { courseId, contentId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user?._id;

    // Validate input
    if (!rating || !comment) {
      return next(new ErrorHandler("Rating and comment are required", 400));
    }

    if (rating < 1 || rating > 5) {
      return next(new ErrorHandler("Rating must be between 1 and 5", 400));
    }

    if (comment.trim().length < 10) {
      return next(new ErrorHandler("Comment must be at least 10 characters", 400));
    }

    // Find the course with session
    const course = await CourseModel.findById(courseId).session(session);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    // Find the content item
    const contentIndex = course.courseData.findIndex(item =>
      item._id.toString() === contentId
    );

    if (contentIndex === -1) {
      return next(new ErrorHandler("Content not found", 404));
    }

    // Initialize reviews array if undefined
    if (!course.courseData[contentIndex].reviews) {
      course.courseData[contentIndex].reviews = [];
    }

    // Check for existing review
    const existingReviewIndex = course.courseData[contentIndex].reviews.findIndex(r =>
      r.user && r.user._id.toString() === userId.toString()
    );

    const reviewData = {
      user: req.user,
      rating: Number(rating),
      comment: comment.trim(),
      createdAt: new Date(),
      commentReplies: []
    };

    // Update or add review
    if (existingReviewIndex >= 0) {
      course.courseData[contentIndex].reviews[existingReviewIndex] = reviewData as IReview;
    } else {
      course.courseData[contentIndex].reviews.push(reviewData as IReview);
    }

    // Calculate video average rating
    const videoReviews = course.courseData[contentIndex].reviews;
    const videoTotalRating = videoReviews.reduce((sum, r) => sum + r.rating, 0);
    const videoReviewCount = videoReviews.length;
    // course.courseData[contentIndex].averageRating =
      // videoReviewCount > 0 ? Number((videoTotalRating / videoReviewCount).toFixed(1)) : 0;

    // Calculate overall course rating
    const allRatings = course.courseData.flatMap(item =>
      item.reviews?.map(review => review.rating) || []
    );
    const courseTotalRating = allRatings.reduce((sum, rating) => sum + rating, 0);
    course.ratings = allRatings.length > 0
      ? Number((courseTotalRating / allRatings.length).toFixed(1))
      : 0;

    // Save with transaction
    await course.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: existingReviewIndex >= 0 ? "Review updated" : "Review added",
      review: reviewData,
      courseRating: course.ratings
    });

  } catch (error: any) {
    await session.abortTransaction();
    console.error("ERROR in addVideoReview:", error);
    return next(new ErrorHandler(error.message || "Internal Server Error", 500));
  } finally {
    session.endSession();
  }
});
export const replyToReview = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId, contentId, reviewId } = req.params;
    const { reply } = req.body;
    const userId = req.user?._id;


    if (!reply) {
      return next(new ErrorHandler("Reply message is required", 400));
    }

    const course = await CourseModel.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    // Find the content item
    const contentIndex = course.courseData.findIndex(item =>
      item._id.toString() === contentId
    );

    if (contentIndex === -1) {
      return next(new ErrorHandler("Content not found", 404));
    }

    // Find the review
    const reviewIndex = course.courseData[contentIndex].reviews.findIndex(
      (r: any) => r._id.toString() === reviewId
    );

    if (reviewIndex === -1) {
      return next(new ErrorHandler("Review not found", 404));
    }

    // Initialize commentReplies if undefined
    if (!course.courseData[contentIndex].reviews[reviewIndex].commentReplies) {
      course.courseData[contentIndex].reviews[reviewIndex].commentReplies = [];
    }

    // Add the reply
    const replyData =  {
      user: req.user._id,
      reply: reply.trim(),
      createdAt: new Date()
    };

    (course.courseData[contentIndex].reviews[reviewIndex].commentReplies as any[]).push(replyData);

    // Mark as modified and save
    course.markModified("courseData");
    await course.save();

    res.status(200).json({
      success: true,
      message: "Reply added successfully",
      reply: replyData
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message || "Internal Server Error", 500));
  }
});


export const addVideoQuestion = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId, contentId } = req.params;
    const { question } = req.body;
    const userId = req.user?._id;


    if (!question) {
      console.error('Question is required');
      return next(new ErrorHandler("Question is required", 400));
    }

    const course = await CourseModel.findById(courseId);
    if (!course) {
      console.error('Course not found:', courseId);
      return next(new ErrorHandler("Course not found", 404));
    }

    // Find the content item
    const contentIndex = course.courseData.findIndex(item =>
      item._id.toString() === contentId
    );

    if (contentIndex === -1) {
      console.error('Content not found:', contentId);
      return next(new ErrorHandler("Content not found", 404));
    }

    // Initialize questions array if undefined
    if (!course.courseData[contentIndex].questions) {
      course.courseData[contentIndex].questions = [];
    }

    // Add the question
    const questionData = {
      user: req.user,
      question: question.trim(),
      questionReplies: [],
      createdAt: new Date()
    };

    course.courseData[contentIndex].questions.push(questionData as IComment);

    // Mark as modified and save
    course.markModified("courseData");
    await course.save();


    // Create notification for admin/instructor
    await NotificationModel.create({
      user: userId, // Or send to course instructor
      title: "New Question Added",
      message: `A new question was asked in "${course.courseData[contentIndex].title}"`,
    });

    res.status(201).json({
      success: true,
      message: "Question added successfully",
      question: questionData
    });
  } catch (error: any) {
    console.error('Error in addVideoQuestion:', error);
    return next(new ErrorHandler(error.message || "Internal Server Error", 500));
  }
});
export const replyToQuestion = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId, contentId, questionId } = req.params;
    const { reply } = req.body;
    const userId = req.user?._id;

    if (!reply) {
      return next(new ErrorHandler("Reply message is required", 400));
    }

    const course = await CourseModel.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    const contentIndex = course.courseData.findIndex(item =>
      item._id.toString() === contentId
    );

    if (contentIndex === -1) {
      return next(new ErrorHandler("Content not found", 404));
    }

    const questionIndex = course.courseData[contentIndex].questions.findIndex(
      (q: any) => q._id.toString() === questionId
    );

    if (questionIndex === -1) {
      return next(new ErrorHandler("Question not found", 404));
    }

    if (!course.courseData[contentIndex].questions[questionIndex].questionReplies) {
      course.courseData[contentIndex].questions[questionIndex].questionReplies = [];
    }

    const replyData = {
      user: req.user.id,
      reply: reply.trim(),
      createdAt: new Date()
    };

    (course.courseData[contentIndex].questions[questionIndex].questionReplies as any[]).push(replyData);
    course.markModified("courseData");
    await course.save();

    // Notification logic here...

    res.status(200).json({
      success: true,
      message: "Reply added successfully",
      reply: replyData
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message || "Internal Server Error", 500));
  }
});
export const addCourseReview = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { courseId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user?._id;


    // Validate input
    if (!rating || !comment) {
      return next(new ErrorHandler("Rating and comment are required", 400));
    }

    if (rating < 1 || rating > 5) {
      return next(new ErrorHandler("Rating must be between 1 and 5", 400));
    }

    if (comment.trim().length < 10) {
      return next(new ErrorHandler("Comment must be at least 10 characters", 400));
    }

    // Find the course with session
    const course = await CourseModel.findById(courseId).session(session);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    // Initialize reviews array if undefined
    if (!course.reviews) {
      course.reviews = [];
    }

    // Create new review (don't check for existing reviews)
    const reviewData = {
      user: req.user,
      rating: Number(rating),
      comment: comment.trim(),
      createdAt: new Date(),
      commentReplies: []
    };

    course.reviews.push(reviewData as IReview);

    // Calculate course average rating
    const courseTotalRating = course.reviews.reduce((sum, r) => sum + r.rating, 0);
    const courseReviewCount = course.reviews.length;
    course.ratings = courseReviewCount > 0
      ? Number((courseTotalRating / courseReviewCount).toFixed(1))
      : 0;


    // Save with transaction
    await course.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Review added successfully",
      review: reviewData,
      courseRating: course.ratings
    });

  } catch (error: any) {
    console.error('Error in addCourseReview:', {
      error: error.message,
      stack: error.stack,
      fullError: JSON.stringify(error, null, 2)
    });
    await session.abortTransaction();
    return next(new ErrorHandler(error.message || "Internal Server Error", 500));
  } finally {
    session.endSession();
  }
});

// Reply to course review
export const replyToCourseReview = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId, reviewId } = req.params;
    const { reply } = req.body;

    if (!reply) {
      return next(new ErrorHandler("Reply message is required", 400));
    }

    const course = await CourseModel.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    const reviewIndex = course.reviews.findIndex(
      (r: any) => r._id.toString() === reviewId
    );

    if (reviewIndex === -1) {
      return next(new ErrorHandler("Review not found", 404));
    }

    if (!course.reviews[reviewIndex].commentReplies) {
      course.reviews[reviewIndex].commentReplies = [];
    }

    const replyData = {
      user: req.user.id,
      comment: reply.trim(),
      createdAt: new Date()
    };

    (course.reviews[reviewIndex].commentReplies as any[]).push(replyData);
    course.markModified("reviews");
    await course.save();

    res.status(200).json({
      success: true,
      message: "Reply added successfully",
      reply: replyData
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message || "Internal Server Error", 500));
  }
});

// Get course reviews
export const getCourseReviews = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { courseId } = req.params;

    const course = await CourseModel.findById(courseId)
      .select("reviews ratings")
      .populate("reviews.user", "name avatar role")
      .populate("reviews.commentReplies.user", "name avatar role");

    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }


    res.status(200).json({
      success: true,
      reviews: course.reviews || [],
      ratings: course.ratings || 0
    });
  } catch (error: any) {
    console.error('Error in getCourseReviews:', {
      error: error.message,
      stack: error.stack,
      fullError: JSON.stringify(error, null, 2)
    });
    return next(new ErrorHandler(error.message || "Internal Server Error", 500));
  }
});
//forAdminGetFullCourse
export const getFullCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courseId = req.params.id;

    // Validate course ID format
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return next(new ErrorHandler("Invalid course ID format", 400));
    }

    // Find the course with all details
    const course = await CourseModel.findById(courseId)
      .populate({
        path: 'reviews.user',
        select: 'name avatar role'
      })
      .populate({
        path: 'courseData.questions.user',
        select: 'name avatar role'
      })
      .populate({
        path: 'courseData.questions.questionReplies.user',
        select: 'name avatar role'
      })
      .populate({
        path: 'courseData.reviews.user',
        select: 'name avatar role'
      })
      .populate({
        path: 'courseData.reviews.commentReplies.user',
        select: 'name avatar role'
      });

    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    // Cache the full course data
    await redis.set(`fullCourse:${courseId}`, JSON.stringify(course), 'EX', 604800); // 7 days expiration

    res.status(200).json({
      success: true,
      course
    });

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});