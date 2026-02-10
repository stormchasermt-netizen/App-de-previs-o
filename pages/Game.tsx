import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMultiplayer } from '@/contexts/MultiplayerContext';
import { GameMap } from '@/components/GameMap';
import { mockStore } from '@/lib/store';
import {
  computeScore,
  isGoodForecastForStreak,
} from '@/lib/gameLogic';
import { LAYER_CATEGORIES, PREDEFINED_LAYERS, LAYER_TIMES } from '@/lib/constants';
import type { PrevisaoEvent, PrevisaoDifficulty } from '@/lib/types';
import { 
  Loader2, Send, Shuffle, Target, Map as MapIcon, 
  ChevronLeft, Lock, Trophy, RotateCcw,
  Lightbulb, X, AlertCircle, Crosshair, ArrowLeft, ArrowRight, Settings, Users, Clock, Menu, ChevronDown, ListOrdered, ZoomIn
} from 'lucide-react';
import clsx from 'clsx';

// Helper Icons
function BookOpenIcon(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>; }
function TrendingUpIcon(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>; }
function ZapIcon(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>; }
function MedalIcon(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>; }

// Constants
const DIFFICULTIES_OPTIONS: { value: PrevisaoDifficulty; label: string; desc: string; icon: React.ElementType }[] = [
  { value: 'iniciante', label: 'Iniciante', desc: 'Todas as ferramentas de análise + compostos', icon: BookOpenIcon },
  { value: 'intermediario', label: 'Intermediário', desc: 'Sem parâmetros compostos', icon: TrendingUpIcon },
  { value: 'especialista', label: 'Especialista', desc: 'Apenas análise de superfície', icon: ZapIcon },
  { value: 'mestre', label: 'Mestre', desc: 'Apenas 12Z, raio de 80mi', icon: MedalIcon },
];

type GamePhase = 'setup' | 'loading' | 'playing' | 'result';

