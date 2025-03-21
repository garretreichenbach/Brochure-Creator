import React, { useState, useEffect } from 'react';
import './SelectedSources.css';

const SelectedSources = ({ sources, onSourceSelect, initialSelectedUrls = [] }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedUrls, setSelectedUrls] = useState(new Set(initialSelectedUrls));

    // Update selected URLs when initialSelectedUrls changes
    useEffect(() => {
        setSelectedUrls(new Set(initialSelectedUrls));
    }, [initialSelectedUrls]);

    const toggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    const toggleUrlSelection = (url) => {
        const newSelectedUrls = new Set(selectedUrls);
        if (newSelectedUrls.has(url)) {
            newSelectedUrls.delete(url);
        } else {
            newSelectedUrls.add(url);
        }
        setSelectedUrls(newSelectedUrls);
        if (onSourceSelect) {
            onSourceSelect(Array.from(newSelectedUrls));
        }
    };

    return (
        <div className="selected-sources">
            <div className="sources-header" onClick={toggleExpand}>
                <div className="header-content">
                    <h2>Selected Sources</h2>
                    <span className="source-count">
                        {selectedUrls.size} of {sources.length} selected
                    </span>
                </div>
                <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
                    {isExpanded ? '▼' : '▶'}
                </span>
            </div>
            
            {isExpanded && (
                <div className="sources-list">
                    {sources.map((source, index) => (
                        <div key={index} className="source-item">
                            <div className="source-title">
                                <input
                                    type="checkbox"
                                    checked={selectedUrls.has(source.url)}
                                    onChange={() => toggleUrlSelection(source.url)}
                                />
                                <a href={source.url} target="_blank" rel="noopener noreferrer">
                                    {source.title}
                                </a>
                            </div>
                            <div className="source-meta">
                                <span className="source-type">{source.type}</span>
                                <span className="source-relevance">Relevance: {source.relevance}</span>
                            </div>
                            <p className="source-description">{source.description}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SelectedSources; 