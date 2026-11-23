# Robust — Full-Stack Social Media Platform

A modern, responsive full-stack social media application built with a decoupled architecture: **HTML5, CSS3, and Vanilla JavaScript** on the frontend, backed by an **Express.js & SQLite** REST API.

---

## 🌟 Key Features

### 1. User Profiles & Identity
- **Rich Profiles**: Custom banners, avatars, display names, @handles, bios, locations, portfolio websites, and join dates.
- **Dynamic Stats**: Live counters for Followers, Following, Posts, and Likes received.
- **Profile Customization**: In-app profile editor with support for local image file uploads or image URLs for avatars and header banners.
- **Multi-Tab Profile Views**: View posts authored by a user or posts they have liked.
- **Followers & Following Modals**: Interactive dialogs showing who follows whom with real-time follow/unfollow toggles.

### 2. Posts & Content Feed
- **Rich Post Composer**: Text content with automatic hashtag detection, character counter, local image upload (JPEG, PNG, GIF, WEBP up to 5MB), or image URL attachments.
- **Dual Feed Modes**:
  - **For You**: Global community discovery stream.
  - **Following**: Chronological feed filtered specifically to accounts you follow.
- **Hashtag Filtering**: Click on any `#hashtag` in a post or from the Trending Tags widget to filter the stream.
- **Media Lightbox**: Fullscreen immersive image view when clicking post attachments.
- **Post Management**: Post authors can delete their own posts at any time.
- **Share Link**: One-click link copying to share direct post references.

### 3. Comments & Engagement
- **Inline Comment Threads**: Expandable discussion drawer under every post.
- **Instant Commenting**: Add comments in real-time with automatic comment count badge updates.
- **Comment Deletion**: Authors can delete their own comments or comments on their posts.

### 4. Like & Follow System
- **Animated Like Reactions**: Toggle like/unlike with spring heart micro-interactions and instant counter feedback.
- **Follow / Unfollow Engine**: Follow creators to build your curated feed; follow status updates dynamically across the entire app.
- **Smart Recommendations**: "Who to follow" sidebar widget suggesting relevant accounts you don't follow yet.

### 5. Activity & Notifications
- **Real-Time Notification Feed**: Alerts for new likes on your posts, comments on your posts, and new followers.
- **Unread Counter Badges**: Visual indicator in the sidebar and mobile navigation.
- **Mark All as Read**: Single click action to dismiss all alerts.

### 6. Design & Accessibility
- **Modern Dark & Light Themes**: Dark slate default with one-click toggle to crisp light mode (persisted in `localStorage`).
- **Responsive Layout**: Desktop 3-column layout, tablet 2-column, and mobile bottom navigation with floating action button (FAB).
- **One-Click Demo Switcher**: Dedicated helper widget in the sidebar allowing instant switching between accounts (`@sarah_tech`, `@alex_designer`, `@elena_nature`, `@marcus_code`) to test social interactions seamlessly.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Semantic HTML5, CSS3 (Custom Properties, Flexbox, CSS Grid, Glassmorphism), Vanilla JavaScript (ES6+ async/await, Fetch API) |
| **Backend** | Node.js, Express.js 5 |
| **Database** | SQLite3 with indexed relational schema & foreign key cascades |
| **Authentication** | JWT (JSON Web Tokens) with `bcryptjs` password hashing |
| **File Handling** | Multer for local multipart image uploads |

---

## 🗄️ Database Schema

The database (`database/social.db`) is structured with foreign keys and cascading deletes:

```sql
-- Users
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  banner TEXT DEFAULT '',
  location TEXT DEFAULT '',
  website TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Posts
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Comments
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Likes
CREATE TABLE likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, post_id)
);

-- Follows
CREATE TABLE follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id)
);

-- Notifications
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'like', 'comment', 'follow'
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**

### 2. Installation
```bash
# Clone or navigate to the directory
cd task2

# Install dependencies (already installed in workspace)
npm install
```

### 3. Run the Application
```bash
npm start
```
The server will automatically initialize the SQLite database (`database/social.db`), run the seed script with initial users and posts, and start listening at:
**`http://localhost:3000`**

---

