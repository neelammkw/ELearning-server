import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { IUser } from "./user.model";

export interface IComment extends Document {
  user: IUser;
  question: string;
  questionReplies: IComment[];
  createdAt: Date;
  _id: Types.ObjectId;
}

export interface IReview extends Document {
  user: IUser;
  rating: number;
  comment: string;
  commentReplies: IComment[];
  createdAt: Date;
  _id: Types.ObjectId;
}

export interface ILink extends Document {
  title: string;
  url: string;
  _id: Types.ObjectId;

}

export interface ICourseData extends Document {
  title: string;
  description: string;
  videoUrl: string;
  videoThumbnail: object;
  videoSection: string;
  videoLength: number;
  videoPlayer: string;
  links: ILink[];
  suggestion: string;
  questions: IComment[];
  likes: Types.ObjectId[]; 
  dislikes: Types.ObjectId[];
  reviews: IReview[];
}

export interface ICourse extends Document {
  name: string;
  description: string;
  categories: string;
  price: number;
  estimatedPrice?: number;
  thumbnail: {
    public_id: string;
    url: string;
  };
  tags: string;
  level: string;
  demoUrl: {
    public_id: string;
    url: string;
  };

  benefits: { title: string }[];
  prerequisites: { title: string }[];
   reviews: IReview[];
  courseData: ICourseData[];
  ratings?: number;
  purchased?: number;
}

const reviewSchema = new Schema<IReview>({
  user: Object,
  rating: {
    type: Number,
    default: 0,
  },
  comment: String,
  commentReplies: [Object],
  createdAt: { type: Date, default: Date.now }

});

const linkSchema = new Schema<ILink>({
  title: String,
  url: String,
});

const commentSchema = new Schema<IComment>({
  user: Object,
  question: String,
  questionReplies: [Object],
  createdAt: { type: Date, default: Date.now }

});

const courseDataSchema = new Schema<ICourseData>({
  videoUrl: {
    public_id: { type: String },
    url: { type: String }
  },
  videoThumbnail: {
    public_id: String,
    url: String,
  },

  title: String,
  videoSection: String,
  description: String,
  videoLength: Number,
  videoPlayer: String,
  links: [linkSchema],
  suggestion: String,
  questions: [commentSchema],
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  dislikes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
reviews: [reviewSchema], 
});

const courseSchema = new Schema<ICourse>({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  categories: {
    type: String,
    // required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  estimatedPrice: {
    type: Number,
  },
  thumbnail: {
    public_id: String,
    url: String,
  },
  tags: {
    type: String,
    required: true,
  },
  level: {
    type: String,
    required: true,
  },
  demoUrl: {
    public_id: String,
    url: String,
  },
  benefits: [{ title: String }],
  prerequisites: [{ title: String }],
   reviews: [reviewSchema],
  courseData: [courseDataSchema],
  ratings: {
    type: Number,
    default: 0,
  },
  purchased: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

const CourseModel: Model<ICourse> = mongoose.model("Course", courseSchema);

export default CourseModel;