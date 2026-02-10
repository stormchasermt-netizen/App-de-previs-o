import React from 'react';
import { Target, BookOpen, Calculator, Trophy, Users, ShieldAlert } from 'lucide-react';

export default function Rules() {
  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in pb-20">
        <div className="text-center space-y-4">
            <h1 className="text-4xl font-black text-white uppercase tracking-tight">Regras & Pontuação</h1>
            <p className="text-slate-400 max-w-2xl mx-auto">
                Entenda como o Previsão Master funciona e como maximizar sua pontuação.
            </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
            <section className="bg-slate-900/50 border border-white/10 p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-3 mb-2">
                    <Target className="text-cyan-400 h-6 w-6" />
                    <h2 className="text-xl font-bold text-white">O Objetivo</h2>
                </div>
                <p className="text-slate-300 leading-relaxed text-sm">
                    O Previsão Master foi projetado para ajudar você a se tornar um melhor previsor de tempo severo. 
                    Ao praticar com eventos históricos reais, você desenvolverá as habilidades de reconhecimento de padrões 
                    que meteorologistas operacionais usam todos os dias. Seja você um entusiasta, estudante ou caçador de 
                    tempestades, este jogo afiará sua habilidade de identificar onde tornados são mais prováveis de ocorrer.
                </p>
            </section>

            <section className="bg-slate-900/50 border border-white/10 p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-3 mb-2">
                    <BookOpen className="text-emerald-400 h-6 w-6" />
                    <h2 className="text-xl font-bold text-white">Como Jogar</h2>
                </div>
                <ul className="space-y-3 text-slate-300 text-sm">
                    <li className="flex gap-2">
                        <span className="text-cyan-500 font-bold">•</span>
                        Você verá análises meteorológicas reais de um dia significativo (a data está oculta).
                    </li>
                    <li className="flex gap-2">
                        <span className="text-cyan-500 font-bold">•</span>
                        Seu trabalho é estudar a configuração atmosférica e posicionar seu alvo onde acredita que a atividade de tornados será focada.
                    </li>
                    <li className="flex gap-2">
                        <span className="text-cyan-500 font-bold">•</span>
                        Ao enviar, você verá os relatos reais de tempestade daquele dia e descobrirá quão perto sua previsão chegou.
                    </li>
                </ul>
            </section>
        </div>

        <section className="space-y-6">
             <div className="flex items-center gap-3">
                <Calculator className="text-amber-400 h-6 w-6" />
                <h2 className="text-2xl font-bold text-white">Níveis de Dificuldade</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800 p-5 rounded-xl border border-white/5">
                    <div className="text-emerald-400 font-bold text-lg mb-1">Iniciante</div>
                    <div className="text-xs text-slate-500 uppercase font-bold mb-3">Multiplicador: 60%</div>
                    <p className="text-xs text-slate-300">Todas as ferramentas de análise disponíveis, incluindo parâmetros compostos como STP e SCP. Ótimo para aprender.</p>
                </div>
                <div className="bg-slate-800 p-5 rounded-xl border border-white/5">
                    <div className="text-cyan-400 font-bold text-lg mb-1">Intermediário</div>
                    <div className="text-xs text-slate-500 uppercase font-bold mb-3">Multiplicador: 80%</div>
                    <p className="text-xs text-slate-300">Sem parâmetros compostos. Você precisará juntar as peças da ameaça a partir dos ingredientes individuais.</p>
                </div>
                <div className="bg-slate-800 p-5 rounded-xl border border-white/5">
                    <div className="text-amber-400 font-bold text-lg mb-1">Especialista</div>
                    <div className="text-xs text-slate-500 uppercase font-bold mb-3">Multiplicador: 100%</div>
                    <p className="text-xs text-slate-300">Apenas análise de superfície. Como prever antes da era da orientação moderna.</p>
                </div>
                <div className="bg-slate-800 p-5 rounded-xl border border-white/5">
                    <div className="text-rose-400 font-bold text-lg mb-1">Mestre</div>
                    <div className="text-xs text-slate-500 uppercase font-bold mb-3">Multiplicador: 120%</div>
                    <p className="text-xs text-slate-300">Apenas análise 12Z com exigência de raio de 80 milhas. O desafio supremo.</p>
                </div>
            </div>
        </section>

        <section className="bg-gradient-to-r from-slate-900 to-slate-800 border border-white/10 p-8 rounded-2xl">
             <div className="flex items-center gap-3 mb-6">
                <Trophy className="text-yellow-400 h-6 w-6" />
                <h2 className="text-2xl font-bold text-white">Como Funciona a Pontuação</h2>
            </div>
            
            <div className="space-y-4 text-slate-300">
                <p>Sua pontuação é baseada na proximidade da sua previsão ao relato de tornado mais próximo:</p>
                <ul className="space-y-2 list-disc list-inside ml-4">
                    <li><strong className="text-white">Distância:</strong> 0-5000 pontos base. Previsões mais próximas pontuam mais. Estar dentro de 25 milhas garante a pontuação máxima.</li>
                    <li><strong className="text-white">Multiplicador de Dificuldade:</strong> Aplica-se sobre os pontos base (60%, 80%, 100%, 120%).</li>
                    <li><strong className="text-white">Bônus de Sequência (Streak):</strong> Previsões boas consecutivas (dentro de 100 milhas) aumentam sua pontuação. Uma sequência de 7+ jogos adiciona 30% à sua pontuação.</li>
                </ul>
                <p className="text-sm text-slate-400 mt-4 italic">
                    Nota: A pontuação máxima possível na dificuldade Mestre com uma longa sequência é de 7.800 pontos.
                </p>
            </div>
        </section>

        <section className="grid md:grid-cols-2 gap-8">
             <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <Users className="text-purple-400 h-6 w-6" />
                    <h2 className="text-xl font-bold text-white">Modos de Jogo</h2>
                </div>
                <ul className="space-y-3 text-sm text-slate-300">
                    <li><strong className="text-white">Single Player:</strong> Pratique no seu próprio ritmo (Em Breve).</li>
                    <li><strong className="text-white">Multiplayer:</strong> Compita contra outros no Ranking Global.</li>
                    <li><strong className="text-white">Live Mode:</strong> Em breve! Preveja eventos reais enquanto acontecem.</li>
                </ul>
             </div>

             <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <ShieldAlert className="text-red-400 h-6 w-6" />
                    <h2 className="text-xl font-bold text-white">Regras da Comunidade</h2>
                </div>
                <ul className="space-y-2 text-xs text-slate-400">
                    <li>• Nomes de usuário devem ser apropriados.</li>
                    <li>• Jogo limpo: O uso de ferramentas de desenvolvedor ou manipulação de dados é proibido.</li>
                    <li>• Detecção de DevTools: O jogo monitora o uso durante sessões ativas.</li>
                    <li>• Contas múltiplas para manipular o ranking resultarão em banimento.</li>
                </ul>
             </div>
        </section>
    </div>
  );
}