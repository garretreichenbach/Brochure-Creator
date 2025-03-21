/**
 * Manages generation of the brochure.
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MapsAPIHandler from '../api/MapsAPIHandler';
import GeminiHandler from '../api/GeminiHandler';
import Brochure from '../data/Brochure';
import './Generator.css';

const API_BASE_URL = `http://localhost:${process.env.SERVER_PORT || 3003}`;

const Generator = () => {
    const [location, setLocation] = useState('');
    const [brochureData, setBrochureData] = useState(null);
    const [layouts, setLayouts] = useState([]);
    const [selectedLayout, setSelectedLayout] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState('');
    const [showJsonViewer, setShowJsonViewer] = useState(false);

    // Initialize API handlers
    const mapsHandler = new MapsAPIHandler(process.env.GOOGLE_MAPS_API_KEY);
    const geminiHandler = new GeminiHandler({
        apiKey: process.env.GEMINI_API_KEY,
        useLocalLLM: process.env.USE_LOCAL_LLM === 'true',
        localLLMEndpoint: process.env.LOCAL_LLM_URL || 'http://localhost:8000'
    });

    const updateProgress = (step, percent) => {
        setCurrentStep(step);
        setProgress(percent);
    };

    const generateBrochure = async () => {
        setIsLoading(true);
        setError(null);
        setProgress(0);
        
        try {
            // Step 1: Get location details from Maps API
            updateProgress('Getting location details...', 10);
            const locationDetails = await mapsHandler.getLocationDetails(location);
            const placeDetails = await mapsHandler.getPlaceDetails(locationDetails.place_id);
            
            // Step 2: Get nearby places
            updateProgress('Finding nearby attractions...', 20);
            const nearbyPlaces = await mapsHandler.getNearbyPlaces(locationDetails.geometry.location);

            // Step 3: Get scraped data for the location
            updateProgress('Loading scraped content...', 30);
            const scrapedDataResponse = await axios.get(`${API_BASE_URL}/api/scrape/locations`);
            const locationData = scrapedDataResponse.data.find(loc => 
                loc.name.toLowerCase() === location.toLowerCase()
            );

            if (!locationData) {
                throw new Error('No scraped data found for this location. Please scrape some websites first.');
            }

            // Step 4: Load all scraped sites for this location
            updateProgress('Processing scraped content...', 40);
            const scrapedSites = await Promise.all(
                locationData.sites.map(async site => {
                    const response = await axios.get(`${API_BASE_URL}/api/scrape/data/${encodeURIComponent(site.url)}`);
                    return response.data;
                })
            );

            // Step 5: Combine Maps API data with scraped content
            updateProgress('Combining data sources...', 50);
            const combinedData = {
                name: placeDetails.name,
                formatted_address: placeDetails.formatted_address,
                coordinates: locationDetails.geometry.location,
                placeTypes: placeDetails.types,
                rating: placeDetails.rating,
                officialPhotos: placeDetails.photos,
                nearbyAttractions: nearbyPlaces,
                scrapedContent: scrapedSites
            };

            // Step 6: Generate brochure content using Gemini or Local LLM
            updateProgress('Generating brochure content...', 60);
            const brochureContent = await geminiHandler.generateBrochureContent(combinedData);

            // Step 7: Process and analyze all available images
            updateProgress('Analyzing images...', 70);
            const allImages = [
                ...(placeDetails.photos || []),
                ...(nearbyPlaces.map(place => place.photos || []).flat()),
                ...scrapedSites.flatMap(site => site.images || [])
            ];
            const analyzedImages = await geminiHandler.analyzeImages(allImages);

            // Step 8: Generate layout suggestions
            updateProgress('Generating layout options...', 80);
            const layoutSuggestions = await geminiHandler.generateLayoutSuggestions(
                brochureContent,
                analyzedImages
            );

            // Step 9: Finalize brochure data
            updateProgress('Finalizing brochure...', 90);
            const finalBrochureData = {
                ...brochureContent,
                images: analyzedImages,
                maps: {
                    center: locationDetails.geometry.location,
                    nearbyPlaces: nearbyPlaces.map(place => ({
                        name: place.name,
                        location: place.geometry.location,
                        type: place.types[0]
                    }))
                }
            };

            setBrochureData(finalBrochureData);
            setLayouts(layoutSuggestions);
            setSelectedLayout(layoutSuggestions[0]); // Default to first layout
            updateProgress('Brochure ready!', 100);
        } catch (error) {
            console.error('Error generating brochure:', error);
            setError(error.message || 'Failed to generate brochure. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLayoutSelect = (layout) => {
        setSelectedLayout(layout);
    };

    const handleElementCustomization = async (element, feedback) => {
        try {
            const updatedElement = await geminiHandler.customizeElement(element, feedback);
            setBrochureData(prevData => ({
                ...prevData,
                [element.type]: updatedElement
            }));
        } catch (error) {
            console.error('Error customizing element:', error);
            setError('Failed to customize element. Please try again.');
        }
    };

    return (
        <div className="generator">
            <div className="input-section">
                <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter a location..."
                    className="location-input"
                />
                <button 
                    onClick={generateBrochure}
                    disabled={isLoading || !location}
                    className="generate-button"
                >
                    {isLoading ? 'Generating...' : 'Generate Brochure'}
                </button>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {isLoading && (
                <div className="generation-progress">
                    <div className="progress-bar">
                        <div 
                            className="progress-fill"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="current-step">{currentStep}</div>
                </div>
            )}

            {layouts.length > 0 && (
                <div className="layout-selector">
                    <h3>Select a Layout</h3>
                    <div className="layout-options">
                        {layouts.map((layout, index) => (
                            <div
                                key={index}
                                className={`layout-option ${selectedLayout === layout ? 'selected' : ''}`}
                                onClick={() => handleLayoutSelect(layout)}
                            >
                                <h4>{layout.name}</h4>
                                <p>{layout.description}</p>
                                <div className="layout-preview">
                                    {/* Add layout preview thumbnail here */}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {brochureData && selectedLayout && (
                <>
                    <div className="json-viewer-toggle">
                        <button 
                            className="toggle-button"
                            onClick={() => setShowJsonViewer(!showJsonViewer)}
                        >
                            {showJsonViewer ? 'Hide JSON Data' : 'Show JSON Data'}
                        </button>
                    </div>

                    {showJsonViewer && (
                        <div className="json-viewer">
                            <pre>
                                {JSON.stringify(brochureData, null, 2)}
                            </pre>
                        </div>
                    )}

                    <Brochure
                        locationData={brochureData}
                        layout={selectedLayout}
                        onElementSelect={(element) => {
                            const feedback = prompt('How would you like to customize this element?');
                            if (feedback) {
                                handleElementCustomization(element, feedback);
                            }
                        }}
                    />
                </>
            )}
        </div>
    );
};

export default Generator;