export default function Game() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { lobby, currentEventData, submitRoundScore, triggerForceFinish } = useMultiplayer();
  const navigate = useNavigate();
  
  // Logic to determine if we are in multiplayer mode
  const isMultiplayer = !!lobby && (lobby.status === 'playing' || lobby.status === 'round_results');

  // Data
  const [events, setEvents] = useState<PrevisaoEvent[]>([]);
  
  // State
  const [phase, setPhase] = useState<GamePhase>(isMultiplayer ? 'loading' : 'setup');
  const [difficulty, setDifficulty] = useState<PrevisaoDifficulty>('iniciante');
  const [currentEvent, setCurrentEvent] = useState<PrevisaoEvent | null>(null);
  
  // Selection State
  const [selectedParamId, setSelectedParamId] = useState<string | null>('spc_temperature'); 
  const [timeIndex, setTimeIndex] = useState<number>(4); // 12Z
  const [showYear, setShowYear] = useState(false);
  const [showMobileParams, setShowMobileParams] = useState(false); // New Mobile State
  
  // Game Interaction
  const [forecast, setForecast] = useState<{ lat: number; lng: number } | null>(null);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  
  // Target Modal Internal State
  const [tempForecast, setTempForecast] = useState<{ lat: number; lng: number } | null>(null);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  
  // Result Image Zoom
  const [isReferenceImageZoomed, setIsReferenceImageZoomed] = useState(false);

  // Scoring
  const [sessionStreak, setSessionStreak] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);
  const [result, setResult] = useState<any>(null);

  // Multiplayer Specific
  const [hasSubmittedMP, setHasSubmittedMP] = useState(false);
  const [roundTimer, setRoundTimer] = useState<number | null>(null);

  // Load events initially (Only for Solo mode fallback)
  useEffect(() => {
    if (!isMultiplayer) {
        const fetchEvents = async () => {
             const all = await mockStore.getEvents();
             setEvents(all.filter(e => e.active));
        };
        fetchEvents();
    }
  }, [isMultiplayer]);

  // MULTIPLAYER: Sync with Lobby Status & Event ID
  useEffect(() => {
    // If lobby finished, kick out
    if (lobby && lobby.status === 'finished') {
        navigate('/lobby-leaderboard');
        return;
    }

    // 1. GAME START SYNC
    if (lobby && lobby.status === 'playing') {
        setDifficulty(lobby.difficulty);
        
        if (currentEventData) {
            // Check if we are already playing this event to avoid reset
            if (currentEvent?.id !== currentEventData.id) {
                setPhase('loading');
                setCurrentEvent(currentEventData);
                
                // Reset Local State
                setForecast(null);
                setTempForecast(null);
                setHasSubmittedMP(false);
                setShowConfirmationDialog(false);
                setResult(null);
                setShowYear(false);
                setIsTargetModalOpen(false);
                setTimeIndex(4);
                setSelectedParamId('spc_temperature');
                setShowMobileParams(false);
                setIsReferenceImageZoomed(false);
                
                setTimeout(() => setPhase('playing'), 1000);
            }
        }
    } 

    // 2. ROUND END SYNC
    // Instead of navigating away immediately, we show the Result screen locally
    if (lobby && lobby.status === 'round_results') {
        if (phase !== 'result') {
            setPhase('result');
            setHasSubmittedMP(false); // Reset submit flag so we don't show "Waiting" overlay on result screen
        }
    }

  }, [lobby, navigate, currentEvent, currentEventData, phase]);

  // MULTIPLAYER: Handle Round Timer (15s finish)
  useEffect(() => {
      // Only run timer if playing
      if (!isMultiplayer || !lobby?.roundEndTime || lobby.status !== 'playing') {
          setRoundTimer(null);
          return;
      }

      const interval = setInterval(() => {
          const left = Math.ceil((lobby.roundEndTime! - Date.now()) / 1000);
          if (left <= 0) {
              setRoundTimer(0);
              clearInterval(interval);
              if (!hasSubmittedMP) {
                  handleForceSubmitFailure();
              }
          } else {
              setRoundTimer(left);
          }
      }, 1000);

      return () => clearInterval(interval);
  }, [lobby?.roundEndTime, lobby?.status, isMultiplayer, hasSubmittedMP]);


  const activeLayer = useMemo(() => {
    if (!currentEvent || !selectedParamId) return null;
    const timeString = LAYER_TIMES[timeIndex];
    return currentEvent.layers.find(l => l.id === selectedParamId && l.time === timeString) || null;
  }, [currentEvent, selectedParamId, timeIndex]);

  const getParamAvailability = (paramId: string) => {
    if (!currentEvent) return { available: false, locked: true };
    const layerDef = PREDEFINED_LAYERS.find(p => p.id === paramId);
    const existsInEvent = currentEvent.layers.some(l => l.id === paramId);
    
    let isLocked = false;
    if (difficulty === 'intermediario' && layerDef?.category?.includes('Composto')) isLocked = true;
    if (difficulty === 'especialista' && !layerDef?.category?.includes('Superfície') && !layerDef?.category?.includes('Ar Superior')) isLocked = true;
    if (difficulty === 'mestre' && timeIndex !== 4) isLocked = true;

    return { available: existsInEvent, locked: isLocked };
  };

  const startLoading = (diff: PrevisaoDifficulty) => {
    if (events.length === 0) {
        addToast('Nenhum evento disponível no sistema. Aguarde o carregamento ou peça ao admin.', 'error');
        return;
    }
    setDifficulty(diff);
    setPhase('loading');
    setTimeout(() => {
        handleStartGame();
    }, 1500);
  };

  const handleStartGame = () => {
    if (events.length === 0) return;
    
    // RANDOM SELECTION LOGIC
    const randomIndex = Math.floor(Math.random() * events.length);
    const eventToPlay = events[randomIndex];
    
    if (!eventToPlay) {
        addToast('Erro ao selecionar evento.', 'error');
        setPhase('setup');
        return;
    }

    setForecast(null);
    setTempForecast(null);
    setShowConfirmationDialog(false);
    setResult(null);
    setShowYear(false);
    setIsTargetModalOpen(false);
    setIsReferenceImageZoomed(false);
    
    setCurrentEvent(eventToPlay);
    setTimeIndex(4); // 12Z
    setSelectedParamId('spc_temperature');
    setPhase('playing');
  };

  const openTargetModal = () => {
    setTempForecast(forecast); 
    setShowConfirmationDialog(false);
    setIsTargetModalOpen(true);
  };

  const handleModalMapClick = (lat: number, lng: number) => {
    setTempForecast({ lat, lng });
    setShowConfirmationDialog(true);
  };

  const handleConfirmLocation = () => {
    if (tempForecast) {
        setForecast(tempForecast);
        setShowConfirmationDialog(false);
        setIsTargetModalOpen(false); // Close modal on confirm
        addToast('Alvo definido. Clique em "Enviar" para confirmar.', 'success');
    }
  };

  const handleCancelLocation = () => {
    setTempForecast(null);
    setShowConfirmationDialog(false);
  };

  const handleParameterSelect = (id: string) => {
      setSelectedParamId(id);
      setShowMobileParams(false); // Auto close on mobile
  };

  const handleSubmit = async () => {
    if (!forecast || !currentEvent) {
        addToast('Defina um alvo primeiro!', 'error');
        return;
    }
    
    // New Score Logic
    const computed = computeScore(
        forecast.lat, 
        forecast.lng, 
        currentEvent.stormReports, 
        difficulty, 
        sessionStreak
    );

    const goodForStreak = isGoodForecastForStreak(computed.minDistance);
    const nextStreak = goodForStreak ? sessionStreak + 1 : 0;
    
    const resultData = {
        ...computed,
        distanceKm: computed.minDistance,
        streakCount: nextStreak,
    };
    
    // Always set result locally so we can show it later
    setResult(resultData);

    if (isMultiplayer) {
        submitRoundScore(computed.finalScore, computed.minDistance, nextStreak);
        setHasSubmittedMP(true);
        addToast('Previsão enviada! Aguardando outros jogadores...', 'info');
    } else {
        setSessionStreak(nextStreak);
        setCurrentScore(prev => prev + computed.finalScore);
        
        // Save Score (Solo)
        if (user) {
            await mockStore.addScore({
                userId: user.uid,
                displayName: user.displayName,
                photoURL: user.photoURL,
                eventId: currentEvent.id,
                difficulty: difficulty,
                forecastLat: forecast.lat,
                forecastLng: forecast.lng,
                distanceKm: computed.minDistance,
                streakCount: nextStreak,
                basePoints: computed.basePoints,
                difficultyMultiplier: computed.difficultyMultiplier,
                streakBonus: computed.streakBonus,
                finalScore: computed.finalScore
            });
        }
        setPhase('result');
    }
  };

  const handleForceSubmitFailure = () => {
      // Called when timer runs out and user hasn't submitted
      if (isMultiplayer && !hasSubmittedMP) {
          setHasSubmittedMP(true); // IMMEDIATE UPDATE to prevent glitches
          
          // Create dummy result to prevent crash
          setResult({
              finalScore: 0,
              precisionScore: 0,
              clusterScore: 0,
              reportsCaught: 0,
              distanceKm: 99999,
              streakCount: 0,
              minDistance: 99999
          });

          submitRoundScore(0, 99999, 0); // Zero points
          addToast('Tempo esgotado! Pontuação zerada.', 'error');
      }
  };

  const handleHostForceFinish = () => {
      if (isMultiplayer && lobby?.hostId === user?.uid) {
          triggerForceFinish();
      }
  };

  // --- UI RENDER ---

  if (phase === 'setup') {
      return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center animate-in fade-in">
            <div className="mb-8 text-center">
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2 uppercase">Modo Solo</h1>
                <p className="text-slate-400">Configure sua sessão</p>
            </div>

            <div className="w-full max-w-sm space-y-6">
                <div className="space-y-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Nível de Dificuldade</p>
                    {DIFFICULTIES_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => startLoading(opt.value)}
                            className="w-full group relative flex items-center p-4 bg-slate-800/50 hover:bg-slate-800 border border-white/10 hover:border-cyan-500/50 rounded-lg transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="h-10 w-10 rounded-lg bg-slate-700/50 flex items-center justify-center mr-4 group-hover:bg-cyan-500/20 group-hover:text-cyan-400 transition-colors">
                                <opt.icon className="h-5 w-5 text-slate-300" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white group-hover:text-cyan-400 transition-colors">{opt.label}</h3>
                                <p className="text-xs text-slate-400">{opt.desc}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <button onClick={() => navigate('/')} className="mt-12 text-slate-500 hover:text-white flex items-center gap-2 text-sm font-medium">
                <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
        </div>
      );
  }

  if (phase === 'loading') {
      return (
        <div className="fixed inset-0 bg-[#0a0f1a] z-50 flex flex-col items-center justify-center animate-in fade-in duration-500">
             <div className="bg-slate-800/50 p-8 rounded-2xl border border-white/5 flex flex-col items-center">
                <Loader2 className="h-12 w-12 text-cyan-400 animate-spin mb-4" />
                <h2 className="text-xl font-bold text-white mb-1">
                    {isMultiplayer ? 'Sincronizando...' : 'Gerando Dia...'}
                </h2>
                <p className="text-slate-500 text-sm">Carregando dados do modelo</p>
             </div>
        </div>
      );
  }

  // --- RESULT VIEW (SOLO & MULTIPLAYER) ---
  if (phase === 'result' && currentEvent && result) {
      return (
        <div className="fixed inset-0 top-16 bg-[#0a0f1a] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-500 z-10 pb-24">
            <div className="max-w-7xl mx-auto p-4 md:p-8 h-full">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px]">
                    
                    {/* Left: Result Map */}
                    <div className="lg:col-span-2 bg-black border border-white/10 rounded-2xl overflow-hidden relative shadow-2xl flex flex-col min-h-[400px]">
                        <div className="absolute top-4 left-4 z-[400] bg-black/80 backdrop-blur px-4 py-2 rounded-lg border border-white/10 pointer-events-none">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <MapIcon className="h-5 w-5 text-cyan-400" /> Mapa de Resultados
                            </h3>
                            <p className="text-slate-400 text-xs">{currentEvent.displayDate}</p>
                        </div>

                        <div className="flex-1 relative">
                             <GameMap 
                                bounds={currentEvent.bounds}
                                layerImageUrl={null}
                                forecastMarker={forecast}
                                stormReports={currentEvent.stormReports}
                                riskPolygons={currentEvent.riskPolygons} // Pass polygons to map
                                allowPlaceMarker={false}
                            />
                        </div>

                        {/* Map Legend Overlay */}
                        <div className="bg-slate-900 border-t border-white/10 p-3 flex flex-wrap gap-4 text-xs justify-center">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-cyan-400 border-2 border-black shadow-[0_0_5px_cyan]"></div>
                                <span className="text-slate-300">Sua Previsão</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center justify-center w-4 h-4">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#ef4444" stroke="white" strokeWidth="2"><path d="M12 22L2 2h20L12 22z"/></svg>
                                </div>
                                <span className="text-slate-300">Tornado</span>
                            </div>
                             <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-[#facc15] opacity-80 border border-white/30"></div>
                                <span className="text-slate-300">Nível 1</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-[#ef4444] opacity-80 border border-white/30"></div>
                                <span className="text-slate-300">Nível 3</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Score Card */}
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 lg:p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Trophy className="w-48 h-48 text-white" />
                        </div>

                        <div className="relative z-10">
                            <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Pontuação da Rodada</div>
                            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
                                {result.finalScore.toLocaleString()}
                            </div>
                            <div className="text-slate-500 text-sm mt-1">pontos ganhos</div>
                        </div>

                        <div className="relative z-10 space-y-2">
                            <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                                <span className="text-slate-400">Pontos de Precisão (Dot)</span>
                                <span className="text-emerald-400 font-mono font-bold">+{result.precisionScore}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                                <span className="text-slate-400">Pontos de Área (Circle)</span>
                                <span className="text-cyan-400 font-mono font-bold">+{result.clusterScore}</span>
                            </div>
                             <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                                <span className="text-slate-400">Relatos Capturados</span>
                                <span className="text-white font-mono font-bold">{result.reportsCaught}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 relative z-10">
                            <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                <div className="text-3xl font-bold text-white">
                                    {result.distanceKm >= 99900 ? 'N/A' : Math.round(result.distanceKm)} 
                                    <span className="text-sm text-slate-500 font-normal"> km</span>
                                </div>
                                <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Erro (Centro)</div>
                            </div>
                             <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                <div className="text-3xl font-bold text-amber-400">{result.streakCount}</div>
                                <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Sequência (Streak)</div>
                            </div>
                        </div>

                        <div className="mt-auto pt-6 space-y-3 relative z-10">
                            {isMultiplayer ? (
                                <button 
                                    onClick={() => navigate('/lobby-leaderboard')}
                                    className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-cyan-900/40 flex items-center justify-center gap-2 transition-all hover:scale-105 animate-pulse"
                                >
                                    <ListOrdered className="w-5 h-5" /> Ver Placar da Sala
                                </button>
                            ) : (
                                <>
                                    <button 
                                        onClick={handleStartGame}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 transition-all hover:scale-105"
                                    >
                                        <ArrowRight className="w-5 h-5" /> Próxima Rodada
                                    </button>
                                    <button 
                                        onClick={() => setPhase('setup')}
                                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-xl border border-white/5 flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <RotateCcw className="w-4 h-4" /> Voltar ao Menu
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Reference Image (Zoomable) */}
                {currentEvent.reportMapUrl && (
                     <div className="mt-8 flex justify-center">
                         <div className="relative group cursor-zoom-in" onClick={() => setIsReferenceImageZoomed(true)}>
                             <div className="absolute top-2 right-2 bg-black/60 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                 <ZoomIn className="w-5 h-5 text-white" />
                             </div>
                             <img 
                                src={currentEvent.reportMapUrl} 
                                alt="Mapa de Relatos Oficial" 
                                className="max-h-48 rounded-lg border border-white/20 shadow-lg hover:border-cyan-400 transition-all"
                             />
                             <p className="text-center text-xs text-slate-500 mt-2">Mapa de Referência (Clique para expandir)</p>
                         </div>
                     </div>
                )}
            </div>

            {/* FULLSCREEN IMAGE MODAL */}
            {isReferenceImageZoomed && currentEvent.reportMapUrl && (
                <div 
                    className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
                    onClick={() => setIsReferenceImageZoomed(false)}
                >
                    <img 
                        src={currentEvent.reportMapUrl} 
                        className="max-w-full max-h-full rounded shadow-2xl"
                        alt="Zoomed Reference"
                    />
                     <div className="absolute top-4 right-4 text-white">
                         <X className="w-8 h-8" />
                     </div>
                </div>
            )}
        </div>
      );
  }

  // --- PLAYING VIEW ---
  return (
    // Top-16 to sit BELOW the Layout header
    <div className="fixed inset-0 top-16 bg-[#0a0f1a] flex flex-col z-0">
        
        {/* TIMER OVERLAY (Multiplayer) */}
        {roundTimer !== null && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[100] bg-red-600/90 text-white px-6 py-2 rounded-full font-black text-2xl shadow-xl animate-pulse flex items-center gap-2 border border-red-400">
                <Clock className="w-6 h-6" /> {roundTimer}s
            </div>
        )}

        {/* WAITING OVERLAY (Multiplayer Submitted) */}
        {isMultiplayer && hasSubmittedMP && roundTimer === null && phase !== 'result' && (
             <div className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center animate-in fade-in">
                 <div className="bg-slate-900 border border-white/10 p-8 rounded-2xl flex flex-col items-center shadow-2xl">
                     <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
                     <h2 className="text-2xl font-bold text-white">Previsão Enviada</h2>
                     <p className="text-slate-400 mt-1">Aguardando outros jogadores...</p>
                 </div>
             </div>
        )}
        
        {/* TOP BAR - Game Controls */}
        <header className="h-16 bg-[#0a0f1a] border-b border-white/10 flex items-center justify-between px-4 z-50 shrink-0">
            <div className="flex items-center gap-2">
                {!isMultiplayer && (
                    <button 
                        onClick={() => setPhase('setup')} 
                        className="hidden md:flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors border border-white/10"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Dificuldade</span>
                    </button>
                )}
                
                <div className={clsx("px-3 py-2 rounded-md text-sm font-bold border border-white/10 hidden md:block",
                    difficulty === 'iniciante' ? "bg-emerald-900/50 text-emerald-400 border-emerald-500/30" :
                    difficulty === 'intermediario' ? "bg-cyan-900/50 text-cyan-400 border-cyan-500/30" :
                    difficulty === 'especialista' ? "bg-amber-900/50 text-amber-400 border-amber-500/30" : 
                    "bg-rose-900/50 text-rose-400 border-rose-500/30"
                )}>
                    {difficulty === 'iniciante' ? 'Iniciante' : 
                     difficulty === 'intermediario' ? 'Intermediário' :
                     difficulty === 'especialista' ? 'Especialista' : 'Mestre'}
                </div>

                {!isMultiplayer && (
                    <button 
                        onClick={handleStartGame} 
                        className="ml-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                        title="Carregar novo dia aleatório"
                    >
                        <Shuffle className="h-4 w-4" /> 
                        <span className="hidden md:inline">Gerar Dia</span>
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2">
                {/* HOST FORCE FINISH BUTTON */}
                {isMultiplayer && lobby?.hostId === user?.uid && !lobby.roundEndTime && (
                     <button 
                        onClick={handleHostForceFinish}
                        className="bg-red-900/50 hover:bg-red-600 text-red-200 hover:text-white border border-red-500/30 px-3 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all"
                        title="Forçar fim da rodada (15s)"
                     >
                        <Clock className="w-4 h-4" /> 
                        <span className="hidden md:inline">Finalizar Rodada</span>
                     </button>
                )}

                {/* Place Target Button - Opens Modal */}
                <button 
                    onClick={openTargetModal}
                    className={clsx(
                        "px-3 md:px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors border",
                        forecast 
                            ? "bg-slate-700 text-slate-400 border-white/10" 
                            : "bg-slate-700 hover:bg-slate-600 text-white border-white/20"
                    )}
                >
                    <Crosshair className="h-4 w-4" /> 
                    <span className="hidden sm:inline">Posicionar Alvo</span>
                    <span className="sm:hidden">Alvo</span>
                </button>

                {/* Submit Button - Active only when forecast is set */}
                <button 
                    onClick={handleSubmit}
                    disabled={!forecast || (isMultiplayer && hasSubmittedMP)}
                    className={clsx(
                        "px-3 md:px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all border",
                        (!forecast || (isMultiplayer && hasSubmittedMP))
                            ? "bg-slate-800 text-slate-600 border-white/5 cursor-not-allowed"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-pulse"
                    )}
                >
                    <Send className="h-4 w-4" /> 
                    <span className="hidden sm:inline">Enviar</span>
                </button>

                 <button 
                    onClick={() => setShowYear(!showYear)}
                    className="ml-2 bg-purple-600 hover:bg-purple-500 text-white border border-purple-400 px-3 md:px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-purple-900/20"
                >
                    <Lightbulb className="h-4 w-4" /> 
                    <span className="hidden sm:inline">{showYear && currentEvent ? currentEvent.eventDate.split('-')[0] : 'Revelar Ano'}</span>
                </button>
            </div>

            <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-md border border-white/10 ml-4 hidden md:flex">
                <Trophy className="h-4 w-4 text-slate-400" />
                <span className="font-mono font-bold text-white text-lg">{currentScore.toFixed(0)}</span>
            </div>
        </header>

        {/* DESKTOP TIME SLIDER (Hidden on mobile) */}
        <div className="hidden md:flex h-12 bg-[#05080f] border-b border-white/5 items-center justify-center px-8 relative z-40 shrink-0">
            <div className="w-full max-w-3xl flex items-center gap-4">
                <span className="text-xs font-mono text-slate-500">{LAYER_TIMES[0]}</span>
                <input 
                    type="range" min="0" max={LAYER_TIMES.length - 1} step="1" value={timeIndex}
                    onChange={(e) => setTimeIndex(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400"
                />
                <span className="text-xs font-mono text-slate-500">{LAYER_TIMES[LAYER_TIMES.length - 1]}</span>
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-8 pointer-events-none">
                     <div className="bg-slate-800 text-cyan-400 text-xs font-bold px-3 py-1 rounded-full border border-cyan-500/30 shadow-lg">
                        {LAYER_TIMES[timeIndex]}
                     </div>
                </div>
            </div>
        </div>

        {/* MOBILE CONTROL BAR (Hidden on desktop) */}
        <div className="md:hidden h-14 bg-[#0a0f1a] border-b border-white/10 flex items-center justify-between px-4 z-40 relative">
             <button 
                onClick={() => setShowMobileParams(!showMobileParams)}
                className={clsx(
                    "flex items-center gap-2 px-3 py-2 rounded border text-xs font-bold transition-all",
                    showMobileParams 
                        ? "bg-cyan-900/50 text-cyan-400 border-cyan-500/50" 
                        : "bg-slate-800 text-slate-300 border-white/10"
                )}
             >
                 <Menu className="w-4 h-4" /> 
                 Parâmetros
                 <ChevronDown className={clsx("w-3 h-3 transition-transform", showMobileParams ? "rotate-180" : "")} />
             </button>

             <div className="flex-1 mx-4 flex flex-col justify-center">
                 <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-1 px-1">
                     <span>{LAYER_TIMES[0]}</span>
                     <span className="text-cyan-400 font-bold">{LAYER_TIMES[timeIndex]}</span>
                     <span>{LAYER_TIMES[LAYER_TIMES.length-1]}</span>
                 </div>
                 <input 
                    type="range" min="0" max={LAYER_TIMES.length - 1} step="1" value={timeIndex}
                    onChange={(e) => setTimeIndex(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
             </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex overflow-hidden relative">
            
            {/* DESKTOP SIDEBAR */}
            <aside className="hidden md:flex w-64 bg-[#0a0f1a] border-r border-white/5 flex-col z-10 shrink-0">
                <div className="p-4 border-b border-white/5">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Settings className="h-4 w-4 text-cyan-500" /> Parâmetros
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {LAYER_CATEGORIES.map((cat) => (
                        <div key={cat} className="mb-4">
                            <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-3 mb-2">{cat}</h4>
                            <div className="space-y-0.5">
                                {PREDEFINED_LAYERS.filter(l => l.category === cat).map((layerDef) => {
                                    const { available, locked } = getParamAvailability(layerDef.id);
                                    const isSelected = selectedParamId === layerDef.id;
                                    return (
                                        <button
                                            key={layerDef.id}
                                            onClick={() => !locked && handleParameterSelect(layerDef.id)}
                                            disabled={locked}
                                            className={clsx(
                                                "w-full text-left px-3 py-2 rounded text-xs font-medium flex items-center justify-between transition-colors",
                                                isSelected ? "bg-cyan-900/30 text-cyan-400 border-l-2 border-cyan-500" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
                                                locked && "opacity-50 cursor-not-allowed hover:bg-transparent"
                                            )}
                                        >
                                            <span className="truncate">{layerDef.name}</span>
                                            {locked ? <Lock className="h-3 w-3 text-slate-600" /> : available ? (isSelected && <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />) : <span className="text-[10px] text-slate-600">N/A</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* MOBILE DROPDOWN PARAMETER MENU (OVERLAY) */}
            {showMobileParams && (
                <div className="absolute top-0 left-0 w-full bg-[#0a0f1a]/95 backdrop-blur-md z-50 border-b border-white/10 shadow-2xl animate-in slide-in-from-top-2 md:hidden max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
                    {LAYER_CATEGORIES.map((cat) => (
                        <div key={cat} className="mb-4">
                            <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-3 mb-2">{cat}</h4>
                            <div className="grid grid-cols-1 gap-1">
                                {PREDEFINED_LAYERS.filter(l => l.category === cat).map((layerDef) => {
                                    const { available, locked } = getParamAvailability(layerDef.id);
                                    const isSelected = selectedParamId === layerDef.id;
                                    return (
                                        <button
                                            key={layerDef.id}
                                            onClick={() => !locked && handleParameterSelect(layerDef.id)}
                                            disabled={locked}
                                            className={clsx(
                                                "w-full text-left px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-between transition-colors border border-transparent",
                                                isSelected ? "bg-cyan-900/30 text-cyan-400 border-cyan-500/30" : "text-slate-300 bg-slate-800/50 hover:bg-slate-800",
                                                locked && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <span className="truncate">{layerDef.name}</span>
                                            {locked ? <Lock className="h-3 w-3 text-slate-600" /> : available ? (isSelected && <div className="h-2 w-2 rounded-full bg-cyan-400" />) : <span className="text-[10px] text-slate-600">N/A</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MAIN DISPLAY AREA */}
            <main className="flex-1 relative bg-black flex items-center justify-center overflow-hidden p-0 md:p-4">
                {/* Info Overlay */}
                <div className="absolute top-4 right-4 z-[30] flex flex-col items-end pointer-events-none">
                     <div className="bg-black/80 backdrop-blur border border-white/10 px-4 py-2 rounded-lg mb-2">
                        <div className="text-xs text-slate-400 uppercase tracking-wider">Visualizando</div>
                        <div className="text-white font-bold text-sm">
                            {PREDEFINED_LAYERS.find(p => p.id === selectedParamId)?.name || 'Mapa Base'}
                            <span className="ml-2 text-cyan-400">{LAYER_TIMES[timeIndex]}</span>
                        </div>
                     </div>
                     {isMultiplayer && (
                         <div className="bg-cyan-900/80 backdrop-blur border border-cyan-500/30 px-4 py-2 rounded-lg flex items-center gap-2 animate-pulse">
                             <Users className="w-4 h-4 text-cyan-200" />
                             <span className="text-cyan-100 font-bold text-xs uppercase tracking-widest">Multiplayer</span>
                         </div>
                     )}
                </div>

                {/* PLAYING MODE: Show Static Image (Stretched/Contained 4:3) */}
                <div className="relative w-full h-full flex items-center justify-center">
                    {/* Changed container aspect ratio to 4:3 */}
                    <div className="relative w-full h-full md:w-auto md:h-full md:aspect-[4/3] bg-[#05080f] md:border border-white/10 shadow-2xl overflow-hidden">
                        {activeLayer ? (
                            <img 
                                src={activeLayer.imageUrl} 
                                alt="Weather Model" 
                                className="w-full h-full object-contain md:object-fill" 
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-center text-slate-500 p-8">
                                <MapIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
                                <p>Nenhuma imagem disponível.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>

        {/* MODAL: TARGET PLACEMENT */}
        {isTargetModalOpen && currentEvent && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="w-full max-w-4xl h-[85vh] bg-slate-900 border border-white/20 rounded-xl overflow-hidden shadow-2xl flex flex-col relative">
                    {/* Modal Header */}
                    <div className="bg-slate-950 px-4 py-3 border-b border-white/10 flex justify-between items-center shrink-0">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <Target className="h-5 w-5 text-cyan-400" /> Defina seu Alvo
                        </h3>
                        <button 
                            onClick={() => setIsTargetModalOpen(false)}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Modal Map Container */}
                    <div className="flex-1 relative bg-black">
                        
                        {/* 1. Map Component */}
                        <GameMap 
                            bounds={currentEvent.bounds}
                            layerImageUrl={null} // Pure map for targeting
                            forecastMarker={tempForecast}
                            stormReports={[]} // Hide reports while guessing
                            allowPlaceMarker={!showConfirmationDialog} // Clickable until dialog pops up
                            onPlaceMarker={handleModalMapClick}
                        />

                        {/* 2. Instructions (Top Left) */}
                        <div className="absolute top-4 left-4 z-[400] bg-black/70 backdrop-blur px-3 py-2 rounded text-xs text-slate-300 pointer-events-none border border-white/10 shadow-lg max-w-xs">
                           Clique no mapa para posicionar seu alvo.
                        </div>

                        {/* 3. Confirmation Dialog Overlay (Centered) */}
                        {showConfirmationDialog && tempForecast && (
                             <div className="absolute inset-0 z-[500] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                                <div className="bg-slate-900 border border-cyan-500/50 p-6 rounded-xl shadow-2xl shadow-cyan-900/50 transform animate-in zoom-in-95 duration-200 max-w-sm text-center">
                                    <AlertCircle className="h-10 w-10 text-cyan-400 mx-auto mb-3" />
                                    <h4 className="text-lg font-bold text-white mb-1">Confirmar Localização?</h4>
                                    <p className="text-sm text-slate-400 mb-6">
                                        Lat: {tempForecast.lat.toFixed(3)}, Lng: {tempForecast.lng.toFixed(3)}
                                    </p>
                                    <div className="flex gap-3 justify-center">
                                        <button 
                                            onClick={handleCancelLocation}
                                            className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded font-medium border border-white/10"
                                        >
                                            Não, Mudar
                                        </button>
                                        <button 
                                            onClick={handleConfirmLocation}
                                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold shadow-lg"
                                        >
                                            Sim, Confirmar
                                        </button>
                                    </div>
                                </div>
                             </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}