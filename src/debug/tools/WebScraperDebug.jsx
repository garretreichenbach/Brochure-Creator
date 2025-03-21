import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { load as cheerioLoad } from 'cheerio';
import './WebScraperDebug.css';

const API_BASE_URL = `http://localhost:${process.env.SERVER_PORT || 3003}/api`;

const WebScraperDebug = () => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [savedFiles, setSavedFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [locations, setLocations] = useState([]);
    const [selectedLocations, setSelectedLocations] = useState([]);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        loadSavedFiles();
        loadLocations();
    }, []);

    const loadSavedFiles = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/scrape/list`);
            setSavedFiles(response.data);
        } catch (err) {
            console.error('Error loading saved files:', err);
        }
    };

    const loadLocations = async () => {
        try {
            window.dispatchEvent(new CustomEvent('debug-info', { detail: 'Loading scrape locations...' }));
            const response = await fetch(`${API_BASE_URL}/scrape/locations`);
            if (!response.ok) {
                throw new Error(`Failed to load locations: ${response.statusText}`);
            }
            const data = await response.json();
            window.dispatchEvent(new CustomEvent('debug-info', { 
                detail: {
                    message: 'Locations loaded successfully',
                    data: data
                }
            }));
            setLocations(data);
        } catch (err) {
            window.dispatchEvent(new CustomEvent('debug-error', { detail: `Error loading locations: ${err.message}` }));
            setError(`Error loading locations: ${err.message}`);
        }
    };

    const handleScrape = async () => {
        setLoading(true);
        setError(null);
        window.dispatchEvent(new CustomEvent('debug-info', { detail: `Starting scrape for URL: ${url}` }));

        try {
            const response = await fetch(`${API_BASE_URL}/scrape/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                window.dispatchEvent(new CustomEvent('debug-error', { detail: `Server error: ${errorData.error}` }));
                setError(`Server error: ${errorData.error}`);
                return;
            }

            const data = await response.json();
            window.dispatchEvent(new CustomEvent('debug-info', { 
                detail: {
                    message: 'Scrape completed successfully',
                    data: data
                }
            }));
            loadLocations();
        } catch (err) {
            window.dispatchEvent(new CustomEvent('debug-error', { detail: `Error during scrape: ${err.message}` }));
            setError(`Error during scrape: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const loadSavedFile = async (filename) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/scrape/${encodeURIComponent(filename)}`);
            setSelectedFile(response.data);
            setResult(JSON.stringify(response.data, null, 2));
        } catch (err) {
            setError(`Error loading file: ${err.message}`);
        }
    };

    const handleSelectAll = () => {
        if (selectedLocations.length === locations.length) {
            setSelectedLocations([]);
        } else {
            setSelectedLocations(locations.map(loc => loc.name));
        }
    };

    const handleLocationSelect = (locationName) => {
        setSelectedLocations(prevSelected => {
            if (prevSelected.includes(locationName)) {
                return prevSelected.filter(name => name !== locationName);
            } else {
                return [...prevSelected, locationName];
            }
        });
    };

    const handleDelete = async () => {
        if (!selectedLocations.length) return;

        setIsDeleting(true);
        window.dispatchEvent(new CustomEvent('debug-warn', { 
            detail: `Deleting locations: ${selectedLocations.join(', ')}`
        }));

        try {
            const response = await fetch(`${API_BASE_URL}/scrape/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ locations: selectedLocations }),
            });

            if (!response.ok) {
                throw new Error(`Failed to delete locations: ${response.statusText}`);
            }

            window.dispatchEvent(new CustomEvent('debug-info', { detail: 'Locations deleted successfully' }));
            setSelectedLocations([]);
            loadLocations();
        } catch (err) {
            window.dispatchEvent(new CustomEvent('debug-error', { detail: `Error deleting locations: ${err.message}` }));
            setError(`Error deleting locations: ${err.message}`);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="web-scraper-debug">
            <div className="debug-section">
                <h3>URL Scraper</h3>
                <div className="debug-input-group">
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Enter URL to scrape"
                        className="debug-input"
                    />
                    <button
                        onClick={handleScrape}
                        disabled={loading || !url}
                        className="debug-button"
                    >
                        {loading ? 'Scraping...' : 'Scrape'}
                    </button>
                </div>
                {error && <div className="debug-error">{error}</div>}
            </div>

            <div className="debug-section">
                <h3>Location Manager</h3>
                <div className="debug-actions">
                    <button
                        onClick={handleSelectAll}
                        className="debug-button select"
                        disabled={locations.length === 0}
                    >
                        {selectedLocations.length === locations.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <button
                        onClick={handleDelete}
                        className="debug-button delete"
                        disabled={selectedLocations.length === 0 || isDeleting}
                    >
                        {isDeleting ? 'Deleting...' : 'Delete Selected'}
                    </button>
                </div>
                <div className="locations-list">
                    {locations.map(location => (
                        <div
                            key={location.name}
                            className={`location-item ${selectedLocations.includes(location.name) ? 'selected' : ''}`}
                            onClick={() => handleLocationSelect(location.name)}
                        >
                            <div className="location-label">{location.name}</div>
                            <div className="location-stats">
                                {location.sites} sites | {location.totalSize}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {result && (
                <div className="debug-section">
                    <h3>Scraped Data</h3>
                    <pre className="debug-result">{result}</pre>
                </div>
            )}
        </div>
    );
};

export default WebScraperDebug; 