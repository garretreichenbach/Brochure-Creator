import ports from '../config/ports';

// Create WebSocket connection
const ws = new WebSocket(`ws://localhost:${ports.WEBSOCKET}`);

let isConnected = false;
let messageQueue = [];

ws.onopen = () => {
    isConnected = true;
    // Send any queued messages
    while (messageQueue.length > 0) {
        const msg = messageQueue.shift();
        dispatchLogEvent(msg.type, msg.message, msg.data);
    }
    // Log successful connection
    dispatchLogEvent('debug-info', 'WebSocket connection established');
};

ws.onmessage = (event) => {
    const logEvent = JSON.parse(event.data);
    // Convert server-side log type to debug event type
    const eventType = `debug-${logEvent.type}`;
    dispatchLogEvent(eventType, logEvent.message, logEvent.data);
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    dispatchLogEvent('debug-error', 'WebSocket connection error', error);
};

ws.onclose = () => {
    isConnected = false;
    dispatchLogEvent('debug-warn', 'WebSocket connection closed, attempting to reconnect...');
    // Try to reconnect after a delay
    setTimeout(() => {
        window.location.reload();
    }, 5000);
};

// Dispatch log event in the format expected by the debug console
function dispatchLogEvent(type, message, data = {}) {
    const event = new CustomEvent(type, {
        detail: {
            message,
            data,
            timestamp: new Date().toISOString()
        }
    });
    window.dispatchEvent(event);

    // If not connected and this is a client message, queue it
    if (!isConnected && !type.startsWith('debug-')) {
        messageQueue.push({ type, message, data });
    }
}

const logger = {
    log: (message, data) => dispatchLogEvent('debug-log', message, data),
    error: (message, data) => dispatchLogEvent('debug-error', message, data),
    warn: (message, data) => dispatchLogEvent('debug-warn', message, data),
    info: (message, data) => dispatchLogEvent('debug-info', message, data)
};

export default logger; 