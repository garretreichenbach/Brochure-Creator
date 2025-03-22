// Port configuration for the application
const ports = {
    // Main server port
    SERVER: process.env.SERVER_PORT || 3003,
    // WebSocket port for debug logging
    WEBSOCKET: process.env.WEBSOCKET_PORT || 3005,
    // Local LLM port (if using local LLM)
    LOCAL_LLM: process.env.LOCAL_LLM_PORT || 8000
};

export default ports; 