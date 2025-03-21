const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;
const fsSync = require('fs');  // Add regular fs for createWriteStream
const path = require('path');
const cheerio = require('cheerio');
const stream = require('stream');
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3003;

// Configure CORS
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',') : 
        [`http://localhost:${process.env.PORT || 3004}`],
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json({ limit: '50mb' }));

// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, {
        query: req.query,
        params: req.params,
        body: req.method === 'POST' ? req.body : undefined
    });
    next();
});

// Serve static files from the working directory
app.use('/static', express.static(path.join(__dirname, '..', 'working')));

// Ensure working directory exists
const workingDir = path.join(__dirname, '..', 'working');
const scrapedataDir = path.join(workingDir, 'scrapedata');

// Define path for scrape index file
const scrapeIndexPath = path.join(workingDir, 'scrapeIndex.json');

async function ensureDirectories() {
    try {
        await fs.mkdir(workingDir, { recursive: true });
        await fs.mkdir(scrapedataDir, { recursive: true });
        
        // Check if scrape index exists, if not create it
        try {
            await fs.access(scrapeIndexPath);
        } catch (error) {
            // File doesn't exist, create it with default structure
            const defaultIndex = {
                locations: {},
                lastUpdated: new Date().toISOString()
            };
            await fs.writeFile(scrapeIndexPath, JSON.stringify(defaultIndex, null, 2));
            console.log('Created new scrape index file');
        }
        
        console.log('Working directories and files created successfully');
    } catch (error) {
        console.error('Error creating directories:', error);
    }
}

// Initialize directories and files
ensureDirectories();

// Validate environment variables
if (!process.env.GOOGLE_SEARCH_API_KEY || !process.env.GOOGLE_SEARCH_ENGINE_ID) {
    console.warn('Missing required environment variables: GOOGLE_SEARCH_API_KEY and/or GOOGLE_SEARCH_ENGINE_ID');
}

// Web search endpoint
app.post('/api/websearch', async (req, res, next) => {
    console.log('Handling websearch request');
    try {
        console.log('Received search request:', {
            query: req.body.query,
            filters: req.body.filters,
            maxResults: req.body.maxResults
        });

        const { query, maxResults, filters } = req.body;

        // Validate required parameters
        if (!query || !filters) {
            console.error('Missing required parameters:', { query, filters });
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Validate API key and search engine ID
        if (!process.env.GOOGLE_SEARCH_API_KEY || !process.env.GOOGLE_SEARCH_ENGINE_ID) {
            console.error('Missing API configuration');
            return res.status(500).json({ error: 'Search API not properly configured' });
        }

        // Configure search parameters for Google Custom Search API
        const searchParams = {
            key: process.env.GOOGLE_SEARCH_API_KEY,
            cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
            q: query,
            num: Math.min(maxResults || 10, 50),
            ...(filters.language && filters.language !== 'any' && { lr: `lang_${filters.language}` })
        };

        console.log('Making Google API request with params:', {
            ...searchParams,
            key: '[REDACTED]',
            cx: '[REDACTED]'
        });

        // Make request to Google Custom Search API
        const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: searchParams,
            timeout: 8000, // 8 second timeout
            headers: {
                'Referer': 'http://localhost:3004',
                'User-Agent': 'BrochureCreator/1.0'
            }
        });

        console.log('Received Google API response with status:', response.status);

        if (!response.data.items) {
            console.warn('No search results found');
            return res.json({ results: [] });
        }

        // Process and format the results
        const results = response.data.items.map(item => ({
            title: item.title,
            url: item.link,
            snippet: item.snippet,
            type: determineContentType(item),
            language: item.language || filters.language,
            date: item.pagemap?.metatags?.[0]?.['article:published_time'] || 
                  item.pagemap?.metatags?.[0]?.['date'] || 
                  'Unknown'
        }));

        console.log(`Processed ${results.length} search results`);
        res.json({ results });
    } catch (error) {
        console.error('Web search error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            stack: error.stack
        });
        
        if (error.response?.status === 403) {
            return res.status(403).json({ 
                error: 'API key invalid or quota exceeded',
                details: error.response.data.error?.message
            });
        }
        if (error.response?.status === 400) {
            return res.status(400).json({ 
                error: 'Invalid search parameters',
                details: error.response.data.error?.message
            });
        }
        if (error.code === 'ETIMEDOUT') {
            return res.status(504).json({ 
                error: 'Google API request timed out'
            });
        }
        
        next(error);
    }
});

