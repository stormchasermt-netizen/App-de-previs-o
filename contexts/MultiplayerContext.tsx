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
  | { type: 'SYNC_EVENT_DATA'; event: PrevisaoEvent } // Legacy/Small payloads
  | { type: 'EVENT_CHUNK'; chunkId: string; index: number; total: number; data: string } // NEW: For heavy images
  | { type: 'JOIN_REQUEST'; user: { uid: string; displayName: string; photoURL?: string } }
  | { type: 'REQUEST_EVENT_DATA'; uid: string }
  | { type: 'LEAVE'; uid: string }
  | { type: 'SUBMIT_SCORE'; uid: string; score: number; distance: number; streak: number }
  | { type: 'HOST_ACTION'; action: string; payload?: any }
  | { type: 'ERROR'; message: string };

interface MultiplayerContextType {
  lobby: Lobby | null;
  currentEventData: PrevisaoEvent | null;
  downloadProgress: number; // 0 to 100
  isHost: boolean;
  createLobby: (difficulty: PrevisaoDifficulty) => void;
  joinLobby: (code: string) => Promise<boolean>;
  leaveLobby: () => void;
  startGame: (eventId: string) => void;
  requestEventData: () => void;
  submitRoundScore: (score: number, distance: number, streak: number) => void;
  triggerForceFinish: () => void;
  forceEndRound: () => void;
  nextRound: (eventId: string) => void;
  endMatch: () => void;
}

const MultiplayerContext = createContext<MultiplayerContextType | undefined>(undefined);

// ROBUST PEER CONFIGURATION
const PEER_CONFIG: any = {
    debug: 1,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
        ]
    }
};

const CHUNK_SIZE = 16384; // 16KB safe chunk size for WebRTC

