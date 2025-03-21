import axios from 'axios';

class GeminiHandler {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.useLocalLLM = config.useLocalLLM;
        this.endpoint = config.useLocalLLM ? config.localLLMEndpoint : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro';
    }

    async generateBrochureContent(locationData) {
        try {
            const prompt = `Create engaging travel brochure content for ${locationData.name}.

Location Details:
${JSON.stringify(locationData, null, 2)}

Requirements:
1. Create a structured brochure with the following sections:
   - Introduction (2-3 sentences)
   - Key Attractions (3-5 items)
   - Cultural Highlights (2-3 paragraphs)
   - Local Activities (4-6 items)
   - Fun Facts (3-5 items)

2. Style:
   - Engaging and enthusiastic tone
   - Highlight unique features
   - Include specific details from the location data
   - Keep descriptions concise but informative

3. Format:
   Return a JSON object with the following structure:
   {
       "name": "Location name",
       "formatted_address": "Full address",
       "introduction": "Introduction text",
       "attractions": [
           {
               "name": "Attraction name",
               "description": "Description",
               "image": "photo_reference or null"
           }
       ],
       "culture": "Cultural highlights text",
       "activities": [
           {
               "name": "Activity name",
               "description": "Description"
           }
       ],
       "facts": ["Fun fact 1", "Fun fact 2", ...]
   }`;

            if (this.useLocalLLM) {
                const response = await axios.post(`${this.endpoint}/v1/chat/completions`, {
                    messages: [
                        {
                            role: "system",
                            content: "You are a travel brochure content generator. Generate engaging, accurate content based on the provided location data. Respond only with the requested JSON structure."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1000
                });

                return JSON.parse(response.data.choices[0].message.content);
            } else {
                const response = await axios.post(this.endpoint, {
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1000
                    }
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                });

                return JSON.parse(response.data.candidates[0].content.parts[0].text);
            }
        } catch (error) {
            console.error('Error generating brochure content:', error);
            throw error;
        }
    }

    async analyzeImages(images) {
        try {
            const analyzedImages = await Promise.all(images.map(async (image) => {
                const prompt = `Analyze this image for a travel brochure:
                ${JSON.stringify(image, null, 2)}

                Provide analysis in JSON format:
                {
                    "type": "HERO | ATTRACTION | ACTIVITY | CULTURAL",
                    "quality": 0-1 score,
                    "relevance": 0-1 score,
                    "caption": "Suggested caption",
                    "tags": ["tag1", "tag2", ...]
                }`;

                const response = this.useLocalLLM ?
                    await this.callLocalLLM(prompt) :
                    await this.callGeminiAPI(prompt);

                const analysis = JSON.parse(response);
                return {
                    ...image,
                    ...analysis
                };
            }));

            return analyzedImages;
        } catch (error) {
            console.error('Error analyzing images:', error);
            throw error;
        }
    }

    async generateLayoutSuggestions(content, images) {
        try {
            const prompt = `Generate layout suggestions for a travel brochure with this content:
            ${JSON.stringify({ content, images }, null, 2)}

            Provide 3 layout options in JSON format:
            [
                {
                    "name": "Layout name",
                    "description": "Layout description",
                    "styles": {
                        // CSS-like styles object
                    }
                }
            ]`;

            const response = this.useLocalLLM ?
                await this.callLocalLLM(prompt) :
                await this.callGeminiAPI(prompt);

            return JSON.parse(response);
        } catch (error) {
            console.error('Error generating layout suggestions:', error);
            throw error;
        }
    }

    async customizeElement(element, feedback) {
        try {
            const prompt = `Customize this brochure element based on the feedback:
            Element: ${JSON.stringify(element, null, 2)}
            Feedback: ${feedback}

            Return the updated element in the same format.`;

            const response = this.useLocalLLM ?
                await this.callLocalLLM(prompt) :
                await this.callGeminiAPI(prompt);

            return JSON.parse(response);
        } catch (error) {
            console.error('Error customizing element:', error);
            throw error;
        }
    }

    async callLocalLLM(prompt) {
        const response = await axios.post(`${this.endpoint}/v1/chat/completions`, {
            messages: [
                {
                    role: "system",
                    content: "You are a travel brochure content generator. Generate content based on the provided data. Respond only with the requested JSON structure."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 1000
        });

        return response.data.choices[0].message.content;
    }

    async callGeminiAPI(prompt) {
        const response = await axios.post(this.endpoint, {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1000
            }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        return response.data.candidates[0].content.parts[0].text;
    }
}

export default GeminiHandler; 