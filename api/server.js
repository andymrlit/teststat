const express = require('express');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

const app = express();
const sessions = new Map();

app.use(express.json());
app.use(express.static('public'));

// Status viewing functionality
async function startStatusWatcher(sock, sessionId) {
    try {
        sock.ev.on('status.update', async ({ status, participant }) => {
            try {
                await sock.readStatus(participant);
                console.log(`[${sessionId}] Viewed status from: ${participant}`);
            } catch (error) {
                console.error(`[${sessionId}] Error viewing status:`, error);
            }
        });

        setInterval(async () => {
            try {
                const statuses = await sock.fetchStatus();
                if (statuses && statuses.length > 0) {
                    for (const status of statuses) {
                        try {
                            await sock.readStatus(status.jid);
                            console.log(`[${sessionId}] Viewed periodic status from: ${status.jid}`);
                        } catch (err) {
                            console.error(`[${sessionId}] Error viewing periodic status:`, err);
                        }
                    }
                }
            } catch (error) {
                console.error(`[${sessionId}] Error fetching statuses:`, error);
            }
        }, 30000);
    } catch (error) {
        console.error(`[${sessionId}] Error in status watcher:`, error);
    }
}

app.post('/api/session/create/pair', async (req, res) => {
    try {
        const { sessionId, phoneNumber } = req.body;
        
        if (!sessionId || !phoneNumber) {
            return res.status(400).json({ error: 'Session ID and phone number are required' });
        }

        if (sessions.has(sessionId)) {
            return res.status(400).json({ error: 'Session already exists' });
        }

        const sessionDir = path.join(__dirname, 'sessions', sessionId);
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        const sock = makeWASocket({
            auth: state,
            mobile: true,
        });

        sock.ev.on('creds.update', saveCreds);

        try {
            const code = await sock.requestPairingCode(phoneNumber);
            sessions.set(sessionId, sock);
            
            // Start status watcher after connection
            sock.ev.on('connection.update', async (update) => {
                if (update.connection === 'open') {
                    startStatusWatcher(sock, sessionId);
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

app.get('/api/sessions', (req, res) => {
    const activeSessions = Array.from(sessions.keys());
    res.json({ sessions: activeSessions });
});

app.delete('/api/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    if (sessions.has(sessionId)) {
        const sock = sessions.get(sessionId);
        sock.end();
        sessions.delete(sessionId);
        res.json({ success: true, message: 'Session deleted successfully' });
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
