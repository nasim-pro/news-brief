import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INewsArticle extends Document {
    _id: any;
    title: string;
    content: string;
    source: string;
    url: string;
    description?: string;
    publishedAt?: Date | string | null;
    modifiedAt?: Date | string | null;
    category?: string;
    author?: string;
    scrapedAt: Date;
    aiSummary?: string;
    isImportant: boolean;
    isAIProcessed: boolean;
    summarized: boolean;
    aiProcessingError?: string;
    aiProcessingErrorAt?: Date;
}

const newsArticleSchema: Schema<INewsArticle> = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    source: { type: String, default: 'Indian Express', required: true },
    url: { type: String, required: true, unique: true, index: true },
    description: { type: String },
    publishedAt: {},
    modifiedAt: {},
    category: { type: String },
    author: { type: String },
    scrapedAt: { type: Date, default: Date.now },
    aiSummary: { type: String },
    isImportant: { type: Boolean, default: false },
    isAIProcessed: { type: Boolean, default: false },
    summarized: { type: Boolean, default: false },
    aiProcessingError: { type: String },
    aiProcessingErrorAt: { type: Date }
}, { timestamps: true });

const NewsArticle: Model<INewsArticle> = mongoose.models.NewsArticle ?? mongoose.model<INewsArticle>('NewsArticle', newsArticleSchema);

export default NewsArticle;
