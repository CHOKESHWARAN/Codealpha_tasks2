const express = require('express');
const router = express.Router();
const { query } = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Extract hashtags helper
function extractHashtags(text) {
  const matches = text.match(/#([a-zA-Z0-9_]+)/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
}

// Get feed posts (For You, Following, by user, by tag, or search)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const feedType = req.query.feed || 'all'; // 'all' or 'following'
    const tag = req.query.tag ? req.query.tag.trim().toLowerCase() : null;
    const search = req.query.search ? req.query.search.trim() : null;
    const username = req.query.username ? req.query.username.trim().toLowerCase() : null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 50);
    const offset = parseInt(req.query.offset, 10) || 0;

    const currentUserId = req.user ? req.user.id : 0;

    let whereClauses = [];
    let params = [currentUserId, currentUserId];

    if (username) {
      whereClauses.push('u.username = ?');
      params.push(username);
    } else if (feedType === 'following') {
      if (!currentUserId) {
        return res.json({ posts: [], message: 'Log in to see posts from accounts you follow.' });
      }
      whereClauses.push('p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)');
      params.push(currentUserId);
    }

    if (tag) {
      whereClauses.push('(p.tags LIKE ? OR p.content LIKE ?)');
      params.push(`%${tag}%`, `%#${tag}%`);
    }

    if (search) {
      whereClauses.push('(p.content LIKE ? OR u.name LIKE ? OR u.username LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sql = `
      SELECT p.id, p.content, p.image_url, p.tags, p.created_at,
             u.id as author_id, u.username, u.name, u.avatar,
             (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
             (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked,
             (p.user_id = ?) as is_own
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ${whereSql}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);
    const posts = await query.all(sql, params);

    const formattedPosts = posts.map(p => ({
      id: p.id,
      content: p.content,
      imageUrl: p.image_url,
      tags: p.tags ? p.tags.split(',').filter(Boolean) : [],
      createdAt: p.created_at,
      author: {
        id: p.author_id,
        username: p.username,
        name: p.name,
        avatar: p.avatar
      },
      likesCount: p.likes_count,
      commentsCount: p.comments_count,
      isLiked: !!p.is_liked,
      isOwn: !!p.is_own
    }));

    return res.json({ posts: formattedPosts });
  } catch (err) {
    console.error('Fetch posts error:', err);
    return res.status(500).json({ error: 'Failed to retrieve posts.' });
  }
});

