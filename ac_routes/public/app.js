/*
 Copyright 2024 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

(function(){
    let map;
    let places = {
        origin: null,
        destination: null,
        intermediates: []
    };
    let paths = [];
    let markers = [];
    let stopInputs = [];

    async function initMap() {
        const { Map } = await google.maps.importLibrary('maps');
        
        map = new Map(document.getElementById('map'), {
            center: { lat: 46.23861, lng: 15.25437 }, // Lokacija Cetisa
            zoom: 8,
            mapId: 'DEMO_MAP_ID'
        });
    }

    async function initPlace() {
        const { Autocomplete } = await google.maps.importLibrary('places');
        const locationFields = Array.from(document.getElementsByClassName('input-location'));
        
        // Initialize autocomplete for origin and destination
        locationFields.forEach((elem, i) => {
            const autocomplete = new Autocomplete(elem);
            google.maps.event.addListener(autocomplete, "place_changed", () => {
                const place = autocomplete.getPlace();
                if (place.place_id) {
                    if (i === 0) places.origin = place.place_id;
                    if (i === 1) places.destination = place.place_id;
                } else {
                    window.alert(`No details available for input: ${place.name}`);
                }
            });
        });

        // Setup add stop button
        document.getElementById('btn-addstop').addEventListener('click', addStopInput);
    }

    function addStopInput() {
        const container = document.getElementById('stops-container') || createStopsContainer();
        const index = places.intermediates.length;
        
        const groupDiv = document.createElement('div');
        groupDiv.className = 'Optionalinputgroup';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'optinal-input-location';
        input.placeholder = 'Vnesite naslov postaje';
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '-';
        removeBtn.addEventListener('click', () => {
            container.removeChild(groupDiv);
            places.intermediates.splice(index, 1);
            stopInputs.splice(index, 1);
        });

        groupDiv.appendChild(input);
        groupDiv.appendChild(removeBtn);
        container.appendChild(groupDiv);
        
        // Initialize autocomplete for new stop
        const autocomplete = new google.maps.places.Autocomplete(input);
        google.maps.event.addListener(autocomplete, "place_changed", () => {
            const place = autocomplete.getPlace();
            if (place.place_id) {
                places.intermediates[index] = place.place_id;
            }
        });
        
        stopInputs.push(input);
    }

    function createStopsContainer() {
        const container = document.createElement('div');
        container.id = 'stops-container';
        const stopGroup = document.querySelector('.Optionalinputgroup');
        stopGroup.parentNode.insertBefore(container, stopGroup.nextSibling);
        return container;
    }

     function requestRoute() {
        document.getElementById('btn-getroute').addEventListener('click', () => {
            if (!places.origin || !places.destination) {
                window.alert('Izberite izhodišče in destinacijo');
                return;
            }

            const reqBody = {
                origin: { placeId: places.origin },
                destination: { placeId: places.destination },
                intermediates: []
            };

            // Add intermediates if they exist
            if (places.intermediates.length > 0) {
                reqBody.intermediates = places.intermediates
                    .filter(id => id)
                    .map(id => ({ placeId: id }));
            }

            fetch("/request-route", {
                method: 'POST',
                body: JSON.stringify(reqBody),
                headers: { "Content-Type": "application/json" }
            }).then((response) => {
                return response.json();
            }).then((data) => {
                console.log("API Response:", data);
                renderRoutes(data);
            }).catch((error) => {
                console.error("Fetch Error:", error);
            });
        });
    }

    async function renderRoutes(data) {
        clearUIElem(paths, 'polyline');
        clearUIElem(markers, 'advMarker');
        const { encoding } = await google.maps.importLibrary("geometry");
        
        if (!data.routes || data.routes.length === 0) {
            console.log("No route found");
            return;
        }

        const route = data.routes[0];
        const pricePerKm = parseFloat(document.getElementById("cena_km").value) || 0;
        let totalDistance = 0;
        let totalPrice = 0;
        let priceHtml = '<div class="price-breakdown">';

        // VERIFIED WAYPOINT OPTIMIZATION HANDLING
        const optimizedOrder = route.optimizedIntermediateWaypointIndex || [];
        console.log("Optimized waypoint order:", optimizedOrder);
        
        // Create array of all points in optimized order
        const allPoints = [];
        
        // 1. Origin is always first (A)
        allPoints.push({
            location: route.legs[0].startLocation,
            label: 'A'
        });
        
        // 2. Add optimized intermediates (B, C, D...)
        optimizedOrder.forEach((originalIdx, i) => {
            // +1 because legs[0] is origin to first waypoint
            const legIndex = originalIdx + 1;
            if (route.legs[legIndex]) {
                allPoints.push({
                    location: route.legs[legIndex].startLocation,
                    label: String.fromCharCode(66 + i) // B, C, D...
                });
            }
        });
        
        // 3. Destination is always last
        const lastLeg = route.legs[route.legs.length - 1];
        const lastLabel = String.fromCharCode(66 + optimizedOrder.length); // B + count
        allPoints.push({
            location: lastLeg.endLocation,
            label: lastLabel
        });

        // Calculate and display prices for each leg
        route.legs.forEach((leg, i) => {
            const legDistanceKm = leg.distanceMeters / 1000;
            const legPrice = legDistanceKm * pricePerKm;
            totalDistance += legDistanceKm;
            totalPrice += legPrice;
            
            // Labels from optimized sequence
            const startLabel = allPoints[i].label;
            const endLabel = allPoints[i + 1].label;
            
            priceHtml += `
                <div class="leg-price">
                    <span class="leg-label">${startLabel} → ${endLabel}:</span>
                    <span class="leg-distance">${legDistanceKm.toFixed(1)} km</span>
                    <span class="leg-cost">${legPrice.toFixed(2)} EUR</span>
                </div>
            `;
        });

        // Add total price
        priceHtml += `
            <div class="total-price">
                <span class="total-label">SKUPAJ:</span>
                <span class="total-distance">${totalDistance.toFixed(1)} km</span>
                <span class="total-cost">${totalPrice.toFixed(2)} EUR</span>
            </div>
        </div>`;
        
        // Update price display
        document.getElementById("priceDisplay").innerHTML = priceHtml;

        // Draw route
        const decodedPath = encoding.decodePath(route.polyline.encodedPolyline);
        const polyline = new google.maps.Polyline({
            map: map,
            path: decodedPath,
            strokeColor: "#4285f4",
            strokeOpacity: 1,
            strokeWeight: 5
        });
        paths.push(polyline);

        // Add markers with optimized labels
        allPoints.forEach(point => {
            addMarker(point.location.latLng, point.label);
        });

        setViewport(route.viewport);
    }

    async function addMarker(pos, label) {
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        const { PinElement } = await google.maps.importLibrary("marker");
        const { LatLng } = await google.maps.importLibrary("core");
        
        let pinGlyph = new PinElement({
            glyphColor: "#fff",
            glyph: label
        });
        
        let marker = new AdvancedMarkerElement({
            position: new LatLng({lat: pos.latitude, lng: pos.longitude}),
            gmpDraggable: false,
            content: pinGlyph.element,
            map: map
        });
        
        markers.push(marker);
    }

    async function setViewport(viewPort) {
        const { LatLng } = await google.maps.importLibrary("core");
        const { LatLngBounds } = await google.maps.importLibrary("core");        
        let sw = new LatLng({lat: viewPort.low.latitude, lng: viewPort.low.longitude});
        let ne = new LatLng({lat: viewPort.high.latitude, lng: viewPort.high.longitude});        
        map.fitBounds(new LatLngBounds(sw, ne));
    }

    function clearUIElem(obj, type) {
        if(obj.length > 0) {
            if(type === 'advMarker') {
                obj.forEach(function(item) {
                    item.map = null;
                });
            } else {
                obj.forEach(function(item) {
                    item.setMap(null);
                });
            }
            obj.length = 0;
        }
    }

    initMap();
    initPlace();
    requestRoute();
}());