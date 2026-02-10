import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import type { MapBounds, StormReport } from '@/lib/types';

// Use CDN URLs for Leaflet markers
const ICON_URL = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const ICON_RETINA_URL = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const SHADOW_URL = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: ICON_URL,
    iconRetinaUrl: ICON_RETINA_URL,
    shadowUrl: SHADOW_URL,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

type GameMapProps = {
  bounds: MapBounds;
  layerImageUrl?: string | null;
  forecastMarker?: { lat: number; lng: number } | null;
  stormReports?: StormReport[];
  allowPlaceMarker: boolean;
  onPlaceMarker?: (lat: number, lng: number) => void;
};

export function GameMap({
  bounds,
  layerImageUrl,
  forecastMarker,
  stormReports = [],
  allowPlaceMarker,
  onPlaceMarker,
}: GameMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const forecastMarkerRef = useRef<L.Marker | null>(null);
  const reportsLayerRef = useRef<L.LayerGroup | null>(null);

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-22, -60], // Centered roughly on South America
      zoom: 3,
      minZoom: 3,
      maxZoom: 10,
      zoomControl: false,
      attributionControl: false
    });

    // Dark Matter tile layer for that "Black Map" aesthetic
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);
    
    // Add borders
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;

    map.on('click', (e: L.LeafletMouseEvent) => {
        if (allowPlaceMarker && onPlaceMarker) {
             onPlaceMarker(e.latlng.lat, e.latlng.lng);
        }
    });

    // Force cursor style
    const container = map.getContainer();
    container.style.cursor = allowPlaceMarker ? 'crosshair' : 'grab';

    // FIX: Force map resize calculation after init
    setTimeout(() => {
        map.invalidateSize();
    }, 200);

  }, [allowPlaceMarker, onPlaceMarker]);

  // Update cursor when allowPlaceMarker changes
  useEffect(() => {
    if (mapRef.current) {
        mapRef.current.getContainer().style.cursor = allowPlaceMarker ? 'crosshair' : 'grab';
    }
  }, [allowPlaceMarker]);

  // FIX: Observer for container resize (fixes grey tiles on load)
  useEffect(() => {
    if (!containerRef.current || !mapRef.current) return;
    
    const resizeObserver = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    initMap();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initMap]);

  // Update Overlay
  useEffect(() => {
    if (!mapRef.current) return;

    // Clean old
    if (overlayRef.current) {
      mapRef.current.removeLayer(overlayRef.current);
      overlayRef.current = null;
    }

    const latLngBounds = L.latLngBounds(
        [bounds.south, bounds.west], 
        [bounds.north, bounds.east]
    );

    if (layerImageUrl) {
      const overlay = L.imageOverlay(layerImageUrl, latLngBounds, {
        opacity: 1,
        interactive: false
      });
      overlay.addTo(mapRef.current);
      overlayRef.current = overlay;
    }
    
    // Always fit bounds initially, but verify validity
    if(latLngBounds.isValid()) {
         mapRef.current.fitBounds(latLngBounds, { padding: [20, 20] });
    }

  }, [layerImageUrl, bounds]);

  // Update Forecast Marker
  useEffect(() => {
    if (!mapRef.current) return;

    if (forecastMarkerRef.current) {
      mapRef.current.removeLayer(forecastMarkerRef.current);
      forecastMarkerRef.current = null;
    }
    if (forecastMarker) {
      const icon = L.divIcon({
        className: 'target-marker',
        html: `
          <div style="position:relative; width:30px; height:30px; display:flex; align-items:center; justify-content:center;">
             <div style="position:absolute; width:100%; height:1px; bg-color: #22d3ee; background: #22d3ee;"></div>
             <div style="position:absolute; height:100%; width:1px; bg-color: #22d3ee; background: #22d3ee;"></div>
             <div style="width:16px; height:16px; border: 2px solid #22d3ee; border-radius: 50%;"></div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const m = L.marker([forecastMarker.lat, forecastMarker.lng], { icon }).addTo(mapRef.current);
      forecastMarkerRef.current = m;
    }
  }, [forecastMarker]);

  // Update Reports (Tornadoes etc)
  useEffect(() => {
    if (!mapRef.current) return;

    if (reportsLayerRef.current) {
      mapRef.current.removeLayer(reportsLayerRef.current);
      reportsLayerRef.current = null;
    }
    if (stormReports.length > 0) {
      const group = L.layerGroup();
      stormReports.forEach((r) => {
        let svgShape = '';
        let color = '';
        
        if (r.type === 'tornado') {
            color = '#ef4444'; // Red
            // Inverted Triangle
            svgShape = `<svg width="20" height="20" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2"><path d="M12 22L2 2h20L12 22z"/></svg>`;
            
            // Draw Track if exists
            if (r.track && r.track.length > 1) {
                const polyline = L.polyline(r.track, {
                    color: '#ef4444',
                    weight: 4,
                    opacity: 0.6,
                    lineCap: 'round'
                });
                polyline.addTo(group);
            }

        } else if (r.type === 'vento') {
            color = '#3b82f6'; // Blue
            // Circle
            svgShape = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="3"><circle cx="12" cy="12" r="10"/></svg>`;
        } else if (r.type === 'granizo') {
            color = '#22c55e'; // Green
            // Diamond / Square rotated
            svgShape = `<svg width="16" height="16" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="3"><rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)"/></svg>`;
        }

        const icon = L.divIcon({
          className: 'report-marker',
          html: `<div style="display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 0 4px ${color});">${svgShape}</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        
        const marker = L.marker([r.lat, r.lng], { icon });
        // Optional popup info
        marker.bindPopup(`<b>${r.type.toUpperCase()}</b>${r.rating ? `<br/>${r.rating}` : ''}`);
        marker.addTo(group);
      });
      group.addTo(mapRef.current);
      reportsLayerRef.current = group;
      
      // If we have reports, fit bounds to show them + forecast
      const reportBounds = L.latLngBounds(stormReports.map(r => [r.lat, r.lng]));
      if (forecastMarker) reportBounds.extend([forecastMarker.lat, forecastMarker.lng]);
      if (reportBounds.isValid()) {
          mapRef.current.fitBounds(reportBounds, { padding: [50, 50], maxZoom: 8 });
      }
    }
  }, [stormReports, forecastMarker]);

  return (
    <div ref={containerRef} className="w-full h-full bg-black z-0 relative outline-none" style={{ background: '#000' }} />
  );
}