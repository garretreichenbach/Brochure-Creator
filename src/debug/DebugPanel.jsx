import React, { useState } from 'react';
import './DebugPanel.css';
import WebSearchDebug from './tools/WebSearchDebug';
import GeminiDebug from './tools/GeminiDebug';
import MapsDebug from './tools/MapsDebug';
import WebScraperDebug from './tools/WebScraperDebug';
import DebugConsole from './tools/DebugConsole';

const DebugPanel = () => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [activeTab, setActiveTab] = useState('websearch');

    const toggleExpansion = () => {
        setIsExpanded(!isExpanded);
    };

    const renderTool = () => {
        switch (activeTab) {
            case 'websearch':
                return <WebSearchDebug />;
            case 'gemini':
                return <GeminiDebug />;
            case 'maps':
                return <MapsDebug />;
            case 'webscraper':
                return <WebScraperDebug />;
            case 'console':
                return <DebugConsole />;
            default:
                return null;
        }
    };

    return (
        <div className={`debug-panel ${!isExpanded ? 'collapsed' : ''}`}>
            <div className="debug-panel-header" onClick={toggleExpansion}>
                <span>Debug Tools</span>
                <span>◀</span>
            </div>
            {isExpanded && (
                <>
                    <div className="debug-tabs">
                        <button
                            className={`debug-tab ${activeTab === 'websearch' ? 'active' : ''}`}
                            onClick={() => setActiveTab('websearch')}
                        >
                            Web Search
                        </button>
                        <button
                            className={`debug-tab ${activeTab === 'webscraper' ? 'active' : ''}`}
                            onClick={() => setActiveTab('webscraper')}
                        >
                            Web Scraper
                        </button>
                        <button
                            className={`debug-tab ${activeTab === 'gemini' ? 'active' : ''}`}
                            onClick={() => setActiveTab('gemini')}
                        >
                            Gemini
                        </button>
                        <button
                            className={`debug-tab ${activeTab === 'maps' ? 'active' : ''}`}
                            onClick={() => setActiveTab('maps')}
                        >
                            Maps
                        </button>
                        <button
                            className={`debug-tab ${activeTab === 'console' ? 'active' : ''}`}
                            onClick={() => setActiveTab('console')}
                        >
                            Console
                        </button>
                    </div>
                    <div className="debug-panel-content">
                        {renderTool()}
                    </div>
                </>
            )}
        </div>
    );
};

export default DebugPanel; 