import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { CloudLightning, Settings, BarChart2, User, X, LogOut, Save, Volume2, Music, Shield } from 'lucide-react';
import clsx from 'clsx';
import { mockStore } from '@/lib/store';

export default function Layout({ children }: { children?: React.ReactNode }) {
  const { user, loginWithGoogle, updateUsername, logout } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  
  // Settings State (Mock)
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);

  // Account State
  const [newUsername, setNewUsername] = useState('');
  
  const handleOpenAccount = () => {
      setIsSettingsOpen(false);
      setNewUsername(user?.displayName || '');
      setIsAccountOpen(true);
  };

  const handleSaveProfile = () => {
      if(newUsername.trim()) {
          updateUsername(newUsername);
          setIsAccountOpen(false);
      }
  };

  const handleGoogleLogin = () => {
      loginWithGoogle();
  };

  const stats = user ? mockStore.getScores().filter(s => s.userId === user.uid) : [];
  const totalScore = stats.reduce((acc, curr) => acc + curr.finalScore, 0);
  const bestDistance = stats.length > 0 ? Math.min(...stats.map(s => s.distanceKm)) : 0;
  const bestDistanceMi = (bestDistance * 0.621371).toFixed(0);

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white font-sans selection:bg-cyan-500/30 relative overflow-x-hidden">
      
      {/* DYNAMIC BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          {/* Base Gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-[#020617] to-black"></div>
          
          {/* Animated Clouds (CSS driven) */}
          <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
          
          {/* Lightning Flash Layer */}
          <div className="absolute inset-0 z-0 bg-white opacity-0 animate-lightning pointer-events-none mix-blend-overlay"></div>
          
          {/* Ambient Glows */}
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[120px] rounded-full animate-pulse-slow"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full"></div>
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#0a0f1a]/80 backdrop-blur-md px-6 h-16 flex items-center justify-between border-b border-white/5 shadow-lg shadow-black/20">
         <div className="flex items-center gap-4">
             <Link to="/" className="text-xs font-bold tracking-widest text-slate-400 hover:text-white uppercase flex items-center gap-2 transition-colors">
                <CloudLightning className="h-5 w-5 text-cyan-400" /> 
                <span className="hidden sm:inline">Previsão Master</span>
             </Link>
         </div>

         <div className="flex items-center gap-2">
            {!user ? (
                 <button 
                    onClick={handleGoogleLogin}
                    className="flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-full text-sm font-bold hover:bg-cyan-50 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                 >
                    <img src="https://www.google.com/favicon.ico" alt="G" className="w-3 h-3" />
                    Entrar com Google
                 </button>
            ) : (
                <>
                    {(user.type === 'admin' || user.type === 'superadmin') && (
                        <Link to="/admin" className="p-2 text-amber-400 hover:bg-white/5 rounded-lg transition-colors" title="Painel Admin">
                            <Shield className="w-5 h-5" />
                        </Link>
                    )}

                    <Link to="/ranking" className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                        <BarChart2 className="w-5 h-5" />
                    </Link>

                    <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <Settings className="w-5 h-5" />
                    </button>

                    <div className="ml-2 flex items-center gap-2 bg-slate-800/50 pl-1 pr-3 py-1 rounded-full border border-white/10 hover:border-cyan-500/30 transition-colors">
                         {user.photoURL ? (
                             <img src={user.photoURL} className="w-6 h-6 rounded-full" alt="Profile" />
                         ) : (
                             <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center text-xs font-bold">{user.displayName[0]}</div>
                         )}
                         <span className="text-xs font-bold text-slate-300 max-w-[80px] truncate">{user.displayName}</span>
                    </div>
                </>
            )}
         </div>
      </header>

      <main className="w-full relative z-10">
        {children}
      </main>

      <footer className="fixed bottom-0 w-full py-4 text-center text-[10px] text-slate-600 border-t border-white/5 bg-[#0a0f1a]/90 backdrop-blur z-30">
          <div className="flex items-center justify-center gap-2">
            <CloudLightning className="h-3 w-3" /> © 2025 Previsão Master
          </div>
      </footer>

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-md bg-[#161b22] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-white/5">
                      <h2 className="text-lg font-bold flex items-center gap-2">
                          <Settings className="w-5 h-5 text-blue-400" /> Configurações
                      </h2>
                      <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
                  </div>
                  
                  <div className="p-4 space-y-4">
                      {/* Account Settings Button */}
                      <button 
                        onClick={handleOpenAccount}
                        className="w-full flex items-center justify-between bg-slate-800/50 hover:bg-slate-800 border border-white/5 p-4 rounded-lg transition-colors group"
                      >
                          <div className="flex items-center gap-3">
                              <div className="bg-blue-500/10 p-2 rounded-full text-blue-400 group-hover:text-blue-300">
                                  <User className="w-5 h-5" />
                              </div>
                              <span className="font-bold text-sm">Configurações da Conta</span>
                          </div>
                          <span className="text-slate-500 text-lg">›</span>
                      </button>

                      <div className="border-t border-white/5 my-4"></div>

                      {/* Sound Toggles */}
                      <div className="flex items-center justify-between p-2">
                          <div className="flex items-center gap-3">
                               <Volume2 className="w-5 h-5 text-slate-400" />
                               <div>
                                   <div className="font-bold text-sm">Efeitos Sonoros</div>
                                   <div className="text-xs text-slate-500">Sons de eventos do jogo</div>
                               </div>
                          </div>
                          <button 
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            className={clsx("w-10 h-6 rounded-full relative transition-colors", soundEnabled ? "bg-blue-600" : "bg-slate-700")}
                          >
                              <div className={clsx("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", soundEnabled ? "left-5" : "left-1")} />
                          </button>
                      </div>

                      <div className="flex items-center justify-between p-2">
                          <div className="flex items-center gap-3">
                               <Music className="w-5 h-5 text-slate-400" />
                               <div>
                                   <div className="font-bold text-sm">Música</div>
                                   <div className="text-xs text-slate-500">Música de fundo</div>
                               </div>
                          </div>
                          <button 
                            onClick={() => setMusicEnabled(!musicEnabled)}
                            className={clsx("w-10 h-6 rounded-full relative transition-colors", musicEnabled ? "bg-blue-600" : "bg-slate-700")}
                          >
                              <div className={clsx("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", musicEnabled ? "left-5" : "left-1")} />
                          </button>
                      </div>
                      
                       <div className="border-t border-white/5 my-4"></div>
                       
                       <div className="grid grid-cols-2 gap-2">
                           <Link to="/regras" onClick={() => setIsSettingsOpen(false)} className="bg-slate-800 hover:bg-slate-700 text-xs font-bold text-center py-3 rounded border border-white/5">
                               ? Regras
                           </Link>
                           <Link to="/ranking" onClick={() => setIsSettingsOpen(false)} className="bg-slate-800 hover:bg-slate-700 text-xs font-bold text-center py-3 rounded border border-white/5">
                               Ranking
                           </Link>
                       </div>

                  </div>
              </div>
          </div>
      )}

      {/* ACCOUNT MODAL */}
      {isAccountOpen && user && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-md bg-[#161b22] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-white/5">
                      <h2 className="text-lg font-bold flex items-center gap-2">
                          <User className="w-5 h-5 text-blue-400" /> Perfil de Usuário
                      </h2>
                      <button onClick={() => setIsAccountOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
                  </div>
                  
                  <div className="p-6 space-y-6">
                      <div className="bg-slate-800/30 rounded-lg p-4 flex items-center gap-4 border border-white/5">
                           {user.photoURL ? (
                               <img src={user.photoURL} className="w-12 h-12 rounded-full border border-white/10 shadow-lg" alt="" />
                           ) : (
                               <div className="w-12 h-12 rounded-full bg-cyan-600 flex items-center justify-center text-xl font-bold">{user.displayName[0]}</div>
                           )}
                           <div>
                               <div className="font-bold text-lg">{user.displayName}</div>
                               <div className="text-xs text-slate-500">{user.email}</div>
                               <div className="text-[10px] uppercase font-bold text-cyan-500 mt-1">{user.type}</div>
                           </div>
                      </div>

                      <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase">Alterar Nome de Usuário</label>
                          <div className="flex gap-2">
                              <input 
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                className="flex-1 bg-black border border-white/10 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none"
                                placeholder="Novo nome"
                              />
                              <button 
                                onClick={handleSaveProfile}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded text-sm font-bold"
                              >
                                  Salvar
                              </button>
                          </div>
                      </div>

                      <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase">Estatísticas na Nuvem</label>
                          <div className="grid grid-cols-2 gap-2">
                              <div className="bg-black/50 p-3 rounded border border-white/5">
                                  <div className="text-xs text-slate-500">Pontuação Total</div>
                                  <div className="text-lg font-mono font-bold">{totalScore.toLocaleString()}</div>
                              </div>
                              <div className="bg-black/50 p-3 rounded border border-white/5">
                                  <div className="text-xs text-slate-500">Partidas</div>
                                  <div className="text-lg font-mono font-bold">{stats.length}</div>
                              </div>
                               <div className="bg-black/50 p-3 rounded border border-white/5">
                                  <div className="text-xs text-slate-500">Melhor Distância</div>
                                  <div className="text-lg font-mono font-bold">{bestDistanceMi} <span className="text-xs font-sans font-normal text-slate-600">mi</span></div>
                              </div>
                               <div className="bg-black/50 p-3 rounded border border-white/5">
                                  <div className="text-xs text-slate-500">Recorde Pessoal</div>
                                  <div className="text-lg font-mono font-bold">{stats.length > 0 ? Math.max(...stats.map(s => s.finalScore)) : 0}</div>
                              </div>
                          </div>
                      </div>

                      <button 
                        onClick={() => { logout(); setIsAccountOpen(false); }}
                        className="w-full border border-red-500/20 text-red-400 hover:bg-red-500/10 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors mt-4"
                      >
                          <LogOut className="w-4 h-4" /> Sair da Conta
                      </button>

                  </div>
              </div>
          </div>
      )}
    </div>
  );
}