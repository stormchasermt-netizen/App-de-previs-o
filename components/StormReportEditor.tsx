import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { StormReport } from '@/lib/types';
import { MapPin, Trash2, Save, X, PenTool, Eraser, Maximize2, Minimize2, ChevronRight, ChevronLeft, Minus, Layers, PlusCircle, Globe } from 'lucide-react';
import clsx from 'clsx';

// Fix for Leaflet icons
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

interface StormReportEditorProps {
    reports: StormReport[];
    onUpdate: (reports: StormReport[]) => void;
}

export function StormReportEditor({ reports, onUpdate }: StormReportEditorProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const tileLayerRef = useRef<L.TileLayer | null>(null);
    const markersRef = useRef<L.Marker[]>([]);
    const tracksLayerRef = useRef<L.LayerGroup | null>(null);

    // Modal & UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false); // Controls if the popup is hidden/docked
    const [isFullscreen, setIsFullscreen] = useState(false); // Controls map fullscreen mode
    const [mapStyle, setMapStyle] = useState<'dark' | 'satellite'>('dark');
    
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [tempReport, setTempReport] = useState<Partial<StormReport>>({ type: 'tornado' });
    
    // Drawing State
    const [isDrawingTrack, setIsDrawingTrack] = useState(false);
    
    // Initialize Map
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: [-25, -55],
            zoom: 4
        });

        // Initialize Tile Layer (Dark by default)
        const layer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO',
        }).addTo(map);
        tileLayerRef.current = layer;

        const tracksGroup = L.layerGroup().addTo(map);
        tracksLayerRef.current = tracksGroup;

        mapRef.current = map;

        // Force resize initially
        setTimeout(() => map.invalidateSize(), 200);

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // Handle Map Style Change
    useEffect(() => {
        if (!mapRef.current) return;
        
        // Remove old layer
        if (tileLayerRef.current) {
            mapRef.current.removeLayer(tileLayerRef.current);
        }

        const url = mapStyle === 'dark' 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

        const attribution = mapStyle === 'dark' ? '&copy; CARTO' : '&copy; Esri';

        const newLayer = L.tileLayer(url, { attribution });
        newLayer.addTo(mapRef.current);
        tileLayerRef.current = newLayer;

    }, [mapStyle]);

    // Resize Observer & Fullscreen Handler
    useEffect(() => {
        if (!mapContainerRef.current || !mapRef.current) return;
        
        // CORREÇÃO: O timeout deve ser maior que a duração da transição CSS (300ms)
        const transitionTimer = setTimeout(() => {
            mapRef.current?.invalidateSize();
        }, 350);

        const resizeObserver = new ResizeObserver(() => {
            mapRef.current?.invalidateSize();
        });
        resizeObserver.observe(mapContainerRef.current);
        
        return () => {
            clearTimeout(transitionTimer);
            resizeObserver.disconnect();
        };
    }, [isFullscreen]);

    // Sync Markers and Tracks with Reports
    useEffect(() => {
        if (!mapRef.current || !tracksLayerRef.current) return;

        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];
        tracksLayerRef.current.clearLayers();

        reports.forEach((report, index) => {
            const color = report.type === 'tornado' ? '#ef4444' : report.type === 'vento' ? '#3b82f6' : '#22c55e';
            
            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color:${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px ${color};"></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            });

            const marker = L.marker([report.lat, report.lng], { 
                icon, 
                draggable: true 
            }).addTo(mapRef.current!);

            if (report.track && report.track.length > 1) {
                L.polyline(report.track, { color, weight: 3, opacity: 0.7 }).addTo(tracksLayerRef.current!);
            }

            marker.on('dragend', (e) => {
                const newLatLng = (e.target as L.Marker).getLatLng();
                const updatedReports = [...reports];
                const oldTrack = updatedReports[index].track || [];
                let newTrack = oldTrack;
                
                if (oldTrack.length > 0) {
                     newTrack = [ { lat: newLatLng.lat, lng: newLatLng.lng }, ...oldTrack.slice(1) ];
                }

                updatedReports[index] = { 
                    ...updatedReports[index], 
                    lat: newLatLng.lat, 
                    lng: newLatLng.lng,
                    track: newTrack
                };
                onUpdate(updatedReports);
            });

            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                setEditingIndex(index);
                setTempReport({ ...report });
                setIsDrawingTrack(false);
                setIsModalOpen(true);
                setIsMinimized(false);
            });

            markersRef.current.push(marker);
        });

    }, [reports, onUpdate]);


    // Click Handler for Map
    useEffect(() => {
        if (!mapRef.current) return;

        const handleMapClick = (e: L.LeafletMouseEvent) => {
            if (isDrawingTrack) {
                setTempReport(prev => {
                    const currentTrack = prev.track || [];
                    const startPoint = (currentTrack.length === 0 && prev.lat && prev.lng) 
                        ? [{ lat: prev.lat, lng: prev.lng }] 
                        : currentTrack;
                    
                    return {
                        ...prev,
                        track: [...startPoint, { lat: e.latlng.lat, lng: e.latlng.lng }]
                    };
                });
            } else {
                if (!isModalOpen) {
                    setEditingIndex(null);
                    setTempReport({
                        lat: e.latlng.lat,
                        lng: e.latlng.lng,
                        type: 'tornado',
                        rating: 'F0',
                        track: []
                    });
                    setIsModalOpen(true);
                    setIsMinimized(false);
                }
            }
        };

        mapRef.current.on('click', handleMapClick);
        return () => {
            mapRef.current?.off('click', handleMapClick);
        };
    }, [isDrawingTrack, isModalOpen]);

    // Live render of track being drawn
    useEffect(() => {
        if (!mapRef.current || !tracksLayerRef.current) return;
        if (isModalOpen && tempReport.track && tempReport.track.length > 0) {
            const tempTrackLine = L.polyline(tempReport.track, { color: '#ffff00', dashArray: '5, 5', weight: 4 }).addTo(mapRef.current);
            return () => {
                tempTrackLine.remove();
            };
        }
    }, [tempReport.track, isModalOpen]);


    const handleManualAdd = () => {
        // Center on map or default
        const center = mapRef.current?.getCenter() || { lat: -25, lng: -55 };
        setEditingIndex(null);
        setTempReport({
            lat: center.lat,
            lng: center.lng,
            type: 'tornado',
            rating: 'F0',
            track: []
        });
        setIsModalOpen(true);
        setIsMinimized(false);
        setIsDrawingTrack(false);
    };

    const handleSave = () => {
        if (!tempReport.lat || !tempReport.lng || !tempReport.type) return;

        const newReport = tempReport as StormReport;
        
        if (editingIndex !== null) {
            const updated = [...reports];
            updated[editingIndex] = newReport;
            onUpdate(updated);
        } else {
            onUpdate([...reports, newReport]);
        }
        setIsModalOpen(false);
        setIsDrawingTrack(false);
        setIsMinimized(false);
    };

    const handleDelete = () => {
        if (editingIndex !== null) {
            const updated = reports.filter((_, i) => i !== editingIndex);
            onUpdate(updated);
            setIsModalOpen(false);
            setIsMinimized(false);
        }
    };

    const handleClearTrack = () => {
         setTempReport(prev => ({ ...prev, track: [] }));
         setIsDrawingTrack(false);
    };

    const toggleDrawing = () => {
        const newState = !isDrawingTrack;
        setIsDrawingTrack(newState);
        if (newState) {
            setIsMinimized(true);
        } else {
            setIsMinimized(false);
        }
    };

    const toggleMapStyle = () => {
        setMapStyle(prev => prev === 'dark' ? 'satellite' : 'dark');
    };

    return (
        <div 
            className={clsx(
                "relative border border-white/10 rounded-lg overflow-hidden transition-all duration-300",
                isFullscreen ? "fixed inset-0 z-[9999] bg-black" : "relative z-0"
            )}
        >
            {/* Map Container */}
            <div 
                ref={mapContainerRef} 
                className={clsx("w-full bg-slate-900 z-0", isFullscreen ? "h-full" : "h-[400px]")} 
            />
            
            {/* Top Right Controls */}
            <div className="absolute top-2 right-2 z-[400] flex items-center gap-2">
                <button
                    onClick={handleManualAdd}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded border border-white/20 shadow-lg text-xs font-bold flex items-center gap-2"
                    title="Adicionar Relato Manualmente"
                >
                    <PlusCircle className="w-4 h-4" /> 
                    <span className="hidden sm:inline">Adicionar Manual</span>
                </button>

                <button 
                    onClick={toggleMapStyle}
                    className="bg-black/70 hover:bg-black text-white p-2 rounded border border-white/20 shadow-lg"
                    title={mapStyle === 'dark' ? "Mudar para Satélite" : "Mudar para Escuro"}
                >
                    {mapStyle === 'dark' ? <Globe className="w-5 h-5 text-blue-400" /> : <Layers className="w-5 h-5 text-slate-300" />}
                </button>

                <button 
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="bg-black/70 hover:bg-black text-white p-2 rounded border border-white/20 shadow-lg"
                    title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
                >
                    {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
            </div>

            {/* Info Badge */}
            <div className="absolute top-2 left-2 z-[400] bg-black/70 backdrop-blur px-3 py-1 rounded text-xs text-slate-300 pointer-events-none border border-white/10">
                {isDrawingTrack ? 'MODO DESENHO: CLIQUE NO MAPA' : 'Clique no mapa para adicionar relato. Arraste para mover.'}
            </div>

            {/* Modal Dialog (Popup) */}
            {isModalOpen && (
                <>
                    {/* MINIMIZED STATE (Side Dock) */}
                    {isMinimized ? (
                        <div 
                            className="absolute right-0 top-1/2 -translate-y-1/2 z-[500] cursor-pointer animate-in slide-in-from-right"
                            onClick={() => setIsMinimized(false)}
                        >
                            <div className="bg-cyan-600 hover:bg-cyan-500 text-white p-3 rounded-l-xl shadow-2xl border-y border-l border-white/20 flex items-center gap-2">
                                <ChevronLeft className="w-5 h-5" />
                                <div className="writing-vertical-lr text-xs font-bold uppercase tracking-widest hidden sm:block rotate-180" style={{ writingMode: 'vertical-rl' }}>
                                    {isDrawingTrack ? 'Desenhando...' : 'Editar Relato'}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* EXPANDED STATE (Floating Window) */
                        <div className={clsx("absolute z-[500] flex justify-end p-4 pointer-events-none", isFullscreen ? "bottom-4 right-4" : "inset-0 items-center justify-center bg-black/60")}>
                            <div className="bg-slate-900 border border-white/20 rounded-xl w-full max-w-xs shadow-2xl animate-in zoom-in-95 duration-200 pointer-events-auto flex flex-col overflow-hidden">
                                
                                {/* Modal Header */}
                                <div className="bg-slate-950 px-4 py-3 border-b border-white/10 flex justify-between items-center handle cursor-grab">
                                    <h3 className="text-white font-bold flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-cyan-400" />
                                        {editingIndex !== null ? 'Editar Relato' : 'Novo Relato'}
                                    </h3>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => setIsMinimized(true)} 
                                            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                                            title="Minimizar"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => { setIsModalOpen(false); setIsDrawingTrack(false); }}
                                            className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400"
                                            title="Fechar"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Modal Content */}
                                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                    {/* Manual Coordinates Inputs */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Latitude</label>
                                            <input 
                                                type="number"
                                                step="0.0001"
                                                className="w-full bg-slate-800 border border-white/10 rounded p-1.5 text-white text-xs"
                                                value={tempReport.lat}
                                                onChange={e => setTempReport({...tempReport, lat: parseFloat(e.target.value)})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Longitude</label>
                                            <input 
                                                type="number"
                                                step="0.0001"
                                                className="w-full bg-slate-800 border border-white/10 rounded p-1.5 text-white text-xs"
                                                value={tempReport.lng}
                                                onChange={e => setTempReport({...tempReport, lng: parseFloat(e.target.value)})}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Tipo</label>
                                        <select 
                                            className="w-full bg-slate-800 border border-white/10 rounded p-2 text-white text-sm focus:border-cyan-500 outline-none"
                                            value={tempReport.type}
                                            onChange={e => setTempReport({ ...tempReport, type: e.target.value as any })}
                                        >
                                            <option value="tornado">Tornado</option>
                                            <option value="vento">Vento (Wind)</option>
                                            <option value="granizo">Granizo (Hail)</option>
                                        </select>
                                    </div>

                                    {tempReport.type === 'tornado' && (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Intensidade (Escala EF)</label>
                                                <select 
                                                    className="w-full bg-slate-800 border border-white/10 rounded p-2 text-white text-sm focus:border-cyan-500 outline-none"
                                                    value={tempReport.rating || 'F0'}
                                                    onChange={e => setTempReport({ ...tempReport, rating: e.target.value })}
                                                >
                                                    <option value="F0">EF0 / F0</option>
                                                    <option value="F1">EF1 / F1</option>
                                                    <option value="F2">EF2 / F2</option>
                                                    <option value="F3">EF3 / F3</option>
                                                    <option value="F4">EF4 / F4</option>
                                                    <option value="F5">EF5 / F5</option>
                                                </select>
                                            </div>

                                            {/* TRACK EDITOR BUTTONS */}
                                            <div className="bg-slate-950 p-2 rounded border border-white/5">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-xs text-slate-500 font-bold uppercase">Trilha de Danos</span>
                                                    <span className="text-[10px] text-slate-600">{(tempReport.track?.length || 0)} pts</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={toggleDrawing}
                                                        className={clsx(
                                                            "flex-1 py-1.5 px-2 rounded text-xs font-bold flex items-center justify-center gap-1 border transition-colors",
                                                            isDrawingTrack 
                                                                ? "bg-amber-500 text-black border-amber-400 animate-pulse" 
                                                                : "bg-slate-800 text-slate-300 border-white/10 hover:bg-slate-700"
                                                        )}
                                                    >
                                                        <PenTool className="w-3 h-3" />
                                                        {isDrawingTrack ? 'Parar Desenho' : 'Traçar Trilha'}
                                                    </button>
                                                    
                                                    {tempReport.track && tempReport.track.length > 0 && (
                                                        <button 
                                                            onClick={handleClearTrack}
                                                            className="px-2 bg-slate-800 text-red-400 border border-white/10 rounded hover:bg-red-900/20"
                                                            title="Limpar Trilha"
                                                        >
                                                            <Eraser className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-2 leading-tight">
                                                    Ao clicar em "Traçar", esta janela será minimizada. Clique no mapa para desenhar.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-2 pt-2 border-t border-white/5">
                                        <button 
                                            onClick={handleSave}
                                            className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded text-sm font-bold flex justify-center gap-2"
                                        >
                                            <Save className="w-4 h-4" /> Salvar
                                        </button>
                                        {editingIndex !== null && (
                                            <button 
                                                onClick={handleDelete}
                                                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-3 rounded"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}