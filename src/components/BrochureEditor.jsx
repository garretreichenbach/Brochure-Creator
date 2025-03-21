import React, { useState, useEffect } from 'react';
import './BrochureEditor.css';

const BrochureEditor = ({ brochureData, onUpdate, activeSection }) => {
    const [editData, setEditData] = useState(brochureData);
    const [selectedTheme, setSelectedTheme] = useState('theme-water');

    useEffect(() => {
        setEditData(brochureData);
    }, [brochureData]);

    const handleInputChange = (field, value) => {
        setEditData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleStatsChange = (stat, value) => {
        setEditData(prev => ({
            ...prev,
            stats: {
                ...prev.stats,
                [stat]: value
            }
        }));
    };

    const handleContentChange = (section, value) => {
        setEditData(prev => ({
            ...prev,
            content: {
                ...prev.content,
                [section]: value
            }
        }));
    };

    const handleAttractionChange = (index, field, value) => {
        const newAttractions = [...editData.content.attractions];
        newAttractions[index] = {
            ...newAttractions[index],
            [field]: value
        };
        handleContentChange('attractions', newAttractions);
    };

    const handleSave = () => {
        onUpdate(editData);
    };

    return (
        <div className="brochure-editor">
            <div className="editor-section">
                <h3>Theme</h3>
                <select 
                    value={selectedTheme} 
                    onChange={(e) => setSelectedTheme(e.target.value)}
                    className="theme-selector"
                >
                    <option value="theme-water">Water Theme</option>
                    <option value="theme-desert">Desert Theme</option>
                    <option value="theme-forest">Forest Theme</option>
                </select>
            </div>

            <div className="editor-section">
                <h3>Basic Information</h3>
                <input
                    type="text"
                    value={editData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Location Title"
                    className="editor-input"
                />
                <textarea
                    value={editData.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Location Description"
                    className="editor-textarea"
                />
            </div>

            <div className="editor-section">
                <h3>Statistics</h3>
                <div className="stats-grid">
                    {Object.entries(editData.stats || {}).map(([stat, value]) => (
                        <div key={stat} className="stat-edit">
                            <label>{stat.charAt(0).toUpperCase() + stat.slice(1)}</label>
                            <input
                                type="text"
                                value={value}
                                onChange={(e) => handleStatsChange(stat, e.target.value)}
                                className="editor-input"
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="editor-section">
                <h3>Attractions</h3>
                <div className="attractions-list">
                    {editData.content.attractions.map((attraction, index) => (
                        <div key={index} className="attraction-edit">
                            <input
                                type="text"
                                value={attraction.name}
                                onChange={(e) => handleAttractionChange(index, 'name', e.target.value)}
                                placeholder="Attraction Name"
                                className="editor-input"
                            />
                            <textarea
                                value={attraction.description}
                                onChange={(e) => handleAttractionChange(index, 'description', e.target.value)}
                                placeholder="Attraction Description"
                                className="editor-textarea"
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="editor-section">
                <h3>Content Sections</h3>
                {['overview', 'history', 'culture'].map(section => (
                    <div key={section} className="content-section-edit">
                        <h4>{section.charAt(0).toUpperCase() + section.slice(1)}</h4>
                        <textarea
                            value={editData.content[section] || ''}
                            onChange={(e) => handleContentChange(section, e.target.value)}
                            placeholder={`${section.charAt(0).toUpperCase() + section.slice(1)} content`}
                            className="editor-textarea"
                        />
                    </div>
                ))}
            </div>

            <div className="editor-section">
                <h3>Travel Tips</h3>
                <div className="travel-tips-edit">
                    <div className="tip-edit-item">
                        <h4>Best Time to Visit</h4>
                        <textarea
                            value={editData.content.practical?.bestTimeToVisit || ''}
                            onChange={(e) => handleContentChange('practical', {
                                ...editData.content.practical,
                                bestTimeToVisit: e.target.value
                            })}
                            placeholder="When is the best time to visit this location?"
                            className="editor-textarea"
                        />
                    </div>
                    <div className="tip-edit-item">
                        <h4>Getting Around</h4>
                        <textarea
                            value={editData.content.practical?.transportation || ''}
                            onChange={(e) => handleContentChange('practical', {
                                ...editData.content.practical,
                                transportation: e.target.value
                            })}
                            placeholder="How can visitors get around this location?"
                            className="editor-textarea"
                        />
                    </div>
                    <div className="tip-edit-item">
                        <h4>Local Tips</h4>
                        <textarea
                            value={editData.content.practical?.localTips || ''}
                            onChange={(e) => handleContentChange('practical', {
                                ...editData.content.practical,
                                localTips: e.target.value
                            })}
                            placeholder="What should visitors know about local customs and recommendations?"
                            className="editor-textarea"
                        />
                    </div>
                </div>
            </div>

            <button onClick={handleSave} className="save-button">
                Save Changes
            </button>
        </div>
    );
};

export default BrochureEditor; 