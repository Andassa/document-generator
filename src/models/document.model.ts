import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const documentSchema = new Schema(
  {
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    title: { type: String, required: true, maxlength: 500 },
    content: { type: String, required: true, maxlength: 200_000 },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      required: true,
      default: 'pending',
      index: true,
    },
    gridFsFileId: { type: Schema.Types.ObjectId, required: false },
    errorMessage: { type: String, required: false },
  },
  { timestamps: true },
);

export type DocumentDoc = InferSchemaType<typeof documentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export type DocumentModel = Model<DocumentDoc>;

export const DocumentModel: DocumentModel =
  mongoose.models.Document ?? mongoose.model<DocumentDoc>('Document', documentSchema);
