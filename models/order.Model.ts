import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IExportDetails {
  description: string;
  hs_code: string;
  sac_code: string;
  is_export: boolean;
  service_type: string;
}

export interface IPaymentInfo {
  id: string;
  status: string;
  amount: number;
  currency: string;
  payment_method_types?: string[];
  created?: number;
  payment_method?: string;
  updatedAt?: Date;
}

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  payment_info?: IPaymentInfo;
  status: 'pending' | 'completed' | 'cancelled' | 'failed';
  totalAmount: number;
  paymentMethod: string;
  export_details: IExportDetails;
}

const orderSchema = new Schema<IOrder>({
  courseId: {
    type: Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  payment_info: {
    type: {
      id: String,
      status: String,
      amount: Number,
      currency: String,
      payment_method_types: [String],
      created: Number,
      payment_method: String
    },
    required: false
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled', 'failed'],
    default: 'pending'
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['card', 'apple_pay', 'google_pay', 'other'],
    default: 'card'
  },
  export_details: {
    description: String,
    hs_code: { type: String, default: "998316" },
    sac_code: { type: String, default: "998316" },
    is_export: { type: Boolean, default: true },
    service_type: { type: String, default: "online_education" }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

orderSchema.virtual('id').get(function(this: IOrder) {
  return this._id.toHexString();
});

orderSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret._id;
    delete ret.__v;
  }
});

const OrderModel: Model<IOrder> = mongoose.model('Order', orderSchema);

export default OrderModel;