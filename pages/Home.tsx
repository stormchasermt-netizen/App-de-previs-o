import React from 'react';
import { Link } from 'react-router-dom';
import { CloudLightning, User, Users, Radio, BookOpen, HelpCircle } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] animate-in fade-in duration-700">
      
      {/* Central Logo Area */}
      <div className="text-center mb-16">
          <div className="mx-auto mb-6 relative">
             <CloudLightning className="w-20 h-20 text-white mx-auto" strokeWidth={1.5} />
             {/* Simple stylistic swirl approximation with CSS/Icon */}
             <div className="absolute -top-2 -right-2 text-slate-600 opacity-50">
                <div className="w-4 h-4 bg-slate-500 rounded-full blur-sm"></div>
             </div>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-widest uppercase mb-2" style={{ fontFamily: 'Impact, sans-serif', letterSpacing: '0.05em' }}>
              Previsão Master
          </h1>
          <p className="text-slate-400 text-lg">
              Teste suas habilidades de previsão de tempestades severas
          </p>
      </div>

      {/* Game Mode Cards */}
      <div className="flex flex-col md:flex-row gap-6 mb-12">
          
          {/* Single Player (Disabled) */}
          <div className="relative group">
              <div className="w-64 h-40 bg-[#161b22] border border-white/5 rounded-lg flex flex-col items-center justify-center opacity-60 cursor-not-allowed">
                  <div className="absolute top-2 right-2 bg-slate-800 text-[9px] font-bold px-1.5 py-0.5 rounded text-slate-400">EM BREVE</div>
                  <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center mb-3">
                      <User className="w-5 h-5 text-slate-500" />
                  </div>
                  <h3 className="text-slate-400 font-bold">Single Player</h3>
                  <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-wider">Pratique sozinho</p>
              </div>
          </div>

          {/* Multiplayer (Active) */}
          <Link to="/jogar" className="group">
              <div className="w-64 h-40 bg-[#161b22] border border-white/10 rounded-lg flex flex-col items-center justify-center hover:border-cyan-500/50 hover:bg-[#1c2128] transition-all cursor-pointer shadow-lg relative overflow-hidden">
                   <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center mb-3 group-hover:bg-cyan-500/20 group-hover:text-cyan-400 transition-colors">
                      <Users className="w-5 h-5 text-slate-300 group-hover:text-cyan-400" />
                  </div>
                  <h3 className="text-white font-bold group-hover:text-cyan-400 transition-colors">Multiplayer</h3>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider group-hover:text-slate-400">Compita no Ranking</p>
              </div>
          </Link>

          {/* Live Mode (Disabled) */}
          <div className="relative w-64 h-40 bg-[#161b22] border border-white/5 rounded-lg flex flex-col items-center justify-center opacity-60 cursor-not-allowed">
               <div className="absolute top-2 right-2 bg-slate-800 text-[9px] font-bold px-1.5 py-0.5 rounded text-slate-400">EM BREVE</div>
               <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center mb-3">
                  <Radio className="w-5 h-5 text-slate-500" />
              </div>
              <h3 className="text-slate-400 font-bold">Modo Ao Vivo</h3>
              <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-wider">Previsão em tempo real</p>
          </div>

      </div>

      {/* Footer Links */}
      <div className="flex gap-4">
          <Link to="/regras">
             <button className="flex items-center gap-2 px-6 py-2 rounded-full border border-white/10 bg-[#161b22] hover:bg-[#1c2128] text-sm text-slate-300 transition-colors">
                 <HelpCircle className="w-4 h-4" /> Como Funciona
             </button>
          </Link>

           <a href="#" className="flex items-center gap-2 px-6 py-2 rounded-full border border-white/10 bg-[#161b22] hover:bg-[#1c2128] text-sm text-slate-300 transition-colors">
                 <BookOpen className="w-4 h-4" /> Material de Estudo
             </a>
      </div>

    </div>
  );
}