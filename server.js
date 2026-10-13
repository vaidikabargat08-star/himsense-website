require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'himsense-data.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
const emptyDb = () => ({ users: [], trips: [], bookings: [], nextUserId: 1, nextTripId: 1, nextBookingId: 1 });
function loadDb() { try { return { ...emptyDb(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch { return emptyDb(); } }
let db = loadDb();
function saveDb() { const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, DB_FILE); }
const appSecret = process.env.SESSION_SECRET;
if (!appSecret || appSecret.length < 32) console.warn('WARNING: Set SESSION_SECRET in .env to a random secret of at least 32 characters before sharing/deploying.');
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); next(); });
app.use(session({ name: 'himsense.sid', secret: appSecret || 'local-development-only-change-this-secret-please', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 } }));
const safeUser = u => ({ id: u.id, email: u.email, display_name: u.display_name, role: u.role, created_at: u.created_at });
function auth(req, res, next) { if (!req.session.userId) return res.status(401).json({ error: 'Please sign in to continue.' }); const user = db.users.find(u => u.id === req.session.userId); if (!user) { req.session.destroy(() => {}); return res.status(401).json({ error: 'Please sign in again.' }); } req.user = user; next(); }
function admin(req, res, next) { if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' }); next(); }
app.get('/api/health', (_req, res) => res.json({ app: 'HimSense', status: 'running', storage: 'local JSON demo storage', googleOAuth: false }));
app.get('/api/auth/me', (req, res) => { const user = db.users.find(u => u.id === req.session.userId); res.json({ user: user ? safeUser(user) : null, googleOAuth: false }); });
app.post('/api/auth/signup', async (req, res) => { try { const email = String(req.body.email || '').trim().toLowerCase(); const password = String(req.body.password || ''); const display_name = String(req.body.display_name || '').trim().slice(0, 80) || email.split('@')[0]; if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' }); if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' }); if (password.length > 200) return res.status(400).json({ error: 'Password is too long.' }); if (db.users.some(u => u.email === email)) return res.status(409).json({ error: 'An account with that email already exists.' }); const user = { id: db.nextUserId++, email, password_hash: await bcrypt.hash(password, 12), display_name, role: email === String(process.env.ADMIN_EMAIL || '').trim().toLowerCase() && process.env.ADMIN_EMAIL ? 'admin' : 'customer', created_at: new Date().toISOString() }; db.users.push(user); saveDb(); req.session.userId = user.id; res.status(201).json({ user: safeUser(user) }); } catch (e) { console.error(e); res.status(500).json({ error: 'Could not create account.' }); } });
app.post('/api/auth/login', async (req, res) => { const email = String(req.body.email || '').trim().toLowerCase(); const password = String(req.body.password || ''); const user = db.users.find(u => u.email === email); if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' }); req.session.userId = user.id; res.json({ user: safeUser(user) }); });
app.post('/api/auth/logout', (req, res) => req.session.destroy(err => err ? res.status(500).json({ error: 'Could not sign out.' }) : res.json({ ok: true })));
app.get('/auth/google', (_req, res) => res.status(501).send('Google sign-in is not configured in this starter backend. Email and password sign-in are available.'));
app.get('/api/profile', auth, (req, res) => res.json({ profile: safeUser(req.user) }));
app.patch('/api/profile', auth, (req, res) => { req.user.display_name = String(req.body.display_name || '').trim().slice(0, 80); saveDb(); res.json({ profile: safeUser(req.user) }); });
app.get('/api/my-data', auth, (req, res) => { const trips = db.trips.filter(t => t.user_id === req.user.id).sort((a,b) => b.id-a.id); const bookings = db.bookings.filter(b => b.user_id === req.user.id).sort((a,b) => b.id-a.id); res.json({ profile: safeUser(req.user), trips, bookings, isAdmin: req.user.role === 'admin' }); });
app.post('/api/trips', auth, (req, res) => { const title = String(req.body.title || 'My Himalayan trip').trim().slice(0, 120) || 'My Himalayan trip'; const details = req.body.details && typeof req.body.details === 'object' && !Array.isArray(req.body.details) ? req.body.details : {}; const trip = { id: db.nextTripId++, user_id: req.user.id, title, details, created_at: new Date().toISOString() }; db.trips.push(trip); saveDb(); res.status(201).json({ trip }); });
app.delete('/api/trips/:id', auth, (req, res) => { const before = db.trips.length; db.trips = db.trips.filter(t => !(t.id === Number(req.params.id) && t.user_id === req.user.id)); if (db.trips.length === before) return res.status(404).json({ error: 'Trip not found.' }); saveDb(); res.json({ ok: true }); });
app.post('/api/bookings', auth, (req, res) => { const place_name = String(req.body.place_name || '').trim().slice(0, 160); if (!place_name) return res.status(400).json({ error: 'A place or service is required.' }); const requested_date = req.body.requested_date || null; if (requested_date && !/^\d{4}-\d{2}-\d{2}$/.test(requested_date)) return res.status(400).json({ error: 'Date must use YYYY-MM-DD.' }); const booking = { id: db.nextBookingId++, user_id: req.user.id, place_name, requested_date, notes: String(req.body.notes || '').trim().slice(0, 1000), status: 'requested', created_at: new Date().toISOString() }; db.bookings.push(booking); saveDb(); res.status(201).json({ booking, message: 'Request saved; this is not a confirmed reservation.' }); });
app.get('/api/admin/overview', auth, admin, (_req, res) => res.json({ profileCount: db.users.length, bookings: db.bookings.slice().sort((a,b)=>b.id-a.id).slice(0,100).map(b => ({ ...b, email: db.users.find(u=>u.id===b.user_id)?.email || '' })), recentTrips: db.trips.slice().sort((a,b)=>b.id-a.id).slice(0,100).map(t => ({ ...t, email: db.users.find(u=>u.id===t.user_id)?.email || '' })) }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`HimSense is running at http://localhost:${PORT}`));
