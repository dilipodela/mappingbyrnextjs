function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

// Initialize map
const map = L.map('map').setView([20.5937, 78.9629], 5);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

let userLocation = null;
let userMarker = null;
let routingControl = null;
const startInput = document.getElementById('start');
const destinationInput = document.getElementById('destination');
const startRouteBtn = document.getElementById('start-route');
let startWaypoint = null;
let destinationWaypoint = null;
let travelMode = 'driving';

const drivingBtn = document.getElementById('driving');
const walkingBtn = document.getElementById('walking');
const cyclingBtn = document.getElementById('cycling');

// Geocoder for inputs
const geocoder = L.Control.Geocoder.nominatim();

function createGeocoderControl(input, callback) {
    const geocoderControl = L.Control.geocoder({
        geocoder: geocoder,
        defaultMarkGeocode: false,
        placeholder: input.placeholder,
    })
    .on('markgeocode', function(e) {
        input.value = e.geocode.name;
        callback(e.geocode.center);
    })
    .on('startgeocode', function() {
        geocoderForm.classList.add('loading');
    })
    .on('finishgeocode', function() {
        geocoderForm.classList.remove('loading');
    })
    .on('errorgeocode', function() {
        geocoderForm.classList.remove('loading');
    });

    const geocoderContainer = geocoderControl.onAdd(map);
    const geocoderInput = geocoderContainer.querySelector('input');
    const geocoderForm = geocoderContainer.querySelector('.leaflet-control-geocoder-form');
    geocoderInput.id = input.id;
    if (input.id === 'start') {
        geocoderInput.value = "Your Location";
    }

    input.parentNode.replaceChild(geocoderContainer, input);
    return geocoderInput;
}

const startInputEl = createGeocoderControl(startInput, (latlng) => {
    startWaypoint = L.latLng(latlng.lat, latlng.lng);
});

const destinationInputEl = createGeocoderControl(destinationInput, (latlng) => {
    destinationWaypoint = L.latLng(latlng.lat, latlng.lng);
});


// Get user's real-time location
if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
        (position) => {
            userLocation = L.latLng(position.coords.latitude, position.coords.longitude);

            if (userMarker) {
                userMarker.setLatLng(userLocation);
            } else {
                userMarker = L.circleMarker(userLocation, {
                    radius: 8,
                    fillColor: '#4285F4',
                    color: '#fff',
                    weight: 3,
                    opacity: 1,
                    fillOpacity: 1
                }).addTo(map).bindPopup('Your Location');
                 map.setView(userLocation, 13);
            }

            if (startInputEl.value === '' || startInputEl.value === 'Your Location') {
                startWaypoint = userLocation;
            }
        },
        (error) => {
            let errorMessage = 'Could not get your location.';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = "Location permission denied. Please enable it in your browser settings.";
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = "Location information is unavailable.";
                    break;
                case error.TIMEOUT:
                    errorMessage = "The request to get user location timed out.";
                    break;
                case error.UNKNOWN_ERROR:
                    errorMessage = "An unknown error occurred.";
                    break;
            }
            console.error('Location error:', error.message);
            alert(errorMessage);
            if (startInputEl.value === '' || startInputEl.value === 'Your Location') {
                startInputEl.value = 'Error getting location';
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
} else {
    startInputEl.value = 'Geolocation not supported';
}

// Current Location Button
document.getElementById('current-location').addEventListener('click', () => {
    if (userLocation) {
        map.setView(userLocation, 15);
    } else {
        alert('Could not get your location.');
    }
});

// Travel Mode Buttons
drivingBtn.addEventListener('click', () => setTravelMode('driving'));
walkingBtn.addEventListener('click', () => setTravelMode('walking'));
cyclingBtn.addEventListener('click', () => setTravelMode('bicycle')); // OSRM uses 'bicycle'

function setTravelMode(mode) {
    travelMode = mode;
    drivingBtn.classList.toggle('active', mode === 'driving');
    walkingBtn.classList.toggle('active', mode === 'walking');
    cyclingBtn.classList.toggle('active', mode === 'bicycle');
}

// Start Route Button
startRouteBtn.addEventListener('click', () => {
    updateRoute();
});

// Routing Control
routingControl = L.Routing.control({
    waypoints: [],
    router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: travelMode
    }),
    routeWhileDragging: true,
    showAlternatives: true,
    createMarker: function(i, waypoint, n) {
        const marker = L.marker(waypoint.latLng, {
            draggable: true,
            icon: L.icon({
                iconUrl: i === 0 ?
                    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png' :
                    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        });
        return marker.bindPopup(i === 0 ? 'Start' : 'Destination');
    }
}).addTo(map);

function updateRoute() {
    routingControl.getRouter().options.profile = travelMode;
    const waypoints = [];
    if (startWaypoint) {
        waypoints.push(startWaypoint);
    }
    if (destinationWaypoint) {
        waypoints.push(destinationWaypoint);
    }

    if (waypoints.length < 2) {
        alert("Please select a start and destination.");
        return;
    }
    routingControl.setWaypoints(waypoints);
}


// Voice navigation (optional)
routingControl.on('routesfound', function(e) {
    const routes = e.routes;
    if (!routes.length) return;
    const summary = routes[0].summary;
    console.log('Distance:', (summary.totalDistance / 1000).toFixed(2), 'km');
    console.log('Duration:', Math.round(summary.totalTime / 60), 'minutes');
    // speakDirections(routes[0].instructions);
});

function speakDirections(instructions) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(
            instructions.map(i => i.text).join('. ')
        );
        speechSynthesis.speak(utterance);
    }
}

// Handle map clicks to set destination
map.on('click', function(e) {
    destinationWaypoint = e.latlng;
    const form = destinationInputEl.closest('.leaflet-control-geocoder-form');
    form.classList.add('loading');
    geocoder.reverse(e.latlng, map.options.crs.scale(map.getZoom()), function(results) {
        form.classList.remove('loading');
        if (results && results.length > 0) {
            destinationInputEl.value = results[0].name;
        }
    });
});