import axios from 'axios';
import logger from '../utils/debugLogger';
import WebScraperService from './WebScraperService';

const API_BASE_URL = `http://localhost:${process.env.SERVER_PORT || '3003'}/api`;

// Color schemes inspired by Super Mario Odyssey kingdoms
const KINGDOM_COLOR_SCHEMES = {
    urban: {
        primary: '#E60012', // Mario Red
        secondary: '#00A0E9', // Sky Blue
        accent: '#FFD700', // Gold
        background: '#FFFFFF',
        text: '#333333',
        highlights: ['#FF4B4B', '#4FC3F7', '#FFE082']
    },
    beach: {
        primary: '#00BCD4', // Cyan
        secondary: '#FFA726', // Orange
        accent: '#FFEB3B', // Yellow
        background: '#E3F2FD',
        text: '#01579B',
        highlights: ['#80DEEA', '#FFB74D', '#FFF176']
    },
    forest: {
        primary: '#4CAF50', // Green
        secondary: '#795548', // Brown
        accent: '#FFEB3B', // Yellow
        background: '#E8F5E9',
        text: '#1B5E20',
        highlights: ['#81C784', '#A1887F', '#FFF176']
    },
    desert: {
        primary: '#FFB300', // Amber
        secondary: '#F57C00', // Orange
        accent: '#FF5722', // Deep Orange
        background: '#FFF8E1',
        text: '#E65100',
        highlights: ['#FFD54F', '#FB8C00', '#FF7043']
    },
    snow: {
        primary: '#90CAF9', // Light Blue
        secondary: '#F5F5F5', // White
        accent: '#B388FF', // Purple
        background: '#E3F2FD',
        text: '#1A237E',
        highlights: ['#BBDEFB', '#FFFFFF', '#E1BEE7']
    },
    mountain: {
        primary: '#78909C', // Blue Grey
        secondary: '#8D6E63', // Brown
        accent: '#4DB6AC', // Teal
        background: '#ECEFF1',
        text: '#263238',
        highlights: ['#90A4AE', '#A1887F', '#80CBC4']
    }
};

// Location type keywords to help determine the environment
const LOCATION_KEYWORDS = {
    urban: ['city', 'metropolis', 'downtown', 'urban', 'capital', 'district'],
    beach: ['beach', 'coast', 'shore', 'seaside', 'ocean', 'bay', 'island'],
    forest: ['forest', 'park', 'woods', 'garden', 'jungle', 'botanical'],
    desert: ['desert', 'canyon', 'dunes', 'arid', 'mesa', 'valley'],
    snow: ['snow', 'ice', 'glacier', 'arctic', 'winter', 'ski'],
    mountain: ['mountain', 'hill', 'peak', 'alpine', 'summit', 'highlands']
};

// Search configuration
const SEARCH_CONFIG = {
    maxResults: process.env.MAX_SEARCH_RESULTS || 10,
    includeTypes: {
        travelGuides: true,
        newsArticles: true,
        blogs: true,
        officialSites: true
    },
    timeframe: 'any',
    language: 'en'
};

class BrochureService {
    /**
     * Search for relevant websites about a location
     * @param {string} location - The location to search for
     * @returns {Promise<Array>} - Array of search results
     */
    static async searchLocation(location) {
        try {
            logger.info('Starting location search', { location });
            const searchQueries = [
                `${location} travel guide tourism attractions`,
                `${location} culture history landmarks`,
                `${location} local customs traditions`
            ];

            const allResults = [];
            
            // Perform multiple searches with different queries
            for (const query of searchQueries) {
                logger.info('Executing search query', { query });
                const response = await axios.post(`${API_BASE_URL}/websearch`, {
                    query,
                    maxResults: SEARCH_CONFIG.maxResults,
                    filters: SEARCH_CONFIG.includeTypes
                });

                if (response.data.results) {
                    allResults.push(...response.data.results);
                }
            }

            logger.info('Search completed', { 
                totalResults: allResults.length,
                queries: searchQueries
            });

            // Deduplicate results based on URL
            const uniqueResults = Array.from(
                new Map(allResults.map(item => [item.url, item])).values()
            );

            // Rank and sort results
            const rankedResults = this.rankResults(uniqueResults, location);
            logger.info('Results ranked and sorted', { 
                uniqueResults: uniqueResults.length,
                rankedResults: rankedResults.length 
            });

            return rankedResults;
        } catch (error) {
            logger.error('Error searching location:', error);
            throw error;
        }
    }

