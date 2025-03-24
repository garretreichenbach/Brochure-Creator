import axios from 'axios';
import logger from '../utils/debugLogger';

const API_BASE_URL = `http://localhost:${process.env.SERVER_PORT || '3003'}/api`;

class WebScraperService {
    /**
     * Scrape a single URL and save its data
     * @param {string} url - The URL to scrape
     * @param {string} location - Optional location name for categorization
     * @returns {Promise<Object>} - The scraped and saved data
     */
    static async scrapeUrl(url, location = 'debug') {
        try {
            logger.info('Starting URL scrape', { url, location });
            
            const response = await axios.post(`${API_BASE_URL}/scrape/save`, {
                url,
                location,
                data: { source: 'brochure-generator' }
            });

            if (response.data.message === 'Data saved successfully') {
                logger.info('Successfully scraped URL', { 
                    url,
                    stats: response.data.stats 
                });
                return response.data;
            } else {
                throw new Error('Scrape did not complete successfully');
            }
        } catch (error) {
            logger.error('Failed to scrape URL', { url, error: error.message });
            throw error;
        }
    }

    /**
     * Get data for a previously scraped URL
     * @param {string} url - The URL to retrieve data for
     * @returns {Promise<Object>} - The scraped data
     */
    static async getScrapedData(url) {
        try {
            logger.info('Retrieving scraped data', { url });
            const encodedUrl = encodeURIComponent(url);
            const response = await axios.get(`${API_BASE_URL}/scrape/data/${encodedUrl}`);
            return response.data;
        } catch (error) {
            logger.error('Failed to retrieve scraped data', { url, error: error.message });
            throw error;
        }
    }

    /**
     * Get list of all scraped URLs
     * @returns {Promise<Array>} - List of scraped URLs and their metadata
     */
    static async getScrapedUrls() {
        try {
            logger.info('Retrieving list of scraped URLs');
            const response = await axios.get(`${API_BASE_URL}/scrape/list`);
            return response.data;
        } catch (error) {
            logger.error('Failed to retrieve scraped URLs list', { error: error.message });
            throw error;
        }
    }

    /**
     * Get list of all scraped locations
     * @returns {Promise<Array>} - List of locations and their scraped data
     */
    static async getScrapedLocations() {
        try {
            logger.info('Retrieving scraped locations');
            const response = await axios.get(`${API_BASE_URL}/scrape/locations`);
            return response.data;
        } catch (error) {
            logger.error('Failed to retrieve scraped locations', { error: error.message });
            throw error;
        }
    }

    /**
     * Delete scraped data for specific locations
     * @param {Array<string>} locations - Array of location names to delete
     * @returns {Promise<void>}
     */
    static async deleteLocations(locations) {
        try {
            logger.info('Deleting scraped locations', { locations });
            await axios.post(`${API_BASE_URL}/scrape/delete`, { locations });
            logger.info('Successfully deleted locations', { locations });
        } catch (error) {
            logger.error('Failed to delete locations', { locations, error: error.message });
            throw error;
        }
    }

    /**
     * Scrape multiple URLs and ensure data is available
     * @param {Array<string>} urls - Array of URLs to scrape
     * @param {string} location - Optional location name for categorization
     * @returns {Promise<Array>} - Array of scraped data
     */
    static async scrapeAndEnsureUrls(urls, location = 'debug') {
        const scrapedData = [];
        logger.info('Processing multiple URLs', { count: urls.length, location });

        for (const url of urls) {
            try {
                // Try to get existing data first
                try {
                    const data = await this.getScrapedData(url);
                    logger.info('Found existing data', { url });
                    scrapedData.push(data);
                    continue;
                } catch (error) {
                    if (error.response?.status === 404) {
                        // If data not found, scrape and save it
                        logger.info('No existing data found, scraping new data', { url });
                        const saveResult = await this.scrapeUrl(url, location);
                        const savedData = await this.getScrapedData(url);
                        scrapedData.push(savedData);
                    } else {
                        throw error; // Re-throw other errors
                    }
                }
            } catch (error) {
                logger.error('Failed to process URL', { url, error: error.message });
                throw new Error(`Failed to process ${url}: ${error.message}`);
            }
        }

        return scrapedData;
    }

    /**
     * Check if a URL has already been scraped
     * @param {string} url - The URL to check
     * @returns {Promise<boolean>} - Whether the URL has been scraped
     */
    static async isUrlScraped(url) {
        try {
            await this.getScrapedData(url);
            return true;
        } catch (error) {
            if (error.response?.status === 404) {
                return false;
            }
            throw error;
        }
    }
}

export default WebScraperService; 