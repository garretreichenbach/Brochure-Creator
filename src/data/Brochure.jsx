/**
 * Brochure component that displays information about a location.
 */
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import './Brochure.css';

const Brochure = ({ locationData, layout, onElementSelect }) => {
    const [content, setContent] = useState(null);
    const [selectedElement, setSelectedElement] = useState(null);

    useEffect(() => {
        if (locationData) {
            setContent(locationData);
        }
    }, [locationData]);

    useEffect(() => {
        // Apply color scheme from layout
        const root = document.documentElement;
        Object.entries(layout.styling.colorScheme).forEach(([key, value]) => {
            root.style.setProperty(`--${key}-color`, value);
        });

        // Apply typography
        root.style.setProperty('--heading-font', layout.styling.typography.headings);
        root.style.setProperty('--body-font', layout.styling.typography.body);
    }, [layout]);

    const handleElementClick = (element) => {
        setSelectedElement(element);
        if (onElementSelect) {
            onElementSelect(element);
        }
    };

    const renderAttractions = () => (
        <section className="attractions" onClick={() => handleElementClick({ type: 'attractions' })}>
            <h2>Key Attractions</h2>
            <div className="attractions-grid">
                {content.attractions.map((attraction, index) => (
                    <div key={index} className="attraction-card">
                        {attraction.image && (
                            <img src={attraction.image} alt={attraction.name} />
                        )}
                        <h3>{attraction.name}</h3>
                        <p>{attraction.description}</p>
                    </div>
                ))}
            </div>
        </section>
    );

    const renderActivities = () => (
        <section className="activities" onClick={() => handleElementClick({ type: 'activities' })}>
            <h2>Local Activities</h2>
            <div className="activities-list">
                {content.activities.map((activity, index) => (
                    <div key={index} className="activity-item">
                        <h3>{activity.name}</h3>
                        <p>{activity.description}</p>
                    </div>
                ))}
            </div>
        </section>
    );

    const renderFacts = () => (
        <section className="facts" onClick={() => handleElementClick({ type: 'facts' })}>
            <h2>Fun Facts</h2>
            <ul>
                {content.facts.map((fact, index) => (
                    <li key={index}>{fact}</li>
                ))}
            </ul>
        </section>
    );

    const renderMap = () => (
        <LoadScript googleMapsApiKey={process.env.GOOGLE_MAPS_API_KEY}>
            <GoogleMap
                mapContainerClassName="map-container"
                center={content.maps.center}
                zoom={13}
            >
                {/* Main location marker */}
                <Marker
                    position={content.maps.center}
                    icon={{
                        url: 'path-to-mario-marker.png',
                        scaledSize: { width: 40, height: 40 }
                    }}
                />
                {/* Nearby places markers */}
                {content.maps.nearbyPlaces.map((place, index) => (
                    <Marker
                        key={index}
                        position={place.location}
                        title={place.name}
                        icon={{
                            url: `path-to-${place.type}-marker.png`,
                            scaledSize: { width: 30, height: 30 }
                        }}
                    />
                ))}
            </GoogleMap>
        </LoadScript>
    );

    if (!content) {
        return <div>Loading brochure content...</div>;
    }

    return (
        <div className="brochure">
            <header className="brochure-header">
                <h1>{content.name}</h1>
                <div className="location-info">
                    {content.formatted_address}
                </div>
            </header>

            <section className="introduction" onClick={() => handleElementClick({ type: 'introduction' })}>
                <h2>Welcome to {content.name}!</h2>
                <p>{content.introduction}</p>
            </section>

            {renderAttractions()}

            <section className="culture" onClick={() => handleElementClick({ type: 'culture' })}>
                <h2>Cultural Highlights</h2>
                <p>{content.culture}</p>
            </section>

            {renderActivities()}
            {renderFacts()}

            <footer className="brochure-footer">
                {renderMap()}
                <div className="footer-info">
                    <p>Last updated: {new Date(content.metadata.generated).toLocaleDateString()}</p>
                    <p>Data sources: {content.metadata.sources.join(', ')}</p>
                </div>
            </footer>
        </div>
    );
};

Brochure.propTypes = {
    locationData: PropTypes.shape({
        name: PropTypes.string.isRequired,
        formatted_address: PropTypes.string.isRequired,
        introduction: PropTypes.string.isRequired,
        attractions: PropTypes.arrayOf(PropTypes.shape({
            name: PropTypes.string.isRequired,
            description: PropTypes.string.isRequired,
            image: PropTypes.string.isRequired
        })).isRequired,
        culture: PropTypes.string.isRequired,
        activities: PropTypes.arrayOf(PropTypes.shape({
            name: PropTypes.string.isRequired,
            description: PropTypes.string.isRequired
        })).isRequired,
        facts: PropTypes.arrayOf(PropTypes.string).isRequired,
        maps: PropTypes.shape({
            center: PropTypes.arrayOf(PropTypes.number).isRequired,
            nearbyPlaces: PropTypes.arrayOf(PropTypes.shape({
                name: PropTypes.string.isRequired,
                type: PropTypes.string.isRequired,
                location: PropTypes.arrayOf(PropTypes.number).isRequired
            })).isRequired
        }).isRequired,
        metadata: PropTypes.shape({
            generated: PropTypes.string.isRequired,
            sources: PropTypes.arrayOf(PropTypes.string).isRequired
        }).isRequired
    }).isRequired,
    layout: PropTypes.shape({
        styles: PropTypes.object.isRequired,
        styling: PropTypes.shape({
            colorScheme: PropTypes.object.isRequired,
            typography: PropTypes.shape({
                headings: PropTypes.string.isRequired,
                body: PropTypes.string.isRequired
            }).isRequired
        }).isRequired
    }).isRequired,
    onElementSelect: PropTypes.func
};

export default Brochure;
