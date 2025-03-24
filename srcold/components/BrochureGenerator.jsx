import React, { useState } from 'react';
import BrochureService from '../services/BrochureService';
import SelectedSources from './SelectedSources';
import './BrochureGenerator.css';
import axios from 'axios';
import logger from '../utils/debugLogger';

// Update API URL constant to use PORT instead of REACT_APP_API_URL
const API_BASE_URL = `http://localhost:${process.env.SERVER_PORT || 3003}`;

// Base templates inspired by Super Mario Odyssey brochures
const BROCHURE_TEMPLATES = {
    standard: {
        layout: {
            header: {
                height: '25%',
                style: 'banner', // full-width image with overlaid text
                elements: ['title', 'subtitle', 'hero-image']
            },
            body: {
                columns: 2,
                sections: [
                    {
                        name: 'highlights',
                        style: 'cards',
                        maxItems: 4
                    },
                    {
                        name: 'attractions',
                        style: 'list',
                        maxItems: 6
                    },
                    {
                        name: 'activities',
                        style: 'grid',
                        maxItems: 6
                    }
                ]
            },
            sidebar: {
                width: '30%',
                sections: [
                    {
                        name: 'quick-facts',
                        style: 'icons'
                    },
                    {
                        name: 'travel-tips',
                        style: 'bullets'
                    }
                ]
            },
            footer: {
                height: '15%',
                elements: ['map', 'contact-info']
            }
        },
        styling: {
            colorScheme: 'location-based', // will be determined based on location type
            typography: {
                headings: 'Playfair Display',
                body: 'Roboto'
            },
            iconStyle: 'rounded-square',
            borderStyle: 'wavy'
        }
    },
    compact: {
        // Alternative template for smaller brochures
        // ... similar structure but with different defaults
    }
};