    /**
     * Rank search results based on relevance
     * @param {Array} results - Array of search results
     * @param {string} location - The location being searched
     * @returns {Array} - Ranked results
     */
    static rankResults(results, location) {
        const locationTerms = location.toLowerCase().split(/\s+/);
        
        return results.map(result => {
            let score = 0;
            const content = `${result.title} ${result.snippet}`.toLowerCase();

            // Score based on content type
            switch (result.type) {
                case 'Travel Guide':
                    score += 5;
                    break;
                case 'Official Site':
                    score += 4;
                    break;
                case 'Blog':
                    score += 3;
                    break;
                case 'News Article':
                    score += 2;
                    break;
                default:
                    score += 1;
            }

            // Score based on location terms frequency
            locationTerms.forEach(term => {
                const regex = new RegExp(term, 'gi');
                const matches = content.match(regex);
                if (matches) {
                    score += matches.length;
                }
            });

            // Score based on URL authority
            if (result.url.includes('.gov')) score += 3;
            if (result.url.includes('.org')) score += 2;
            if (result.url.includes('tourism') || result.url.includes('travel')) score += 2;

            // Score based on content freshness
            if (result.date && result.date !== 'Unknown') {
                const date = new Date(result.date);
                const now = new Date();
                const monthsOld = (now - date) / (1000 * 60 * 60 * 24 * 30);
                if (monthsOld < 1) score += 3;
                else if (monthsOld < 6) score += 2;
                else if (monthsOld < 12) score += 1;
            }

            return { ...result, relevanceScore: score };
        }).sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    /**
     * Scrape selected URLs and merge their data
     * @param {Array} urls - Array of URLs to scrape
     * @returns {Promise<Object>} - Merged data object
     */
    static async scrapeAndMergeUrls(urls) {
        try {
            logger.info('Starting URL scraping', { urlCount: urls.length });
            
            // Use WebScraperService to handle scraping
            const scrapedData = await WebScraperService.scrapeAndEnsureUrls(urls);
            logger.info('All URLs processed', { count: scrapedData.length });

            // Merge the scraped data
            logger.info('Starting data merge');
            const mergedData = await this.mergeScrapedData(scrapedData);
            logger.info('Data merge completed');

            return mergedData;
        } catch (error) {
            logger.error('Error scraping and merging URLs:', error);
            throw error;
        }
    }

    /**
     * Merge data from multiple scraped files
     * @param {Array} files - Array of filenames
     * @returns {Promise<Object>} - Merged data object
     */
    static async mergeScrapedData(files) {
        const mergedData = {
            title: '',
            description: '',
            content: {
                overview: '',
                history: '',
                attractions: [],
                culture: '',
                practical: ''
            },
            images: [],
            stats: {
                totalSources: files.length,
                totalImages: 0,
                totalLinks: 0,
                contentSections: {
                    overview: 0,
                    history: 0,
                    attractions: 0,
                    culture: 0,
                    practical: 0
                }
            }
        };

        try {
            const contentSections = {
                overview: [],
                history: [],
                attractions: [],
                culture: [],
                practical: []
            };

            // Keywords for content categorization
            const categoryKeywords = {
                overview: ['overview', 'about', 'introduction', 'summary', 'description'],
                history: ['history', 'historical', 'ancient', 'founded', 'established', 'origin', 'past', 'century', 'era'],
                attractions: ['attraction', 'sight', 'landmark', 'monument', 'museum', 'park', 'garden', 'temple', 'shrine', 'palace', 'castle'],
                culture: ['culture', 'tradition', 'custom', 'festival', 'celebration', 'art', 'music', 'food', 'cuisine', 'local'],
                practical: ['transport', 'accommodation', 'hotel', 'restaurant', 'shopping', 'price', 'cost', 'ticket', 'schedule', 'hour', 'open']
            };

            for (const filename of files) {
                const response = await axios.get(`${API_BASE_URL}/scrape/${encodeURIComponent(filename)}`);
                const data = response.data;

                // Merge basic information
                if (!mergedData.title && data.title) {
                    mergedData.title = data.title;
                }
                if (!mergedData.description && data.description) {
                    mergedData.description = data.description;
                }

                // Process main content
                const paragraphs = data.mainContent.split(/\n\s*\n/); // Split by double newlines

                // Categorize each paragraph
                paragraphs.forEach(paragraph => {
                    if (paragraph.trim().length < 50) return; // Skip very short paragraphs

                    // Calculate relevance scores for each category
                    const scores = {};
                    for (const [category, keywords] of Object.entries(categoryKeywords)) {
                        scores[category] = this.calculateRelevanceScore(paragraph, keywords);
                    }

                    // Find the category with the highest score
                    const bestCategory = Object.entries(scores)
                        .reduce((a, b) => a[1] > b[1] ? a : b)[0];

                    if (scores[bestCategory] > 0) {
                        contentSections[bestCategory].push({
                            text: paragraph,
                            score: scores[bestCategory],
                            source: data.url
                        });
                        mergedData.stats.contentSections[bestCategory]++;
                    }
                });

                // Process and rank images
                data.images.forEach(image => {
                    if (!mergedData.images.some(img => img.src === image.src)) {
                        const imageScore = this.calculateImageRelevance(image, data.mainContent);
                        mergedData.images.push({
                            ...image,
                            relevanceScore: imageScore
                        });
                    }
                });

                // Update stats
                mergedData.stats.totalImages += data.stats.totalImages;
                mergedData.stats.totalLinks += data.stats.totalLinks;
            }

            // Process and merge content sections
            for (const [category, items] of Object.entries(contentSections)) {
                if (category === 'attractions') {
                    // For attractions, keep them as separate items
                    mergedData.content[category] = this.mergeAttractions(items);
                } else {
                    // For other categories, merge paragraphs into coherent text
                    mergedData.content[category] = this.mergeParagraphs(items);
                }
            }

            // Sort images by relevance
            mergedData.images.sort((a, b) => b.relevanceScore - a.relevanceScore);

            return mergedData;
        } catch (error) {
            console.error('Error merging scraped data:', error);
            throw error;
        }
    }

    /**
     * Calculate relevance score for a paragraph based on keywords
     * @param {string} text - The text to analyze
     * @param {Array} keywords - Keywords to look for
     * @returns {number} - Relevance score
     */
    static calculateRelevanceScore(text, keywords) {
        text = text.toLowerCase();
        let score = 0;

        keywords.forEach(keyword => {
            const regex = new RegExp(keyword, 'gi');
            const matches = text.match(regex);
            if (matches) {
                score += matches.length;
            }
        });

        // Normalize score based on text length
        return score / Math.sqrt(text.length);
    }

    /**
     * Calculate image relevance based on its context
     * @param {Object} image - The image object
     * @param {string} context - The surrounding text content
     * @returns {number} - Relevance score
     */
    static calculateImageRelevance(image, context) {
        let score = 0;

        // Score based on alt text
        if (image.alt && image.alt.length > 0) {
            score += 2;
            // Check if alt text appears in context
            if (context.toLowerCase().includes(image.alt.toLowerCase())) {
                score += 3;
            }
        }

        // Score based on filename relevance
        const filename = image.src.split('/').pop().toLowerCase();
        if (!filename.includes('banner') && !filename.includes('logo') && 
            !filename.includes('icon') && !filename.includes('button')) {
            score += 1;
        }

        // Penalize very small or very large images (if dimensions are available)
        if (image.width && image.height) {
            const area = image.width * image.height;
            if (area < 10000 || area > 4000000) { // Less than 100x100 or larger than 2000x2000
                score -= 2;
            }
        }

        return Math.max(0, score); // Ensure score is not negative
    }

    /**
     * Merge attraction items, removing duplicates and combining information
     * @param {Array} items - Array of attraction content items
     * @returns {Array} - Merged attractions
     */
    static mergeAttractions(items) {
        const attractions = new Map();

        items.forEach(item => {
            const text = item.text;
            // Try to extract attraction name from the first sentence
            const firstSentence = text.split('.')[0];
            const name = firstSentence.split(/[,()]/, 1)[0].trim();

            if (!attractions.has(name)) {
                attractions.set(name, {
                    name,
                    description: text,
                    score: item.score,
                    sources: [item.source]
                });
            } else {
                const existing = attractions.get(name);
                // If new description is more detailed, use it
                if (text.length > existing.description.length) {
                    existing.description = text;
                }
                existing.score += item.score;
                existing.sources.push(item.source);
            }
        });

        return Array.from(attractions.values())
            .sort((a, b) => b.score - a.score);
    }

    /**
     * Merge paragraphs into coherent text, removing duplicates
     * @param {Array} items - Array of content items
     * @returns {string} - Merged text
     */
    static mergeParagraphs(items) {
        // Sort by score
        const sortedItems = items.sort((a, b) => b.score - a.score);
        
        // Remove similar paragraphs (simple similarity check)
        const uniqueItems = sortedItems.filter((item, index) => {
            const text = item.text.toLowerCase();
            return !sortedItems.slice(0, index).some(prevItem => 
                this.calculateSimilarity(text, prevItem.text.toLowerCase()) > 0.7
            );
        });

        // Join paragraphs
        return uniqueItems.map(item => item.text).join('\n\n');
    }

    /**
     * Calculate similarity between two texts (simple Jaccard similarity)
     * @param {string} text1 - First text
     * @param {string} text2 - Second text
     * @returns {number} - Similarity score (0-1)
     */
    static calculateSimilarity(text1, text2) {
        const words1 = new Set(text1.split(/\s+/));
        const words2 = new Set(text2.split(/\s+/));
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        return intersection.size / union.size;
    }

    static async determineColorScheme(location, data) {
        try {
            // Extract relevant text for analysis
            const textToAnalyze = [
                location.toLowerCase(),
                data.description?.toLowerCase() || '',
                data.climate?.toLowerCase() || '',
                data.environment?.toLowerCase() || '',
                ...(data.keywords || []).map(k => k.toLowerCase())
            ].join(' ');

            // Count matches for each environment type
            const matchCounts = Object.entries(LOCATION_KEYWORDS).reduce((acc, [type, keywords]) => {
                const count = keywords.reduce((sum, keyword) => 
                    sum + (textToAnalyze.match(new RegExp(keyword, 'g')) || []).length, 0
                );
                return { ...acc, [type]: count };
            }, {});

            // Find the environment type with the most matches
            const [dominantType] = Object.entries(matchCounts)
                .sort(([,a], [,b]) => b - a)[0];

            // Default to urban if no clear match
            return KINGDOM_COLOR_SCHEMES[dominantType] || KINGDOM_COLOR_SCHEMES.urban;
        } catch (error) {
            console.error('Error determining color scheme:', error);
            return KINGDOM_COLOR_SCHEMES.urban; // Fallback to urban theme
        }
    }

    static async generateBrochure(data, template) {
        try {
            // Extract and organize content from merged data
            const content = await this.organizeContent(data);

            // Apply template layout rules
            const layout = await this.applyTemplateLayout(content, template);

            // Generate sections based on template
            const sections = await this.generateSections(content, template);

            // Combine everything into the final brochure
            return {
                layout,
                sections,
                styling: template.styling,
                metadata: {
                    location: data.location,
                    generated: new Date().toISOString(),
                    sources: data.sources
                }
            };
        } catch (error) {
            console.error('Error generating brochure:', error);
            throw new Error('Failed to generate brochure');
        }
    }

    static async organizeContent(data) {
        // Organize and categorize the content
        return {
            title: data.title,
            subtitle: await this.generateSubtitle(data),
            highlights: this.extractHighlights(data),
            attractions: this.categorizeAttractions(data),
            activities: this.extractActivities(data),
            quickFacts: this.extractQuickFacts(data),
            travelTips: this.extractTravelTips(data),
            images: this.selectImages(data),
            mapData: data.mapData
        };
    }

    static async applyTemplateLayout(content, template) {
        const { layout } = template;
        
        // Apply layout rules while maintaining Super Mario Odyssey style
        return {
            header: {
                ...layout.header,
                heroImage: content.images.hero,
                title: content.title,
                subtitle: content.subtitle
            },
            body: {
                ...layout.body,
                sections: layout.body.sections.map(section => ({
                    ...section,
                    content: content[section.name]?.slice(0, section.maxItems)
                }))
            },
            sidebar: {
                ...layout.sidebar,
                sections: layout.sidebar.sections.map(section => ({
                    ...section,
                    content: content[section.name]
                }))
            },
            footer: {
                ...layout.footer,
                map: content.mapData,
                contactInfo: content.quickFacts.contact
            }
        };
    }

    static async generateSubtitle(data) {
        try {
            // Prepare context from the scraped data
            const context = {
                location: data.title || '',
                description: data.description || '',
                attractions: (data.attractions || []).map(a => a.name),
                climate: data.quickFacts?.climate || '',
                culture: data.content?.culture || '',
                activities: (data.activities || []).map(a => a.name),
                environment: Object.entries(LOCATION_KEYWORDS)
                    .find(([type, keywords]) => 
                        keywords.some(keyword => 
                            data.description?.toLowerCase().includes(keyword)
                        )
                    )?.[0]
            };

            // Make API call to generate subtitle
            const response = await axios.post(`${API_BASE_URL}/generate/subtitle`, {
                context,
                style: {
                    tone: "enthusiastic",
                    format: "Super Mario Odyssey style",
                    requirements: [
                        "Should be catchy and memorable",
                        "Should highlight unique features of the location",
                        "Should maintain a sense of adventure and excitement",
                        "Should be concise (max 40 characters)",
                        "Should end with an exclamation mark"
                    ]
                }
            });

            if (response.data && response.data.subtitle) {
                return response.data.subtitle;
            }

            // Fallback to environment-based subtitle if API call fails
            const envPhrases = {
                urban: "Where City Dreams Come True!",
                beach: "Paradise Found on Golden Shores!",
                forest: "Adventure Through Nature's Wonder!",
                desert: "Discover Desert Magic!",
                snow: "A Winter Wonderland Awaits!",
                mountain: "Peak Adventures Above the Clouds!",
                default: "Your Next Great Adventure Awaits!"
            };

            return envPhrases[context.environment] || envPhrases.default;

        } catch (error) {
            console.error('Error generating subtitle:', error);
            return "A World of Wonder!"; // Safe fallback
        }
    }

    static extractHighlights(data) {
        // Extract and format main highlights
        return (data.highlights || [])
            .slice(0, 4)
            .map(highlight => ({
                title: highlight.title,
                description: highlight.description,
                image: highlight.image,
                icon: this.selectIconForHighlight(highlight)
            }));
    }

    static categorizeAttractions(data) {
        // Categorize and format attractions
        return (data.attractions || []).map(attraction => ({
            name: attraction.name,
            category: attraction.category,
            description: attraction.description,
            rating: attraction.rating,
            image: attraction.image,
            icon: this.selectIconForAttraction(attraction)
        }));
    }

    static extractActivities(data) {
        // Extract and format activities
        return (data.activities || []).map(activity => ({
            name: activity.name,
            duration: activity.duration,
            difficulty: activity.difficulty,
            description: activity.description,
            image: activity.image,
            icon: this.selectIconForActivity(activity)
        }));
    }

    static extractQuickFacts(data) {
        // Extract and format quick facts
        return {
            climate: data.climate,
            bestTime: data.bestTimeToVisit,
            language: data.language,
            currency: data.currency,
            transport: data.transportation,
            contact: data.contactInfo
        };
    }

    static extractTravelTips(data) {
        // Extract and format travel tips
        return (data.travelTips || []).map(tip => ({
            title: tip.title,
            content: tip.content,
            icon: this.selectIconForTip(tip)
        }));
    }

    static selectImages(data) {
        // Select and organize images
        return {
            hero: this.findBestHeroImage(data.images),
            gallery: this.selectGalleryImages(data.images),
            thumbnails: this.selectThumbnails(data.images)
        };
    }

    static selectIconForHighlight(highlight) {
        // Select appropriate icon based on highlight type
        const iconMap = {
            landmark: '🏛️',
            nature: '🌳',
            culture: '🎭',
            food: '🍽️',
            shopping: '🛍️',
            entertainment: '🎪',
            history: '📜',
            art: '🎨',
            default: '⭐'
        };
        return iconMap[highlight.type] || iconMap.default;
    }

    static selectIconForAttraction(attraction) {
        // Select appropriate icon based on attraction category
        const iconMap = {
            museum: '🏛️',
            park: '🌳',
            monument: '🗽',
            theater: '🎭',
            restaurant: '🍽️',
            market: '🏪',
            temple: '⛩️',
            church: '⛪',
            castle: '🏰',
            beach: '🏖️',
            mountain: '⛰️',
            lake: '🌊',
            zoo: '🦁',
            amusement: '🎡',
            sports: '🏟️',
            default: '📍'
        };
        return iconMap[attraction.category?.toLowerCase()] || iconMap.default;
    }

    static selectIconForActivity(activity) {
        // Select appropriate icon based on activity type
        const iconMap = {
            hiking: '🥾',
            swimming: '🏊',
            shopping: '🛍️',
            sightseeing: '📸',
            dining: '🍽️',
            touring: '🚶',
            cycling: '🚲',
            boating: '⛵',
            skiing: '⛷️',
            surfing: '🏄',
            climbing: '🧗',
            camping: '⛺',
            default: '🎯'
        };
        return iconMap[activity.type?.toLowerCase()] || iconMap.default;
    }

    static selectIconForTip(tip) {
        // Select appropriate icon based on tip category
        const iconMap = {
            transport: '🚌',
            safety: '⚠️',
            weather: '🌤️',
            money: '💰',
            language: '💬',
            customs: '🤝',
            timing: '⏰',
            packing: '🎒',
            food: '🍴',
            accommodation: '🏨',
            default: '💡'
        };
        return iconMap[tip.category?.toLowerCase()] || iconMap.default;
    }

    static async findBestHeroImage(images) {
        try {
            // Filter for landscape-oriented images with good resolution
            const suitable = images.filter(img => {
                const ratio = img.width / img.height;
                return (
                    ratio >= 1.5 && // Landscape orientation
                    img.width >= 1200 && // Minimum width
                    !img.isLogo && // Not a logo
                    !img.containsText && // Minimal text overlay
                    img.quality >= 0.7 // Good quality score
                );
            });

            // Sort by a combination of factors
            return suitable.sort((a, b) => {
                const scoreA = this.calculateImageScore(a);
                const scoreB = this.calculateImageScore(b);
                return scoreB - scoreA;
            })[0] || images[0]; // Fallback to first image if no suitable ones found
        } catch (error) {
            console.error('Error finding hero image:', error);
            return images[0]; // Fallback to first image
        }
    }

    static calculateImageScore(image) {
        // Calculate a score based on various factors
        const factors = {
            resolution: image.width * image.height,
            quality: image.quality * 100,
            colorfulness: image.colorfulness || 50,
            prominence: image.prominence || 50,
            isScenic: image.isScenic ? 20 : 0
        };

        return Object.values(factors).reduce((sum, value) => sum + value, 0);
    }

    static async selectGalleryImages(images, count = 6) {
        try {
            // Filter for good quality images that aren't the hero
            const suitable = images.filter(img => 
                img.quality >= 0.6 && 
                !img.isLogo && 
                img.width >= 800
            );

            // Group images by content type
            const grouped = this.groupImagesByContent(suitable);

            // Select a diverse set of images
            return this.selectDiverseImages(grouped, count);
        } catch (error) {
            console.error('Error selecting gallery images:', error);
            return images.slice(0, count); // Fallback to first n images
        }
    }

    static groupImagesByContent(images) {
        // Group images into categories
        return images.reduce((acc, img) => {
            const category = img.category || 'other';
            if (!acc[category]) acc[category] = [];
            acc[category].push(img);
            return acc;
        }, {});
    }

    static selectDiverseImages(groupedImages, count) {
        const selected = [];
        const categories = Object.keys(groupedImages);
        
        // Ensure we get at least one image from each major category
        categories.forEach(category => {
            if (selected.length < count && groupedImages[category].length > 0) {
                // Sort by quality within category and take the best
                const best = groupedImages[category]
                    .sort((a, b) => b.quality - a.quality)[0];
                selected.push(best);
                groupedImages[category] = groupedImages[category].slice(1);
            }
        });

        // Fill remaining slots with best remaining images
        while (selected.length < count) {
            let bestScore = -1;
            let bestImage = null;

            categories.forEach(category => {
                if (groupedImages[category].length > 0) {
                    const image = groupedImages[category][0];
                    const score = this.calculateImageScore(image);
                    if (score > bestScore) {
                        bestScore = score;
                        bestImage = image;
                    }
                }
            });

            if (!bestImage) break;
            selected.push(bestImage);
            const category = bestImage.category || 'other';
            groupedImages[category] = groupedImages[category].slice(1);
        }

        return selected;
    }

    static async selectThumbnails(images, count = 12) {
        try {
            // Filter for images suitable for thumbnails
            const suitable = images.filter(img => 
                img.width >= 400 && 
                img.quality >= 0.5 && 
                !img.isLogo
            );

            // Sort by a combination of quality and diversity
            const sorted = suitable.sort((a, b) => {
                const scoreA = this.calculateThumbnailScore(a);
                const scoreB = this.calculateThumbnailScore(b);
                return scoreB - scoreA;
            });

            // Ensure diversity in the selection
            return this.ensureDiverseThumbnails(sorted, count);
        } catch (error) {
            console.error('Error selecting thumbnails:', error);
            return images.slice(0, count); // Fallback to first n images
        }
    }

    static calculateThumbnailScore(image) {
        return (
            (image.quality * 0.4) +
            (image.prominence * 0.3) +
            (image.colorfulness * 0.2) +
            (image.isScenic ? 0.1 : 0)
        ) * 100;
    }

    static ensureDiverseThumbnails(images, count) {
        const selected = [];
        const categories = new Set(images.map(img => img.category));
        
        // First, select one from each category
        categories.forEach(category => {
            if (selected.length < count) {
                const categoryImage = images.find(img => 
                    img.category === category && 
                    !selected.includes(img)
                );
                if (categoryImage) selected.push(categoryImage);
            }
        });

        // Fill remaining slots with best remaining images
        while (selected.length < count && images.length > selected.length) {
            const remaining = images.filter(img => !selected.includes(img));
            if (remaining.length === 0) break;
            selected.push(remaining[0]);
        }

        return selected;
    }

    static async generateSections(content, template) {
        // Generate sections based on template configuration
        const sections = {};

        for (const section of template.layout.body.sections) {
            sections[section.name] = await this.formatSection(
                content[section.name],
                section.style,
                section.maxItems
            );
        }

        return sections;
    }

    static async formatSection(content, style, maxItems) {
        if (!content) return null;

        switch (style) {
            case 'cards':
                return this.formatCardsSection(content, maxItems);
            case 'list':
                return this.formatListSection(content, maxItems);
            case 'grid':
                return this.formatGridSection(content, maxItems);
            case 'icons':
                return this.formatIconsSection(content);
            case 'bullets':
                return this.formatBulletsSection(content);
            default:
                return content;
        }
    }

    static formatCardsSection(content, maxItems) {
        return content
            .slice(0, maxItems)
            .map(item => ({
                ...item,
                layout: 'card',
                aspectRatio: '4:3'
            }));
    }

    static formatListSection(content, maxItems) {
        return content
            .slice(0, maxItems)
            .map(item => ({
                ...item,
                layout: 'list-item',
                showImage: true
            }));
    }

    static formatGridSection(content, maxItems) {
        return content
            .slice(0, maxItems)
            .map(item => ({
                ...item,
                layout: 'grid-item',
                aspectRatio: '1:1'
            }));
    }

    static formatIconsSection(content) {
        return Object.entries(content).map(([key, value]) => ({
            key,
            value,
            icon: this.selectIconForFact(key)
        }));
    }

    static formatBulletsSection(content) {
        return content.map(item => ({
            ...item,
            layout: 'bullet',
            icon: this.selectIconForTip(item)
        }));
    }

    static selectIconForFact(factKey) {
        const iconMap = {
            climate: '🌡️',
            bestTime: '📅',
            language: '💬',
            currency: '💰',
            transport: '🚌',
            contact: '📞'
        };
        return iconMap[factKey] || '📌';
    }
}

export default BrochureService; 