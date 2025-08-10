import { Schema, model, Document } from "mongoose";

interface FaqItem extends Document {
    question: string;
    answer: string;
}
interface Category extends Document {
    title: string;
}
export interface BannerImageInput {
    public_id: string;
    url: string;
}

export interface BannerImage extends BannerImageInput, Document {}

export interface Layout extends Document {
    type: string;
    faq: FaqItem[];
    categories: Category[];
    banner: {
        image: BannerImage;
        title: string;
        subTitle: string;
        description: string;
    };
}
const faqSchema = new Schema<FaqItem>({
    question: { type: String },
    answer: { type: String }
});
const categorySchema = new Schema<Category>({
    title: { type: String },

});
const bannerImageSchema = new Schema<BannerImage>({
    public_id: { type: String },
    url: { type: String },
});
export interface BannerImageInput {
  public_id: string;
  url: string;
}
export interface BannerInput {
    image: BannerImageInput;
    title: string;
    subTitle: string;
    description: string;
}

const layoutSchema = new Schema<Layout>({
    type: { type: String },
    faq: [faqSchema],
    categories: [categorySchema],
    banner: {
        image: bannerImageSchema,
        title: { type: String },
        subTitle: { type: String },
        description: { type: String }
    }
    });
const LayoutModel = model<Layout>('Layout', layoutSchema);
export default LayoutModel;