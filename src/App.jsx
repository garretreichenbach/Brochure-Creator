import React, { useState } from 'react';
import BrochureGenerator from './components/BrochureGenerator';
import DebugPanel from './debug/DebugPanel';
import './App.css';

function App() {
    const [location, setLocation] = useState('');
    const [generatedData, setGeneratedData] = useState(null);

    const handleLocationSubmit = (e) => {
        e.preventDefault();
        // Location submitted, BrochureGenerator will handle the rest
    };

    const handleGenerationComplete = (data) => {
        setGeneratedData(data);
    };

    return (
        <div className="App">
            <header className="app-header">
                <h1>Brochure Creator</h1>
                <p>Create custom brochures in Super Mario Odyssey style</p>
            </header>

            <main className="app-content">
                <form className="location-form" onSubmit={handleLocationSubmit}>
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Enter a location (e.g., Tokyo, Japan)"
                        className="location-input"
                    />
                </form>

                {location && (
                    <BrochureGenerator
                        location={location}
                        onComplete={handleGenerationComplete}
                    />
                )}

                {generatedData && (
                    <div className="generated-preview">
                        <h2>Generated Data Preview</h2>
                        <pre>{JSON.stringify(generatedData, null, 2)}</pre>
                    </div>
                )}
            </main>

            {process.env.NODE_ENV === 'development' && <DebugPanel />}
        </div>
    );
}

export default App; 