export function MultiplayerProvider({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [currentEventData, setCurrentEventData] = useState<PrevisaoEvent | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [peer, setPeer] = useState<Peer | null>(null);
  
  const lobbyRef = useRef<Lobby | null>(null);
  const eventDataRef = useRef<PrevisaoEvent | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  const hostConnRef = useRef<DataConnection | null>(null);
  
  // Chunk Reassembly Buffer
  const chunksBuffer = useRef<Map<string, string[]>>(new Map());

  useEffect(() => {
    lobbyRef.current = lobby;
  }, [lobby]);
  
  useEffect(() => {
      eventDataRef.current = currentEventData;
  }, [currentEventData]);

  useEffect(() => {
    return () => {
      peer?.destroy();
    };
  }, []);

  // --- HOST HEARTBEAT SYNC ---
  useEffect(() => {
      if (!lobby || lobby.hostId !== user?.uid || lobby.status !== 'waiting') return;
      const interval = setInterval(() => {
          if (connectionsRef.current.length > 0) {
              broadcastLobby(lobby);
          }
      }, 2000); 
      return () => clearInterval(interval);
  }, [lobby, user]);

  // --- HOST LOGIC ---

  const createLobby = (difficulty: PrevisaoDifficulty) => {
    if (!user) return;
    if (peer) peer.destroy();

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newPeer = new Peer(code, PEER_CONFIG);

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

    newPeer.on('error', (err: any) => {
      console.error("Host Peer Error:", err);
      if (err.type === 'unavailable-id') {
         createLobby(difficulty); 
      } else {
         addToast('Erro ao criar sala P2P: ' + err.type, 'error');
      }
    });

    newPeer.on('connection', (conn) => {
      conn.on('open', () => {
         connectionsRef.current = connectionsRef.current.filter(c => c.open);
         connectionsRef.current.push(conn);
         if (lobbyRef.current) {
             conn.send({ type: 'SYNC_LOBBY', lobby: lobbyRef.current });
         }
      });

      conn.on('data', (data: any) => {
        handleHostMessage(data, conn);
      });

      conn.on('close', () => {
        connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
      });
      
      conn.on('error', (err) => {
          console.error("Connection error on host:", err);
          connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
      });
    });
  };

  const handleHostMessage = (msg: MPMessage, conn: DataConnection) => {
      const currentLobby = lobbyRef.current;
      const currentEvent = eventDataRef.current;
      if (!currentLobby) return;

      if (msg.type === 'JOIN_REQUEST') {
          if (currentLobby.players.length >= 20) {
              conn.send({ type: 'ERROR', message: 'A sala está cheia (máx 20 jogadores).' });
              setTimeout(() => conn.close(), 500);
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
              
              // If joining late, send data (Chunked)
              if (updatedLobby.status === 'playing' && currentEvent) {
                  sendEventDataToClient(conn, currentEvent);
              }
              
              addToast(`${msg.user.displayName} entrou!`, 'info');
          } else {
              conn.send({ type: 'SYNC_LOBBY', lobby: updatedLobby });
              if (updatedLobby.status === 'playing' && currentEvent) {
                  sendEventDataToClient(conn, currentEvent);
              }
              broadcastLobby(updatedLobby);
          }
      }

      if (msg.type === 'REQUEST_EVENT_DATA') {
          if (currentEvent) {
              sendEventDataToClient(conn, currentEvent);
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

  // --- CHUNKING LOGIC ---

  const sendEventDataToClient = (conn: DataConnection, event: PrevisaoEvent) => {
      try {
          const json = JSON.stringify(event);
          const chunkId = Date.now().toString();
          const totalChunks = Math.ceil(json.length / CHUNK_SIZE);
          
          console.log(`Sending event data: ${json.length} bytes in ${totalChunks} chunks.`);

          for (let i = 0; i < totalChunks; i++) {
              const chunk = json.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
              conn.send({
                  type: 'EVENT_CHUNK',
                  chunkId,
                  index: i,
                  total: totalChunks,
                  data: chunk
              });
          }
      } catch (e) {
          console.error("Error chunking data:", e);
      }
  };

  const broadcastEventDataChunks = (event: PrevisaoEvent) => {
      try {
          const json = JSON.stringify(event);
          const chunkId = Date.now().toString();
          const totalChunks = Math.ceil(json.length / CHUNK_SIZE);
          
          console.log(`Broadcasting event data: ${json.length} bytes in ${totalChunks} chunks.`);

          // Helper to send with delay to avoid flooding WebRTC buffer
          const sendChunkBatch = async () => {
              for (let i = 0; i < totalChunks; i++) {
                  const chunk = json.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                  const msg = {
                      type: 'EVENT_CHUNK',
                      chunkId,
                      index: i,
                      total: totalChunks,
                      data: chunk
                  };
                  
                  connectionsRef.current.forEach(conn => {
                      if (conn.open) {
                          try { conn.send(msg); } catch(e) {}
                      }
                  });

                  // Small delay every 10 chunks to let network breathe
                  if (i % 10 === 0) await new Promise(r => setTimeout(r, 50));
              }
          };
          
          sendChunkBatch();

      } catch (e) {
          console.error("Failed to broadcast chunks:", e);
      }
  };

  const handleIncomingChunk = (msg: any) => {
      const { chunkId, index, total, data } = msg;
      
      if (!chunksBuffer.current.has(chunkId)) {
          chunksBuffer.current.set(chunkId, new Array(total).fill(null));
      }
      
      const buffer = chunksBuffer.current.get(chunkId)!;
      buffer[index] = data;
      
      // Calculate progress
      const percent = Math.round(((index + 1) / total) * 100);
      setDownloadProgress(percent);

      // Check if complete
      if (buffer.every(c => c !== null)) {
          console.log("All chunks received. Reassembling...");
          const fullJson = buffer.join('');
          try {
              const event = JSON.parse(fullJson);
              setCurrentEventData(event);
              setDownloadProgress(100);
              chunksBuffer.current.delete(chunkId); // Cleanup
              addToast("Mapa carregado com sucesso!", "success");
          } catch (e) {
              console.error("Failed to parse chunked JSON", e);
              addToast("Erro ao processar dados do mapa.", "error");
          }
      }
  };

  // --- CLIENT LOGIC ---

  const broadcastLobby = (data: Lobby) => {
      connectionsRef.current.forEach(conn => {
          if (conn.open) {
              try {
                  conn.send({ type: 'SYNC_LOBBY', lobby: data });
              } catch (e) {
                  console.error("Failed to broadcast to a peer:", e);
              }
          }
      });
  };

  const joinLobby = async (code: string): Promise<boolean> => {
      if (!user) return false;
      
      if (peer) {
          peer.destroy();
          setPeer(null);
          await new Promise(r => setTimeout(r, 500)); 
      }

      return new Promise((resolve) => {
          let isResolved = false;

          const fail = (msg?: string) => {
              if (isResolved) return;
              isResolved = true;
              if (msg) addToast(msg, 'error');
              resolve(false);
          };

          const succeed = (lobbyData: Lobby) => {
              if (isResolved) return;
              isResolved = true;
              setLobby(lobbyData);
              resolve(true);
          };

          const connectionTimeout = setTimeout(() => {
              fail("Tempo de conexão esgotado.");
          }, 15000);

          const uniqueClientId = `player_${user.uid}_${Date.now().toString(36)}`;
          const clientPeer = new Peer(uniqueClientId, PEER_CONFIG);
          
          clientPeer.on('open', (myId) => {
              const conn = clientPeer.connect(code, { reliable: true });

              conn.on('open', () => {
                  hostConnRef.current = conn;
                  setPeer(clientPeer);
                  conn.send({ 
                      type: 'JOIN_REQUEST', 
                      user: { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL } 
                  });
              });

              conn.on('data', (data: any) => {
                  if (data.type === 'SYNC_LOBBY') {
                      clearTimeout(connectionTimeout);
                      succeed(data.lobby);
                  }
                  if (data.type === 'SYNC_EVENT_DATA') { // Legacy fallback
                      setCurrentEventData(data.event);
                  }
                  if (data.type === 'EVENT_CHUNK') {
                      handleIncomingChunk(data);
                  }
                  if (data.type === 'ERROR') {
                      clearTimeout(connectionTimeout);
                      fail(data.message);
                  }
              });
              
              conn.on('close', () => {
                  if(isResolved) {
                      setLobby(null);
                      setCurrentEventData(null);
                      addToast('Desconectado do Host.', 'error');
                      navigate('/');
                  } else {
                      fail("Conexão encerrada pelo Host.");
                  }
              });

              conn.on('error', (err) => {
                  if (!isResolved) fail("Erro de transporte.");
              });
          });

          clientPeer.on('error', (err: any) => {
              clearTimeout(connectionTimeout);
              fail(`Erro P2P: ${err.type}`);
          });
      });
  };

  const requestEventData = () => {
      if (hostConnRef.current && user) {
          console.log("Requesting missing event data...");
          setDownloadProgress(1); // Visual feedback
          hostConnRef.current.send({ type: 'REQUEST_EVENT_DATA', uid: user.uid });
      }
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
      copy.players = [...copy.players.map(p => ({...p}))];
      updater(copy);
      setLobby(copy);
      broadcastLobby(copy);
  };

  const startGame = async (eventId: string) => {
      if (lobbyRef.current?.hostId !== user?.uid) return;
      
      const allEvents = await mockStore.getEvents();
      const fullEvent = allEvents.find(e => e.id === eventId);
      
      if (fullEvent) {
          // 1. Set Local Host State IMMEDIATELY
          setCurrentEventData(fullEvent);
          
          // 2. Broadcast Heavy Data via Chunks
          broadcastEventDataChunks(fullEvent);
          
          // 3. WAIT for data propagation (4 seconds delay for chunking)
          addToast("Enviando dados do mapa (4s)...", "info");
          
          setTimeout(() => {
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
              
              // Redundancy
              setTimeout(() => {
                  if (lobbyRef.current) broadcastLobby(lobbyRef.current);
              }, 1000);

          }, 4000);

      } else {
          addToast("Erro: Evento não encontrado no Host.", 'error');
      }
  };

  const nextRound = (eventId: string) => {
      startGame(eventId);
  };

  const triggerForceFinish = () => {
      if (lobbyRef.current?.hostId !== user?.uid) return;
      updateHostState(l => {
          l.roundEndTime = Date.now() + 15000;
      });
  };

  const forceEndRound = () => {
      if (lobbyRef.current?.hostId !== user?.uid) return;
      
      updateHostState(l => {
          l.players.forEach(p => {
             if (!p.hasSubmitted) {
                 p.hasSubmitted = true;
                 p.lastRoundScore = 0;
                 p.lastRoundDistance = 99999;
             }
          });
          l.status = 'round_results';
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

          setTimeout(() => {
              const current = lobbyRef.current;
              if (current && current.players.every(p => p.hasSubmitted)) {
                  updateHostState(l => l.status = 'round_results');
              }
          }, 500);

      } else {
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
      downloadProgress,
      isHost: lobby?.hostId === user?.uid,
      createLobby, 
      joinLobby, 
      leaveLobby, 
      startGame, 
      requestEventData,
      submitRoundScore, 
      triggerForceFinish, 
      forceEndRound,
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