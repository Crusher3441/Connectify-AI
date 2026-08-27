import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
        type: String, required: true, trim: true
    },
    username: {
        type: String,
        required: true,
        unique: true, // creates the unique index — duplicates throw error code 11000
        lowercase: true, // stored normalized; every lookup lowercases too
        trim: true,
    },
    password: {  //bcrypt hash password
        type: String,
        required: true
     },
    token: { type: String, default: null, index: true }, //session token
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
