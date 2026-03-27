import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const batchSchema = new Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'partial'],
      required: true,
      default: 'pending',
      index: true,
    },
    documents: [{ type: Schema.Types.ObjectId, ref: 'Document', required: true }],
  },
  { timestamps: true },
);

export type BatchDoc = InferSchemaType<typeof batchSchema> & {
  _id: mongoose.Types.ObjectId;
};

export type BatchModel = Model<BatchDoc>;

export const BatchModel: BatchModel =
  mongoose.models.Batch ?? mongoose.model<BatchDoc>('Batch', batchSchema);
