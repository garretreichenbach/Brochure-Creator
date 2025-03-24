/**
 * Handles the calls to the Google Maps API to get the data for the map.
 */
import { Loader } from '@googlemaps/js-api-loader';

class MapsAPIHandler {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.loader = new Loader({
            apiKey: this.apiKey,
            version: "weekly",
            libraries: ["places"]
        });
    }

    /**
     * Initialize the Maps API
     * @returns {Promise} Promise that resolves when the API is loaded
     */
    async initialize() {
        try {
            await this.loader.load();
            return true;
        } catch (error) {
            console.error('Error loading Google Maps API:', error);
            throw error;
        }
    }

    /**
     * Get location details using Places API
     * @param {string} locationName - Name of the location to search for
     * @returns {Promise<Object>} Location details including coordinates, place_id, etc.
     */
    async getLocationDetails(locationName) {
        try {
            const service = new google.maps.places.PlacesService(document.createElement('div'));
            
            return new Promise((resolve, reject) => {
                service.findPlaceFromQuery({
                    query: locationName,
                    fields: ['name', 'geometry', 'place_id', 'formatted_address', 'photos', 'types']
                }, (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                        resolve(results[0]);
                    } else {
                        reject(new Error(`Places API error: ${status}`));
                    }
                });
            });
        } catch (error) {
            console.error('Error getting location details:', error);
            throw error;
        }
    }

    /**
     * Get detailed place information
     * @param {string} placeId - The place ID from Google Maps
     * @returns {Promise<Object>} Detailed place information
     */
    async getPlaceDetails(placeId) {
        try {
            const service = new google.maps.places.PlacesService(document.createElement('div'));
            
            return new Promise((resolve, reject) => {
                service.getDetails({
                    placeId: placeId,
                    fields: [
                        'name',
                        'formatted_address',
                        'geometry',
                        'photos',
                        'reviews',
                        'rating',
                        'types',
                        'website',
                        'opening_hours',
                        'formatted_phone_number'
                    ]
                }, (place, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK) {
                        resolve(place);
                    } else {
                        reject(new Error(`Place Details API error: ${status}`));
                    }
                });
            });
        } catch (error) {
            console.error('Error getting place details:', error);
            throw error;
        }
    }

    /**
     * Get nearby places of interest
     * @param {Object} location - Location coordinates {lat, lng}
     * @param {number} radius - Search radius in meters
     * @returns {Promise<Array>} Array of nearby places
     */
    async getNearbyPlaces(location, radius = 5000) {
        try {
            const service = new google.maps.places.PlacesService(document.createElement('div'));
            
            return new Promise((resolve, reject) => {
                service.nearbySearch({
                    location: location,
                    radius: radius,
                    type: ['tourist_attraction', 'point_of_interest']
                }, (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK) {
                        resolve(results);
                    } else {
                        reject(new Error(`Nearby Search API error: ${status}`));
                    }
                });
            });
        } catch (error) {
            console.error('Error getting nearby places:', error);
            throw error;
        }
    }
}

export default MapsAPIHandler;