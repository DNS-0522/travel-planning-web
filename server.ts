import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';

app.use(express.json());

// Initialize SQLite Database
const db = new Database('travel_planner.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    days TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS trip_collaborators (
    trip_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'editor',
    PRIMARY KEY (trip_id, user_id),
    FOREIGN KEY (trip_id) REFERENCES trips(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS itinerary_items (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL,
    day_id TEXT,
    place_name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    stay_duration TEXT,
    travel_time TEXT,
    order_index INTEGER NOT NULL,
    FOREIGN KEY (trip_id) REFERENCES trips(id)
  );
`);

// Add columns if they don't exist (for existing databases)
try {
  db.exec("ALTER TABLE trips ADD COLUMN days TEXT DEFAULT '[]'");
} catch (e) {}
try {
  db.exec("ALTER TABLE itinerary_items ADD COLUMN day_id TEXT");
} catch (e) {}

// Middleware to authenticate JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Helper to check if user has access to a trip (owner or collaborator)
const hasTripAccess = (tripId: string, userId: string) => {
  const checkOwner = db.prepare('SELECT * FROM trips WHERE id = ? AND user_id = ?');
  const owner = checkOwner.get(tripId, userId);
  if (owner) return true;

  const checkCollaborator = db.prepare('SELECT * FROM trip_collaborators WHERE trip_id = ? AND user_id = ?');
  const collaborator = checkCollaborator.get(tripId, userId);
  return !!collaborator;
};

// --- API Routes ---

// Auth: Login / Register
app.post('/api/auth', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const getUser = db.prepare('SELECT * FROM users WHERE email = ?');
  const user = getUser.get(email) as any;

  if (user) {
    // Login
    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    return res.json({ message: 'Logged in successfully', token, user: { id: user.id, email: user.email } });
  } else {
    // Register
    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    const insertUser = db.prepare('INSERT INTO users (id, email, password) VALUES (?, ?, ?)');
    try {
      insertUser.run(id, email, hashedPassword);
      const token = jwt.sign({ id, email }, JWT_SECRET);
      return res.json({ message: 'Registered successfully', token, user: { id, email } });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to register user' });
    }
  }
});

// Get user trips (owned or collaborated)
app.get('/api/trips', authenticateToken, (req: any, res) => {
  const getTrips = db.prepare(`
    SELECT t.* FROM trips t
    LEFT JOIN trip_collaborators tc ON t.id = tc.trip_id
    WHERE t.user_id = ? OR tc.user_id = ?
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `);
  const trips = getTrips.all(req.user.id, req.user.id);
  res.json(trips);
});

// Create a new trip
app.post('/api/trips', authenticateToken, (req: any, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const id = uuidv4();
  const defaultDays = [{ id: uuidv4(), title: 'Day 1' }];
  const insertTrip = db.prepare('INSERT INTO trips (id, user_id, title, days) VALUES (?, ?, ?, ?)');
  insertTrip.run(id, req.user.id, title, JSON.stringify(defaultDays));
  
  res.json({ id, title, user_id: req.user.id, days: JSON.stringify(defaultDays) });
});

// Get itinerary items for a trip
app.get('/api/trips/:tripId/items', authenticateToken, (req: any, res) => {
  const { tripId } = req.params;
  
  if (!hasTripAccess(tripId, req.user.id)) {
    return res.status(404).json({ error: 'Trip not found or access denied' });
  }

  const getItems = db.prepare('SELECT * FROM itinerary_items WHERE trip_id = ? ORDER BY order_index ASC');
  const items = getItems.all(tripId);
  res.json(items);
});

// Update trip days
app.put('/api/trips/:tripId/days', authenticateToken, (req: any, res) => {
  const { tripId } = req.params;
  const { days } = req.body;

  if (!hasTripAccess(tripId, req.user.id)) {
    return res.status(404).json({ error: 'Trip not found or access denied' });
  }

  const updateTrip = db.prepare('UPDATE trips SET days = ? WHERE id = ?');
  updateTrip.run(JSON.stringify(days), tripId);

  res.json({ success: true, days });
});

// Add itinerary item
app.post('/api/trips/:tripId/items', authenticateToken, (req: any, res) => {
  const { tripId } = req.params;
  const { place_name, lat, lng, stay_duration, travel_time, day_id } = req.body;

  if (!hasTripAccess(tripId, req.user.id)) {
    return res.status(404).json({ error: 'Trip not found or access denied' });
  }

  // Get max order_index
  const getMaxOrder = db.prepare('SELECT MAX(order_index) as maxOrder FROM itinerary_items WHERE trip_id = ? AND (day_id = ? OR (? IS NULL AND day_id IS NULL))');
  const result = getMaxOrder.get(tripId, day_id || null, day_id || null) as any;
  const order_index = result.maxOrder !== null ? result.maxOrder + 1 : 0;

  const id = uuidv4();
  const insertItem = db.prepare('INSERT INTO itinerary_items (id, trip_id, day_id, place_name, lat, lng, stay_duration, travel_time, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insertItem.run(id, tripId, day_id || null, place_name, lat, lng, stay_duration || '', travel_time || '', order_index);

  res.json({ id, trip_id: tripId, day_id: day_id || null, place_name, lat, lng, stay_duration, travel_time, order_index });
});

// Update itinerary item
app.put('/api/trips/:tripId/items/:itemId', authenticateToken, (req: any, res) => {
  const { tripId, itemId } = req.params;
  const { stay_duration, travel_time, day_id } = req.body;

  if (!hasTripAccess(tripId, req.user.id)) {
    return res.status(404).json({ error: 'Trip not found or access denied' });
  }

  const updateItem = db.prepare('UPDATE itinerary_items SET stay_duration = ?, travel_time = ?, day_id = ? WHERE id = ? AND trip_id = ?');
  updateItem.run(stay_duration || '', travel_time || '', day_id || null, itemId, tripId);

  res.json({ success: true });
});

// Update itinerary items order
app.put('/api/trips/:tripId/items/reorder', authenticateToken, (req: any, res) => {
  const { tripId } = req.params;
  const { items } = req.body; // Array of { id, order_index, day_id }

  if (!hasTripAccess(tripId, req.user.id)) {
    return res.status(404).json({ error: 'Trip not found or access denied' });
  }

  const updateItem = db.prepare('UPDATE itinerary_items SET order_index = ?, day_id = ? WHERE id = ? AND trip_id = ?');
  
  const transaction = db.transaction((itemsToUpdate) => {
    for (const item of itemsToUpdate) {
      updateItem.run(item.order_index, item.day_id || null, item.id, tripId);
    }
  });

  try {
    transaction(items);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder items' });
  }
});

// Delete itinerary item
app.delete('/api/trips/:tripId/items/:itemId', authenticateToken, (req: any, res) => {
  const { tripId, itemId } = req.params;

  if (!hasTripAccess(tripId, req.user.id)) {
    return res.status(404).json({ error: 'Trip not found or access denied' });
  }

  const deleteItem = db.prepare('DELETE FROM itinerary_items WHERE id = ? AND trip_id = ?');
  deleteItem.run(itemId, tripId);

  res.json({ success: true });
});

// --- Collaborator Routes ---

// Get collaborators for a trip
app.get('/api/trips/:tripId/collaborators', authenticateToken, (req: any, res) => {
  const { tripId } = req.params;

  if (!hasTripAccess(tripId, req.user.id)) {
    return res.status(404).json({ error: 'Trip not found or access denied' });
  }

  const getCollaborators = db.prepare(`
    SELECT u.id, u.email, tc.role FROM trip_collaborators tc
    JOIN users u ON tc.user_id = u.id
    WHERE tc.trip_id = ?
  `);
  const collaborators = getCollaborators.all(tripId);
  res.json(collaborators);
});

// Add a collaborator by email
app.post('/api/trips/:tripId/collaborators', authenticateToken, (req: any, res) => {
  const { tripId } = req.params;
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Only owner can add collaborators
  const getTrip = db.prepare('SELECT * FROM trips WHERE id = ? AND user_id = ?');
  const trip = getTrip.get(tripId, req.user.id);
  if (!trip) return res.status(403).json({ error: 'Only the owner can add collaborators' });

  // Find user by email
  const getUser = db.prepare('SELECT id FROM users WHERE email = ?');
  const userToAdd = getUser.get(email) as any;
  if (!userToAdd) return res.status(404).json({ error: 'User not found' });

  if (userToAdd.id === req.user.id) {
    return res.status(400).json({ error: 'You are already the owner' });
  }

  // Check if already a collaborator
  const checkCollaborator = db.prepare('SELECT * FROM trip_collaborators WHERE trip_id = ? AND user_id = ?');
  if (checkCollaborator.get(tripId, userToAdd.id)) {
    return res.status(400).json({ error: 'User is already a collaborator' });
  }

  const insertCollaborator = db.prepare('INSERT INTO trip_collaborators (trip_id, user_id) VALUES (?, ?)');
  insertCollaborator.run(tripId, userToAdd.id);

  res.json({ success: true });
});

// Remove a collaborator
app.delete('/api/trips/:tripId/collaborators/:userId', authenticateToken, (req: any, res) => {
  const { tripId, userId } = req.params;

  // Only owner can remove collaborators
  const getTrip = db.prepare('SELECT * FROM trips WHERE id = ? AND user_id = ?');
  const trip = getTrip.get(tripId, req.user.id);
  if (!trip) return res.status(403).json({ error: 'Only the owner can remove collaborators' });

  const deleteCollaborator = db.prepare('DELETE FROM trip_collaborators WHERE trip_id = ? AND user_id = ?');
  deleteCollaborator.run(tripId, userId);

  res.json({ success: true });
});

// Delete a trip
app.delete('/api/trips/:tripId', authenticateToken, (req: any, res) => {
  const { tripId } = req.params;

  // Only owner can delete the trip
  const getTrip = db.prepare('SELECT * FROM trips WHERE id = ? AND user_id = ?');
  const trip = getTrip.get(tripId, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Trip not found or you are not the owner' });

  // Delete items and collaborators first
  const deleteItems = db.prepare('DELETE FROM itinerary_items WHERE trip_id = ?');
  const deleteCollaborators = db.prepare('DELETE FROM trip_collaborators WHERE trip_id = ?');
  const deleteTrip = db.prepare('DELETE FROM trips WHERE id = ?');

  const transaction = db.transaction(() => {
    deleteItems.run(tripId);
    deleteCollaborators.run(tripId);
    deleteTrip.run(tripId);
  });

  try {
    transaction();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