## 👤 Seeded Demo Accounts

Default password for all demo accounts: `password123`

| Username | Name | Bio / Role |
|---|---|---|
| `sarah_tech` | Sarah Chen | Full-stack engineer & AI enthusiast |
| `alex_designer` | Alex Rivera | Product Designer @ StudioLab |
| `elena_nature` | Elena Rostova | Landscape & wildlife photographer |
| `marcus_code` | Marcus Brody | Backend architect & database engineer |

> **Tip**: You can switch between these accounts with 1 click using the **Switch Accounts** demo helper on the right sidebar or modal without having to re-type passwords! You can also create fresh accounts anytime via the **Sign Up** tab.

---

## 📡 API Reference Summary

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new account (`{ username, name, email, password }`)
- `POST /api/auth/login` — Log in with username/email & password
- `POST /api/auth/demo` — Quick login as any seeded demo user
- `GET /api/auth/me` — Fetch currently authenticated user and unread notification count
- `GET /api/auth/demo-users` — List available demo accounts for the quick switcher

### Users & Profiles (`/api/users`)
- `GET /api/users/profile/:username` — Retrieve user profile, stats, and follow status
- `PUT /api/users/profile` — Update display name, bio, avatar, banner, location, website
- `POST /api/users/:id/follow` — Toggle follow/unfollow on target user
- `GET /api/users/:username/followers` — List users following this account
- `GET /api/users/:username/following` — List accounts followed by this user
- `GET /api/users/suggested` — Suggested accounts to follow
- `GET /api/users/search?q=query` — Live user search

### Posts (`/api/posts`)
- `GET /api/posts?feed=all|following&tag=...&search=...` — Retrieve posts stream
- `GET /api/posts/:id` — Retrieve post details and discussion thread
- `GET /api/posts/user/:username/likes` — Retrieve posts liked by a user
- `POST /api/posts` — Create a new post (`{ content, imageUrl, tags }`)
- `DELETE /api/posts/:id` — Delete a post (author only)
- `POST /api/posts/:id/like` — Toggle like/unlike on a post
- `GET /api/posts/meta/trending` — Top trending hashtags

### Comments (`/api/comments`)
- `GET /api/comments/post/:postId` — Get comments for a post
- `POST /api/comments/post/:postId` — Add comment to a post
- `DELETE /api/comments/:id` — Delete a comment (comment author or post owner)

### Notifications (`/api/notifications`)
- `GET /api/notifications` — Retrieve recent activity notifications
- `PUT /api/notifications/read` — Mark all notifications as read

### Uploads (`/api/upload`)
- `POST /api/upload` — Multipart file upload for images (`multipart/form-data`)

---

## 📁 Directory Structure

```
task2/
├── package.json               # Node.js project manifest & scripts
├── server.js                  # Main Express server & API route aggregator
├── test-api.js                # Integration test suite for backend API
├── README.md                  # Comprehensive documentation
├── database/
│   ├── db.js                  # SQLite database connection & schema initialization
│   ├── seed.js                # Data seeder with realistic users & content
│   └── social.db              # SQLite database file
├── middleware/
│   └── auth.js                # JWT verification & authentication middleware
├── routes/
│   ├── auth.js                # Authentication endpoints (login, register, demo)
│   ├── users.js               # Profile, follow/unfollow, suggestions & search
│   ├── posts.js               # Feed, post creation, deletion, likes, hashtags
│   ├── comments.js            # Comment threads and management
│   ├── notifications.js       # Activity stream & read states
│   └── upload.js              # Multer image upload handler
├── uploads/                   # Stored uploaded local user images
└── public/
    ├── index.html             # Single Page Application HTML shell
    ├── css/
    │   └── styles.css         # Modern styling, dark/light themes & animations
    └── js/
        ├── api.js             # API client, HTTP methods & utilities
        ├── auth.js            # Auth state, session storage & modal handlers
        ├── feed.js            # Feed rendering, post composer, like & comment handlers
        ├── profile.js         # Profile view, editing & follower modals
        ├── notifications.js   # Notifications view & unread badges
        └── app.js             # App router, widgets, search & theme management
```
#   C o d e a l p h a _ t a s k s 2  
 