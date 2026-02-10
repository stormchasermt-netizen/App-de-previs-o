import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Lobby, LobbyPlayer, PrevisaoDifficulty, PrevisaoEvent } from '@/lib/types';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { Peer, DataConnection } from 'peerjs';
import { useToast } from './ToastContext';
import { mockStore } from '@/lib/store';

// Define Message Protocol
type MPMessage = 
  | { type: 'SYNC_LOBBY'; lobby: Lobby }
  | { type: 'SYNC_EVENT_DATA'; event: PrevisaoEvent } // New message to send heavy image data
  | { type: 'JOIN_REQUEST'; user: { uid: string; displayName: string; photoURL?: string } }
  | { type: 'LEAVE'; uid: string }
  | { type: 'SUBMIT_SCORE'; uid: string; score: number; distance: number; streak: number }
  | { type: 'HOST_ACTION'; action: string; payload?: any }
  | { type: 'ERROR'; message: string }; // Generic error message

interface MultiplayerContextType {
  lobby: Lobby | null;
  currentEventData: PrevisaoEvent | null; // Shared event data
  isHost: boolean;
  createLobby: (difficulty: PrevisaoDifficulty) => void;
  joinLobby: (code: string) => Promise<boolean>;
  leaveLobby: () => void;
  startGame: (eventId: string) => void;
  submitRoundScore: (score: number, distance: number, streak: number) => void;
  triggerForceFinish: () => void;
  nextRound: (eventId: string) => void;
  endMatch: () => void;
}

const MultiplayerContext = createContext<MultiplayerContextType | undefined>(undefined);

