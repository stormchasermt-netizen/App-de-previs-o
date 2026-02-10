import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMultiplayer } from '@/contexts/MultiplayerContext';
import { useAuth } from '@/contexts/AuthContext';
import { mockStore } from '@/lib/store';
import { Users, Copy, Play, Loader2, LogOut, Shield, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { useToast } from '@/contexts/ToastContext';

export default function Lobby() {
    const { code } = useParams();
    const { lobby, joinLobby, leaveLobby, startGame } = useMultiplayer();
    const { user } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    // Auto-join if url param exists and not in lobby
    useEffect(() => {
        if (code && user && (!lobby || lobby.code !== code)) {
            joinLobby(code);
        }
    }, [code, user, lobby]);

    // Redirect if playing
    useEffect(() => {
        if (lobby?.status === 'playing') {
            navigate('/jogar');
        }
    }, [lobby?.status]);

    if (!user) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <p className="text-white mb-4">Você precisa estar logado para entrar na sala.</p>
                <button onClick={() => navigate('/login')} className="bg-white text-black px-4 py-2 rounded font-bold">Fazer Login</button>
            </div>
        );
    }

    if (!lobby) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
        );
    }

    const isHost = lobby.hostId === user.uid;
    const isAdmin = user.type === 'admin' || user.type === 'superadmin';
    const playerCount = lobby.players.length;
    const canStart = playerCount >= 2;

    const handleCopyInvite = () => {
        const url = `${window.location.origin}/#/lobby/${lobby.code}`;
        navigator.clipboard.writeText(url);
        addToast('Link copiado para a área de transferência!', 'success');
    };

    const handleStart = async () => {
        if (!canStart) {
            addToast("Mínimo de 2 jogadores para iniciar.", 'error');
            return;
        }

        // Pick random event (async)
        const allEvents = await mockStore.getEvents();
        const activeEvents = allEvents.filter(e => e.active);
        
        if (activeEvents.length === 0) {
            addToast("Nenhum evento disponível.", 'error');
            return;
        }
        
        const random = activeEvents[Math.floor(Math.random() * activeEvents.length)];
        startGame(random.id);
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 animate-in fade-in pb-32">
            {/* Header */}
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-black text-white uppercase tracking-tight">Sala de Espera</h1>
                <div className="inline-flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg border border-white/10">
                    <span className="text-slate-400 text-sm font-bold uppercase">Código:</span>
                    <span className="text-cyan-400 font-mono text-xl tracking-widest font-bold">{lobby.code}</span>
                    {(isAdmin || isHost) && (
                        <button onClick={handleCopyInvite} className="ml-2 text-slate-400 hover:text-white" title="Copiar Link">
                            <Copy className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Players Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {lobby.players.map(player => (
                    <div key={player.uid} className="bg-slate-900 border border-white/10 p-4 rounded-xl flex flex-col items-center relative group">
                        {player.isHost && (
                            <div className="absolute top-2 right-2 text-amber-400" title="Host">
                                <Shield className="w-4 h-4" />
                            </div>
                        )}
                        <div className="w-16 h-16 rounded-full bg-slate-800 mb-3 overflow-hidden border-2 border-slate-700">
                            {player.photoURL ? (
                                <img src={player.photoURL} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-xl font-bold text-slate-500">
                                    {player.displayName[0]}
                                </div>
                            )}
                        </div>
                        <div className="font-bold text-white text-center truncate w-full">{player.displayName}</div>
                        <div className="text-xs text-emerald-400 font-bold mt-1">Pronto</div>
                    </div>
                ))}
                
                {/* Empty Slots visuals */}
                {[...Array(Math.max(0, 4 - lobby.players.length))].map((_, i) => (
                    <div key={i} className="bg-slate-900/30 border border-white/5 border-dashed p-4 rounded-xl flex flex-col items-center justify-center opacity-50">
                        <Users className="w-8 h-8 text-slate-600 mb-2" />
                        <span className="text-xs text-slate-600">Aguardando...</span>
                    </div>
                ))}
            </div>

            {/* Controls - Fixed Bottom (Raised slightly to avoid global footer overlap) */}
            <div className="fixed bottom-8 left-0 w-full bg-[#0a0f1a] border-t border-white/10 p-4 z-[60] shadow-2xl">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <button 
                        onClick={leaveLobby}
                        className="flex items-center gap-2 text-red-400 hover:text-red-300 font-bold px-4 py-3 rounded-lg hover:bg-red-900/10 transition-colors"
                    >
                        <LogOut className="w-5 h-5" /> Sair
                    </button>

                    <div className="flex items-center gap-4">
                        <div className={clsx("text-sm hidden sm:block font-medium", playerCount >= 20 ? "text-red-400" : "text-slate-400")}>
                            {playerCount}/20 jogadores
                        </div>
                        
                        {isHost ? (
                            <div className="flex flex-col items-end">
                                <button 
                                    onClick={handleStart}
                                    disabled={!canStart}
                                    className={clsx(
                                        "px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all",
                                        canStart 
                                            ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 hover:scale-105" 
                                            : "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
                                    )}
                                >
                                    <Play className="w-5 h-5" /> Iniciar Partida
                                </button>
                                {!canStart && (
                                    <span className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" /> Mínimo 2 jogadores
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-slate-400 bg-slate-800 px-4 py-3 rounded-lg animate-pulse border border-white/5">
                                <Loader2 className="w-4 h-4 animate-spin" /> Aguardando o Host iniciar...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}