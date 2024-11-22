import express from 'express';
import { makeWASocket, useMultiFileAuthState, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static('public'));

const sessions = new Map();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.post('/login', async (req, res) => {
  const { phoneNumber } = req.body;
  
  try {
    const { state, saveCreds } = await useMultiFileAuthState(`auth_${phoneNumber}`);
    
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: Browsers.ubuntu('Chrome'),
      logger: pino({ level: 'silent' })
    });

    sessions.set(phoneNumber, sock);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === 'close') {
        if (lastDisconnect?.error?.output?.statusCode !== 401) {
          // Reconnect if not logged out
          sessions.delete(phoneNumber);
        }
      } else if (connection === 'open') {
        console.log(`Connected with ${phoneNumber}`);
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // Handle status updates
    sock.ev.on('status.update', async ({ status, participant }) => {
      console.log(`Status update from ${participant}: ${status}`);
      
      // Mark status as read
      try {
        await sock.readMessages([{ remoteJid: participant, id: status.id }]);
        console.log(`Marked status from ${participant} as read`);
      } catch (error) {
        console.error('Error marking status as read:', error);
      }
    });

    res.json({ success: true, message: 'WhatsApp connection initiated' });
  } catch (error) {
    console.error('Connection error:', error);
    res.status(500).json({ success: false, error: 'Failed to establish connection' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});