import React, { useEffect, useRef, useState } from 'react';
import type { MapBounds, StormReport, RiskPolygon } from '@/lib/types';
import { PREVISAO_SCORING, MAP_STYLE_DARK } from '@/lib/constants';
import { normalizeReportType } from '@/lib/gameLogic';

declare const google: any;

type GameMapProps = {
  bounds: MapBounds;
  layerImageUrl?: string | null;
  forecastMarker?: { lat: number; lng: number } | null;
  stormReports?: StormReport[];
  riskPolygons?: RiskPolygon[];
  allowPlaceMarker: boolean;
  onPlaceMarker?: (lat: number, lng: number) => void;
};

// Color mapping for risk levels
const RISK_COLORS = {
    1: '#facc15', // Yellow (Nível 1)
    2: '#fb923c', // Orange (Nível 2)
    3: '#ef4444', // Red (Nível 3)
    4: '#d946ef', // Pink (Nível 4)
};

export function GameMap({
  bounds,
  layerImageUrl,
  forecastMarker,
  stormReports = [],
  riskPolygons = [],
  allowPlaceMarker,
  onPlaceMarker,
}: GameMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  
  // References to active map objects to allow clearing them
  const markersRef = useRef<any[]>([]);
  const circleRef = useRef<any>(null);
  const targetRef = useRef<any>(null);
  const tracksRef = useRef<any[]>([]);
  const polygonsRef = useRef<any[]>([]);

  // Initialize Map
  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
        if (!mapRef.current) return;

        try {
             // Wait for the Maps library to load
            const { Map } = await google.maps.importLibrary("maps");
            await google.maps.importLibrary("marker"); 

            if (!isMounted) return;

            // Center roughly on South America initially
            const map = new Map(mapRef.current, {
                center: { lat: -25, lng: -55 },
                zoom: 4,
                disableDefaultUI: true, // Clean look
                zoomControl: true, // Keep zoom
                styles: MAP_STYLE_DARK, // Apply Dark Theme
                backgroundColor: '#000000',
                clickableIcons: false,
            });

            map.addListener('click', (e: any) => {
                if (allowPlaceMarker && onPlaceMarker && e.latLng) {
                    onPlaceMarker(e.latLng.lat(), e.latLng.lng());
                }
            });

            // Cursor Styling
            map.addListener('mouseover', () => {
                map.setOptions({ draggableCursor: allowPlaceMarker ? 'crosshair' : 'grab' });
            });

            mapInstanceRef.current = map;
            setMapReady(true);

        } catch (error) {
            console.error("Error loading Game Map:", error);
        }
    };

    initMap();

    return () => { isMounted = false; };
  }, []); // Init once

  const [mapReady, setMapReady] = useState(false);

  // Handle allowPlaceMarker updates
  useEffect(() => {
      if(mapInstanceRef.current) {
          mapInstanceRef.current.setOptions({ 
              draggableCursor: allowPlaceMarker ? 'crosshair' : 'grab' 
          });
      }
  }, [allowPlaceMarker, mapReady]);

  // Handle Bounds & Reports Fitting
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    const googleBounds = new google.maps.LatLngBounds();
    
    // 1. Add Event Bounds
    if (bounds) {
        googleBounds.extend({ lat: bounds.south, lng: bounds.west });
        googleBounds.extend({ lat: bounds.north, lng: bounds.east });
    }

    // 2. Add Reports to bounds if existing
    if (stormReports.length > 0) {
        stormReports.forEach(r => googleBounds.extend({ lat: r.lat, lng: r.lng }));
    }

    // 3. Add Forecast if exists
    if (forecastMarker) {
        googleBounds.extend(forecastMarker);
    }

    if (!googleBounds.isEmpty()) {
        mapInstanceRef.current.fitBounds(googleBounds, 50); // 50px padding
    }

  }, [bounds, stormReports, forecastMarker, mapReady]);

  // Render Risk Polygons (Prevots)
  useEffect(() => {
      if (!mapInstanceRef.current || !mapReady) return;

      // Clear old polygons
      polygonsRef.current.forEach(p => p.setMap(null));
      polygonsRef.current = [];

      // Sort polygons by level (ascending) so lower levels are drawn first in DOM order too, 
      // though zIndex handles the visual stacking.
      const sortedPolygons = [...riskPolygons].sort((a, b) => a.level - b.level);

      sortedPolygons.forEach(polyData => {
          const color = RISK_COLORS[polyData.level] || '#ffffff';
          
          // Z-index logic: Higher levels sit on top of lower levels
          // Level 1: 10, Level 2: 20, Level 3: 30, Level 4: 40
          const zIndex = polyData.level * 10;

          const polygon = new google.maps.Polygon({
              paths: polyData.points,
              strokeColor: color,
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: color,
              fillOpacity: 0.35,
              map: mapInstanceRef.current,
              zIndex: zIndex 
          });

          polygonsRef.current.push(polygon);
      });

  }, [riskPolygons, mapReady]);


  // Render Forecast Target (Bullseye + Green Circle)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    // Define Symbol Here to ensure google.maps is loaded
    const TARGET_SYMBOL = {
        path: 'M 0,0 m -3,0 a 3,3 0 1,0 6,0 a 3,3 0 1,0 -6,0 M 0,-8 L 0,8 M -8,0 L 8,0',
        strokeColor: '#000000',
        strokeWeight: 2,
        scale: 2
    };

    // Clear old
    if (targetRef.current) { targetRef.current.setMap(null); targetRef.current = null; }
    if (circleRef.current) { circleRef.current.setMap(null); circleRef.current = null; }

    if (forecastMarker) {
        // Draw 100km Circle (Green, Transparent)
        const circle = new google.maps.Circle({
            strokeColor: "#10b981", // Emerald 500
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#10b981",
            fillOpacity: 0.25,
            map: mapInstanceRef.current,
            center: forecastMarker,
            radius: PREVISAO_SCORING.RADIUS_KM * 1000,
            clickable: false,
        });
        circleRef.current = circle;

        // Draw Bullseye Target
        const target = new google.maps.Marker({
            position: forecastMarker,
            map: mapInstanceRef.current,
            icon: TARGET_SYMBOL,
            zIndex: 999
        });
        targetRef.current = target;
    }
  }, [forecastMarker, mapReady]);

  // Render Storm Reports
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    // Define Symbols Here
    const SYMBOLS = {
        TORNADO: {
            path: 'M 0 0 L 6 -12 L -6 -12 Z', 
            fillColor: '#ef4444',
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 1.5,
            scale: 2.5 // Increased scale for visibility
        },
        WIND: {
            path: 'M -5,-5 5,-5 5,5 -5,5 z',
            fillColor: '#3b82f6',
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 1.5,
            scale: 1
        },
        HAIL: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#22c55e',
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 1.5,
            scale: 6
        }
    };

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    
    // Clear old tracks
    tracksRef.current.forEach(t => t.setMap(null));
    tracksRef.current = [];

    stormReports.forEach(r => {
        let icon: any = SYMBOLS.TORNADO; // Default
        let zIndex = 100;

        // Use strict normalization from logic
        const type = normalizeReportType(r.type);

        if (type === 'vento') {
            icon = SYMBOLS.WIND;
            zIndex = 90;
        } else if (type === 'granizo') {
            icon = SYMBOLS.HAIL;
            zIndex = 90;
        } else {
            // It's a tornado
            icon = SYMBOLS.TORNADO;
            zIndex = 100;
        }

        // Draw Tracks (For Tornadoes)
        if (type === 'tornado' && r.track && r.track.length > 1) {
            // Shadow/Border Line
            const borderLine = new google.maps.Polyline({
                path: r.track,
                geodesic: true,
                strokeColor: '#000000',
                strokeOpacity: 0.8,
                strokeWeight: 6,
                map: mapInstanceRef.current,
                zIndex: 50
            });
            tracksRef.current.push(borderLine);

            // Inner Color Line
            const mainLine = new google.maps.Polyline({
                path: r.track,
                geodesic: true,
                strokeColor: '#ef4444',
                strokeOpacity: 1.0,
                strokeWeight: 3,
                map: mapInstanceRef.current,
                zIndex: 51
            });
            tracksRef.current.push(mainLine);
        }

        // Draw Report Marker
        const marker = new google.maps.Marker({
            position: { lat: r.lat, lng: r.lng },
            map: mapInstanceRef.current,
            icon: icon,
            title: `${type.toUpperCase()} ${r.rating || ''}`,
            zIndex: zIndex
        });

        markersRef.current.push(marker);
    });

  }, [stormReports, mapReady]);

  return (
    <div ref={mapRef} className="w-full h-full bg-black" />
  );
}