// Helper function to determine content type
function determineContentType(item) {
    const url = item.link.toLowerCase();
    const title = item.title.toLowerCase();
    const snippet = item.snippet.toLowerCase();

    if (url.includes('guide') || url.includes('travel') || url.includes('tourism') ||
        title.includes('guide') || title.includes('travel guide')) {
        return 'Travel Guide';
    }

    if (url.includes('news') || url.includes('/article/') ||
        item.pagemap?.metatags?.[0]?.['og:type'] === 'article') {
        return 'News Article';
    }

    if (url.includes('blog') || url.includes('/posts/') ||
        item.pagemap?.metatags?.[0]?.['og:type'] === 'blog') {
        return 'Blog';
    }

    if (url.includes('.gov') || url.includes('.org') ||
        url.includes('official')) {
        return 'Official Site';
    }

    return 'Other';
}

// Helper function to create a safe directory/file name
function createSafeName(name) {
    return name
        .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .trim();
}

// Helper function to create a safe filename from a URL
function createSafeFileName(url, alt = 'image') {
    try {
        // Extract the filename from the URL
        const urlObj = new URL(url);
        let fileName = path.basename(urlObj.pathname);
        
        // If no filename in URL or it's too long, use alt text
        if (!fileName || fileName.length > 50) {
            fileName = alt;
        }
        
        // Remove file extension if present
        fileName = fileName.replace(/\.[^/.]+$/, '');
        
        // Sanitize the filename
        fileName = fileName
            .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace invalid chars with underscore
            .replace(/_+/g, '_') // Replace multiple underscores with single
            .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
        
        // Add timestamp and extension
        const timestamp = Date.now();
        const ext = path.extname(urlObj.pathname) || '.jpg';
        return `${fileName}_${timestamp}${ext}`;
    } catch (error) {
        console.error('Error creating safe filename:', error);
        return `image_${Date.now()}.jpg`;
    }
}

