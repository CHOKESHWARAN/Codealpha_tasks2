const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Get suggested users to follow
router.get('/suggested', optionalAuth, async (req, res) => {
  try {
    const currentUserId = req.user ? req.user.id : 0;
    
    // Select users who aren't the current user and not already followed
    const suggested = await query.all(
      `SELECT u.id, u.username, u.name, u.avatar, u.bio,
              (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followersCount
       FROM users u
       WHERE u.id != ?
         AND u.id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
       ORDER BY followersCount DESC, u.id DESC
       LIMIT 5`,
      [currentUserId, currentUserId]
    );

    return res.json({ users: suggested });
  } catch (err) {
    console.error('Suggested users error:', err);
    return res.status(500).json({ error: 'Failed to fetch suggested users.' });
  }
});

// Search users
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const q = req.query.q ? req.query.q.trim() : '';
    if (!q) {
      return res.json({ users: [] });
    }

    const currentUserId = req.user ? req.user.id : 0;
    const users = await query.all(
      `SELECT u.id, u.username, u.name, u.avatar, u.bio,
              (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.id) as isFollowing
       FROM users u
       WHERE u.username LIKE ? OR u.name LIKE ?
       LIMIT 10`,
      [currentUserId, `%${q}%`, `%${q}%`]
    );

    return res.json({
      users: users.map(u => ({
        ...u,
        isFollowing: !!u.isFollowing,
        isSelf: u.id === currentUserId
      }))
    });
  } catch (err) {
    console.error('Search users error:', err);
    return res.status(500).json({ error: 'Search failed.' });
  }
});

// Get user profile by username
router.get('/profile/:username', optionalAuth, async (req, res) => {
  try {
    const username = req.params.username.trim().toLowerCase();
    const user = await query.get(
      `SELECT id, username, name, email, bio, avatar, banner, location, website, created_at
       FROM users WHERE username = ?`,
      [username]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const currentUserId = req.user ? req.user.id : 0;

    // Follower counts
    const followers = await query.get('SELECT COUNT(*) as count FROM follows WHERE following_id = ?', [user.id]);
    const following = await query.get('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [user.id]);
    const posts = await query.get('SELECT COUNT(*) as count FROM posts WHERE user_id = ?', [user.id]);
    const totalLikes = await query.get(
      `SELECT COUNT(*) as count FROM likes l
       JOIN posts p ON l.post_id = p.id
       WHERE p.user_id = ?`,
      [user.id]
    );

    // Check if current user is following this user
    let isFollowing = false;
    if (currentUserId && currentUserId !== user.id) {
      const followCheck = await query.get(
        'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
        [currentUserId, user.id]
      );
      isFollowing = !!followCheck;
    }

    return res.json({
      profile: {
        ...user,
        followersCount: followers.count,
        followingCount: following.count,
        postsCount: posts.count,
        likesCount: totalLikes.count,
        isFollowing,
        isSelf: currentUserId === user.id
      }
    });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// Update own profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, bio, avatar, banner, location, website } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Display name cannot be empty.' });
    }

    await query.run(
      `UPDATE users
       SET name = ?, bio = ?, avatar = ?, banner = ?, location = ?, website = ?
       WHERE id = ?`,
      [
        name.trim(),
        (bio || '').trim(),
        (avatar || '').trim(),
        (banner || '').trim(),
        (location || '').trim(),
        (website || '').trim(),
        req.user.id
      ]
    );

    const updated = await query.get(
      `SELECT id, username, name, email, bio, avatar, banner, location, website, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    return res.json({
      message: 'Profile updated successfully!',
      user: updated
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// Toggle follow / unfollow
router.post('/:id/follow', requireAuth, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const currentUserId = req.user.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ error: 'You cannot follow yourself.' });
    }

    // Check target exists
    const targetUser = await query.get('SELECT id, username FROM users WHERE id = ?', [targetUserId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const existing = await query.get(
      'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
      [currentUserId, targetUserId]
    );

    let isFollowingNow = false;

    if (existing) {
      // Unfollow
      await query.run(
        'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
        [currentUserId, targetUserId]
      );
      isFollowingNow = false;
    } else {
      // Follow
      await query.run(
        'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
        [currentUserId, targetUserId]
      );
      isFollowingNow = true;

      // Add notification for target user
      await query.run(
        'INSERT INTO notifications (user_id, actor_id, type) VALUES (?, ?, ?)',
        [targetUserId, currentUserId, 'follow']
      );
    }

    // Return updated follower counts for target
    const followers = await query.get('SELECT COUNT(*) as count FROM follows WHERE following_id = ?', [targetUserId]);
    const targetFollowing = await query.get('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [targetUserId]);

    return res.json({
      following: isFollowingNow,
      followersCount: followers.count,
      targetFollowingCount: targetFollowing.count,
      message: isFollowingNow ? `Followed @${targetUser.username}` : `Unfollowed @${targetUser.username}`
    });
  } catch (err) {
    console.error('Toggle follow error:', err);
    return res.status(500).json({ error: 'Failed to update follow status.' });
  }
});

// Get user followers list
router.get('/:username/followers', optionalAuth, async (req, res) => {
  try {
    const username = req.params.username.trim().toLowerCase();
    const user = await query.get('SELECT id FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const currentUserId = req.user ? req.user.id : 0;
    const followers = await query.all(
      `SELECT u.id, u.username, u.name, u.avatar, u.bio,
              (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.id) as isFollowing
       FROM follows f
       JOIN users u ON f.follower_id = u.id
       WHERE f.following_id = ?
       ORDER BY f.created_at DESC`,
      [currentUserId, user.id]
    );

    return res.json({
      followers: followers.map(f => ({
        ...f,
        isFollowing: !!f.isFollowing,
        isSelf: f.id === currentUserId
      }))
    });
  } catch (err) {
    console.error('Get followers error:', err);
    return res.status(500).json({ error: 'Failed to fetch followers.' });
  }
});

// Get user following list
router.get('/:username/following', optionalAuth, async (req, res) => {
  try {
    const username = req.params.username.trim().toLowerCase();
    const user = await query.get('SELECT id FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const currentUserId = req.user ? req.user.id : 0;
    const following = await query.all(
      `SELECT u.id, u.username, u.name, u.avatar, u.bio,
              (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = u.id) as isFollowing
       FROM follows f
       JOIN users u ON f.following_id = u.id
       WHERE f.follower_id = ?
       ORDER BY f.created_at DESC`,
      [currentUserId, user.id]
    );

    return res.json({
      following: following.map(f => ({
        ...f,
        isFollowing: !!f.isFollowing,
        isSelf: f.id === currentUserId
      }))
    });
  } catch (err) {
    console.error('Get following error:', err);
    return res.status(500).json({ error: 'Failed to fetch following.' });
  }
});

module.exports = router;
