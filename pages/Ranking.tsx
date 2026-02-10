import React, { useEffect, useState } from 'react';
import { mockStore } from '@/lib/store';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import type { PrevisaoScore } from '@/lib/types';
import { Trophy, Medal, User, Trash2 } from 'lucide-react';
import clsx from 'clsx';

export default function Ranking() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [scores, setScores] = useState<PrevisaoScore[]>([]);

  const loadScores = async () => {
    const all = await mockStore.getScores();
    all.sort((a, b) => b.finalScore - a.finalScore);
    setScores(all);
  };

  useEffect(() => {
    loadScores();
  }, []);

  const handleClear = async () => {
    if (confirm('Tem certeza que deseja apagar todo o ranking?')) {
        await mockStore.clearScores();
        loadScores();
        addToast('Ranking zerado com sucesso.', 'success');
    }
  };

  const isAdmin = user?.type === 'admin' || user?.type === 'superadmin';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Trophy className="text-amber-400 h-8 w-8" /> Ranking Global
          </h1>
          
          {isAdmin && scores.length > 0 && (
             <button 
                onClick={handleClear}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 border border-red-500/30 px-3 py-1.5 rounded hover:bg-red-500/10 transition-colors"
             >
                <Trash2 className="h-3 w-3" /> Zerar Ranking (Admin)
             </button>
          )}
      </div>

      <div className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-slate-900 border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                    <th className="p-4 font-medium w-16">Pos</th>
                    <th className="p-4 font-medium">Jogador</th>
                    <th className="p-4 font-medium">Dificuldade</th>
                    <th className="p-4 font-medium text-right">Distância</th>
                    <th className="p-4 font-medium text-right">Pontos</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
                {scores.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">
                            Ainda não há pontuações. Seja o primeiro a jogar!
                        </td>
                    </tr>
                ) : (
                    scores.map((s, i) => (
                        <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-4 text-slate-400 font-mono">
                                {i === 0 && <Medal className="h-5 w-5 text-amber-400" />}
                                {i === 1 && <Medal className="h-5 w-5 text-slate-300" />}
                                {i === 2 && <Medal className="h-5 w-5 text-amber-700" />}
                                {i > 2 && `#${i + 1}`}
                            </td>
                            <td className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                                        {s.photoURL ? <img src={s.photoURL} alt="" /> : <User className="h-4 w-4 text-slate-400"/>}
                                    </div>
                                    <span className="text-white font-medium">{s.displayName}</span>
                                </div>
                            </td>
                            <td className="p-4 text-slate-400 text-sm capitalize">{s.difficulty}</td>
                            <td className="p-4 text-right text-slate-400 font-mono text-sm">{s.distanceKm.toFixed(1)} km</td>
                            <td className="p-4 text-right text-cyan-400 font-bold font-mono">{s.finalScore}</td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>
    </div>
  );
}