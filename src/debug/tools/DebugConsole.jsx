import React, { useState, useEffect, useRef } from 'react';
import './DebugConsole.css';

const DebugConsole = () => {
    const [logs, setLogs] = useState([]);
    const [filter, setFilter] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    const consoleEndRef = useRef(null);

    useEffect(() => {
        // Function to handle log messages
        const handleLog = (event) => {
            const newLog = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                type: event.type || 'log',
                message: event.detail?.message || event.detail || 'No message',
                data: event.detail?.data
            };
            
            setLogs(prevLogs => [...prevLogs, newLog]);
        };

        // Listen for custom log events
        window.addEventListener('debug-log', handleLog);
        window.addEventListener('debug-error', handleLog);
        window.addEventListener('debug-info', handleLog);
        window.addEventListener('debug-warn', handleLog);

        return () => {
            window.removeEventListener('debug-log', handleLog);
            window.removeEventListener('debug-error', handleLog);
            window.removeEventListener('debug-info', handleLog);
            window.removeEventListener('debug-warn', handleLog);
        };
    }, []);

    useEffect(() => {
        if (autoScroll && consoleEndRef.current) {
            consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    const handleCopy = (log) => {
        const logText = typeof log.message === 'string' 
            ? log.message 
            : JSON.stringify(log.message, null, 2);
        
        navigator.clipboard.writeText(logText).then(
            () => {
                // Visual feedback for copy
                const element = document.getElementById(`log-${log.id}`);
                if (element) {
                    element.classList.add('copied');
                    setTimeout(() => element.classList.remove('copied'), 1000);
                }
            },
            (err) => console.error('Failed to copy:', err)
        );
    };

    const handleClear = () => {
        setLogs([]);
    };

    const filteredLogs = logs.filter(log => {
        if (!filter) return true;
        const searchStr = filter.toLowerCase();
        const messageStr = typeof log.message === 'string' 
            ? log.message.toLowerCase() 
            : JSON.stringify(log.message).toLowerCase();
        return messageStr.includes(searchStr);
    });

    return (
        <div className="debug-console">
            <div className="debug-console-header">
                <div className="debug-console-controls">
                    <input
                        type="text"
                        className="debug-input"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Filter logs..."
                    />
                    <label className="debug-checkbox">
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={(e) => setAutoScroll(e.target.checked)}
                        />
                        Auto-scroll
                    </label>
                    <button
                        className="debug-button clear"
                        onClick={handleClear}
                    >
                        Clear Console
                    </button>
                </div>
                <div className="debug-console-stats">
                    {filteredLogs.length} entries
                </div>
            </div>
            <div className="debug-console-content">
                {filteredLogs.map(log => (
                    <div
                        key={log.id}
                        id={`log-${log.id}`}
                        className={`debug-console-entry ${log.type}`}
                        onClick={() => handleCopy(log)}
                    >
                        <span className="timestamp">
                            {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="message">
                            {typeof log.message === 'string' 
                                ? log.message 
                                : JSON.stringify(log.message, null, 2)}
                        </span>
                        {log.data && (
                            <pre className="data">
                                {JSON.stringify(log.data, null, 2)}
                            </pre>
                        )}
                    </div>
                ))}
                <div ref={consoleEndRef} />
            </div>
        </div>
    );
};

export default DebugConsole; 