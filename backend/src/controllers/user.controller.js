import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import User from '../models/user.model.js';
import Meeting from '../models/meeting.model.js';
import { recordMeeting } from './meeting.controller.js';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export const registerUser = async (req, res) => {
  try {
    const { name, username, password } = req.body || {};

    // Server-side validation (R5 / audit #9): the client's checks are UX
    // sugar — THIS is the gate. Every rule below has a specific message so
    // the user can fix the exact problem.
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ message: 'Name must be at least 2 characters' });
    }
    if (!username || !USERNAME_RE.test(String(username))) {
      return res.status(400).json({ message: 'Username must be 3–20 letters, numbers or underscores' });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const cleanName = String(name).trim().slice(0, 60);
    const cleanUsername = String(username).trim().toLowerCase();

    // Hash with 10 rounds — the roadmap's stated cost. ~100ms/hash:
    // instant for a real user, expensive for someone hammering the endpoint.
    const hashed = await bcrypt.hash(String(password), 10);

    const user = await User.create({
      name: cleanName,
      username: cleanUsername,
      password: hashed,
    });

    // Respond with identity, never the hash, never a token (login issues tokens).
    return res.status(201).json({
      id: user._id,
      name: user.name,
      username: user.username,
    });
  } catch (err) {
    // Duplicate username → the unique index fired (2A). That's a 409, not a crash.
    if (err.code === 11000) {
      return res.status(409).json({ message: 'That username is already taken' });
    }
    // R2: log the FAILURE, never the request body (which contains a password).
    console.error('register failed:', err.message);
    return res.status(500).json({ message: 'Registration failed' });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ username: String(username).trim().toLowerCase() });

   
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(String(password), user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    // Opaque session token: 64 hex chars of cryptographic randomness, stored
    // ON the user document. Roadmap decision: DB token, not JWT — revocation
    // is trivial (overwrite/null the field) and there's no signature to
    // misconfigure. Re-login ROTATES the token → the previous session dies.
    
    user.token = crypto.randomBytes(32).toString('hex');
     // Token valid for 1 day
    user.tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    return res.json({
      token: user.token,
      user: { name: user.name, username: user.username },
    });
  } catch (err) {
    console.error('login failed:', err.message);
    return res.status(500).json({ message: 'Login failed' });
  }
};

export const getUserHistory = async (req, res) => {
  // Identity from req.user ONLY (2D). A username in the query string is
  // ignored — that's the audit #4 IDOR fix in its most compact form.
  const items = await Meeting.find({ user_id: req.user.username })
    .sort({ date: -1 })
    .limit(50)
    .lean();
  return res.json({ items, count: items.length });
};

export const addMeetingToHistory = async (req, res) => {
  const { meetingCode } = req.body || {};
  try {
    const meeting = await recordMeeting({ meetingCode, username: req.user.username });
    return res.status(201).json(meeting);
  } catch (err) {
    return res.status(err.status || 400).json({ message: err.message });
  }
};