// Helper function to download an image
async function downloadImage(imageUrl, outputPath) {
    try {
        const response = await axios({
            url: imageUrl,
            method: 'GET',
            responseType: 'stream',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        // Only proceed if we got an image content type
        const contentType = response.headers['content-type'];
        if (!contentType || !contentType.startsWith('image/')) {
            throw new Error('Not an image');
        }

        // Ensure the output directory exists
        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        await pipeline(response.data, fsSync.createWriteStream(outputPath));
        return true;
    } catch (error) {
        console.error(`Error downloading image ${imageUrl}:`, error.message);
        return false;
    }
}

// Helper function to generate a unique, safe identifier for a website
function generateWebsiteId(url, title) {
    // Create a hash of the URL
    const urlHash = crypto.createHash('md5').update(url).digest('hex').slice(0, 8);
    
    // Create a safe version of the title (first 30 chars)
    const safeTitle = title
        ? createSafeName(title).slice(0, 30)
        : 'untitled';
    
    return `${safeTitle}_${urlHash}`;
}

// Helper function to analyze content with AI
async function analyzeContentWithAI(content, url, location, maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const prompt = `Analyze this webpage content about ${location} and structure it into meaningful sections.

Content to analyze:
Title: ${content.title}
Description: ${content.description}
Main Content: ${content.mainContent.substring(0, 5000)} // Limit content length to prevent token overflow

URL: ${url}

You MUST respond with ONLY valid JSON in the following format:
{
    "overview": "A concise overview of the location/attraction",
    "keyFeatures": [
        {
            "name": "Feature name",
            "description": "Brief description",
            "type": "LANDMARK | ACTIVITY | CULTURAL | NATURAL"
        }
    ],
    "historicalContext": "Historical background if relevant",
    "practicalInfo": {
        "bestTimeToVisit": "When to visit",
        "accessibility": "How to get there/accessibility info",
        "hours": "Opening hours if applicable",
        "fees": "Entry fees or costs if applicable"
    },
    "culturalSignificance": "Cultural importance and local customs",
    "environmentalContext": {
        "climate": "Climate information",
        "terrain": "Geographical features",
        "naturalFeatures": "Notable natural elements"
    },
    "visitorExperience": {
        "suggestedActivities": ["List of recommended activities"],
        "highlights": ["Key points of interest"],
        "tips": ["Useful visitor tips"]
    }
}

Requirements:
1. RESPOND ONLY WITH THE JSON. No other text.
2. Focus on factual, relevant information
3. Maintain original meaning but structure clearly
4. Include specific details when available
5. Keep descriptions concise but informative
6. If certain fields have no relevant information, use null
7. Ensure all text is properly escaped for JSON
8. Double-check that the response is valid JSON before sending`;

            const response = await axios.post(`${process.env.LOCAL_LLM_URL}/v1/chat/completions`, {
                messages: [
                    {
                        role: "system",
                        content: "You are a travel content analyzer. You MUST respond with ONLY valid JSON. No other text or explanations. Extract and structure relevant information from webpage content into organized, meaningful sections. Focus on accuracy and relevance."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 1000,
                stream: false
            });

            let analysisText = response.data.choices[0].message.content.trim();
            
            // Remove any potential markdown code block markers
            analysisText = analysisText.replace(/```json\n?|\n?```/g, '');
            
            // Try to find JSON content if there's any surrounding text
            const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysisText = jsonMatch[0];
            }

            try {
                const analysis = JSON.parse(analysisText);
                
                // Validate required fields
                const requiredFields = [
                    'overview',
                    'keyFeatures',
                    'historicalContext',
                    'practicalInfo',
                    'culturalSignificance',
                    'environmentalContext',
                    'visitorExperience'
                ];

                const missingFields = requiredFields.filter(field => !(field in analysis));
                if (missingFields.length > 0) {
                    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
                }

                // Validate nested objects
                if (!analysis.practicalInfo || typeof analysis.practicalInfo !== 'object') {
                    throw new Error('Invalid practicalInfo structure');
                }
                if (!analysis.environmentalContext || typeof analysis.environmentalContext !== 'object') {
                    throw new Error('Invalid environmentalContext structure');
                }
                if (!analysis.visitorExperience || typeof analysis.visitorExperience !== 'object') {
                    throw new Error('Invalid visitorExperience structure');
                }

                // Validate arrays
                if (!Array.isArray(analysis.keyFeatures)) {
                    throw new Error('keyFeatures must be an array');
                }

                return analysis;
            } catch (parseError) {
                console.error(`Attempt ${attempt}/${maxRetries} - Failed to parse LLM response as JSON:`, parseError);
                console.error('Raw response:', analysisText);
                lastError = parseError;
                
                if (attempt < maxRetries) {
                    console.log(`Retrying... (Attempt ${attempt + 1}/${maxRetries})`);
                    // Add a small delay before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    continue;
                }
            }
        } catch (error) {
            console.error(`Attempt ${attempt}/${maxRetries} - Error analyzing content with AI:`, error);
            lastError = error;
            
            if (attempt < maxRetries) {
                console.log(`Retrying... (Attempt ${attempt + 1}/${maxRetries})`);
                // Add a small delay before retrying
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
            }
        }
    }

    // If we get here, all retries failed
    throw new Error(`Failed to generate valid JSON after ${maxRetries} attempts. Last error: ${lastError.message}`);
}

// Helper function to load scrape index
async function loadScrapeIndex() {
    try {
        // Ensure the scrape index file exists
        try {
            await fs.access(scrapeIndexPath);
        } catch (error) {
            // Create default index if file doesn't exist
            const defaultIndex = {
                locations: {},
                lastUpdated: new Date().toISOString()
            };
            await fs.writeFile(scrapeIndexPath, JSON.stringify(defaultIndex, null, 2));
            return defaultIndex;
        }

        // Read and parse the index file
        const content = await fs.readFile(scrapeIndexPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Error loading scrape index:', error);
        // Return empty index on error
        return {
            locations: {},
            lastUpdated: new Date().toISOString()
        };
    }
}

// Helper function to save scrape index
async function saveScrapeIndex(index) {
    try {
        await fs.writeFile(scrapeIndexPath, JSON.stringify(index, null, 2));
    } catch (error) {
        console.error('Error saving scrape index:', error);
        throw error;
    }
}

// Helper function to update scrape index
async function updateScrapeIndex(locationName, siteId, data) {
    try {
        const index = await loadScrapeIndex();
        
        // Initialize location if it doesn't exist
        if (!index.locations[locationName]) {
            index.locations[locationName] = {
                sites: {},
                totalSize: 0,
                lastUpdated: new Date().toISOString()
            };
        }
        
        // Add or update site information
        index.locations[locationName].sites[siteId] = {
            url: data.url,
            title: data.title,
            scrapedAt: data.scrapedAt,
            path: path.join('scrapedata', locationName, siteId)
        };
        
        // Update last modified time
        index.lastUpdated = new Date().toISOString();
        index.locations[locationName].lastUpdated = new Date().toISOString();
        
        // Calculate and update total size
        const locationPath = path.join(scrapedataDir, locationName);
        try {
            index.locations[locationName].totalSize = await getDirectorySize(locationPath);
        } catch (error) {
            console.error(`Error calculating size for ${locationName}:`, error);
            index.locations[locationName].totalSize = 0;
        }
        
        await saveScrapeIndex(index);
    } catch (error) {
        console.error('Error updating scrape index:', error);
        throw error;
    }
}

// Helper function to remove from scrape index
async function removeFromScrapeIndex(locationName) {
    const index = await loadScrapeIndex();
    if (index.locations[locationName]) {
        delete index.locations[locationName];
        index.lastUpdated = new Date().toISOString();
        await saveScrapeIndex(index);
    }
}

// Helper function to normalize URLs
function normalizeUrl(url, baseUrl) {
    try {
        // Handle data URLs
        if (url.startsWith('data:')) {
            return url;
        }
        
        // Handle absolute URLs
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        
        // Handle protocol-relative URLs
        if (url.startsWith('//')) {
            return `https:${url}`;
        }
        
        // Handle root-relative URLs
        if (url.startsWith('/')) {
            const baseUrlObj = new URL(baseUrl);
            return `${baseUrlObj.protocol}//${baseUrlObj.host}${url}`;
        }
        
        // Handle relative URLs
        return new URL(url, baseUrl).href;
    } catch (error) {
        console.error('Error normalizing URL:', error);
        return url;
    }
}

// Modify the save endpoint to make location optional for debugging
app.post('/api/scrape/save', async (req, res) => {
    let siteDir = null;
    try {
        const { url, data } = req.body;
        let { location } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'Missing url' });
        }

        // For debugging purposes, use a default location if not provided
        if (!location) {
            location = 'debug';
            console.log('No location provided, using debug location');
        }

        // Create safe names for directories
        const safeLocationName = createSafeName(location);
        const locationDir = path.join(scrapedataDir, safeLocationName);

        // Fetch and parse the webpage
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });
        const html = response.data;
        const $ = cheerio.load(html);

        // Get the title and generate a unique website ID
        const title = $('title').text().trim();
        const websiteId = generateWebsiteId(url, title);
        siteDir = path.join(locationDir, websiteId);
        const imagesDir = path.join(siteDir, 'images');

        // Extract main content
        const mainContent = $('main, article, .content, #content').first().text().trim();
        const metaDescription = $('meta[name="description"]').attr('content') || '';
        
        // Clean and prepare content for analysis
        function cleanText(text) {
            return text
                .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
                .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
                .trim();
        }

        // Extract relevant content sections
        const contentSections = new Set();
        $('main, article, .content, #content, section, [role="main"]').each((_, elem) => {
            const text = $(elem).text().trim();
            if (text.length > 100) { // Only include substantial sections
                contentSections.add(cleanText(text));
            }
        });

        // Combine content for AI analysis, avoiding duplicates
        const uniqueContent = Array.from(contentSections).join('\n\n');
        const contentForAnalysis = {
            title,
            description: metaDescription,
            mainContent: uniqueContent.length > mainContent.length ? uniqueContent : mainContent
        };

        // Analyze content with AI
        console.log('Analyzing content with AI...');
        const contentAnalysis = await analyzeContentWithAI(contentForAnalysis, url, location);
        console.log('AI analysis complete');

        // Create directories only after successful content analysis
        await fs.mkdir(locationDir, { recursive: true });
        await fs.mkdir(imagesDir, { recursive: true });

        // Extract and download images
        const processedUrls = new Set();
        const imagePromises = [];

        $('img').each((i, elem) => {
            const src = $(elem).attr('src');
            if (src) {
                const normalizedSrc = normalizeUrl(src, response.request.res.responseUrl);
                if (!processedUrls.has(normalizedSrc)) {
                    processedUrls.add(normalizedSrc);
                    
                    const alt = $(elem).attr('alt') || '';
                    const width = $(elem).attr('width');
                    const height = $(elem).attr('height');
                    
                    // Generate a safe filename for the image
                    const safeImageName = createSafeFileName(normalizedSrc, alt);
                    const imagePath = path.join(imagesDir, safeImageName);
                    
                    // Add to download queue
                    imagePromises.push(
                        downloadImage(normalizedSrc, imagePath)
                            .then(success => {
                                if (success) {
                                    return {
                                        originalUrl: normalizedSrc,
                                        localPath: path.join('images', safeImageName),
                                        alt,
                                        width,
                                        height
                                    };
                                }
                                return null;
                            })
                    );
                }
            }
        });

        // Wait for all image downloads to complete
        const downloadedImages = (await Promise.allSettled(imagePromises))
            .filter(result => result.status === 'fulfilled' && result.value)
            .map(result => result.value);

        // Create the final structured data
        const pageData = {
            url,
            title,
            location,
            scrapedAt: new Date().toISOString(),
            content: contentAnalysis,
            images: downloadedImages,
            metadata: {
                originalDescription: metaDescription,
                totalImages: downloadedImages.length
            }
        };

        // Save the JSON data
        const dataFilePath = path.join(siteDir, 'data.json');
        await fs.writeFile(dataFilePath, JSON.stringify(pageData, null, 2));

        // After saving the data, update the index
        await updateScrapeIndex(safeLocationName, websiteId, pageData);

        res.json({ 
            message: 'Data and images saved successfully',
            location: safeLocationName,
            site: websiteId,
            stats: {
                totalImages: downloadedImages.length,
                contentSections: Object.keys(contentAnalysis).length
            }
        });
    } catch (error) {
        console.error('Error saving scraped data:', error);
        
        // Clean up incomplete scrape
        if (siteDir) {
            try {
                await fs.rm(siteDir, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error('Error cleaning up incomplete scrape:', cleanupError);
            }
        }
        
        res.status(500).json({ 
            error: 'Failed to save scraped data',
            details: error.message
        });
    }
});

