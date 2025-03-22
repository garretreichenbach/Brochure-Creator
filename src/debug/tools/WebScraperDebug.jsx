import React, { useState, useEffect } from 'react';
import WebScraperService from '../../services/WebScraperService';
import logger from '../../utils/debugLogger';
import './WebScraperDebug.css';

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
            const files = await WebScraperService.getScrapedUrls();
            setSavedFiles(files);
        } catch (err) {
            logger.error('Error loading saved files:', err);
        }
    };

    const loadLocations = async () => {
        try {
            logger.info('Loading scrape locations...');
            const data = await WebScraperService.getScrapedLocations();
            logger.info('Locations loaded successfully', data);
            setLocations(data);
        } catch (err) {
            logger.error('Error loading locations:', err);
            setError(`Error loading locations: ${err.message}`);
        }
    };

    const handleScrape = async () => {
        setLoading(true);
        setError(null);
        logger.info('Starting scrape', { url });

        try {
            const result = await WebScraperService.scrapeUrl(url);
            logger.info('Scrape completed successfully', result);
            loadLocations();
        } catch (err) {
            logger.error('Error during scrape:', err);
            setError(`Error during scrape: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const loadSavedFile = async (url) => {
        try {
            const data = await WebScraperService.getScrapedData(url);
            setSelectedFile(data);
            setResult(JSON.stringify(data, null, 2));
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
        logger.warn('Deleting locations', { locations: selectedLocations });

        try {
            await WebScraperService.deleteLocations(selectedLocations);
            logger.info('Locations deleted successfully');
            setSelectedLocations([]);
            loadLocations();
        } catch (err) {
            logger.error('Error deleting locations:', err);
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
                <h3>Saved Files</h3>
                <div className="saved-files-list">
                    {savedFiles.map((file, index) => (
                        <div key={index} className="saved-file-item">
                            <span className="file-title">{file.title}</span>
                            <button
                                onClick={() => loadSavedFile(file.url)}
                                className="debug-button small"
                            >
                                Load
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="debug-section">
                <h3>Locations</h3>
                <div className="locations-controls">
                    <button
                        onClick={handleSelectAll}
                        className="debug-button"
                    >
                        {selectedLocations.length === locations.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting || !selectedLocations.length}
                        className="debug-button danger"
                    >
                        {isDeleting ? 'Deleting...' : `Delete Selected (${selectedLocations.length})`}
                    </button>
                </div>
                <div className="locations-list">
                    {locations.map((location, index) => (
                        <div key={index} className="location-item">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={selectedLocations.includes(location.name)}
                                    onChange={() => handleLocationSelect(location.name)}
                                />
                                {location.name} ({Object.keys(location.sites || {}).length} sites)
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            {selectedFile && (
                <div className="debug-section">
                    <h3>File Content</h3>
                    <pre className="file-content">{result}</pre>
                </div>
            )}
        </div>
    );
};

export default WebScraperDebug; 