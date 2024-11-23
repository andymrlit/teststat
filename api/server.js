// api/server.js
const express = require('express');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
const sessions = new Map();

// MongoDB Session Schema
const SessionSchema = new mongoose.Schema({
    sessionId: String,
    phoneNumber: String,
    auth: Object,
    createdAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now }
});

const Session = mongoose.model('Session', SessionSchema);

// User Schema for Authentication
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
    apiKey: String,
    sessions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Session' }]
});

const User = mongoose.model('User', UserSchema);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});

app.use('/api/', limiter);

// Auth middleware
const authenticateUser = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }

    try {
        const user = await User.findOne({ apiKey });
        if (!user) {
            return res.status(401).json({ error: 'Invalid API key' });
        }
        req.user = user;
        next();
    } catch (error) {
        res.status(500).json({ error: 'Authentication error' });
    }
};

// Database-based session state management
async function getSessionState(sessionId, user) {
    try {
        let session = await Session.findOne({ sessionId, _id: { $in: user.sessions } });
        
        if (!session) {
            session = new Session({
                sessionId,
                auth: {
                    creds: null,
                    keys: {}
                }
            });
            await session.save();
            user.sessions.push(session._id);
            await user.save();
        }

        return {
            state: {
                creds: session.auth.creds,
                keys: {
                    get: async (key) => {
                        const updatedSession = await Session.findById(session._id);
                        return updatedSession.auth.keys[key];
                    },
                    set: async (key, val) => {
                        session.auth.keys[key] = val;
                        await session.save();
                    }
                }
            },
            saveCreds: async () => {
                session.auth.creds = session.state?.creds;
                session.lastActive = new Date();
                await session.save();
            }
        };
    } catch (error) {
        console.error('Error managing session state:', error);
        throw error;
    }
}

// Status viewing functionality
async function startStatusWatcher(sock, sessionId, user) {
    try {
        const session = await Session.findOne({ sessionId, _id: { $in: user.sessions } });
        if (!session) return;

        sock.ev.on('status.update', async ({ status, participant }) => {
            try {
                await sock.readStatus(participant);
                console.log(`[${sessionId}] Viewed status from: ${participant}`);
                session.lastActive = new Date();
                await session.save();
            } catch (error) {
                console.error(`[${sessionId}] Error viewing status:`, error);
            }
        });

        // Periodic status checking
        setInterval(async () => {
            try {
                const statuses = await sock.fetchStatus();
                if (statuses && statuses.length > 0) {
                    for (const status of statuses) {
                        try {
                            await sock.readStatus(status.jid);
                        } catch (err) {
                            console.error(`[${sessionId}] Error viewing periodic status:`, err);
                        }
                    }
                    session.lastActive = new Date();
                    await session.save();
                }
            } catch (error) {
                console.error(`[${sessionId}] Error fetching statuses:`, error);
            }
        }, 30000);
    } catch (error) {
        console.error(`[${sessionId}] Error in status watcher:`, error);
    }
}

// User registration
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const apiKey = crypto.randomBytes(32).toString('hex');
        
        const user = new User({
            username,
            password: hashedPassword,
            apiKey
        });
        
        await user.save();
        
        res.json({ 
            success: true, 
            message: 'Registration successful', 
            apiKey 
        });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

// WhatsApp session endpoints
app.post('/api/session/create/pair', authenticateUser, async (req, res) => {
    try {
        const { sessionId, phoneNumber } = req.body;
        
        if (!sessionId || !phoneNumber) {
            return res.status(400).json({ error: 'Session ID and phone number are required' });
        }

        if (sessions.has(sessionId)) {
            return res.status(400).json({ error: 'Session already exists' });
        }

        const { state, saveCreds } = await getSessionState(sessionId, req.user);
        
        const sock = makeWASocket({
            auth: state,
            mobile: true,
            logger: console
        });

        sock.ev.on('creds.update', saveCreds);

        try {
            const code = await sock.requestPairingCode(phoneNumber);
            sessions.set(sessionId, sock);
            
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;
                
                if (connection === 'open') {
                    console.log(`[${sessionId}] Connected successfully!`);
                    startStatusWatcher(sock, sessionId, req.user);
                }
                
                if (connection === 'close') {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    if (shouldReconnect) {
                        console.log(`[${sessionId}] Reconnecting...`);
                        sessions.delete(sessionId);
                    }
                }
            });
            
            res.json({ success: true, pairingCode: code });
        } catch (error) {
            console.error('Error requesting pairing code:', error);
            res.status(500).json({ error: 'Failed to generate pairing code' });
        }
    } catch (error) {
        console.error('Error in pairing process:', error);
        res.status(500).json({ error: 'Failed to initialize pairing' });
    }
});

app.get('/api/sessions', authenticateUser, async (req, res) => {
    try {
        const userSessions = await Session.find({ _id: { $in: req.user.sessions } })
            .select('sessionId phoneNumber lastActive -_id');
        res.json({ sessions: userSessions });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

app.delete('/api/session/:sessionId', authenticateUser, async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const session = await Session.findOne({ 
            sessionId, 
            _id: { $in: req.user.sessions } 
        });
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (sessions.has(sessionId)) {
            const sock = sessions.get(sessionId);
            sock.end();
            sessions.delete(sessionId);
        }

        req.user.sessions = req.user.sessions.filter(s => !s.equals(session._id));
        await req.user.save();
        await session.deleteOne();

        res.json({ success: true, message: 'Session deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete session' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
