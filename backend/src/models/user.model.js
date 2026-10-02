import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true, // creates the unique index — duplicates throw error code 11000
      lowercase: true, // stored normalized; every lookup lowercases too
      trim: true,
    },
    password: {
      //bcrypt hash password
      type: String,
      required: true,
    },
    token: {
      //session token
      type: String,
      default: null,
      index: true, // It makes reads faster ( User.findOne({token})) but makes writes lil slower and use extra storage
    },
    tokenExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
