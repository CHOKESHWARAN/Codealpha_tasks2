/**
 * Feed & Posts Management for Robust
 */

const Feed = {
  currentTab: 'all', // 'all' or 'following'
  currentTag: null,
  currentSearch: null,
  posts: [],
  attachedImageUrl: '',

  init() {
    this.bindEvents();
  },

  async loadFeed() {
    const container = document.getElementById('feed-posts-container');
    if (!container) return;

    container.innerHTML = `
      <div class="loading-spinner-wrapper">
        <div class="spinner"></div>
        <p>Fetching posts...</p>
      </div>
    `;

    try {
      const params = {
        feed: this.currentTab
      };
      if (this.currentTag) params.tag = this.currentTag;
      if (this.currentSearch) params.search = this.currentSearch;

      const res = await API.posts.getPosts(params);
      this.posts = res.posts || [];
      this.renderPosts(container, this.posts);
    } catch (err) {
      console.error('Failed to load posts:', err);
      container.innerHTML = `
        <div class="empty-state">
          <h3>Could not load feed</h3>
          <p>${Utils.escapeHTML(err.message || 'Check your connection and try again.')}</p>
          <button class="btn btn-secondary btn-sm" onclick="Feed.loadFeed()">Retry</button>
        </div>
      `;
    }
  },

  renderPosts(container, posts) {
    if (!posts || posts.length === 0) {
      let emptyMsg = "No posts in this feed yet. Be the first to share!";
      if (this.currentTab === 'following') {
        emptyMsg = "You aren't following anyone with posts yet. Check 'Explore' or 'Who to follow' to discover great people!";
      } else if (this.currentTag) {
        emptyMsg = `No posts found with hashtag #${this.currentTag}.`;
      }
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <h3>Nothing to see here yet</h3>
          <p>${emptyMsg}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = posts.map(post => this.createPostCardHTML(post)).join('');
    this.attachPostListeners(container);
  },

  createPostCardHTML(post) {
    const authorAvatar = post.author.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${post.author.username}`;
    const isLikedClass = post.isLiked ? 'liked' : '';
    const formattedContent = Utils.formatPostContent(post.content);
    const timeAgo = Utils.formatTimeAgo(post.createdAt);

    return `
      <article class="post-card" id="post-${post.id}" data-post-id="${post.id}">
        <div class="post-avatar-col">
          <img src="${Utils.escapeHTML(authorAvatar)}" 
               alt="${Utils.escapeHTML(post.author.name)}" 
               class="avatar-md btn-nav-profile" 
               data-username="${Utils.escapeHTML(post.author.username)}">
        </div>
        <div class="post-main-col">
          <div class="post-header">
            <div class="post-author-info btn-nav-profile" data-username="${Utils.escapeHTML(post.author.username)}">
              <span class="post-author-name">${Utils.escapeHTML(post.author.name)}</span>
              <span class="post-author-handle">@${Utils.escapeHTML(post.author.username)}</span>
              <span class="post-dot-separator">&middot;</span>
              <span class="post-timestamp">${timeAgo}</span>
            </div>
            ${post.isOwn ? `
              <button class="btn-icon btn-delete-post" title="Delete post" data-post-id="${post.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            ` : ''}
          </div>

          <div class="post-content">${formattedContent}</div>

          ${post.imageUrl ? `
            <div class="post-media-container">
              <img src="${Utils.escapeHTML(post.imageUrl)}" alt="Post image" class="post-media-img" data-full-img="${Utils.escapeHTML(post.imageUrl)}">
            </div>
          ` : ''}

          <div class="post-actions">
            <!-- Comment Button -->
            <button class="post-action-btn action-comment btn-toggle-comments" data-post-id="${post.id}" title="Comments">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
              <span class="action-count comment-count">${post.commentsCount || 0}</span>
            </button>

            <!-- Like Button -->
            <button class="post-action-btn action-like ${isLikedClass} btn-toggle-like" data-post-id="${post.id}" title="Like">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <span class="action-count like-count">${post.likesCount || 0}</span>
            </button>

            <!-- Share Button -->
            <button class="post-action-btn action-share btn-share-post" data-post-id="${post.id}" title="Share">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>
          </div>

          <!-- Collapsible Comments Section -->
          <div class="comments-section" id="comments-box-${post.id}" style="display: none;">
            <div class="comment-input-row">
              <img src="${Utils.escapeHTML(Auth.currentUser?.avatar || 'https://api.dicebear.com/7.x/identicon/svg?seed=user')}" alt="" class="avatar-xs">
              <input type="text" placeholder="Write a thoughtful comment..." class="comment-input" data-post-id="${post.id}">
              <button class="btn btn-primary btn-sm btn-submit-comment" data-post-id="${post.id}">Reply</button>
            </div>
            <div class="comments-list" id="comments-list-${post.id}">
              <!-- Comments will load when opened -->
            </div>
          </div>
        </div>
      </article>
    `;
  },

  attachPostListeners(container) {
    // Like toggle
    container.querySelectorAll('.btn-toggle-like').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!Auth.currentUser) {
          Auth.openAuthModal('login');
          return;
        }

        const postId = btn.getAttribute('data-post-id');
        const countSpan = btn.querySelector('.like-count');

        try {
          const res = await API.posts.toggleLike(postId);
          if (res.liked) {
            btn.classList.add('liked');
          } else {
            btn.classList.remove('liked');
          }
          if (countSpan) countSpan.textContent = res.likesCount;
        } catch (err) {
          Utils.showToast(err.message || 'Could not update like', 'error');
        }
      });
    });

    // Expand/collapse comments
    container.querySelectorAll('.btn-toggle-comments').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const postId = btn.getAttribute('data-post-id');
        this.toggleCommentsSection(postId);
      });
    });

    // Submit comment
    container.querySelectorAll('.btn-submit-comment').forEach(btn => {
      btn.addEventListener('click', () => {
        const postId = btn.getAttribute('data-post-id');
        this.submitComment(postId);
      });
    });

    // Enter key on comment input
    container.querySelectorAll('.comment-input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const postId = input.getAttribute('data-post-id');
          this.submitComment(postId);
        }
      });
    });

    // Delete post
    container.querySelectorAll('.btn-delete-post').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const postId = btn.getAttribute('data-post-id');
        if (!confirm('Are you sure you want to delete this post?')) return;

        try {
          await API.posts.deletePost(postId);
          Utils.showToast('Post deleted', 'info');
          const postCard = document.getElementById(`post-${postId}`);
          if (postCard) {
            postCard.style.opacity = '0';
            postCard.style.transform = 'scale(0.95)';
            postCard.style.transition = 'all 0.25s ease';
            setTimeout(() => postCard.remove(), 250);
          }
        } catch (err) {
          Utils.showToast(err.message || 'Failed to delete post', 'error');
        }
      });
    });

    // Share post
    container.querySelectorAll('.btn-share-post').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const postId = btn.getAttribute('data-post-id');
        const shareUrl = `${window.location.origin}/#post-${postId}`;
        navigator.clipboard?.writeText(shareUrl).then(() => {
          Utils.showToast('Post link copied to clipboard!', 'success');
        }).catch(() => {
          Utils.showToast('Post link ready to share', 'info');
        });
      });
    });

    // Image lightbox
    container.querySelectorAll('.post-media-img').forEach(img => {
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        const src = img.getAttribute('data-full-img');
        if (window.App && typeof window.App.openLightbox === 'function') {
          window.App.openLightbox(src);
        }
      });
    });

    // Navigate to profile
    container.querySelectorAll('.btn-nav-profile').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const username = el.getAttribute('data-username');
        if (window.App && typeof window.App.showProfile === 'function') {
          window.App.showProfile(username);
        }
      });
    });

    // Hashtag clicks
    container.querySelectorAll('.hashtag').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const tag = el.getAttribute('data-tag');
        Feed.filterByTag(tag);
      });
    });
  },

  async toggleCommentsSection(postId) {
    const box = document.getElementById(`comments-box-${postId}`);
    if (!box) return;

    if (box.style.display === 'none') {
      box.style.display = 'flex';
      await this.loadComments(postId);
      const input = box.querySelector('.comment-input');
      if (input) input.focus();
    } else {
      box.style.display = 'none';
    }
  },

  async loadComments(postId) {
    const list = document.getElementById(`comments-list-${postId}`);
    if (!list) return;

    list.innerHTML = `<div style="font-size:0.85rem; color:var(--text-dim);">Loading comments...</div>`;

    try {
      const res = await API.comments.getComments(postId);
      const comments = res.comments || [];

      if (comments.length === 0) {
        list.innerHTML = `<div style="font-size:0.85rem; color:var(--text-dim); padding:6px 0;">No comments yet. Start the conversation!</div>`;
        return;
      }

      list.innerHTML = comments.map(c => `
        <div class="comment-item" id="comment-${c.id}">
          <img src="${Utils.escapeHTML(c.author.avatar || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + c.author.username)}" alt="" class="avatar-xs btn-nav-profile" data-username="${Utils.escapeHTML(c.author.username)}">
          <div class="comment-body">
            <div class="comment-header">
              <span class="comment-author btn-nav-profile" data-username="${Utils.escapeHTML(c.author.username)}">${Utils.escapeHTML(c.author.name)}</span>
              <span class="comment-handle">@${Utils.escapeHTML(c.author.username)}</span>
              <span class="post-dot-separator">&middot;</span>
              <span style="font-size:0.75rem; color:var(--text-dim);">${Utils.formatTimeAgo(c.createdAt)}</span>
            </div>
            <div class="comment-text">${Utils.formatPostContent(c.content)}</div>
          </div>
          ${c.isOwn ? `
            <button class="btn-delete-comment" title="Delete comment" data-comment-id="${c.id}" data-post-id="${postId}">&times;</button>
          ` : ''}
        </div>
      `).join('');

      // Comment delete listeners
      list.querySelectorAll('.btn-delete-comment').forEach(btn => {
        btn.addEventListener('click', async () => {
          const commentId = btn.getAttribute('data-comment-id');
          try {
            const result = await API.comments.deleteComment(commentId);
            const item = document.getElementById(`comment-${commentId}`);
            if (item) item.remove();

            // Update comment count on post card
            const postCard = document.getElementById(`post-${postId}`);
            if (postCard) {
              const countSpan = postCard.querySelector('.comment-count');
              if (countSpan) countSpan.textContent = result.commentsCount;
            }
          } catch (err) {
            Utils.showToast(err.message || 'Failed to delete comment', 'error');
          }
        });
      });

      // Profile navs in comment
      list.querySelectorAll('.btn-nav-profile').forEach(el => {
        el.addEventListener('click', () => {
          const uname = el.getAttribute('data-username');
          if (window.App) window.App.showProfile(uname);
        });
      });
    } catch (err) {
      list.innerHTML = `<div style="font-size:0.85rem; color:var(--like-color);">Failed to load comments</div>`;
    }
  },

  async submitComment(postId) {
    if (!Auth.currentUser) {
      Auth.openAuthModal('login');
      return;
    }

    const box = document.getElementById(`comments-box-${postId}`);
    if (!box) return;
    const input = box.querySelector('.comment-input');
    const content = input.value.trim();

    if (!content) return;

    try {
      const res = await API.comments.addComment(postId, content);
      input.value = '';

      // Update count badge
      const postCard = document.getElementById(`post-${postId}`);
      if (postCard) {
        const countSpan = postCard.querySelector('.comment-count');
        if (countSpan) countSpan.textContent = res.commentsCount;
      }

      await this.loadComments(postId);
      Utils.showToast('Comment added!', 'success');
    } catch (err) {
      Utils.showToast(err.message || 'Failed to post comment', 'error');
    }
  },

  async submitNewPost(content, imageUrl) {
    if (!Auth.currentUser) {
      Auth.openAuthModal('login');
      return;
    }

    if (!content || !content.trim()) {
      Utils.showToast('Please write something to post.', 'warning');
      return;
    }

    try {
      const res = await API.posts.createPost({
        content,
        imageUrl: imageUrl || ''
      });

      Utils.showToast('Post published!', 'success');
      this.clearComposer();
      await this.loadFeed();
      // Also refresh trending topics
      if (window.App) window.App.loadTrending();
    } catch (err) {
      Utils.showToast(err.message || 'Failed to publish post', 'error');
    }
  },

  clearComposer() {
    const text = document.getElementById('composer-text');
    if (text) text.value = '';
    const counter = document.getElementById('composer-char-count');
    if (counter) counter.textContent = '1000';

    this.attachedImageUrl = '';
    const previewBox = document.getElementById('composer-image-preview-container');
    const previewImg = document.getElementById('composer-image-preview');
    if (previewBox) previewBox.style.display = 'none';
    if (previewImg) previewImg.src = '';

    const urlBar = document.getElementById('composer-url-bar');
    if (urlBar) urlBar.style.display = 'none';
  },

  filterByTag(tag) {
    this.currentTag = tag;
    const banner = document.getElementById('filter-banner');
    const bannerText = document.getElementById('filter-banner-text');
    if (banner && bannerText) {
      bannerText.textContent = `#${tag}`;
      banner.style.display = 'flex';
    }
    // Switch to feed view
    if (window.App) window.App.switchView('feed');
    this.loadFeed();
  },

  clearFilter() {
    this.currentTag = null;
    this.currentSearch = null;
    const banner = document.getElementById('filter-banner');
    if (banner) banner.style.display = 'none';
    this.loadFeed();
  },

  bindEvents() {
    // Feed tabs: For You / Following
    const tabForYou = document.getElementById('tab-for-you');
    const tabFollowing = document.getElementById('tab-following');

    if (tabForYou) {
      tabForYou.addEventListener('click', () => {
        this.currentTab = 'all';
        tabForYou.classList.add('active');
        tabFollowing?.classList.remove('active');
        this.loadFeed();
      });
    }

    if (tabFollowing) {
      tabFollowing.addEventListener('click', () => {
        if (!Auth.currentUser) {
          Auth.openAuthModal('login');
          return;
        }
        this.currentTab = 'following';
        tabFollowing.classList.add('active');
        tabForYou?.classList.remove('active');
        this.loadFeed();
      });
    }

    // Clear filter banner button
    const btnClear = document.getElementById('btn-clear-filter');
    if (btnClear) {
      btnClear.addEventListener('click', () => this.clearFilter());
    }

    // Composer text input & char counter
    const compText = document.getElementById('composer-text');
    const compCount = document.getElementById('composer-char-count');
    if (compText && compCount) {
      compText.addEventListener('input', () => {
        const remaining = 1000 - compText.value.length;
        compCount.textContent = remaining;
        compCount.style.color = remaining < 50 ? 'var(--like-color)' : 'var(--text-dim)';
      });
    }

    // Composer submit
    const btnSubmit = document.getElementById('btn-submit-post');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => {
        const text = compText ? compText.value : '';
        this.submitNewPost(text, this.attachedImageUrl);
      });
    }

    // Image URL bar toggle
    const btnUrlToggle = document.getElementById('btn-image-url-toggle');
    const urlBar = document.getElementById('composer-url-bar');
    const urlInput = document.getElementById('composer-image-url-input');
    const btnApplyUrl = document.getElementById('btn-apply-image-url');

    if (btnUrlToggle && urlBar) {
      btnUrlToggle.addEventListener('click', () => {
        urlBar.style.display = urlBar.style.display === 'none' ? 'flex' : 'none';
        if (urlBar.style.display === 'flex' && urlInput) urlInput.focus();
      });
    }

    if (btnApplyUrl && urlInput) {
      btnApplyUrl.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (url) {
          this.setAttachedImage(url);
          urlInput.value = '';
          urlBar.style.display = 'none';
        }
      });
    }

    // Local file input upload
    const fileInput = document.getElementById('composer-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          Utils.showToast('Uploading image...', 'info');
          const res = await API.upload.uploadImage(file);
          this.setAttachedImage(res.url);
          Utils.showToast('Image uploaded!', 'success');
        } catch (err) {
          Utils.showToast(err.message || 'Image upload failed', 'error');
        }
      });
    }

    // Remove preview image
    const btnRemove = document.getElementById('btn-remove-preview');
    if (btnRemove) {
      btnRemove.addEventListener('click', () => {
        this.attachedImageUrl = '';
        const previewBox = document.getElementById('composer-image-preview-container');
        if (previewBox) previewBox.style.display = 'none';
      });
    }

    // Insert hashtag helper
    const btnInsertHash = document.getElementById('btn-insert-hashtag');
    if (btnInsertHash && compText) {
      btnInsertHash.addEventListener('click', () => {
        compText.value += ' #';
        compText.focus();
      });
    }
  },

  setAttachedImage(url) {
    this.attachedImageUrl = url;
    const previewBox = document.getElementById('composer-image-preview-container');
    const previewImg = document.getElementById('composer-image-preview');
    if (previewBox && previewImg) {
      previewImg.src = url;
      previewBox.style.display = 'block';
    }
  }
};