// List saved scrape data
app.get('/api/scrape/list', async (req, res) => {
    try {
        const index = await loadScrapeIndex();
        
        // Get all unique site URLs from the index
        const sites = [];
        Object.entries(index.locations).forEach(([locationName, locationData]) => {
            if (locationData.sites) {
                Object.entries(locationData.sites).forEach(([siteId, siteData]) => {
                    sites.push({
                        url: siteData.url,
                        title: siteData.title,
                        location: locationName,
                        scrapedAt: siteData.scrapedAt
                    });
                });
            }
        });
        
        res.json(sites);
    } catch (error) {
        console.error('Error listing scraped data:', error);
        res.status(500).json({ error: 'Failed to list scraped data' });
    }
});

// Get specific scraped data
app.get('/api/scrape/:url', async (req, res) => {
    try {
        const encodedUrl = req.params.url;
        const decodedUrl = decodeURIComponent(encodedUrl);
        
        // Load the index
        const index = await loadScrapeIndex();
        
        // Search through all locations for the URL
        for (const [locationName, locationData] of Object.entries(index.locations)) {
            if (locationData.sites) {
                for (const [siteId, siteData] of Object.entries(locationData.sites)) {
                    if (siteData.url === decodedUrl) {
                        // Found the site, load its data
                        const dataPath = path.join(scrapedataDir, locationName, siteId, 'data.json');
                        try {
                            const content = await fs.readFile(dataPath, 'utf8');
                            const data = JSON.parse(content);
                            
                            // Update image paths to be absolute
                            if (data.images) {
                                data.images = data.images.map(img => ({
                                    ...img,
                                    localPath: path.join(scrapedataDir, locationName, siteId, img.localPath)
                                }));
                            }
                            
                            return res.json(data);
                        } catch (error) {
                            console.error(`Error reading data file for ${siteId}:`, error);
                            return res.status(500).json({ error: 'Failed to read site data' });
                        }
                    }
                }
            }
        }
        
        // If we get here, the URL wasn't found
        res.status(404).json({ error: 'Scraped data not found' });
    } catch (error) {
        console.error('Error reading scraped data:', error);
        res.status(500).json({ error: 'Failed to read scraped data' });
    }
});

