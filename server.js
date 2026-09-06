const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');

// Load environment variables from .env if present
const ENV_FILE = path.join(ROOT, '.env');
if (fs.existsSync(ENV_FILE)) {
  try {
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  } catch (e) {
    console.error('Error reading .env file:', e.message);
  }
}

const { handleChatStream } = require('./services/chatService');

// Ensure data directory and bookings file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BOOKINGS_FILE)) {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify([], null, 2), 'utf8');
}

function getStoredBookings() {
  try {
    const raw = fs.readFileSync(BOOKINGS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveBookings(bookings) {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), 'utf8');
}

// Generate standard 30-minute time slots from 09:00 to 18:00
function getStandardDailySlots() {
  return [
    { t12: '9:00 AM', t24: '09:00', end12: '9:30 AM', end24: '09:30' },
    { t12: '9:30 AM', t24: '09:30', end12: '10:00 AM', end24: '10:00' },
    { t12: '10:00 AM', t24: '10:00', end12: '10:30 AM', end24: '10:30' },
    { t12: '10:30 AM', t24: '10:30', end12: '11:00 AM', end24: '11:00' },
    { t12: '11:00 AM', t24: '11:00', end12: '11:30 AM', end24: '11:30' },
    { t12: '11:30 AM', t24: '11:30', end12: '12:00 PM', end24: '12:00' },
    { t12: '12:00 PM', t24: '12:00', end12: '12:30 PM', end24: '12:30' },
    { t12: '12:30 PM', t24: '12:30', end12: '1:00 PM', end24: '13:00' },
    { t12: '1:00 PM', t24: '13:00', end12: '1:30 PM', end24: '13:30' },
    { t12: '1:30 PM', t24: '13:30', end12: '2:00 PM', end24: '14:00' },
    { t12: '2:00 PM', t24: '14:00', end12: '2:30 PM', end24: '14:30' },
    { t12: '2:30 PM', t24: '14:30', end12: '3:00 PM', end24: '15:00' },
    { t12: '3:00 PM', t24: '15:00', end12: '3:30 PM', end24: '15:30' },
    { t12: '3:30 PM', t24: '15:30', end12: '4:00 PM', end24: '16:00' },
    { t12: '4:00 PM', t24: '16:00', end12: '4:30 PM', end24: '16:30' },
    { t12: '4:30 PM', t24: '16:30', end12: '5:00 PM', end24: '17:00' },
    { t12: '5:00 PM', t24: '17:00', end12: '5:30 PM', end24: '17:30' },
    { t12: '5:30 PM', t24: '17:30', end12: '6:00 PM', end24: '18:00' }
  ];
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let reqPath = decodeURIComponent(parsedUrl.pathname);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ==========================================
  // BACKEND API ROUTES
  // ==========================================

  // 0. POST /api/chat (AI Portfolio Chatbot streaming endpoint)
  if (reqPath === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        handleChatStream(req, res, payload);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Malformed JSON payload.' }));
      }
    });
    return;
  }

  // 0b. GET /api/chat/logs (View saved conversation logs)
  if (reqPath === '/api/chat/logs' && req.method === 'GET') {
    const logsFile = path.join(DATA_DIR, 'chat_logs.json');
    let logs = [];
    if (fs.existsSync(logsFile)) {
      try {
        logs = JSON.parse(fs.readFileSync(logsFile, 'utf8') || '[]');
      } catch (e) {
        logs = [];
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, count: logs.length, logs }));
    return;
  }

  // 1. GET /api/booking/availability?date=YYYY-MM-DD&timezone=...
  if (reqPath === '/api/booking/availability' && req.method === 'GET') {
    const queryDate = parsedUrl.query.date;
    const timezone = parsedUrl.query.timezone || 'Asia/Kolkata';

    if (!queryDate || !/^\d{4}-\d{2}-\d{2}$/.test(queryDate)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid or missing date parameter (YYYY-MM-DD)' }));
      return;
    }

    const allBookings = getStoredBookings();
    const dateBookings = allBookings.filter(b => b.date === queryDate);
    const bookedTimeSlots = new Set(dateBookings.map(b => b.time));

    const standardSlots = getStandardDailySlots();
    const availableSlots = standardSlots.filter(s => !bookedTimeSlots.has(s.t12) && !bookedTimeSlots.has(s.t24));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      date: queryDate,
      timezone: timezone,
      totalSlots: standardSlots.length,
      availableCount: availableSlots.length,
      slots: availableSlots
    }));
    return;
  }

  // 2. POST /api/booking/book
  if (reqPath === '/api/booking/book' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { name, email, date, time, timezone, goals } = payload;

        // Validation
        if (!name || typeof name !== 'string' || name.trim().length < 2) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Please enter a valid full name.' }));
          return;
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Please enter a valid email address.' }));
          return;
        }

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid booking date selected.' }));
          return;
        }

        if (!time) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Please select a valid time slot.' }));
          return;
        }

        const allBookings = getStoredBookings();

        // Check for duplicate slot booking
        const conflict = allBookings.find(b => b.date === date && b.time === time);
        if (conflict) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'This time slot was just booked by another creator. Please select another slot.' }));
          return;
        }

        // Helper to format ISO date for Google Calendar (YYYYMMDDTHHmmssZ)
        function formatGCalDateTime(dateStr, timeStr) {
          try {
            // timeStr e.g. "9:00 AM", "09:00", "2:30 PM"
            var parts = dateStr.split('-');
            var y = parseInt(parts[0]);
            var m = parseInt(parts[1]) - 1;
            var d = parseInt(parts[2]);

            var hours = 10, minutes = 0;
            var match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
            if (match) {
              hours = parseInt(match[1]);
              minutes = parseInt(match[2]);
              var ampm = match[3];
              if (ampm) {
                if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
                if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
              }
            }

            // Pad helper
            var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
            var startDt = new Date(Date.UTC(y, m, d, hours - 5, minutes - 30)); // adjust for UTC from IST (+5:30)
            var endDt = new Date(startDt.getTime() + 30 * 60 * 1000);

            var startStr = startDt.getUTCFullYear() + pad(startDt.getUTCMonth() + 1) + pad(startDt.getUTCDate()) + 'T' + pad(startDt.getUTCHours()) + pad(startDt.getUTCMinutes()) + '00Z';
            var endStr = endDt.getUTCFullYear() + pad(endDt.getUTCMonth() + 1) + pad(endDt.getUTCDate()) + 'T' + pad(endDt.getUTCHours()) + pad(endDt.getUTCMinutes()) + '00Z';

            return startStr + '/' + endStr;
          } catch(e) {
            return '20260915T043000Z/20260915T050000Z';
          }
        }

        // Create booking record
        const bookingId = 'BK-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        const gcalDates = formatGCalDateTime(date, time);
        const gcalUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + 
          encodeURIComponent('30 Min Video Strategy Session - Sangam Singh') + 
          '&dates=' + gcalDates + 
          '&details=' + encodeURIComponent('Strategy session with Sangam Singh.\nAttendee: ' + name.trim() + ' (' + email.trim() + ')\nGoals: ' + (goals ? goals.trim() : 'General content scaling') + '\n\nMeeting Link: https://cal.com/sangam-singh/30min') + 
          '&location=' + encodeURIComponent('Google Meet / Video Call');

        const newBooking = {
          id: bookingId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          date: date,
          time: time,
          timezone: timezone || 'Asia/Kolkata',
          goals: goals ? goals.trim() : '',
          meetingLink: 'https://cal.com/sangam-singh/30min',
          calendarInviteLink: gcalUrl,
          createdAt: new Date().toISOString()
        };

        allBookings.push(newBooking);
        saveBookings(allBookings);

        console.log('[BOOKING CREATED] ' + newBooking.id + ' for ' + newBooking.name + ' (' + newBooking.email + ') on ' + newBooking.date + ' at ' + newBooking.time);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          booking: newBooking
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Malformed JSON payload.' }));
      }
    });
    return;
  }

  // 3. GET /api/booking/list
  if (reqPath === '/api/booking/list' && req.method === 'GET') {
    const bookings = getStoredBookings();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, count: bookings.length, bookings }));
    return;
  }

  // ==========================================
  // STATIC FILE SERVING
  // ==========================================
  if (reqPath === '/') reqPath = '/index.html';
  if (reqPath === '/about') reqPath = '/about.html';
  if (reqPath === '/contact') reqPath = '/contact.html';

  let filePath = path.join(ROOT, reqPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    } else {
      filePath = path.join(ROOT, 'index.html');
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Server running at http://localhost:' + PORT + '/ with Booking API endpoints.');
});
