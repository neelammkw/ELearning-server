import express from "express";
import {
  addAnswer, addQuestion, addReplyToReview, addReview, checkCourseEnrollment, deleteCourse, editCourse, getUserCourses, getAdminAllCourse, getAllCourses, getCourseByUser, getSingleCourse, uploadCourse, addVideoReview, dislikeVideo, likeVideo, replyToReview, replyToQuestion, addVideoQuestion, checkLectureCompletion, addCourseReview, getFullCourse,
  replyToCourseReview,
  getCourseReviews
} from "../controllers/course.controller";
import { authorizationRoles, isAuthenticated } from "../middleware/auth";
import { updateAccessToken } from "../controllers/user.controller";

const courseRouter = express.Router();
courseRouter.post("/create-course",
  updateAccessToken, isAuthenticated, authorizationRoles("admin"),
  uploadCourse);
courseRouter.put("/edit-course/:id", updateAccessToken, isAuthenticated, authorizationRoles("admin"),
  editCourse);
courseRouter.get("/get-course/:id", getSingleCourse);
courseRouter.get("/get-admin-courses", isAuthenticated, authorizationRoles("admin"), getAdminAllCourse);
courseRouter.get("/get-courses", getAllCourses);
courseRouter.get("/get-course-content/:id", updateAccessToken, isAuthenticated, getCourseByUser);
courseRouter.put("/add-question", updateAccessToken, isAuthenticated, addQuestion);
courseRouter.put("/add-answer", updateAccessToken, isAuthenticated, addAnswer);
courseRouter.put("/add-review/:id", updateAccessToken, addReview);
courseRouter.put("/add-reply", updateAccessToken, isAuthenticated, authorizationRoles("admin"), addReplyToReview);
courseRouter.get("/get-courses", isAuthenticated, authorizationRoles("admin"), getAllCourses);
courseRouter.get("/get-full-course/:id", isAuthenticated, authorizationRoles("admin"), getFullCourse);
courseRouter.get("/user/courses", isAuthenticated, getUserCourses);

courseRouter.get("/user-courses/:id", updateAccessToken, isAuthenticated, checkCourseEnrollment);
courseRouter.delete("/delete-course/:id", updateAccessToken, isAuthenticated, authorizationRoles("admin"), deleteCourse);
courseRouter.post(
  '/add-video-review/:courseId/:contentId/:videoId', updateAccessToken,
  isAuthenticated,
  addVideoReview
);
courseRouter.post(
  '/like-video/:courseId/:contentId', updateAccessToken,
  isAuthenticated,
  likeVideo
);

courseRouter.post(
  '/dislike-video/:courseId/:contentId', updateAccessToken,
  isAuthenticated,
  dislikeVideo
);

courseRouter.put(
  '/reply-review/:courseId/:contentId/:reviewId', updateAccessToken,
  isAuthenticated,
  replyToReview
);
courseRouter.put(
  "/reply-question/:courseId/:contentId/:questionId", updateAccessToken,
  isAuthenticated,
  replyToQuestion
);

// Add a new question to a video
courseRouter.post(
  "/add-question/:courseId/:contentId", updateAccessToken,
  isAuthenticated,
  addVideoQuestion
);
courseRouter.get('/check-lecture-completion', isAuthenticated, checkLectureCompletion);
courseRouter.post('/courses/:courseId/reviews', isAuthenticated, addCourseReview);
courseRouter.put('/courses/:courseId/reviews/:reviewId/reply', isAuthenticated, replyToCourseReview);
courseRouter.get('/courses/:courseId/reviews', getCourseReviews);

export default courseRouter;
