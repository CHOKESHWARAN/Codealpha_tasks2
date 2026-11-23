const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { requireAuth } = require('../middleware/auth');

// Get notifications for current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const notifications = await query.all(
      `SELECT n.id, n.type, n.post_id, n.is_read, n.created_at,
              u.id as actor_id, u.username as actor_username, u.name as actor_name, u.avatar as actor_avatar,
              p.content as post_content
       FROM notifications n
       JOIN users u ON n.actor_id = u.id
       LEFT JOIN posts p ON n.post_id = p.id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT 40`,
      [req.user.id]
    );

    return res.json({
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        postId: n.post_id,
        postSnippet: n.post_content ? (n.post_content.length > 60 ? n.post_content.substring(0, 60) + '...' : n.post_content) : null,
        isRead: !!n.is_read,
        createdAt: n.created_at,
        actor: {
          id: n.actor_id,
          username: n.actor_username,
          name: n.actor_name,
          avatar: n.actor_avatar
        }
      }))
    });
  } catch (err) {
    console.error('Fetch notifications error:', err);
    return res.status(500).json({ error: 'Failed to retrieve notifications.' });
  }
});

// Mark all as read
router.put('/read', requireAuth, async (req, res) => {
  try {
    await query.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    return res.json({ message: 'Notifications marked as read.' });
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

module.exports = router;