const BrochureGenerator = ({ location, onComplete }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentStep, setCurrentStep] = useState('');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);
    const [searchResults, setSearchResults] = useState(null);
    const [selectedUrls, setSelectedUrls] = useState([]);
    const [sourcesConfirmed, setSourcesConfirmed] = useState(false);
    const [template, setTemplate] = useState(BROCHURE_TEMPLATES.standard);

    // Function to automatically select the most relevant sources
    const selectBestSources = (results) => {
        const sortedResults = [...results].sort((a, b) => b.relevanceScore - a.relevanceScore);
        const topN = process.env.MAX_SOURCES || 5;
        const bestSources = sortedResults.slice(0, topN);
        const urls = bestSources.map(result => result.url);
        setSelectedUrls(urls);
        return urls;
    };

    const handleSearch = async () => {
        if (!location) return;

        setIsGenerating(true);
        setError(null);
        setProgress(0);
        setCurrentStep('Searching for relevant websites...');
        setSourcesConfirmed(false);

        try {
            logger.info('Starting location search', { location });
            const results = await BrochureService.searchLocation(location);
            logger.info('Search completed', { resultCount: results.length });
            setSearchResults(results);
            selectBestSources(results);
            setCurrentStep('Found relevant websites');
            setProgress(25);
        } catch (error) {
            logger.error('Error searching:', error);
            setError(error.message || 'Failed to search for websites');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConfirmSources = () => {
        setSourcesConfirmed(true);
    };

    const handleGenerate = async () => {
        if (!location || !sourcesConfirmed || selectedUrls.length === 0) return;

        setIsGenerating(true);
        setError(null);
        setProgress(0);
        setCurrentStep('Initializing scraping process...');
        logger.info('Starting brochure generation', { location, selectedUrls });

        try {
            // Get the scraped data for each URL
            const totalUrls = selectedUrls.length;
            const scrapedData = [];
            
            // Process each URL sequentially to better track progress
            for (let i = 0; i < selectedUrls.length; i++) {
                const url = selectedUrls[i];
                try {
                    setCurrentStep(`Scraping website ${i + 1} of ${totalUrls}: ${url}`);
                    setProgress(Math.floor((i / totalUrls) * 50)); // First 50% for scraping
                    logger.info(`Processing URL ${i + 1}/${totalUrls}`, { url });

                    const encodedUrl = encodeURIComponent(url);
                    logger.log('Encoded URL:', encodedUrl);

                    // First try to get existing data
                    try {
                        logger.log('Attempting to get existing data');
                        const response = await axios.get(`${API_BASE_URL}/api/scrape/data/${encodedUrl}`);
                        logger.info('Found existing data', { url });
                        scrapedData.push(response.data);
                    } catch (error) {
                        if (error.response?.status === 404) {
                            setCurrentStep(`Scraping new content from ${url}...`);
                            logger.info('No existing data found, scraping new data', { url });
                            // If data not found, scrape and save it
                            const saveResponse = await axios.post(`${API_BASE_URL}/api/scrape/save`, {
                                url,
                                location,
                                data: {}
                            });
                            logger.info('Save response received', saveResponse.data);
                            
                            // After saving, get the saved data
                            const savedDataResponse = await axios.get(`${API_BASE_URL}/api/scrape/data/${encodedUrl}`);
                            logger.info('Retrieved saved data', { url });
                            scrapedData.push(savedDataResponse.data);
                        }
                        throw error; // Re-throw other errors
                    }
                } catch (error) {
                    logger.error(`Error processing ${url}:`, error);
                    if (error.response) {
                        logger.error('Error response:', error.response.data);
                    }
                    throw new Error(`Failed to process ${url}: ${error.message}`);
                }
            }

            setCurrentStep('Analyzing and merging content...');
            setProgress(60);
            logger.info('Starting content analysis and merge');

            // Process images from the scraped data
            setCurrentStep('Processing and analyzing images...');
            setProgress(70);
            logger.info('Starting image processing');

            const processImages = async (data, currentContext) => {
                if (!data.images || !Array.isArray(data.images)) return;

                const totalImages = data.images.length;
                logger.info('Processing images', { totalImages });

                for (let i = 0; i < data.images.length; i++) {
                    const image = data.images[i];
                    setCurrentStep(`Analyzing image ${i + 1} of ${totalImages}`);
                    setProgress(70 + Math.floor((i / totalImages) * 10)); // 70-80% progress

                    // Skip if no URL or tiny images
                    if (!image.url || (image.width && image.width < 300) || (image.height && image.height < 300)) {
                        continue;
                    }

                    // Clean the image object
                    const cleanedImage = {
                        url: image.url,
                        alt: image.alt || '',
                        title: image.title || '',
                        width: image.width || 0,
                        height: image.height || 0,
                        type: image.type || 'general',
                        quality: image.quality || 0.5,
                        caption: image.caption || '',
                        context: image.surroundingText || ''
                    };

                    try {
                        logger.info(`Processing image ${i + 1}/${totalImages}`, { 
                            url: image.url,
                            dimensions: `${image.width}x${image.height}`
                        });
                        // Get AI categorization for the image
                        const categorizationResponse = await axios.post(
                            `${API_BASE_URL}/api/categorize/image`,
                            {
                                image: cleanedImage,
                                location: location,
                                context: currentContext
                            }
                        );

                        const { categories, primaryCategory, isHighQuality, relevanceScore } = categorizationResponse.data;

                        // Update image with AI-generated metadata
                        const processedImage = {
                            ...cleanedImage,
                            categories,
                            primaryCategory,
                            isHighQuality,
                            relevanceScore,
                            quality: Math.max(cleanedImage.quality, relevanceScore)
                        };

                        // Add to hero images if it's high quality and primarily a hero shot
                        if (
                            processedImage.primaryCategory === 'HERO' &&
                            processedImage.isHighQuality &&
                            (processedImage.width >= 1200 || !processedImage.width) &&
                            (!processedImage.width || processedImage.width / processedImage.height >= 1.5)
                        ) {
                            mergedData.images.hero.push(processedImage);
                        }

                        // Add to attraction images if it shows attractions
                        if (processedImage.categories.some(cat => 
                            cat.type === 'ATTRACTION' && cat.confidence > 0.6
                        )) {
                            mergedData.images.attractions.push(processedImage);
                        }

                        // Add to activity images if it shows activities
                        if (processedImage.categories.some(cat => 
                            cat.type === 'ACTIVITY' && cat.confidence > 0.6
                        )) {
                            mergedData.images.activities.push(processedImage);
                        }

                        // Add cultural and food images to general category
                        if (processedImage.categories.some(cat => 
                            (cat.type === 'CULTURAL' || cat.type === 'FOOD') && 
                            cat.confidence > 0.6
                        )) {
                            mergedData.images.general.push(processedImage);
                        }
                    } catch (error) {
                        logger.error('Error categorizing image:', { error, imageUrl: image.url });
                        continue; // Skip to the next image if categorization fails
                    }
                }
            };

            // Process each scraped source
            setCurrentStep('Organizing content...');
            setProgress(80);
            logger.info('Starting content organization');

            const mergedData = {
                title: location,
                description: '',
                attractions: [],
                activities: [],
                images: {
                    hero: [],
                    attractions: [],
                    activities: [],
                    general: []
                },
                quickFacts: {
                    climate: '',
                    bestTime: '',
                    language: '',
                    transport: '',
                    fees: ''
                },
                content: {
                    overview: '',
                    culture: '',
                    history: '',
                    highlights: [],
                    tips: []
                }
            };

            for (const data of scrapedData) {
                if (!data.content) continue;

                // Merge overview and description
                if (data.content.overview) {
                    mergedData.description = mergedData.description 
                        ? `${mergedData.description} ${data.content.overview}`
                        : data.content.overview;
                }

                // Merge key features into attractions and activities
                if (data.content.keyFeatures) {
                    data.content.keyFeatures.forEach(feature => {
                        const item = {
                            name: feature.name,
                            description: feature.description,
                            type: feature.type
                        };

                        if (feature.type === 'LANDMARK') {
                            mergedData.attractions.push(item);
                        } else if (feature.type === 'ACTIVITY') {
                            mergedData.activities.push(item);
                        }
                    });
                }

                // Merge practical information
                if (data.content.practicalInfo) {
                    const { practicalInfo } = data.content;
                    mergedData.quickFacts.bestTime = mergedData.quickFacts.bestTime || practicalInfo.bestTimeToVisit;
                    mergedData.quickFacts.fees = mergedData.quickFacts.fees || practicalInfo.fees;
                }

                // Merge environmental context
                if (data.content.environmentalContext) {
                    const { environmentalContext } = data.content;
                    mergedData.quickFacts.climate = mergedData.quickFacts.climate || environmentalContext.climate;
                }

                // Merge cultural significance
                if (data.content.culturalSignificance) {
                    mergedData.content.culture = mergedData.content.culture
                        ? `${mergedData.content.culture} ${data.content.culturalSignificance}`
                        : data.content.culturalSignificance;
                }

                // Merge historical context
                if (data.content.historicalContext) {
                    mergedData.content.history = mergedData.content.history
                        ? `${mergedData.content.history} ${data.content.historicalContext}`
                        : data.content.historicalContext;
                }

                // Merge visitor experience
                if (data.content.visitorExperience) {
                    const { visitorExperience } = data.content;
                    
                    // Merge activities
                    if (visitorExperience.suggestedActivities) {
                        visitorExperience.suggestedActivities.forEach(activity => {
                            mergedData.activities.push({
                                name: activity,
                                type: 'ACTIVITY'
                            });
                        });
                    }

                    // Merge highlights
                    if (visitorExperience.highlights) {
                        mergedData.content.highlights.push(...visitorExperience.highlights);
                    }

                    // Merge tips
                    if (visitorExperience.tips) {
                        mergedData.content.tips.push(...visitorExperience.tips);
                    }
                }

                // Process images
                if (data.images && data.images.length > 0) {
                    await processImages(data, {
                        description: mergedData.description,
                        attractions: mergedData.attractions.map(a => a.name),
                        activities: mergedData.activities.map(a => a.name),
                        environment: data.content.environmentalContext
                    });
                }
            }

            // Clean up and deduplicate data
            mergedData.description = mergedData.description.substring(0, 500) + '...'; // Limit description length
            
            // Deduplicate attractions and activities by name
            const deduplicateByName = (items) => {
                const seen = new Set();
                return items.filter(item => {
                    const duplicate = seen.has(item.name);
                    seen.add(item.name);
                    return !duplicate;
                });
            };

            mergedData.attractions = deduplicateByName(mergedData.attractions).slice(0, 10);
            mergedData.activities = deduplicateByName(mergedData.activities).slice(0, 8);
            mergedData.content.highlights = Array.from(new Set(mergedData.content.highlights)).slice(0, 5);
            mergedData.content.tips = Array.from(new Set(mergedData.content.tips)).slice(0, 5);

            // Deduplicate images by URL and sort by quality/relevance
            const deduplicateImages = (images) => {
                return Array.from(
                    new Map(images.map(img => [img.url, img])).values()
                ).sort((a, b) => b.quality - a.quality);
            };

            mergedData.images = {
                hero: deduplicateImages(mergedData.images.hero).slice(0, 3),
                attractions: deduplicateImages(mergedData.images.attractions).slice(0, 20),
                activities: deduplicateImages(mergedData.images.activities).slice(0, 15),
                general: deduplicateImages(mergedData.images.general).slice(0, 30)
            };

            setCurrentStep('Generating final brochure layout...');
            setProgress(90);
            logger.info('Generating brochure layout');

            // Determine the environment type based on content
            const environment = determineEnvironmentType(mergedData.description);

            // Generate the subtitle with the merged data
            const subtitleResponse = await axios.post(`${API_BASE_URL}/api/generate/subtitle`, {
                context: {
                    location: mergedData.title,
                    description: mergedData.description,
                    attractions: mergedData.attractions.map(a => a.name),
                    activities: mergedData.activities.map(a => a.name),
                    climate: mergedData.quickFacts.climate,
                    culture: mergedData.content.culture,
                    environment: environment
                }
            });

            // Update the template with the generated subtitle and environment-based color scheme
            const customizedTemplate = {
                ...template,
                layout: {
                    ...template.layout,
                    header: {
                        ...template.layout.header,
                        title: mergedData.title,
                        subtitle: subtitleResponse.data.subtitle
                    }
                },
                styling: {
                    ...template.styling,
                    colorScheme: await BrochureService.determineColorScheme(location, mergedData)
                }
            };

            // Generate the final brochure
            setCurrentStep('Finalizing brochure...');
            logger.info('Finalizing brochure');
            const brochure = await BrochureService.generateBrochure(mergedData, customizedTemplate);
            setProgress(100);

            setCurrentStep('Brochure generation complete!');
            logger.info('Brochure generation completed successfully');

            if (onComplete) {
                onComplete(brochure);
            }
        } catch (error) {
            logger.error('Error in handleGenerate:', error);
            setError(error.message || 'Failed to generate brochure');
            setIsGenerating(false);
            setProgress(0);
            setCurrentStep('');
        }
    };

    // Helper function to determine environment type
    const determineEnvironmentType = (content) => {
        const environmentKeywords = {
            urban: ['city', 'metropolis', 'urban', 'downtown'],
            beach: ['beach', 'coast', 'ocean', 'sea', 'island'],
            forest: ['forest', 'jungle', 'woodland', 'rainforest'],
            desert: ['desert', 'dune', 'arid', 'oasis'],
            snow: ['snow', 'ice', 'glacier', 'arctic'],
            mountain: ['mountain', 'peak', 'alpine', 'hill']
        };

        const contentLower = content.toLowerCase();
        for (const [type, keywords] of Object.entries(environmentKeywords)) {
            if (keywords.some(keyword => contentLower.includes(keyword))) {
                return type;
            }
        }
        return 'urban'; // Default to urban if no specific environment is detected
    };

    const handleSourceSelect = (urls) => {
        setSelectedUrls(urls);
        setSourcesConfirmed(false); // Reset confirmation when selection changes
    };

    return (
        <div className="brochure-generator">
            <div className="button-group">
                <button 
                    className="search-button"
                    onClick={handleSearch}
                    disabled={isGenerating || !location}
                >
                    {isGenerating ? 'Searching...' : 'Search Sources'}
                </button>

                {searchResults && !sourcesConfirmed && (
                    <button 
                        className="confirm-button"
                        onClick={handleConfirmSources}
                        disabled={selectedUrls.length === 0}
                    >
                        Confirm Selection
                    </button>
                )}

                {sourcesConfirmed && (
                    <button 
                        className="generate-button"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                    >
                        {isGenerating ? 'Generating...' : 'Generate Brochure'}
                    </button>
                )}
            </div>

            {isGenerating && (
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

            {error && (
                <div className="error-message">
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
                            relevance: result.relevanceScore.toFixed(1)
                        }))}
                        onSourceSelect={handleSourceSelect}
                        initialSelectedUrls={selectedUrls}
                    />
                </div>
            )}
        </div>
    );
};

export default BrochureGenerator; 