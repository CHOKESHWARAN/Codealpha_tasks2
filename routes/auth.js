const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../database/db');
const { requireAuth, generateToken } = require('../middleware/auth');

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { username, name, email, password } = req.body;

    if (!username || !name || !email || !password) {
      return res.status(400).json({ error: 'All fields (username, name, email, password) are required.' });
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters and contain only letters, numbers, or underscores.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Check if username exists
    const existingUser = await query.get(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [cleanUsername, email.trim().toLowerCase()]
    );

    if (existingUser) {
      return res.status(409).json({ error: 'A user with that username or email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    // Generate an automatic stylish avatar using Dicebear
    const defaultAvatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanUsername}`;
    const defaultBanner = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&h=400&fit=crop';

    const result = await query.run(
      `INSERT INTO users (username, name, email, password_hash, avatar, banner)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [cleanUsername, name.trim(), email.trim().toLowerCase(), passwordHash, defaultAvatar, defaultBanner]
    );

    const newUser = await query.get(
      `SELECT id, username, name, email, bio, avatar, banner, location, website, created_at
       FROM users WHERE id = ?`,
      [result.lastID]
    );

    const token = generateToken(newUser);

    return res.status(201).json({
      message: 'Registration successful!',
      token,
      user: {
        ...newUser,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body; // login can be username or email

    if (!login || !password) {
      return res.status(400).json({ error: 'Username/Email and password are required.' });
    }

    const cleanLogin = login.trim().toLowerCase();
    const user = await query.get(
      `SELECT id, username, name, email, password_hash, bio, avatar, banner, location, website, created_at
       FROM users WHERE username = ? OR email = ?`,
      [cleanLogin, cleanLogin]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    // Get counts
    const followers = await query.get('SELECT COUNT(*) as count FROM follows WHERE following_id = ?', [user.id]);
    const following = await query.get('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [user.id]);
    const posts = await query.get('SELECT COUNT(*) as count FROM posts WHERE user_id = ?', [user.id]);

    const { password_hash, ...userData } = user;
    const token = generateToken(userData);

    return res.json({
      message: 'Login successful!',
      token,
      user: {
        ...userData,
        followersCount: followers.count,
        followingCount: following.count,
        postsCount: posts.count
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// Quick demo login
router.post('/demo', async (req, res) => {
  try {
    const targetUsername = req.body.username || 'sarah_tech';
    const user = await query.get(
      `SELECT id, username, name, email, bio, avatar, banner, location, website, created_at
       FROM users WHERE username = ?`,
      [targetUsername.toLowerCase()]
    );

    if (!user) {
      return res.status(404).json({ error: 'Demo user not found.' });
    }

    const followers = await query.get('SELECT COUNT(*) as count FROM follows WHERE following_id = ?', [user.id]);
    const following = await query.get('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [user.id]);
    const posts = await query.get('SELECT COUNT(*) as count FROM posts WHERE user_id = ?', [user.id]);

    const token = generateToken(user);

    return res.json({
      message: `Logged in as demo user @${user.username}`,
      token,
      user: {
        ...user,
        followersCount: followers.count,
        followingCount: following.count,
        postsCount: posts.count
      }
    });
  } catch (err) {
    console.error('Demo login error:', err);
    return res.status(500).json({ error: 'Failed to authenticate demo user.' });
  }
});

// List demo users for quick switcher
router.get('/demo-users', async (req, res) => {
  try {
    const demoUsers = await query.all(
      `SELECT id, username, name, bio, avatar FROM users LIMIT 6`
    );
    return res.json({ users: demoUsers });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch demo users.' });
  }
});

// Get current authenticated user profile & stats
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await query.get(
      `SELECT id, username, name, email, bio, avatar, banner, location, website, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const followers = await query.get('SELECT COUNT(*) as count FROM follows WHERE following_id = ?', [user.id]);
    const following = await query.get('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [user.id]);
    const posts = await query.get('SELECT COUNT(*) as count FROM posts WHERE user_id = ?', [user.id]);
    const unreadNotifications = await query.get(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [user.id]
    );

    return res.json({
      user: {
        ...user,
        followersCount: followers.count,
        followingCount: following.count,
        postsCount: posts.count,
        unreadNotificationsCount: unreadNotifications.count
      }
    });
  } catch (err) {
    console.error('Fetch me error:', err);
    return res.status(500).json({ error: 'Failed to load user profile.' });
  }
});

module.exports = router;