export function MultiplayerProvider({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [currentEventData, setCurrentEventData] = useState<PrevisaoEvent | null>(null);
  const [peer, setPeer] = useState<Peer | null>(null);
  
  // Refs to maintain state in callbacks/effects without stale closures
  const lobbyRef = useRef<Lobby | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]); // For Host: list of client connections
  const hostConnRef = useRef<DataConnection | null>(null); // For Client: connection to host

  // Update ref when state changes
  useEffect(() => {
    lobbyRef.current = lobby;
  }, [lobby]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      peer?.destroy();
    };
  }, []);

  // --- HOST LOGIC ---

  const createLobby = (difficulty: PrevisaoDifficulty) => {
    if (!user) return;
    if (peer) peer.destroy();

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Initialize Host Peer
    const newPeer = new Peer(code, { debug: 1 });

    newPeer.on('open', (id) => {
      console.log('Lobby Created with ID:', id);
      const newLobby: Lobby = {
        code: id,
        hostId: user.uid,
        status: 'waiting',
        difficulty,
        players: [{
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          isHost: true,
          isReady: true,
          hasSubmitted: false,
          totalScore: 0,
          lastRoundScore: 0,
          lastRoundDistance: 0,
          streakCount: 0
        }],
        currentEventId: null,
        roundEndTime: null,
        roundsPlayed: 0,
        createdAt: Date.now()
      };

      setLobby(newLobby);
      setPeer(newPeer);
      navigate(`/lobby/${id}`);
    });

    newPeer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
         createLobby(difficulty);
      } else {
         addToast('Erro ao criar sala P2P: ' + err.type, 'error');
      }
    });

    newPeer.on('connection', (conn) => {
      conn.on('open', () => {
         connectionsRef.current.push(conn);
      });

      conn.on('data', (data: any) => {
        handleHostMessage(data, conn);
      });

      conn.on('close', () => {
        connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
      });
    });
  };

  const handleHostMessage = (msg: MPMessage, conn: DataConnection) => {
      const currentLobby = lobbyRef.current;
      if (!currentLobby) return;

      if (msg.type === 'JOIN_REQUEST') {
          // Check Max Players
          if (currentLobby.players.length >= 20) {
              conn.send({ type: 'ERROR', message: 'A sala está cheia (máx 20 jogadores).' });
              setTimeout(() => conn.close(), 500); // Give time to send message
              return;
          }

          const exists = currentLobby.players.find(p => p.uid === msg.user.uid);
          let updatedLobby = { ...currentLobby };
          
          if (!exists) {
              updatedLobby.players.push({
                  uid: msg.user.uid,
                  displayName: msg.user.displayName,
                  photoURL: msg.user.photoURL,
                  isHost: false,
                  isReady: true,
                  hasSubmitted: false,
                  totalScore: 0,
                  lastRoundScore: 0,
                  lastRoundDistance: 0,
                  streakCount: 0
              });
              setLobby(updatedLobby);
              broadcastLobby(updatedLobby);
              
              // If joining late during a game, send the current event data too
              if (updatedLobby.status === 'playing' && currentEventData) {
                  conn.send({ type: 'SYNC_EVENT_DATA', event: currentEventData });
              }
              
              addToast(`${msg.user.displayName} entrou!`, 'info');
          } else {
              conn.send({ type: 'SYNC_LOBBY', lobby: updatedLobby });
               if (updatedLobby.status === 'playing' && currentEventData) {
                  conn.send({ type: 'SYNC_EVENT_DATA', event: currentEventData });
              }
          }
      }

      if (msg.type === 'SUBMIT_SCORE') {
          const updatedLobby = { ...currentLobby };
          const player = updatedLobby.players.find(p => p.uid === msg.uid);
          if (player) {
              player.hasSubmitted = true;
              player.lastRoundScore = msg.score;
              player.lastRoundDistance = msg.distance;
              player.totalScore += msg.score;
              player.streakCount = msg.streak;
              
              setLobby(updatedLobby);
              broadcastLobby(updatedLobby);

              // CHECK AUTO END ROUND
              const allSubmitted = updatedLobby.players.every(p => p.hasSubmitted);
              if (allSubmitted) {
                  setTimeout(() => {
                      updateHostState(l => l.status = 'round_results');
                  }, 1000);
              }
          }
      }
      
      if (msg.type === 'LEAVE') {
           const updatedLobby = { ...currentLobby };
           updatedLobby.players = updatedLobby.players.filter(p => p.uid !== msg.uid);
           setLobby(updatedLobby);
           broadcastLobby(updatedLobby);
      }
  };

  const broadcastLobby = (data: Lobby) => {
      connectionsRef.current.forEach(conn => {
          if (conn.open) {
              conn.send({ type: 'SYNC_LOBBY', lobby: data });
          }
      });
  };
  
  const broadcastEventData = (event: PrevisaoEvent) => {
      connectionsRef.current.forEach(conn => {
          if (conn.open) {
              conn.send({ type: 'SYNC_EVENT_DATA', event: event });
          }
      });
  };

  // --- CLIENT LOGIC ---

  const joinLobby = async (code: string): Promise<boolean> => {
      if (!user) return false;
      if (peer) peer.destroy();

      return new Promise((resolve) => {
          const clientPeer = new Peer({ debug: 1 });
          
          clientPeer.on('open', () => {
              const conn = clientPeer.connect(code, { reliable: true });

              conn.on('open', () => {
                  hostConnRef.current = conn;
                  setPeer(clientPeer);
                  conn.send({ 
                      type: 'JOIN_REQUEST', 
                      user: { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL } 
                  });
                  resolve(true);
              });

              conn.on('data', (data: any) => {
                  if (data && data.type === 'SYNC_LOBBY') {
                      setLobby(data.lobby);
                  }
                  if (data && data.type === 'SYNC_EVENT_DATA') {
                      console.log("Recebendo dados do evento do Host...");
                      setCurrentEventData(data.event);
                  }
                  if (data && data.type === 'ERROR') {
                      addToast(data.message, 'error');
                      // Disconnect logic handled by Host closing, but we can cleanup here
                      setLobby(null);
                      navigate('/');
                  }
              });
              
              conn.on('error', (err) => {
                  addToast('Erro na conexão com o Host.', 'error');
                  resolve(false);
              });
              
              conn.on('close', () => {
                  addToast('Desconectado do Host.', 'error');
                  setLobby(null);
                  setCurrentEventData(null);
                  navigate('/');
              });
          });

          clientPeer.on('error', (err) => {
              addToast('Não foi possível conectar à sala. Verifique o código.', 'error');
              resolve(false);
          });
      });
  };

  // --- SHARED ACTIONS ---

  const leaveLobby = () => {
      if (lobby && user) {
          if (lobby.hostId === user.uid) {
              peer?.destroy();
              setLobby(null);
              setPeer(null);
              setCurrentEventData(null);
              navigate('/');
          } else {
              if (hostConnRef.current) {
                  hostConnRef.current.send({ type: 'LEAVE', uid: user.uid });
                  hostConnRef.current.close();
              }
              peer?.destroy();
              setLobby(null);
              setPeer(null);
              setCurrentEventData(null);
              navigate('/');
          }
      }
  };

  const updateHostState = (updater: (l: Lobby) => void) => {
      if (!lobbyRef.current) return;
      const copy = { ...lobbyRef.current }; 
      copy.players = [...copy.players.map(p => ({...p}))]; // Deep copy players
      updater(copy);
      setLobby(copy);
      broadcastLobby(copy);
  };

  // Actions
  const startGame = async (eventId: string) => {
      if (lobbyRef.current?.hostId !== user?.uid) return;
      
      // Get Full Event Data from Host's IndexedDB Store (Async now)
      const allEvents = await mockStore.getEvents();
      const fullEvent = allEvents.find(e => e.id === eventId);
      
      if (fullEvent) {
          // 1. Broadcast heavy data first
          setCurrentEventData(fullEvent);
          broadcastEventData(fullEvent);
          
          // 2. Then update lobby status
          updateHostState(l => {
              l.status = 'playing';
              l.currentEventId = eventId;
              l.players.forEach(p => {
                  p.hasSubmitted = false;
                  p.lastRoundScore = 0;
                  p.lastRoundDistance = 0;
              });
              l.roundEndTime = null;
          });
      } else {
          addToast("Erro: Evento não encontrado no Host.", 'error');
      }
  };

  const nextRound = (eventId: string) => {
      startGame(eventId); // Reuse same logic
  };

  const triggerForceFinish = () => {
      if (lobbyRef.current?.hostId !== user?.uid) return;
      updateHostState(l => {
          l.roundEndTime = Date.now() + 15000;
      });
  };

  const endMatch = () => {
      if (lobbyRef.current?.hostId !== user?.uid) return;
      updateHostState(l => {
          l.status = 'finished';
      });
  };

  const submitRoundScore = (score: number, distance: number, streak: number) => {
      if (!user) return;
      
      if (lobby?.hostId === user.uid) {
          // Host updating self
          updateHostState(l => {
              const me = l.players.find(p => p.uid === user.uid);
              if (me) {
                  me.hasSubmitted = true;
                  me.lastRoundScore = score;
                  me.lastRoundDistance = distance;
                  me.totalScore += score;
                  me.streakCount = streak;
              }
          });

          // Host Check Auto End (Immediate)
          // We need to check the updated state, which updateHostState handles via the callback copy
          // But to be safe, we check 'lobbyRef.current' in the next tick or inside updateHostState
          // Since updateHostState broadcasts, let's do a double check logic inside the updater if possible,
          // OR checking inside updateHostState is hard.
          // Easier: Just duplicate the check logic here for the Host's submission action.
          
          setTimeout(() => {
              const current = lobbyRef.current;
              if (current && current.players.every(p => p.hasSubmitted)) {
                  updateHostState(l => l.status = 'round_results');
              }
          }, 500);

      } else {
          // Client sending to Host
          hostConnRef.current?.send({
              type: 'SUBMIT_SCORE',
              uid: user.uid,
              score,
              distance,
              streak
          });
      }
  };

  return (
    <MultiplayerContext.Provider value={{ 
      lobby,
      currentEventData,
      isHost: lobby?.hostId === user?.uid,
      createLobby, 
      joinLobby, 
      leaveLobby, 
      startGame, 
      submitRoundScore, 
      triggerForceFinish, 
      nextRound, 
      endMatch 
    }}>
      {children}
    </MultiplayerContext.Provider>
  );
}

export function useMultiplayer() {
  const context = useContext(MultiplayerContext);
  if (context === undefined) {
    throw new Error('useMultiplayer must be used within a MultiplayerProvider');
  }
  return context;
}