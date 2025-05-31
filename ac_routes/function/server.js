// Server.js - Optimized Waypoints
// ================================
// Make sure to install required packages first:
//   npm install dotenv express body-parser node-fetch@2

// Load environment variables from absolute path
const path = require('path');
require('dotenv').config({ 
    path: 'C:/Users/jerne/Desktop/Mind/FRI - LJ/GitHubRepos/Routes-per-partes/.env'
});

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const port = process.env.PORT || 8080;

// Verify environment variables
console.log('=======================================');
console.log('Environment variables loaded from:');
console.log('C:/Users/jerne/Desktop/Mind/FRI - LJ/GitHubRepos/Routes-per-partes/.env');
console.log('API Key:', process.env.GOOGLE_API_KEY ? 'Loaded successfully' : 'MISSING!');
console.log('Port:', port);
console.log('=======================================');

function main() {
    // Serve static files from public directory
    const publicPath = path.join(__dirname, '../public');
    app.use('/', express.static(publicPath));
    console.log(`Serving static files from: ${publicPath}`);
    
    // Configure middleware
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(express.json());
    console.log('Middleware configured');

    // Route handler for direction requests
    app.post('/request-route', (req, res) => {    
        const waypointCount = req.body.intermediates?.length || 0;
        console.log(`\n=== NEW ROUTE REQUEST ===`);
        console.log(`Origin: ${req.body.origin.placeId}`);
        console.log(`Destination: ${req.body.destination.placeId}`);
        console.log(`Waypoints: ${waypointCount}`);
        console.log(`Optimize: ${waypointCount > 0 ? 'Yes' : 'No'}`);

        // Prepare API request with forced optimization
        const requestBody = {
            ...req.body,
            travelMode: "DRIVE",
            optimizeWaypointOrder: waypointCount > 0,  // FORCE optimization when waypoints exist
            routingPreference: "TRAFFIC_AWARE",
            computeAlternativeRoutes: false  // Ensure only optimized route is returned
        };

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            console.error("API key is missing");
            return res.status(500).json({ error: "Server configuration error: API key missing" });
        }

        // Send request to Google Routes API
        fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": apiKey,
                "X-Goog-FieldMask": "routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs",
                "X-Server-Timeout": "10"  // Required for optimization
            },
            body: JSON.stringify(requestBody)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    const errorMsg = `API error ${response.status}: ${JSON.stringify(errData)}`;
                    console.error(`❌ ${errorMsg}`);
                    throw new Error(errorMsg);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                console.error("❌ Routes API Error:", data.error);
                res.status(500).json(data.error);
            } else if (!data.routes || data.routes.length === 0) {
                console.log("No route found for request");
                res.status(404).json({ error: "No route found" });
            } else {
                const route = data.routes[0];
                const legCount = route.legs.length;
                const optimizedIndices = route.optimizedIntermediateWaypointIndex || [];
                
                // VERIFICATION: Confirm optimization occurred
                if (waypointCount > 0) {
                    if (optimizedIndices.length > 0) {
                        console.log(`Route optimized with ${optimizedIndices.length} waypoints`);
                        console.log(`Optimized order: ${optimizedIndices}`);
                    } else {
                        console.log("WARNING: Optimization requested but no optimized order returned!");
                    }
                }
                
                console.log(`Route found with ${legCount} legs`);
                console.log(`Total distance: ${route.distanceMeters} meters`);
                res.json(data);
            }
        })
        .catch(error => {
            console.error("Fetch Error:", error.message);
            res.status(500).json({ error: error.message });
        });
    });

    // Start server
    app.listen(port, () => {
        console.log('\n=======================================');
        console.log(`App listening on port ${port}`);
        console.log(`Access at: http://localhost:${port}`);
        console.log('Press Ctrl+C to quit');
        console.log('=======================================');
    });
}

// Start application
main();