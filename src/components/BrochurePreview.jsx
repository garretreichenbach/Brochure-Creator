import React, { useState } from 'react';
import './BrochurePreview.css';

const BrochurePreview = ({ brochureData, onEdit }) => {
    const [activeSection, setActiveSection] = useState(null);

    const {
        title,
        description,
        content: { overview, history, attractions, culture, practical },
        stats = {
            population: 'Unknown',
            climate: 'Varied',
            currency: 'Coins',
            temperature: 'Moderate'
        }
    } = brochureData || {};

    const handleSectionClick = (section) => {
        setActiveSection(section === activeSection ? null : section);
        if (onEdit) {
            onEdit(section);
        }
    };

    return (
        <div className="brochure-preview">
            {/* Left Column */}
            <div className="brochure-left-column">
                <div className="brochure-header">
                    <h1 className="brochure-title">{title}</h1>
                    <p className="brochure-subtitle">{description}</p>
                </div>

                <div className="brochure-stats">
                    <div className="stat-item">
                        <span className="stat-label">Population</span>
                        <span className="stat-value">{stats.population}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Climate</span>
                        <span className="stat-value">{stats.climate}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Currency</span>
                        <span className="stat-value">{stats.currency}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Temperature</span>
                        <span className="stat-value">{stats.temperature}</span>
                    </div>
                </div>

                <div className="featured-attractions">
                    {attractions.slice(0, 2).map((attraction, index) => (
                        <div 
                            key={index} 
                            className="featured-attraction"
                            onClick={() => handleSectionClick(`attraction-${index}`)}
                        >
                            <h3>{attraction.name}</h3>
                            <p>{attraction.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Middle Column (Map Representation) */}
            <div className="brochure-middle-column">
                <div className="map-container">
                    <div className="stylized-map">
                        {/* We'll add a stylized representation of the location */}
                        <div className="map-overlay"></div>
                        <div className="map-markers">
                            {attractions.map((attraction, index) => (
                                <div 
                                    key={index}
                                    className="map-marker"
                                    style={{
                                        left: `${(index + 1) * 20}%`,
                                        top: `${(index + 1) * 15}%`
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="map-legend">
                        <div className="legend-item">
                            <span className="marker-icon">📍</span>
                            <span>You Are Here</span>
                        </div>
                        <div className="legend-item">
                            <span className="marker-icon">⭐</span>
                            <span>Points of Interest</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column */}
            <div className="brochure-right-column">
                <div className="highlights-section">
                    <h2>Local Highlights</h2>
                    {attractions.slice(2).map((attraction, index) => (
                        <div 
                            key={index}
                            className="highlight-item"
                            onClick={() => handleSectionClick(`highlight-${index}`)}
                        >
                            <h3>{attraction.name}</h3>
                            <p>{attraction.description}</p>
                        </div>
                    ))}
                </div>

                <div className="keys-section">
                    <h2>Essential Travel Tips</h2>
                    <div className="tips-content">
                        <div className="tip-item">
                            <span className="tip-icon">🕒</span>
                            <div className="tip-text">
                                <h4>Best Time to Visit</h4>
                                <p>{practical.bestTimeToVisit || "Plan your visit during favorable weather conditions"}</p>
                            </div>
                        </div>
                        <div className="tip-item">
                            <span className="tip-icon">🚶</span>
                            <div className="tip-text">
                                <h4>Getting Around</h4>
                                <p>{practical.transportation || "Explore transportation options and local navigation"}</p>
                            </div>
                        </div>
                        <div className="tip-item">
                            <span className="tip-icon">💡</span>
                            <div className="tip-text">
                                <h4>Local Tips</h4>
                                <p>{practical.localTips || "Discover insider recommendations and cultural etiquette"}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrochurePreview; 