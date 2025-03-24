import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// Define supported endpoint styles
const ENDPOINT_STYLES = {
    OPENAI: {
        name: 'OpenAI Compatible',
        description: 'OpenAI-style API (e.g., LM Studio)',
        completionsEndpoint: '/v1/completions',
        chatEndpoint: '/v1/chat/completions',
        modelsEndpoint: '/v1/models',
        formatRequest: (prompt, params) => ({
            model: "local-model",
            prompt: prompt,
            max_tokens: params.max_tokens || 1000,
            temperature: params.temperature || 0.7,
            stream: false
        }),
        extractResponse: (response) => {
            return response.data.choices?.[0]?.text || response.data.choices?.[0]?.message?.content;
        }
    },
    SIMPLE: {
        name: 'Simple API',
        description: 'Basic /generate endpoint',
        completionsEndpoint: '/generate',
        chatEndpoint: '/chat',
        modelsEndpoint: '/models',
        formatRequest: (prompt, params) => ({
            prompt: prompt,
            max_tokens: params.max_tokens || 1000,
            temperature: params.temperature || 0.7
        }),
        extractResponse: (response) => response.data
    },
    LLAMA_CPP: {
        name: 'llama.cpp Server',
        description: 'llama.cpp HTTP server format',
        completionsEndpoint: '/completion',
        chatEndpoint: '/chat',
        modelsEndpoint: '/model',
        formatRequest: (prompt, params) => ({
            prompt: prompt,
            n_predict: params.max_tokens || 1000,
            temperature: params.temperature || 0.7,
            stop: ["</s>", "User:", "Assistant:"]
        }),
        extractResponse: (response) => response.data.content
    }
};

