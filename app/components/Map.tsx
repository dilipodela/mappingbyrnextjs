import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import L from 'leaflet';
import 'leaflet-routing-machine';

export default function Map() {
    const mapRef = useRef(null);
    const isMapInitialized = useRef(false);
    const mapInstanceRef = useRef<any>(null);
    const [travelMode, setTravelMode] = useState('driving');
    const routingControlRef = useRef<any>(null);
    const [startSearch, setStartSearch] = useState('');
    const [destinationSearch, setDestinationSearch] = useState('');
    const [startResults, setStartResults] = useState<any[]>([]);
    const [destinationResults, setDestinationResults] = useState<any[]>([]);

    const handleSearch = async (query: string, setSearchResults: (results: any[]) => void) => {
        if (query.length > 2) {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`, { mode: 'cors' });
                const data = await response.json();
                setSearchResults(data);
            } catch (error) {
                console.error('Search error:', error);
            }
        }
    };

    const handleTravelModeChange = (newMode: string) => {
        setTravelMode(newMode);
        if (routingControlRef.current) {
            routingControlRef.current.getRouter().options.profile = newMode;
        }
    };

    const handleStartRoute = () => {
        if (routingControlRef.current) {
            const waypoints = routingControlRef.current.getWaypoints();
            if (waypoints.length >= 2 && waypoints[0].latLng && waypoints[1].latLng) {
                routingControlRef.current.route();
            } else {
                alert("Please select a start and destination.");
            }
        }
    };

    const handleCurrentLocation = () => {
        if (navigator.geolocation && mapInstanceRef.current) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLocation = L.latLng(position.coords.latitude, position.coords.longitude);
                    mapInstanceRef.current.setView(userLocation, 13);
                    routingControlRef.current.spliceWaypoints(0, 1, userLocation);
                    setStartSearch('Your Location');
                    setStartResults([]);
                },
                (error) => console.error('Location error:', error)
            );
        }
    };

    useEffect(() => {
        if (mapRef.current && !isMapInitialized.current) {
            isMapInitialized.current = true;

            const map = L.map(mapRef.current).setView([20.5937, 78.9629], 5);
            mapInstanceRef.current = map;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(map);

            const routingControl = (L as any).Routing.control({
                waypoints: [],
                router: (L as any).Routing.osrmv1({
                    serviceUrl: 'https://router.project-osrm.org/route/v1',
                    profile: travelMode
                }),
                routeWhileDragging: true,
                showAlternatives: true,
                createMarker: function(i: number, waypoint: any, n: number) {
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
                },
                container: '#routing-instructions'
            }).addTo(map);

            routingControlRef.current = routingControl;

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const userLocation = L.latLng(position.coords.latitude, position.coords.longitude);
                        map.setView(userLocation, 13);
                        routingControl.spliceWaypoints(0, 1, userLocation);
                    },
                    (error) => console.error('Location error:', error)
                );
            }
        }
    }, []);

    return (
        <>
            <Head>
                <title>Free Navigation App</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            </Head>

            <div id="map" ref={mapRef} style={{ height: '100vh' }}></div>

            <div id="controls">
                <div className="search-container">
                    <input type="text" id="start" placeholder="Choose starting point" value={startSearch} onChange={(e) => { setStartSearch(e.target.value); handleSearch(e.target.value, setStartResults); }} />
                    <div className="search-results">
                        {startResults.map((result) => (
                            <div key={result.place_id} onClick={() => { routingControlRef.current.spliceWaypoints(0, 1, L.latLng(result.lat, result.lon)); setStartSearch(result.display_name); setStartResults([]); }}>
                                {result.display_name}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="search-container">
                    <input type="text" id="destination" placeholder="Choose destination" value={destinationSearch} onChange={(e) => { setDestinationSearch(e.target.value); handleSearch(e.target.value, setDestinationResults); }} />
                    <div className="search-results">
                        {destinationResults.map((result) => (
                            <div key={result.place_id} onClick={() => { routingControlRef.current.spliceWaypoints(routingControlRef.current.getWaypoints().length - 1, 1, L.latLng(result.lat, result.lon)); setDestinationSearch(result.display_name); setDestinationResults([]); }}>
                                {result.display_name}
                            </div>
                        ))}
                    </div>
                </div>

                <div id="travel-modes">
                    <button id="driving" className={travelMode === 'driving' ? 'active' : ''} onClick={() => handleTravelModeChange('driving')}>Driving</button>
                    <button id="walking" className={travelMode === 'walking' ? 'active' : ''} onClick={() => handleTravelModeChange('walking')}>Walking</button>
                    <button id="bicycle" className={travelMode === 'bicycle' ? 'active' : ''} onClick={() => handleTravelModeChange('bicycle')}>Cycling</button>
                </div>
                <button id="start-route" onClick={handleStartRoute}>Start</button>
                <button id="current-location" onClick={handleCurrentLocation}>Current Location</button>
            </div>

            <div id="routing-instructions"></div>
        </>
    );
}