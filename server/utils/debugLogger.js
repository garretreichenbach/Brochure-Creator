const WebSocket = require('ws');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const WEBSOCKET_PORT = process.env.WEBSOCKET_PORT || 3005;
const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });

// Store connected clients
const clients = new Set();

// Handle WebSocket connections
wss.on('connection', (ws) => {
    clients.add(ws);
    
    ws.on('close', () => {
        clients.delete(ws);
        broadcastLog('warn', 'Debug client disconnected', { totalClients: clients.size });
    });

    // Send initial connection message
    broadcastLog('info', 'Debug client connected', { totalClients: clients.size });
});

// Broadcast log message to all connected clients
function broadcastLog(type, message, data = {}) {
    // Add server source to data
    const logData = {
        ...data,
        source: 'server'
    };

    const logEvent = {
        type,
        message,
        data: logData,
        timestamp: new Date().toISOString()
    };

    const logString = JSON.stringify(logEvent);
    
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(logString);
        }
    });

    // Also log to console based on type
    switch (type) {
        case 'error':
            console.error(message, logData);
            break;
        case 'warn':
            console.warn(message, logData);
            break;
        case 'info':
            console.info(message, logData);
            break;
        default:
            console.log(message, logData);
    }
}

const logger = {
    log: (message, data) => broadcastLog('log', message, data),
    error: (message, data) => broadcastLog('error', message, data),
    warn: (message, data) => broadcastLog('warn', message, data),
    info: (message, data) => broadcastLog('info', message, data)
};

// Log server startup
logger.info('Debug WebSocket server started', { port: WEBSOCKET_PORT });

module.exports = logger; 