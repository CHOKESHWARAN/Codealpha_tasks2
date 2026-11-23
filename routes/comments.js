const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Get comments for a post
router.get('/post/:postId', optionalAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.postId, 10);
    const currentUserId = req.user ? req.user.id : 0;

    const comments = await query.all(
      `SELECT c.id, c.content, c.created_at,
              u.id as author_id, u.username, u.name, u.avatar,
              (c.user_id = ?) as is_own
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC`,
      [currentUserId, postId]
    );

    return res.json({
      comments: comments.map(c => ({
        id: c.id,
        content: c.content,
        createdAt: c.created_at,
        author: {
          id: c.author_id,
          username: c.username,
          name: c.name,
          avatar: c.avatar
        },
        isOwn: !!c.is_own
      }))
    });
  } catch (err) {
    console.error('Fetch comments error:', err);
    return res.status(500).json({ error: 'Failed to retrieve comments.' });
  }
});

// Add a comment to a post
router.post('/post/:postId', requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.postId, 10);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment text cannot be empty.' });
    }

    // Verify post exists
    const post = await query.get('SELECT id, user_id FROM posts WHERE id = ?', [postId]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const result = await query.run(
      'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
      [postId, req.user.id, content.trim()]
    );

    // Notify post author if not self
    if (post.user_id !== req.user.id) {
      await query.run(
        'INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, ?, ?)',
        [post.user_id, req.user.id, 'comment', postId]
      );
    }

    const newComment = await query.get(
      `SELECT c.id, c.content, c.created_at,
              u.id as author_id, u.username, u.name, u.avatar
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [result.lastID]
    );

    const commentCount = await query.get('SELECT COUNT(*) as count FROM comments WHERE post_id = ?', [postId]);

    return res.status(201).json({
      message: 'Comment posted!',
      comment: {
        id: newComment.id,
        content: newComment.content,
        createdAt: newComment.created_at,
        author: {
          id: newComment.author_id,
          username: newComment.username,
          name: newComment.name,
          avatar: newComment.avatar
        },
        isOwn: true
      },
      commentsCount: commentCount.count
    });
  } catch (err) {
    console.error('Post comment error:', err);
    return res.status(500).json({ error: 'Failed to post comment.' });
  }
});

// Delete a comment
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const commentId = parseInt(req.params.id, 10);
    const comment = await query.get(
      `SELECT c.id, c.user_id, c.post_id, p.user_id as post_author_id
       FROM comments c
       JOIN posts p ON c.post_id = p.id
       WHERE c.id = ?`,
      [commentId]
    );

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    // Only comment author or post author can delete
    if (comment.user_id !== req.user.id && comment.post_author_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this comment.' });
    }

    await query.run('DELETE FROM comments WHERE id = ?', [commentId]);
    const commentCount = await query.get('SELECT COUNT(*) as count FROM comments WHERE post_id = ?', [comment.post_id]);

    return res.json({
      message: 'Comment deleted.',
      postId: comment.post_id,
      commentsCount: commentCount.count
    });
  } catch (err) {
    console.error('Delete comment error:', err);
    return res.status(500).json({ error: 'Failed to delete comment.' });
  }
});

module.exports = router;
