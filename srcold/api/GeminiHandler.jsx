import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

class GeminiHandler {
    constructor(config = {}) {
        this.useLocalLLM = config.useLocalLLM || false;
        this.localLLMEndpoint = config.localLLMEndpoint || 'http://localhost:8000';
        
        if (!this.useLocalLLM && config.apiKey) {
            this.genAI = new GoogleGenerativeAI(config.apiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
            this.visionModel = this.genAI.getGenerativeModel({ model: "gemini-pro-vision" });
        }
    }

    async generateContent(prompt, options = {}) {
        try {
            if (this.useLocalLLM) {
                const response = await axios.post(`${this.localLLMEndpoint}/generate`, {
                    prompt,
                    max_tokens: options.maxTokens || 1000,
                    temperature: options.temperature || 0.7
                });
                return response.data;
            } else {
                const result = await this.model.generateContent(prompt);
                const response = await result.response;
                return response.text();
            }
        } catch (error) {
            console.error('Error generating content:', error);
            throw error;
        }
    }

    /**
     * Analyze location data and generate brochure content
     * @param {Object} locationData - Data from Maps API
     * @param {Array} images - Array of image URLs or base64 strings
     * @returns {Promise<Object>} Structured brochure content
     */
    async generateBrochureContent(locationData) {
        try {
            const prompt = `Create a travel brochure content for ${locationData.name} in the style of the travel brochures from Super Mario Odyssey. 
                          Include the following sections:
                          1. Brief introduction and highlights
                          2. Key attractions and landmarks
                          3. Cultural significance
                          4. Local activities and experiences
                          5. Interesting facts
                          
                          Format the response as a JSON object with these sections as keys.
                          Make it fun and adventurous while maintaining accuracy.
                          
                          Location data to consider:
                          ${JSON.stringify(locationData, null, 2)}`;

            const response = await this.generateContent(prompt);
            return typeof response === 'string' ? JSON.parse(response) : response;
        } catch (error) {
            console.error('Error generating brochure content:', error);
            throw error;
        }
    }

    /**
     * Analyze images and generate descriptions
     * @param {Array} images - Array of image data
     * @returns {Promise<Array>} Array of image descriptions and relevance scores
     */
    async analyzeImages(images) {
        try {
            if (this.useLocalLLM) {
                const results = await Promise.all(images.map(async (image) => {
                    const response = await axios.post(`${this.localLLMEndpoint}/analyze-image`, {
                        image: image,
                        prompt: "Analyze this image for a travel brochure. Describe what's shown and rate its relevance for showcasing this location (1-10)."
                    });
                    return response.data;
                }));
                return results;
            } else {
                const results = await Promise.all(images.map(async (image) => {
                    const result = await this.visionModel.generateContent([
                        "Analyze this image for a travel brochure. Describe what's shown and rate its relevance for showcasing this location (1-10).",
                        image
                    ]);
                    const response = await result.response;
                    return response.text();
                }));
                return results;
            }
        } catch (error) {
            console.error('Error analyzing images:', error);
            throw error;
        }
    }

    /**
     * Generate layout suggestions based on content
     * @param {Object} content - Brochure content
     * @param {Array} images - Analyzed images with descriptions
     * @returns {Promise<Array>} Array of layout suggestions
     */
    async generateLayoutSuggestions(content, images) {
        try {
            const prompt = `Create 3 different layout suggestions for a travel brochure with the following content:
                          ${JSON.stringify(content)}
                          
                          Consider these images:
                          ${JSON.stringify(images)}
                          
                          Format each layout as a JSON object with:
                          1. Layout name
                          2. Section arrangement
                          3. Image placement
                          4. Color scheme (based on location theme)
                          5. Typography suggestions`;

            const response = await this.generateContent(prompt);
            return typeof response === 'string' ? JSON.parse(response) : response;
        } catch (error) {
            console.error('Error generating layout suggestions:', error);
            throw error;
        }
    }

    /**
     * Customize specific elements based on user feedback
     * @param {Object} element - Element to customize
     * @param {string} feedback - User feedback
     * @returns {Promise<Object>} Updated element suggestion
     */
    async customizeElement(element, feedback) {
        try {
            const prompt = `Modify this brochure element based on the following feedback:
                          Element: ${JSON.stringify(element)}
                          Feedback: ${feedback}
                          
                          Maintain the Super Mario Odyssey style while incorporating the requested changes.`;

            const response = await this.generateContent(prompt);
            return typeof response === 'string' ? JSON.parse(response) : response;
        } catch (error) {
            console.error('Error customizing element:', error);
            throw error;
        }
    }
}

export default GeminiHandler; 