// Get posts liked by a specific user
router.get('/user/:username/likes', optionalAuth, async (req, res) => {
  try {
    const username = req.params.username.trim().toLowerCase();
    const user = await query.get('SELECT id FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const currentUserId = req.user ? req.user.id : 0;
    const sql = `
      SELECT p.id, p.content, p.image_url, p.tags, p.created_at,
             u.id as author_id, u.username, u.name, u.avatar,
             (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
             (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked,
             (p.user_id = ?) as is_own
      FROM likes l
      JOIN posts p ON l.post_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE l.user_id = ?
      ORDER BY l.created_at DESC
      LIMIT 30
    `;

    const posts = await query.all(sql, [currentUserId, currentUserId, user.id]);

    const formattedPosts = posts.map(p => ({
      id: p.id,
      content: p.content,
      imageUrl: p.image_url,
      tags: p.tags ? p.tags.split(',').filter(Boolean) : [],
      createdAt: p.created_at,
      author: {
        id: p.author_id,
        username: p.username,
        name: p.name,
        avatar: p.avatar
      },
      likesCount: p.likes_count,
      commentsCount: p.comments_count,
      isLiked: !!p.is_liked,
      isOwn: !!p.is_own
    }));

    return res.json({ posts: formattedPosts });
  } catch (err) {
    console.error('Fetch liked posts error:', err);
    return res.status(500).json({ error: 'Failed to retrieve liked posts.' });
  }
});

// Get single post by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    const currentUserId = req.user ? req.user.id : 0;

    const post = await query.get(
      `SELECT p.id, p.content, p.image_url, p.tags, p.created_at,
              u.id as author_id, u.username, u.name, u.avatar,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked,
              (p.user_id = ?) as is_own
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
      [currentUserId, currentUserId, postId]
    );

    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    // Get comments for this post
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
      post: {
        id: post.id,
        content: post.content,
        imageUrl: post.image_url,
        tags: post.tags ? post.tags.split(',').filter(Boolean) : [],
        createdAt: post.created_at,
        author: {
          id: post.author_id,
          username: post.username,
          name: post.name,
          avatar: post.avatar
        },
        likesCount: post.likes_count,
        commentsCount: post.comments_count,
        isLiked: !!post.is_liked,
        isOwn: !!post.is_own,
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
      }
    });
  } catch (err) {
    console.error('Get post details error:', err);
    return res.status(500).json({ error: 'Failed to retrieve post details.' });
  }
});

// Create a new post
router.post('/', requireAuth, async (req, res) => {
  try {
    const { content, imageUrl, tags } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content cannot be empty.' });
    }

    // Auto extract tags if not passed or combine
    const autoTags = extractHashtags(content);
    let tagList = [];
    if (tags && typeof tags === 'string') {
      tagList = tags.split(',').map(t => t.trim().toLowerCase().replace(/^#/, ''));
    }
    const combinedTags = [...new Set([...tagList, ...autoTags])].filter(Boolean).join(',');

    const result = await query.run(
      'INSERT INTO posts (user_id, content, image_url, tags) VALUES (?, ?, ?, ?)',
      [req.user.id, content.trim(), (imageUrl || '').trim(), combinedTags]
    );

    const newPost = await query.get(
      `SELECT p.id, p.content, p.image_url, p.tags, p.created_at,
              u.id as author_id, u.username, u.name, u.avatar
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
      [result.lastID]
    );

    return res.status(201).json({
      message: 'Post created successfully!',
      post: {
        id: newPost.id,
        content: newPost.content,
        imageUrl: newPost.image_url,
        tags: newPost.tags ? newPost.tags.split(',').filter(Boolean) : [],
        createdAt: newPost.created_at,
        author: {
          id: newPost.author_id,
          username: newPost.username,
          name: newPost.name,
          avatar: newPost.avatar
        },
        likesCount: 0,
        commentsCount: 0,
        isLiked: false,
        isOwn: true
      }
    });
  } catch (err) {
    console.error('Create post error:', err);
    return res.status(500).json({ error: 'Failed to create post.' });
  }
});

// Delete a post
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    const post = await query.get('SELECT id, user_id FROM posts WHERE id = ?', [postId]);

    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to delete this post.' });
    }

    await query.run('DELETE FROM posts WHERE id = ?', [postId]);

    return res.json({ message: 'Post deleted successfully.' });
  } catch (err) {
    console.error('Delete post error:', err);
    return res.status(500).json({ error: 'Failed to delete post.' });
  }
});

// Like / unlike post
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    const post = await query.get('SELECT id, user_id FROM posts WHERE id = ?', [postId]);

    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const existingLike = await query.get(
      'SELECT id FROM likes WHERE user_id = ? AND post_id = ?',
      [req.user.id, postId]
    );

    let isLikedNow = false;

    if (existingLike) {
      // Unlike
      await query.run('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [req.user.id, postId]);
      isLikedNow = false;
    } else {
      // Like
      await query.run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [req.user.id, postId]);
      isLikedNow = true;

      // Create notification if liking someone else's post
      if (post.user_id !== req.user.id) {
        await query.run(
          'INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, ?, ?)',
          [post.user_id, req.user.id, 'like', postId]
        );
      }
    }

    const countResult = await query.get('SELECT COUNT(*) as count FROM likes WHERE post_id = ?', [postId]);

    return res.json({
      liked: isLikedNow,
      likesCount: countResult.count
    });
  } catch (err) {
    console.error('Like toggle error:', err);
    return res.status(500).json({ error: 'Failed to update like status.' });
  }
});

// Trending hashtags
router.get('/meta/trending', async (req, res) => {
  try {
    const postsWithTags = await query.all(
      "SELECT tags FROM posts WHERE tags != '' AND created_at >= datetime('now', '-7 days')"
    );

    const counts = {};
    for (const row of postsWithTags) {
      const tags = row.tags.split(',').filter(Boolean);
      for (const t of tags) {
        counts[t] = (counts[t] || 0) + 1;
      }
    }

    const trending = Object.keys(counts)
      .map(tag => ({ tag, count: counts[tag] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return res.json({ trending });
  } catch (err) {
    console.error('Trending tags error:', err);
    return res.status(500).json({ error: 'Failed to fetch trending tags.' });
  }
});

module.exports = router;
