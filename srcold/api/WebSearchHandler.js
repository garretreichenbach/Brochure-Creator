import axios from 'axios';

class WebSearchHandler {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
        this.baseUrl = 'https://www.googleapis.com/customsearch/v1';
    }

    /**
     * Format a date string for the search API
     * @param {string} timeframe - 'any', 'year', 'month', or 'week'
     * @returns {string} Formatted date string
     */
    formatDateRestrict(timeframe) {
        if (timeframe === 'any') return '';
        
        const now = new Date();
        switch (timeframe) {
            case 'year':
                now.setFullYear(now.getFullYear() - 1);
                break;
            case 'month':
                now.setMonth(now.getMonth() - 1);
                break;
            case 'week':
                now.setDate(now.getDate() - 7);
                break;
            default:
                return '';
        }
        return now.toISOString().split('T')[0];
    }

    /**
     * Build search query with filters
     * @param {string} baseQuery - The base search query
     * @param {Object} filters - Search filters
     * @returns {string} Complete search query
     */
    buildSearchQuery(baseQuery, filters) {
        const parts = [baseQuery];

        // Add content type filters
        if (filters.contentTypes) {
            const typeQueries = filters.contentTypes.map(type => {
                switch (type) {
                    case 'travelGuides':
                        return '(inurl:guide OR inurl:travel OR inurl:tourism)';
                    case 'newsArticles':
                        return '(inurl:news OR site:news.*)';
                    case 'blogs':
                        return '(inurl:blog OR site:*.blog.*)';
                    case 'officialSites':
                        return '(site:*.gov.* OR site:*.org.*)';
                    default:
                        return '';
                }
            }).filter(Boolean);

            if (typeQueries.length > 0) {
                parts.push(`(${typeQueries.join(' OR ')})`);
            }
        }

        // Add language filter
        if (filters.language && filters.language !== 'any') {
            parts.push(`lang:${filters.language}`);
        }

        return parts.join(' ');
    }

    /**
     * Perform a web search with the given parameters
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} Search results
     */
    async search(params) {
        try {
            const query = this.buildSearchQuery(params.query, params.filters);
            const dateRestrict = this.formatDateRestrict(params.filters.timeframe);

            const searchParams = {
                key: this.apiKey,
                cx: this.searchEngineId,
                q: query,
                num: params.maxResults || 10,
                ...(dateRestrict && { dateRestrict }),
                ...(params.filters.language !== 'any' && { lr: `lang_${params.filters.language}` })
            };

            const response = await axios.get(this.baseUrl, { params: searchParams });

            // Process and format the results
            return response.data.items.map(item => ({
                title: item.title,
                url: item.link,
                snippet: item.snippet,
                type: this.determineContentType(item),
                language: item.language || params.filters.language,
                date: item.pagemap?.metatags?.[0]?.['article:published_time'] || 
                      item.pagemap?.metatags?.[0]?.['date'] || 
                      'Unknown'
            }));
        } catch (error) {
            console.error('Web search error:', error);
            throw new Error(error.response?.data?.error?.message || 'Failed to perform web search');
        }
    }

    /**
     * Determine the content type of a search result
     * @param {Object} item - Search result item
     * @returns {string} Content type
     */
    determineContentType(item) {
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

    /**
     * Validate search parameters
     * @param {Object} params - Search parameters to validate
     * @throws {Error} If parameters are invalid
     */
    validateSearchParams(params) {
        if (!params.query || typeof params.query !== 'string' || !params.query.trim()) {
            throw new Error('Search query is required');
        }

        if (params.maxResults && (params.maxResults < 1 || params.maxResults > 50)) {
            throw new Error('maxResults must be between 1 and 50');
        }

        if (params.filters) {
            if (params.filters.timeframe && 
                !['any', 'year', 'month', 'week'].includes(params.filters.timeframe)) {
                throw new Error('Invalid timeframe filter');
            }

            if (params.filters.language && 
                !['en', 'ja', 'any'].includes(params.filters.language)) {
                throw new Error('Invalid language filter');
            }
        }
    }
}

export default WebSearchHandler; 