import React, { useState } from 'react';
import axios from 'axios';

const MapsDebug = () => {
    const [location, setLocation] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [testType, setTestType] = useState('location'); // location, details, or nearby

    const handleTest = async () => {
        if (!location) return;

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            let response;
            const baseUrl = process.env.MAPS_API_BASE_URL || 'https://maps.googleapis.com/maps/api/';
            const apiKey = process.env.GOOGLE_MAPS_API_KEY;

            switch (testType) {
                case 'location':
                    response = await axios.get(`${baseUrl}geocode/json`, {
                        params: {
                            address: location,
                            key: apiKey
                        }
                    });
                    break;
                case 'details':
                    response = await axios.get(`${baseUrl}place/details/json`, {
                        params: {
                            place_id: location, // In this case, location should be a place_id
                            key: apiKey
                        }
                    });
                    break;
                case 'nearby':
                    // Expecting location to be "lat,lng" format
                    const [lat, lng] = location.split(',').map(coord => coord.trim());
                    response = await axios.get(`${baseUrl}place/nearbysearch/json`, {
                        params: {
                            location: `${lat},${lng}`,
                            radius: 5000, // 5km radius
                            key: apiKey
                        }
                    });
                    break;
                default:
                    throw new Error('Invalid test type');
            }

            setResult(JSON.stringify(response.data, null, 2));
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="maps-debug">
            <div className="test-type-selector">
                <select
                    className="debug-input"
                    value={testType}
                    onChange={(e) => setTestType(e.target.value)}
                >
                    <option value="location">Geocoding</option>
                    <option value="details">Place Details</option>
                    <option value="nearby">Nearby Search</option>
                </select>
            </div>

            <div className="input-group">
                <input
                    type="text"
                    className="debug-input"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={
                        testType === 'location' ? "Enter location name" :
                        testType === 'details' ? "Enter place_id" :
                        "Enter coordinates (lat,lng)"
                    }
                />
                <button
                    className="debug-button"
                    onClick={handleTest}
                    disabled={isLoading || !location}
                >
                    {isLoading ? 'Testing...' : 'Test Maps API'}
                </button>
            </div>

            {error && (
                <div className="debug-error">
                    Error: {error}
                </div>
            )}

            {result && (
                <div className="debug-result">
                    <h4>API Response:</h4>
                    <pre>{result}</pre>
                </div>
            )}
        </div>
    );
};

export default MapsDebug; 