// Delete specific scraped data
app.delete('/api/scrape/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filepath = path.join(scrapedataDir, filename);
        
        // Check if file exists
        try {
            await fs.access(filepath);
        } catch (err) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Delete the file
        await fs.unlink(filepath);
        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Error deleting scraped data:', error);
        res.status(500).json({ error: 'Failed to delete scraped data' });
    }
});

// Subtitle generation endpoint
app.post('/api/generate/subtitle', async (req, res) => {
    try {
        const { context, style } = req.body;

        // Validate that we have enough context data
        if (!context.location || !context.description) {
            return res.status(400).json({ 
                error: 'Missing required context data',
                details: 'Location and description are required'
            });
        }

        // Clean and prepare the context data
        const cleanContext = {
            location: context.location.trim(),
            description: context.description.trim(),
            attractions: (context.attractions || [])
                .filter(a => a && typeof a === 'string')
                .map(a => a.trim()),
            activities: (context.activities || [])
                .filter(a => a && typeof a === 'string')
                .map(a => a.trim()),
            climate: (context.climate || '').trim(),
            culture: (context.culture || '').trim(),
            environment: (context.environment || '').trim()
        };

        // Construct a more direct prompt for the LLM
        const prompt = `Create a short, catchy subtitle for ${cleanContext.location} in Super Mario Odyssey style.

Key Location Features:
${cleanContext.description ? `- ${cleanContext.description}` : ''}
${cleanContext.attractions.length ? `- Notable attractions: ${cleanContext.attractions.join(', ')}` : ''}
${cleanContext.activities.length ? `- Activities: ${cleanContext.activities.join(', ')}` : ''}
${cleanContext.climate ? `- Climate: ${cleanContext.climate}` : ''}
${cleanContext.culture ? `- Culture: ${cleanContext.culture}` : ''}
${cleanContext.environment ? `- Environment: ${cleanContext.environment}` : ''}

Requirements:
1. RESPOND ONLY WITH THE SUBTITLE TEXT
2. Must be under 40 characters
3. Must end with an exclamation mark
4. Must highlight a unique feature of ${cleanContext.location}
5. Must match Super Mario Odyssey's playful, adventurous style

Example format:
"Where Desert Dreams Take Flight!"
"A Tropical Paradise Awaits!"
"Kingdom of Ancient Wonders!"`;

        // Call the local LLM API with a more strict system message
        const response = await axios.post(`${process.env.LOCAL_LLM_URL}/v1/chat/completions`, {
            messages: [
                {
                    role: "system",
                    content: "You are a subtitle generator. You MUST respond with ONLY the subtitle text. No explanations, no conversation, just the subtitle. The subtitle must be short, catchy, and end with an exclamation mark."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 50,
            stream: false
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Extract and validate the generated subtitle
        let subtitle = response.data.choices[0].message.content.trim();
        
        // Remove any quotes that might be in the response
        subtitle = subtitle.replace(/["']/g, '');
        
        // Ensure it ends with an exclamation mark
        if (!subtitle.endsWith('!')) {
            subtitle += '!';
        }

        // Ensure it's not too long
        if (subtitle.length > 40) {
            subtitle = subtitle.substring(0, 39) + '!';
        }

        // Validate the generated subtitle
        if (subtitle.length < 5 || subtitle.includes('\n') || subtitle.toLowerCase().includes('subtitle')) {
            throw new Error('Invalid subtitle generated');
        }

        res.json({ subtitle });
    } catch (error) {
        console.error('Error generating subtitle:', error);
        res.status(500).json({ error: 'Failed to generate subtitle' });
    }
});

// Image categorization endpoint
app.post('/api/categorize/image', async (req, res) => {
    try {
        const { image, location, context } = req.body;

        // Construct the prompt for image categorization
        const prompt = `Analyze this image and its context for a travel brochure about ${location}.

Image Details:
- Title: ${image.title || 'N/A'}
- Alt Text: ${image.alt || 'N/A'}
- Caption: ${image.caption || 'N/A'}
- Surrounding Text: ${image.context || 'N/A'}
- Dimensions: ${image.width || '?'}x${image.height || '?'}

Location Context:
${context.description ? `- Location Description: ${context.description}` : ''}
${context.attractions?.length ? `- Key Attractions: ${context.attractions.join(', ')}` : ''}
${context.activities?.length ? `- Main Activities: ${context.activities.join(', ')}` : ''}

Task: Categorize this image into one or more of these categories:
1. HERO - Scenic/panoramic shots that capture the essence of ${location}
2. ATTRACTION - Images of specific landmarks or attractions
3. ACTIVITY - Images showing activities or experiences
4. CULTURAL - Images showcasing local culture, traditions, or customs
5. FOOD - Images of local cuisine or dining
6. GENERAL - Other relevant travel images

Requirements:
- Respond in JSON format only
- Include confidence score (0-1) for each assigned category
- Consider image context and relevance to ${location}
- Consider image quality and composition based on dimensions
- Multiple categories can be assigned if relevant

Example response format:
{
    "categories": [
        {"type": "HERO", "confidence": 0.9},
        {"type": "ATTRACTION", "confidence": 0.7}
    ],
    "primaryCategory": "HERO",
    "isHighQuality": true,
    "relevanceScore": 0.85
}`;

        // Call the local LLM API
        const response = await axios.post(`${process.env.LOCAL_LLM_URL}/v1/chat/completions`, {
            messages: [
                {
                    role: "system",
                    content: "You are an image categorization expert for travel brochures. You analyze image metadata and context to determine the best categories for each image. Respond only with valid JSON."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.3, // Lower temperature for more consistent categorization
            max_tokens: 150,
            stream: false
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Parse and validate the response
        let categorization = JSON.parse(response.data.choices[0].message.content);
        
        // Ensure the response has the required fields
        if (!categorization.categories || !categorization.primaryCategory) {
            throw new Error('Invalid categorization response format');
        }

        res.json(categorization);
    } catch (error) {
        console.error('Error categorizing image:', error);
        res.status(500).json({ error: 'Failed to categorize image' });
    }
});

// Get scraped data for a URL
app.get('/api/scrape/data/:url', async (req, res) => {
    try {
        const decodedUrl = decodeURIComponent(req.params.url);
        console.log('Looking for data for URL:', decodedUrl);
        
        // List all location directories
        const locations = await fs.readdir(scrapedataDir);
        console.log('Found locations:', locations);
        
        // Search through each location directory
        for (const location of locations) {
            const locationPath = path.join(scrapedataDir, location);
            const locationStat = await fs.stat(locationPath);
            
            // Skip if not a directory
            if (!locationStat.isDirectory()) {
                console.log('Skipping non-directory:', location);
                continue;
            }
            
            console.log('Searching in location:', location);
            const sites = await fs.readdir(locationPath);
            
            // Search through each site directory
            for (const site of sites) {
                const sitePath = path.join(locationPath, site);
                const siteStat = await fs.stat(sitePath);
                
                // Skip if not a directory
                if (!siteStat.isDirectory()) {
                    console.log('Skipping non-directory site:', site);
                    continue;
                }
                
                console.log('Checking site:', site);
                const dataPath = path.join(sitePath, 'data.json');
                
                try {
                    const content = await fs.readFile(dataPath, 'utf8');
                    const data = JSON.parse(content);
                    
                    if (data.url === decodedUrl) {
                        console.log('Found matching data in:', sitePath);
                        // Update image paths to be absolute
                        if (data.images) {
                            data.images = data.images.map(img => ({
                                ...img,
                                localPath: path.join(sitePath, img.localPath)
                            }));
                        }
                        return res.json(data);
                    }
                } catch (error) {
                    console.error(`Error reading data file in ${sitePath}:`, error);
                    // Continue to next site
                }
            }
        }
        
        console.log('No data found for URL:', decodedUrl);
        return res.status(404).json({ error: 'No scraped data found for this URL' });
    } catch (error) {
        console.error('Error getting scraped data:', error);
        res.status(500).json({ error: 'Failed to get scraped data' });
    }
});

// Helper function to get directory size
async function getDirectorySize(dirPath) {
    let totalSize = 0;
    const items = await fs.readdir(dirPath);
    
    for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
            totalSize += await getDirectorySize(itemPath);
        } else {
            totalSize += stats.size;
        }
    }
    
    return totalSize;
}

// Helper function to format file size
function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
}

// Update the locations endpoint to use the index
app.get('/api/scrape/locations', async (req, res) => {
    try {
        console.log('Loading scrape index from:', scrapeIndexPath);
        const index = await loadScrapeIndex();
        
        // If no locations exist yet, return empty array
        if (!index.locations || Object.keys(index.locations).length === 0) {
            console.log('No locations found in index');
            return res.json([]);
        }
        
        // Map the locations data to the expected format
        const locations = Object.entries(index.locations).map(([name, data]) => {
            const siteCount = data.sites ? Object.keys(data.sites).length : 0;
            return {
                name,
                sites: siteCount,
                totalSize: formatSize(data.totalSize || 0),
                lastUpdated: data.lastUpdated || data.scrapedAt || new Date().toISOString()
            };
        });
        
        console.log('Returning locations:', locations);
        res.json(locations);
    } catch (error) {
        console.error('Error getting locations:', error);
        res.status(500).json({ error: 'Failed to get locations', details: error.message });
    }
});

// Update the delete endpoint to update the index
app.post('/api/scrape/delete', async (req, res) => {
    try {
        const { locations } = req.body;
        
        if (!locations || !Array.isArray(locations)) {
            return res.status(400).json({ error: 'Invalid locations data' });
        }

        const deletePromises = locations.map(async (location) => {
            const locationPath = path.join(scrapedataDir, location);
            
            try {
                // Verify it's a directory before deleting
                const stats = await fs.stat(locationPath);
                if (!stats.isDirectory()) {
                    throw new Error('Not a directory');
                }

                // Delete all subdirectories and files
                const deleteDirectory = async (dirPath) => {
                    const items = await fs.readdir(dirPath);
                    
                    for (const item of items) {
                        const itemPath = path.join(dirPath, item);
                        const itemStats = await fs.stat(itemPath);
                        
                        if (itemStats.isDirectory()) {
                            await deleteDirectory(itemPath);
                            await fs.rmdir(itemPath);
                        } else {
                            await fs.unlink(itemPath);
                        }
                    }
                };

                await deleteDirectory(locationPath);
                await fs.rmdir(locationPath);
                
                // Remove from index
                await removeFromScrapeIndex(location);
                
                return { location, success: true };
            } catch (error) {
                console.error(`Error deleting location ${location}:`, error);
                return { location, success: false, error: error.message };
            }
        });

        const results = await Promise.all(deletePromises);
        const failures = results.filter(r => !r.success);

        if (failures.length > 0) {
            res.status(207).json({
                message: 'Some locations failed to delete',
                results
            });
        } else {
            res.json({
                message: 'All locations deleted successfully',
                results
            });
        }
    } catch (error) {
        console.error('Error deleting locations:', error);
        res.status(500).json({ error: 'Failed to delete locations' });
    }
});

// Error handling middleware - MOVED TO END
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Available routes:');
    console.log('- POST /api/websearch');
    console.log('- POST /api/scrape/save');
    console.log('- GET /api/scrape/list');
    console.log('- GET /api/scrape/:url');
    console.log('- DELETE /api/scrape/:filename');
    console.log('- POST /api/generate/subtitle');
    console.log('- POST /api/categorize/image');
    console.log('- GET /api/scrape/data/:url');
    console.log('- GET /api/scrape/locations');
    console.log('- POST /api/scrape/delete');
}); 