const GeminiDebug = () => {
    const [localLLMEndpoint, setLocalLLMEndpoint] = useState('http://localhost:3001');
    const [endpointStyle, setEndpointStyle] = useState('OPENAI');
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [useLocalLLM, setUseLocalLLM] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [params, setParams] = useState({
        max_tokens: 1000,
        temperature: 0.7
    });
    const [uploadedImages, setUploadedImages] = useState([]);
    const [contextData, setContextData] = useState({
        location: '',
        placeDetails: '',
        nearbyPlaces: ''
    });
    const [activePromptType, setActivePromptType] = useState('text');
    const fileInputRef = useRef(null);

    // Load saved settings from localStorage
    useEffect(() => {
        const savedEndpoint = localStorage.getItem('localLLMEndpoint');
        const savedStyle = localStorage.getItem('endpointStyle');
        const savedParams = localStorage.getItem('llmParams');
        
        if (savedEndpoint) {
            setLocalLLMEndpoint(savedEndpoint);
        }
        if (savedStyle && ENDPOINT_STYLES[savedStyle]) {
            setEndpointStyle(savedStyle);
        }
        if (savedParams) {
            try {
                setParams(JSON.parse(savedParams));
            } catch (e) {
                console.error('Failed to parse saved params:', e);
            }
        }
        
        // Test connection with saved or default settings
        testConnection(savedEndpoint || localLLMEndpoint, savedStyle || endpointStyle);
    }, []);

    const validateEndpoint = (url) => {
        try {
            new URL(url);
            return true;
        } catch (err) {
            return false;
        }
    };

    const testConnection = async (endpoint, style) => {
        if (!validateEndpoint(endpoint)) {
            setError('Invalid endpoint URL. Make sure it includes http:// or https://');
            setIsConnected(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            
            // Try to list models using the selected endpoint style
            const modelsEndpoint = ENDPOINT_STYLES[style].modelsEndpoint;
            await axios.get(`${endpoint}${modelsEndpoint}`, { timeout: 5000 });
            
            setIsConnected(true);
            setError(null);
            
            // Save settings
            localStorage.setItem('localLLMEndpoint', endpoint);
            localStorage.setItem('endpointStyle', style);
            localStorage.setItem('llmParams', JSON.stringify(params));
        } catch (err) {
            setIsConnected(false);
            if (err.code === 'ECONNABORTED') {
                setError('Connection timeout. Is the server running?');
            } else if (err.response) {
                setError(`Server error: ${err.response.data.error || 'Unknown error'}`);
            } else if (err.request) {
                setError('No response from server. Is it running?');
            } else {
                setError(`Error: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleEndpointChange = (e) => {
        const newEndpoint = e.target.value;
        setLocalLLMEndpoint(newEndpoint);
        setIsConnected(false);
    };

    const handleEndpointStyleChange = (e) => {
        const newStyle = e.target.value;
        setEndpointStyle(newStyle);
        setIsConnected(false);
        // Update placeholder based on typical port for this style
        if (newStyle === 'OPENAI') {
            setLocalLLMEndpoint(prev => prev.replace(/:\d+/, ':3001'));
        } else if (newStyle === 'LLAMA_CPP') {
            setLocalLLMEndpoint(prev => prev.replace(/:\d+/, ':8080'));
        }
    };

    const handleParamChange = (param, value) => {
        setParams(prev => {
            const updated = { ...prev, [param]: value };
            localStorage.setItem('llmParams', JSON.stringify(updated));
            return updated;
        });
    };

    const handleImageUpload = (event) => {
        const files = Array.from(event.target.files);
        
        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    setUploadedImages(prev => [...prev, {
                        id: Date.now() + Math.random(),
                        name: file.name,
                        data: e.target.result,
                        type: file.type
                    }]);
                };
                reader.readAsDataURL(file);
            }
        });
    };

    const removeImage = (imageId) => {
        setUploadedImages(prev => prev.filter(img => img.id !== imageId));
    };

    const handleContextChange = (field, value) => {
        setContextData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleTest = async () => {
        if (!prompt) return;
        if (!isConnected && useLocalLLM) {
            setError('Please test the connection to the LLM server first');
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            let response;
            if (useLocalLLM) {
                const style = ENDPOINT_STYLES[endpointStyle];
                const endpoint = `${localLLMEndpoint}${style.completionsEndpoint}`;
                
                // Prepare the request data based on prompt type
                let requestData = style.formatRequest(prompt, params);
                
                // Add context data if available
                if (Object.values(contextData).some(v => v.trim())) {
                    requestData.context = contextData;
                }
                
                // Add images if available and using image analysis
                if (uploadedImages.length > 0 && activePromptType === 'image') {
                    requestData.images = uploadedImages.map(img => ({
                        data: img.data,
                        type: img.type
                    }));
                }

                response = await axios.post(endpoint, requestData, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000
                });

                const generatedText = style.extractResponse(response);
                
                try {
                    if (generatedText.trim().startsWith('{') || generatedText.trim().startsWith('[')) {
                        setResult(JSON.parse(generatedText));
                    } else {
                        setResult(generatedText);
                    }
                } catch (e) {
                    setResult(generatedText);
                }
            } else {
                setError('Gemini API not yet configured');
            }
        } catch (err) {
            if (err.code === 'ECONNABORTED') {
                setError('Request timeout. The LLM is taking too long to respond.');
            } else if (err.response) {
                setError(`Server error: ${err.response.data.error || err.response.statusText}`);
            } else if (err.request) {
                setError('No response from server. Check the endpoint URL and server status.');
            } else {
                setError(`Error: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Updated test prompts with image and context support
    const testPrompts = {
        contentGeneration: {
            type: 'text',
            value: `Create a travel brochure content for Tokyo in the style of Super Mario Odyssey's travel brochures.
Include:
1. Brief introduction and highlights
2. Key attractions and landmarks
3. Cultural significance
4. Local activities and experiences
5. Interesting facts

Format the response as a JSON object with these sections as keys.`,
            needsContext: true
        },
        
        layoutSuggestion: {
            type: 'text',
            value: `Create 3 different layout suggestions for a travel brochure about Tokyo.
Format each layout as a JSON object with:
1. Layout name
2. Section arrangement
3. Image placement
4. Color scheme (based on location theme)
5. Typography suggestions`,
            needsContext: false
        },
        
        imageAnalysis: {
            type: 'image',
            value: `Analyze the provided images for a travel brochure.
For each image:
1. Describe what's shown
2. Rate its relevance for showcasing the location (1-10)
3. Suggest placement in the brochure
4. Identify key elements that make it appealing`,
            needsImages: true
        }
    };

    return (
        <div className="gemini-debug">
            <div className="llm-config">
                <label className="debug-label">
                    <input
                        type="checkbox"
                        checked={useLocalLLM}
                        onChange={(e) => setUseLocalLLM(e.target.checked)}
                    />
                    Use Local LLM
                </label>
                
                {useLocalLLM && (
                    <div className="endpoint-config">
                        <div className="input-group">
                            <select
                                className="debug-select"
                                value={endpointStyle}
                                onChange={handleEndpointStyleChange}
                            >
                                {Object.entries(ENDPOINT_STYLES).map(([key, style]) => (
                                    <option key={key} value={key}>
                                        {style.name} ({style.description})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="input-group">
                            <input
                                type="text"
                                className={`debug-input ${!validateEndpoint(localLLMEndpoint) ? 'invalid' : ''}`}
                                value={localLLMEndpoint}
                                onChange={handleEndpointChange}
                                placeholder={`Local LLM endpoint URL (e.g., ${localLLMEndpoint})`}
                            />
                            <button
                                className={`debug-button ${isConnected ? 'connected' : ''}`}
                                onClick={() => testConnection(localLLMEndpoint, endpointStyle)}
                                disabled={isLoading || !validateEndpoint(localLLMEndpoint)}
                            >
                                {isLoading ? 'Testing...' : isConnected ? 'Connected ✓' : 'Test Connection'}
                            </button>
                        </div>
                        <div className="params-config">
                            <div className="param-group">
                                <label>Temperature:</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={params.temperature}
                                    onChange={(e) => handleParamChange('temperature', parseFloat(e.target.value))}
                                />
                                <span>{params.temperature}</span>
                            </div>
                            <div className="param-group">
                                <label>Max Tokens:</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="4096"
                                    value={params.max_tokens}
                                    onChange={(e) => handleParamChange('max_tokens', parseInt(e.target.value))}
                                />
                            </div>
                        </div>
                        <div className="connection-status">
                            {isConnected && (
                                <span className="status-connected">
                                    Connected to {ENDPOINT_STYLES[endpointStyle].name}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="test-prompts">
                <h4>Test Prompts:</h4>
                <div className="prompt-buttons">
                    {Object.entries(testPrompts).map(([key, config]) => (
                        <button
                            key={key}
                            className={`debug-button ${activePromptType === config.type ? 'active' : ''}`}
                            onClick={() => {
                                setPrompt(config.value);
                                setActivePromptType(config.type);
                            }}
                        >
                            Load {key.replace(/([A-Z])/g, ' $1').toLowerCase()} prompt
                        </button>
                    ))}
                </div>
            </div>

            {activePromptType === 'image' && (
                <div className="image-upload-section">
                    <h4>Upload Images:</h4>
                    <div className="upload-controls">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageUpload}
                            style={{ display: 'none' }}
                        />
                        <button
                            className="debug-button"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            Select Images
                        </button>
                    </div>
                    {uploadedImages.length > 0 && (
                        <div className="uploaded-images">
                            {uploadedImages.map(img => (
                                <div key={img.id} className="image-preview">
                                    <img src={img.data} alt={img.name} />
                                    <button
                                        className="remove-image"
                                        onClick={() => removeImage(img.id)}
                                    >
                                        ×
                                    </button>
                                    <span className="image-name">{img.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {testPrompts[Object.keys(testPrompts).find(k => 
                testPrompts[k].value === prompt)]?.needsContext && (
                <div className="context-input-section">
                    <h4>Additional Context:</h4>
                    <div className="context-fields">
                        <div className="context-field">
                            <label>Location Details:</label>
                            <textarea
                                className="debug-input"
                                value={contextData.location}
                                onChange={(e) => handleContextChange('location', e.target.value)}
                                placeholder="Enter location details (e.g., coordinates, address, etc.)"
                                rows={3}
                            />
                        </div>
                        <div className="context-field">
                            <label>Place Details:</label>
                            <textarea
                                className="debug-input"
                                value={contextData.placeDetails}
                                onChange={(e) => handleContextChange('placeDetails', e.target.value)}
                                placeholder="Enter place details (e.g., description, ratings, etc.)"
                                rows={3}
                            />
                        </div>
                        <div className="context-field">
                            <label>Nearby Places:</label>
                            <textarea
                                className="debug-input"
                                value={contextData.nearbyPlaces}
                                onChange={(e) => handleContextChange('nearbyPlaces', e.target.value)}
                                placeholder="Enter nearby places information"
                                rows={3}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="prompt-input">
                <textarea
                    className="debug-input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter your prompt here..."
                    rows={6}
                />
                <button
                    className="debug-button"
                    onClick={handleTest}
                    disabled={
                        isLoading || 
                        !prompt || 
                        (useLocalLLM && !isConnected) ||
                        (activePromptType === 'image' && uploadedImages.length === 0)
                    }
                >
                    {isLoading ? 'Generating...' : 'Test Generation'}
                </button>
            </div>

            {error && (
                <div className="debug-error">
                    Error: {error}
                </div>
            )}

            {result && (
                <div className="debug-result">
                    <h4>Generated Response:</h4>
                    <pre>{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</pre>
                </div>
            )}
        </div>
    );
};

export default GeminiDebug; 