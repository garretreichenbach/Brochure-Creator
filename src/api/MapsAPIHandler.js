import axios from 'axios';

class MapsAPIHandler {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://maps.googleapis.com/maps/api';
    }

    async getLocationDetails(location) {
        try {
            const response = await axios.get(`${this.baseUrl}/geocode/json`, {
                params: {
                    address: location,
                    key: this.apiKey
                }
            });

            if (!response.data.results || response.data.results.length === 0) {
                throw new Error('Location not found');
            }

            return response.data.results[0];
        } catch (error) {
            console.error('Error getting location details:', error);
            throw error;
        }
    }

    async getPlaceDetails(placeId) {
        try {
            const response = await axios.get(`${this.baseUrl}/place/details/json`, {
                params: {
                    place_id: placeId,
                    fields: 'name,formatted_address,photos,editorial_summary,geometry,types,rating,reviews,opening_hours,website',
                    key: this.apiKey
                }
            });

            if (!response.data.result) {
                throw new Error('Place details not found');
            }

            return response.data.result;
        } catch (error) {
            console.error('Error getting place details:', error);
            throw error;
        }
    }

    async getNearbyPlaces(location) {
        try {
            const response = await axios.get(`${this.baseUrl}/place/nearbysearch/json`, {
                params: {
                    location: `${location.lat},${location.lng}`,
                    radius: 5000, // 5km radius
                    type: ['tourist_attraction', 'point_of_interest', 'museum', 'park'],
                    rankby: 'rating',
                    key: this.apiKey
                }
            });

            if (!response.data.results) {
                return [];
            }

            // Get detailed information for each nearby place
            const detailedPlaces = await Promise.all(
                response.data.results.slice(0, 10).map(place => 
                    this.getPlaceDetails(place.place_id)
                )
            );

            return detailedPlaces;
        } catch (error) {
            console.error('Error getting nearby places:', error);
            throw error;
        }
    }

    async getPlacePhotos(photoReferences) {
        try {
            const photoUrls = photoReferences.map(ref => 
                `${this.baseUrl}/place/photo?maxwidth=1600&photoreference=${ref}&key=${this.apiKey}`
            );
            return photoUrls;
        } catch (error) {
            console.error('Error getting place photos:', error);
            throw error;
        }
    }
}

export default MapsAPIHandler; 