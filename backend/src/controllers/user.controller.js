import bcrypt from 'bcrypt';
import User from '../models/user.model.js';
import crypto from 'node:crypto';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export const registerUser = async (req, res) => {
  try {
    const { name, username, password } = req.body || {}; // `req.body` is a property of the __request object__ (`req`) that contains the parsed data sent by the client in the body of an HTTP request (e.g., a POST or PUT request).


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

    const hashed = await bcrypt.hash(String(password), 10);

    const user = await User.create({
      name: cleanName,
      username: cleanUsername,
      password: hashed,
    });

    return res.status(201).json({
      id: user._id,
      name: user.name,
      username: user.username,
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'That username is already taken' });
    }
    
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