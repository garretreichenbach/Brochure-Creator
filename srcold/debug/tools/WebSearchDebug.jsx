import React, { useState } from 'react';
import axios from 'axios';
import SelectedSources from '../../components/SelectedSources';

const API_BASE_URL = `http://localhost:${process.env.SERVER_PORT || '3003'}/api`;

const WebSearchDebug = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchFilters, setSearchFilters] = useState({
        maxResults: 10,
        includeTypes: {
            travelGuides: true,
            newsArticles: true,
            blogs: true,
            officialSites: true
        },
        timeframe: 'any', // any, year, month, week
        language: 'en'
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchResults, setSearchResults] = useState(null);
    const [selectedUrls, setSelectedUrls] = useState([]);
    const [isScraping, setIsScraping] = useState(false);

    // Example search configurations for different content types
    const searchConfigs = {
        travelGuide: {
            query: 'Tokyo travel guide tourism attractions',
            filters: {
                maxResults: 5,
                includeTypes: {
                    travelGuides: true,
                    officialSites: true,
                    blogs: false,
                    newsArticles: false
                },
                timeframe: 'year',
                language: 'en'
            }
        },
        culturalInfo: {
            query: 'Tokyo culture traditions festivals customs',
            filters: {
                maxResults: 5,
                includeTypes: {
                    travelGuides: true,
                    blogs: true,
                    newsArticles: false,
                    officialSites: true
                },
                timeframe: 'any',
                language: 'en'
            }
        },
        currentEvents: {
            query: 'Tokyo current events activities exhibitions',
            filters: {
                maxResults: 5,
                includeTypes: {
                    newsArticles: true,
                    blogs: true,
                    travelGuides: false,
                    officialSites: true
                },
                timeframe: 'month',
                language: 'en'
            }
        }
    };

    const handleFilterChange = (category, value) => {
        if (category === 'includeTypes') {
            setSearchFilters(prev => ({
                ...prev,
                includeTypes: {
                    ...prev.includeTypes,
                    [value]: !prev.includeTypes[value]
                }
            }));
        } else {
            setSearchFilters(prev => ({
                ...prev,
                [category]: value
            }));
        }
    };

    const loadSearchConfig = (configKey) => {
        const config = searchConfigs[configKey];
        setSearchQuery(config.query);
        setSearchFilters(config.filters);
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsLoading(true);
        setError(null);
        setSearchResults(null);

        try {
            // Format the search parameters
            const searchParams = {
                query: searchQuery,
                maxResults: searchFilters.maxResults,
                filters: {
                    contentTypes: Object.entries(searchFilters.includeTypes)
                        .filter(([_, included]) => included)
                        .map(([type]) => type),
                    timeframe: searchFilters.timeframe,
                    language: searchFilters.language
                }
            };

            console.log('Making search request with params:', searchParams);

            // Make the search request to the correct server URL
            const response = await axios.post(`${API_BASE_URL}/websearch`, searchParams, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Referer': window.location.origin
                },
                withCredentials: true,
                timeout: 10000 // 10 second timeout
            });
            
            console.log('Received response:', response.data);
            
            // Process and set the results
            setSearchResults(response.data.results);
        } catch (err) {
            console.error('Search error details:', {
                message: err.message,
                response: err.response?.data,
                status: err.response?.status,
                config: err.config
            });

            let errorMessage = 'Failed to perform search';
            
            if (err.code === 'ECONNREFUSED') {
                errorMessage = 'Could not connect to search server. Is it running?';
            } else if (err.code === 'ETIMEDOUT') {
                errorMessage = 'Search request timed out. Please try again.';
            } else if (err.response?.status === 403) {
                errorMessage = 'API key error or quota exceeded';
            } else if (err.response?.data?.error) {
                errorMessage = err.response.data.error;
            }

            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSourceSelect = (selectedUrls) => {
        setSelectedUrls(selectedUrls);
    };

    const handleScrapeUrls = async () => {
        if (selectedUrls.size === 0) {
            setError('Please select at least one URL to scrape');
            return;
        }

        setIsScraping(true);
        setError(null);

        try {
            // Get list of existing scrapes
            const listResponse = await fetch(`${API_BASE_URL}/scrape/list`);
            if (!listResponse.ok) {
                throw new Error('Failed to fetch existing scrapes');
            }
            const existingScrapes = await listResponse.json();

            // Process each selected URL
            for (const url of selectedUrls) {
                try {
                    // For each existing scrape, fetch its data to check the URL
                    for (const filename of existingScrapes) {
                        const scrapeResponse = await fetch(`${API_BASE_URL}/scrape/${encodeURIComponent(filename)}`);
                        if (!scrapeResponse.ok) continue;
                        
                        const scrapeData = await scrapeResponse.json();
                        if (scrapeData.url === url) {
                            // Delete the existing scrape
                            await fetch(`${API_BASE_URL}/scrape/${encodeURIComponent(filename)}`, {
                                method: 'DELETE'
                            });
                            console.log(`Deleted old scrape: ${filename}`);
                            break;
                        }
                    }

                    // Scrape and save new data
                    const response = await fetch(`${API_BASE_URL}/scrape/save`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ url })
                    });

                    if (!response.ok) {
                        throw new Error(`Failed to scrape ${url}`);
                    }

                    const result = await response.json();
                    console.log(`Successfully scraped ${url}`, result);
                } catch (error) {
                    console.error(`Error processing ${url}:`, error);
                    setError(prev => prev ? `${prev}\n${error.message}` : error.message);
                }
            }
        } catch (error) {
            console.error('Error during scraping:', error);
            setError('Failed to process scraping request');
        } finally {
            setIsScraping(false);
        }
    };

    return (
        <div className="websearch-debug">
            <div className="search-configs">
                <h4>Load Search Configuration:</h4>
                <div className="config-buttons">
                    {Object.entries(searchConfigs).map(([key, config]) => (
                        <button
                            key={key}
                            className="debug-button"
                            onClick={() => loadSearchConfig(key)}
                        >
                            Load {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="search-filters">
                <h4>Search Filters:</h4>
                <div className="filter-group">
                    <label>Max Results:</label>
                    <input
                        type="number"
                        min="1"
                        max="50"
                        value={searchFilters.maxResults}
                        onChange={(e) => handleFilterChange('maxResults', parseInt(e.target.value))}
                    />
                </div>

                <div className="filter-group">
                    <label>Include Content Types:</label>
                    <div className="checkbox-group">
                        {Object.entries(searchFilters.includeTypes).map(([type, included]) => (
                            <label key={type} className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={included}
                                    onChange={() => handleFilterChange('includeTypes', type)}
                                />
                                {type.replace(/([A-Z])/g, ' $1').toLowerCase()}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="filter-group">
                    <label>Timeframe:</label>
                    <select
                        value={searchFilters.timeframe}
                        onChange={(e) => handleFilterChange('timeframe', e.target.value)}
                    >
                        <option value="any">Any time</option>
                        <option value="year">Past year</option>
                        <option value="month">Past month</option>
                        <option value="week">Past week</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>Language:</label>
                    <select
                        value={searchFilters.language}
                        onChange={(e) => handleFilterChange('language', e.target.value)}
                    >
                        <option value="en">English</option>
                        <option value="ja">Japanese</option>
                        <option value="any">Any</option>
                    </select>
                </div>
            </div>

            <div className="search-input">
                <textarea
                    className="debug-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter search query..."
                    rows={3}
                />
                <button
                    className="debug-button"
                    onClick={handleSearch}
                    disabled={isLoading || !searchQuery.trim()}
                >
                    {isLoading ? 'Searching...' : 'Search'}
                </button>
            </div>

            {error && (
                <div className="debug-error">
                    Error: {error}
                </div>
            )}

            {searchResults && (
                <div className="search-results">
                    <SelectedSources 
                        sources={searchResults.map(result => ({
                            title: result.title,
                            url: result.url,
                            type: result.type,
                            description: result.snippet,
                            relevance: result.relevance || 'N/A'
                        }))}
                        onSourceSelect={handleSourceSelect}
                    />
                    
                    {selectedUrls.length > 0 && (
                        <div className="selected-urls">
                            <button
                                className="debug-button"
                                onClick={handleScrapeUrls}
                                disabled={isScraping}
                            >
                                {isScraping ? 'Scraping...' : `Scrape ${selectedUrls.length} Selected URLs`}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default WebSearchDebug; 