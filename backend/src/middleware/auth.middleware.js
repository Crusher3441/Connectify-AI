import User from "../models/user.model.js";

// THE single token gate. Every protected route
// mounts this; identity flows to handlers via req.user — never from
// req.body, req.query, or req.params, no matter what the client sends.
export const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null; // by default In HTTP authentication, the header typically looks like this: Authorization: Bearer abc123xyz Bearer is whoever who has this token

  if (!token) {
    return res.status(401).json({ message: "Authorization required" });
  }

  const user = await User.findOne({ token }).select("-password"); // search user by token in db ( to search do i have already registered user with this token? ), return everything except password
  if (!user) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  if (!user.tokenExpiresAt || user.tokenExpiresAt <= new Date()) {
    user.token = null;
    user.tokenExpiresAt = null;
    await user.save();

    return res.status(401).json({ message: "Session expired" });
  }

  req.user = user; //Attach user to request Now every route after this middleware can access the logged-in user.
  return next();
};
