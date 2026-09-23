CREATE TABLE videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  originalPath TEXT NOT NULL,
  hlsPlaylistPath TEXT,
  status TEXT NOT NULL DEFAULT 'PROCESSING'
    CHECK (status IN ('PROCESSING', 'READY', 'FAILED')),
  duration REAL,
  thumbnailPath TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
