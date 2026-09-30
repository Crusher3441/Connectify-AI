import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true },      
    meetingCode: { type: String, required: true, index: true },
    meetingOwner: { type: String, required: true }, 
    date: { type: Date, default: Date.now },        // reads this as the host registry key
  },
  { timestamps: true }
);

export default mongoose.model('Meeting', meetingSchema);
