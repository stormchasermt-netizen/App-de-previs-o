import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Lobby, LobbyPlayer, PrevisaoDifficulty, PrevisaoEvent, ChatMessage } from '@/lib/types';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { Peer, DataConnection } from 'peerjs';
import { useToast } from './ToastContext';
import { mockStore } from '@/lib/store';

// Define Message Protocol
type MPMessage = 
  | { type: 'SYNC_LOBBY'; lobby: Lobby }
  | { type: 'SYNC_EVENT_DATA'; event: PrevisaoEvent } 
  | { type: 'DATA_CHUNK'; dataType: 'EVENT_JSON' | 'LAYER_IMAGE'; meta?: any; chunkId: string; index: number; total: number; data: string }
  | { type: 'REPORT_PROGRESS'; uid: string; progress: number } // Client -> Host
  | { type: 'JOIN_REQUEST'; user: { uid: string; displayName: string; photoURL?: string } }
  | { type: 'REQUEST_EVENT_DATA'; uid: string }
  | { type: 'LEAVE'; uid: string }
  | { type: 'SUBMIT_SCORE'; uid: string; score: number; distance: number; streak: number }
  | { type: 'HOST_ACTION'; action: string; payload?: any }
  | { type: 'ERROR'; message: string }
  | { type: 'INVITE'; lobbyCode: string; hostName: string } // Invite protocol
  | { type: 'CHAT_MESSAGE'; message: ChatMessage };

interface MultiplayerContextType {
  lobby: Lobby | null;
  currentEventData: PrevisaoEvent | null;
  downloadProgress: number; // 0 to 100
  isHost: boolean;
  createLobby: (difficulty: PrevisaoDifficulty) => Promise<string>;
  joinLobby: (code: string) => Promise<boolean>;
  leaveLobby: () => void;
  startGame: (eventId: string) => void;
  requestEventData: () => void;
  submitRoundScore: (score: number, distance: number, streak: number) => void;
  triggerForceFinish: () => void;
  forceEndRound: () => void;
  nextRound: (eventId: string) => void;
  endMatch: () => void;
  // Invite System
  sendInvite: (targetUid: string, lobbyCodeOverride?: string) => Promise<void>;
  incomingInvite: { lobbyCode: string; hostName: string } | null;
  acceptInvite: () => void;
  declineInvite: () => void;
  recentPlayers: { uid: string; displayName: string; photoURL?: string, lastSeen: number }[];
  // Chat System
  chatMessages: ChatMessage[];
  sendChatMessage: (text: string) => void;
  forceStartGame: () => void;
}

const MultiplayerContext = createContext<MultiplayerContextType | undefined>(undefined);

// PeerJS Server Configuration
// IMPORTANT: After deploying your own PeerJS server, update the host below.
// See peer-server/README.md for deployment instructions.
const PEER_SERVER_HOST = 'peerjs-server-275898169040.us-east1.run.app';
const PEER_SERVER_PORT = 443;
const PEER_SERVER_SECURE = true;
const PEER_SERVER_PATH = '/peerjs';
const PEER_SERVER_KEY = 'previsao';

const PEER_CONFIG: any = {
    host: PEER_SERVER_HOST,
    port: PEER_SERVER_PORT,
    secure: PEER_SERVER_SECURE,
    path: PEER_SERVER_PATH,
    key: PEER_SERVER_KEY,
    debug: 0,
    config: {
        iceServers: [
            // STUN Servers (free, for discovering public IP)
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
            { urls: 'stun:stun.cloudflare.com:3478' },
            // TURN Servers (Metered Open Relay - free 20GB/month)
            // These relay traffic when direct P2P fails (firewalls, 4G, etc.)
            {
                urls: 'turn:staticauth.openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject',
            },
            {
                urls: 'turn:staticauth.openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject',
            },
            {
                urls: 'turns:staticauth.openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject',
            },
        ]
    }
};

const CHUNK_SIZE = 16384; // 16KB

export function MultiplayerProvider({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [currentEventData, setCurrentEventData] = useState<PrevisaoEvent | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  // Peers
  const [peer, setPeer] = useState<Peer | null>(null); // Lobby Peer (Host or Client)
  const [personalPeer, setPersonalPeer] = useState<Peer | null>(null); // For receiving invites on Home
  
  // Refs
  const lobbyRef = useRef<Lobby | null>(null);
  const eventDataRef = useRef<PrevisaoEvent | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  const hostConnRef = useRef<DataConnection | null>(null);
  const chunksBuffer = useRef<Map<string, string[]>>(new Map());
  
  // Timers
  const loadingStartTimeRef = useRef<number>(0);

  // Invite State
  const [incomingInvite, setIncomingInvite] = useState<{ lobbyCode: string; hostName: string } | null>(null);
  const [recentPlayers, setRecentPlayers] = useState<any[]>([]);

  useEffect(() => { lobbyRef.current = lobby; }, [lobby]);
  useEffect(() => { eventDataRef.current = currentEventData; }, [currentEventData]);
  
  // Clear chat on lobby exit
  useEffect(() => { if (!lobby) setChatMessages([]); }, [lobby]);

  // Load recent players
  useEffect(() => {
      const stored = localStorage.getItem('previsao_recent_players');
      if (stored) setRecentPlayers(JSON.parse(stored));
  }, []);

  // --- PERSONAL PEER (Global Presence for Invites) ---
  // Only active when NOT in a lobby and User is logged in
  useEffect(() => {
      if (!user || lobby) {
          if (personalPeer) {
              personalPeer.destroy();
              setPersonalPeer(null);
          }
          return;
      }

      // Create Personal Peer
      const myPersonalId = `player_${user.uid}`;
      const pPeer = new Peer(myPersonalId, PEER_CONFIG);

      pPeer.on('open', (id) => {
          console.log("Global Presence Active:", id);
      });

      pPeer.on('connection', (conn) => {
          conn.on('data', (data: any) => {
              if (data.type === 'INVITE') {
                  setIncomingInvite({ lobbyCode: data.lobbyCode, hostName: data.hostName });
              }
          });
      });

      pPeer.on('error', (err: any) => {
           // Ignore ID taken errors (tab duplication) - it means another tab is open
           if (err.type === 'unavailable-id') {
               console.log("Personal Peer ID taken (another tab open). Invites disabled for this tab.");
               return; 
           }
           console.warn("Personal Peer Error", err);
      });

      setPersonalPeer(pPeer);

      return () => {
          pPeer.destroy();
      };
  }, [user, lobby]); // Re-run if user logs in or lobby state changes

  const broadcastLobby = (lobbyToBroadcast: Lobby) => {
      const msg: MPMessage = { type: 'SYNC_LOBBY', lobby: lobbyToBroadcast };
      connectionsRef.current.forEach(conn => {
          if (conn.open) {
              try { conn.send(msg); } catch(e) { console.error("Broadcast Error", e); }
          }
      });
  };

  // --- HOST HEARTBEAT & LOADING SYNC ---
  useEffect(() => {
      if (!lobby || lobby.hostId !== user?.uid) return;
      const interval = setInterval(() => {
          const currentLobby = lobbyRef.current;
          if (currentLobby && connectionsRef.current.length > 0) {
              broadcastLobby(currentLobby);
          }
          
          // Check if everyone finished loading
          if (currentLobby?.status === 'loading') {
              const allLoaded = currentLobby.players.every(p => (p.loadProgress || 0) >= 100);
              
              // 10 SECONDS DELAY: Ensure we wait at least 10s for data propagation
              const startT = currentLobby.loadingStartTime || loadingStartTimeRef.current;
              const timeElapsed = Date.now() - startT;
              const minTimePassed = timeElapsed > 10000;
              
              if (allLoaded && minTimePassed) {
                  // Transition to Playing
                  console.log("All players loaded and buffer time passed. Starting game!");
                  updateHostState(l => { l.status = 'playing'; });
                  // Send navigation signal via sync
              }
          }
      }, 1000); 
      return () => clearInterval(interval);
  }, [lobby?.hostId, user?.uid, lobby?.status]); 

  // --- HOST AUTO END ROUND ---
  useEffect(() => {
      if (!lobby || lobby.hostId !== user?.uid || lobby.status !== 'playing') return;
      const allSubmitted = lobby.players.every(p => p.hasSubmitted);
      if (allSubmitted && lobby.players.length > 0) {
          const timer = setTimeout(() => {
              if (lobbyRef.current?.status === 'playing') {
                   updateHostState(l => l.status = 'round_results');
              }
          }, 1000);
          return () => clearTimeout(timer);
      }
  }, [lobby, user?.uid]);

  // --- HOST ACTIONS ---

  const createLobby = (difficulty: PrevisaoDifficulty): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!user) { reject("User not logged in"); return; }
        if (peer) peer.destroy();

        const tryCreate = () => {
             const code = Math.random().toString(36).substring(2, 8).toUpperCase();
             const newPeer = new Peer(code, PEER_CONFIG);

             newPeer.on('open', (id) => {
                  console.log('Lobby Created:', id);
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
                      streakCount: 0,
                      loadProgress: 100 // Host is always ready immediately
                    }],
                    currentEventId: null,
                    roundEndTime: null,
                    roundsPlayed: 0,
                    createdAt: Date.now()
                  };

                  setLobby(newLobby);
                  setPeer(newPeer);
                  
                  // Setup connections handler
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
                  });

                  navigate(`/lobby/${id}`);
                  resolve(id);
             });

             newPeer.on('error', (err: any) => {
                  if (err.type === 'unavailable-id') {
                      tryCreate();
                  } else {
                      addToast('Erro ao criar sala P2P: ' + err.type, 'error');
                  }
             });
        };
        
        tryCreate();
    });
  };

  const handleHostMessage = (msg: MPMessage, conn: DataConnection) => {
      const currentLobby = lobbyRef.current;
      const currentEvent = eventDataRef.current;
      if (!currentLobby) return;

      if (msg.type === 'JOIN_REQUEST') {
          if (currentLobby.players.length >= 20) {
              conn.send({ type: 'ERROR', message: 'A sala está cheia.' });
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
                  streakCount: 0,
                  loadProgress: 0
              });
              setLobby(updatedLobby);
              broadcastLobby(updatedLobby);
              
              // If game is in loading/playing, send data
              if ((updatedLobby.status === 'playing' || updatedLobby.status === 'loading') && currentEvent) {
                  transmitEventToPeer(conn, currentEvent);
              }
              
              addToast(`${msg.user.displayName} entrou!`, 'info');
              addToRecentPlayers(msg.user);
          } else {
              // Reconnect
              conn.send({ type: 'SYNC_LOBBY', lobby: updatedLobby });
              if ((updatedLobby.status === 'playing' || updatedLobby.status === 'loading') && currentEvent) {
                  transmitEventToPeer(conn, currentEvent);
              }
              broadcastLobby(updatedLobby);
          }
      }

      if (msg.type === 'REPORT_PROGRESS') {
          updateHostState(l => {
              const p = l.players.find(pl => pl.uid === msg.uid);
              if (p) {
                  p.loadProgress = msg.progress;
              }
          });
      }

      if (msg.type === 'REQUEST_EVENT_DATA') {
          if (currentEvent) {
              transmitEventToPeer(conn, currentEvent);
          }
      }

      if (msg.type === 'SUBMIT_SCORE') {
          const updatedLobby = { ...currentLobby };
          updatedLobby.players = updatedLobby.players.map(p => ({...p}));
          const player = updatedLobby.players.find(p => p.uid === msg.uid);
          if (player) {
              player.hasSubmitted = true;
              player.lastRoundScore = msg.score;
              player.lastRoundDistance = msg.distance;
              player.totalScore += msg.score;
              player.streakCount = msg.streak;
              setLobby(updatedLobby);
              broadcastLobby(updatedLobby);
          }
      }
      
      if (msg.type === 'LEAVE') {
           const updatedLobby = { ...currentLobby };
           updatedLobby.players = updatedLobby.players.filter(p => p.uid !== msg.uid);
           setLobby(updatedLobby);
           broadcastLobby(updatedLobby);
      }

      if (msg.type === 'CHAT_MESSAGE') {
          setChatMessages(prev => {
              if (prev.some(m => m.id === msg.message.id)) return prev;
              return [...prev, msg.message];
          });
          // Host Relay to others
          connectionsRef.current.forEach(c => {
              if (c.open && c !== conn) { // Don't echo back to sender (dedup handles it but saves bandwidth)
                  try { c.send(msg); } catch(e) {}
              }
          });
      }
  };

  // --- CHAT SYSTEM ---
  const sendChatMessage = (text: string) => {
      if (!user || !text.trim()) return;
      
      const msg: ChatMessage = {
          id: Date.now().toString() + Math.random().toString().substring(2, 5),
          senderId: user.uid,
          senderName: user.displayName,
          text: text.trim(),
          timestamp: Date.now()
      };

      // Optimistic Update
      setChatMessages(prev => [...prev, msg]);

      // Send
      if (lobby?.hostId === user.uid) {
          // Host Broadcast
          const payload: MPMessage = { type: 'CHAT_MESSAGE', message: msg };
          connectionsRef.current.forEach(conn => { if(conn.open) conn.send(payload); });
      } else {
          // Client Send to Host
          if (hostConnRef.current) {
              hostConnRef.current.send({ type: 'CHAT_MESSAGE', message: msg });
          }
      }
  };

  const forceStartGame = () => {
      if (lobbyRef.current?.hostId === user?.uid && lobbyRef.current?.status === 'loading') {
          updateHostState(l => { l.status = 'playing'; });
      }
  };

  // --- INVITE SYSTEM ---

  const sendInvite = async (targetUid: string, lobbyCodeOverride?: string) => {
      const code = lobbyCodeOverride || lobby?.code;
      if (!code || !user) {
          console.warn("Invite failed: No lobby code available");
          return;
      }
      
      const tempPeer = new Peer(); // Disposable peer for sending
      tempPeer.on('open', () => {
          const conn = tempPeer.connect(`player_${targetUid}`);
          conn.on('open', () => {
              conn.send({ 
                  type: 'INVITE', 
                  lobbyCode: code, 
                  hostName: user.displayName 
              });
              addToast('Convite enviado!', 'success');
              setTimeout(() => { conn.close(); tempPeer.destroy(); }, 2000);
          });
          conn.on('error', () => {
              addToast('Não foi possível conectar ao jogador. Ele pode estar offline ou em partida.', 'error');
              tempPeer.destroy();
          });
      });
  };

  const acceptInvite = () => {
      if (incomingInvite) {
          joinLobby(incomingInvite.lobbyCode);
          setIncomingInvite(null);
      }
  };

  const declineInvite = () => {
      setIncomingInvite(null);
  };

  const addToRecentPlayers = (player: { uid: string; displayName: string; photoURL?: string }) => {
      const current = JSON.parse(localStorage.getItem('previsao_recent_players') || '[]');
      // Remove existing entry for this user
      const filtered = current.filter((p: any) => p.uid !== player.uid);
      // Add to top
      const updated = [{ ...player, lastSeen: Date.now() }, ...filtered].slice(0, 10);
      localStorage.setItem('previsao_recent_players', JSON.stringify(updated));
      setRecentPlayers(updated);
  };

  // --- DATA TRANSMISSION ---

  const sendPayloadInChunks = async (conns: DataConnection[], payload: string, dataType: 'EVENT_JSON' | 'LAYER_IMAGE', meta?: any) => {
      const chunkId = Date.now().toString() + Math.random().toString().substring(2,5);
      const totalChunks = Math.ceil(payload.length / CHUNK_SIZE);
      
      for (let i = 0; i < totalChunks; i++) {
          const chunk = payload.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          const msg: MPMessage = { type: 'DATA_CHUNK', dataType, chunkId, index: i, total: totalChunks, data: chunk, meta };
          for (const conn of conns) { if (conn.open) try { conn.send(msg); } catch(e) {} }
          if (i % 10 === 0) await new Promise(r => setTimeout(r, 20));
      }
  };

  const transmitEventToPeer = async (conn: DataConnection, fullEvent: PrevisaoEvent) => {
      const skeletonEvent = { ...fullEvent, layers: fullEvent.layers.map(l => ({...l, imageUrl: ''})) };
      await sendPayloadInChunks([conn], JSON.stringify(skeletonEvent), 'EVENT_JSON');
      for (const layer of fullEvent.layers) {
          if (layer.imageUrl && layer.imageUrl.length > 50) {
              await sendPayloadInChunks([conn], layer.imageUrl, 'LAYER_IMAGE', { layerId: layer.id, time: layer.time });
          }
      }
  };

  const broadcastFullEvent = async (fullEvent: PrevisaoEvent) => {
      const skeletonEvent = { ...fullEvent, layers: fullEvent.layers.map(l => ({...l, imageUrl: ''})) };
      const activeConns = connectionsRef.current.filter(c => c.open);
      await sendPayloadInChunks(activeConns, JSON.stringify(skeletonEvent), 'EVENT_JSON');
      for (const layer of fullEvent.layers) {
          if (layer.imageUrl && layer.imageUrl.length > 50) {
              await sendPayloadInChunks(activeConns, layer.imageUrl, 'LAYER_IMAGE', { layerId: layer.id, time: layer.time });
          }
      }
  };

  const handleIncomingChunk = (msg: any) => {
      const { chunkId, index, total, data, dataType, meta } = msg;
      
      if (!chunksBuffer.current.has(chunkId)) chunksBuffer.current.set(chunkId, new Array(total).fill(null));
      const buffer = chunksBuffer.current.get(chunkId)!;
      buffer[index] = data;
      
      // Calculate simplistic total progress (visual approximation)
      const percent = Math.round(((index + 1) / total) * 100);
      setDownloadProgress(percent);

      if (buffer.every(c => c !== null)) {
          const fullString = buffer.join('');
          chunksBuffer.current.delete(chunkId);

          if (dataType === 'EVENT_JSON') {
              try {
                  const event = JSON.parse(fullString);
                  setCurrentEventData(event);
                  // Notify Host of progress
                  if (hostConnRef.current && user) {
                      hostConnRef.current.send({ type: 'REPORT_PROGRESS', uid: user.uid, progress: 50 }); // 50% = Metadata loaded
                  }
              } catch (e) { console.error("JSON Parse Error", e); }
          } else if (dataType === 'LAYER_IMAGE') {
              setCurrentEventData(prev => {
                  if (!prev) return null;
                  const newLayers = prev.layers.map(l => {
                      if (l.id === meta.layerId && l.time === meta.time) return { ...l, imageUrl: fullString };
                      return l;
                  });
                  return { ...prev, layers: newLayers };
              });
              // Notify Host 
              if (hostConnRef.current && user) {
                  // Heuristic: If we have an image, we are likely mostly done
                  hostConnRef.current.send({ type: 'REPORT_PROGRESS', uid: user.uid, progress: 100 });
              }
          }
      }
  };

  // --- CLIENT LOGIC ---

  const joinLobby = async (code: string): Promise<boolean> => {
      if (!user) return false;
      if (peer) { peer.destroy(); setPeer(null); await new Promise(r => setTimeout(r, 500)); }

      const tryConnect = async (attempt: number): Promise<boolean> => {
          return new Promise((resolve) => {
              console.log(`Tentativa de conexão ${attempt}...`);
              let isResolved = false;
              
              const fail = (msg?: string) => { 
                  if (isResolved) return; 
                  isResolved = true;
                  clientPeer.destroy(); // Clean up failed peer
                  // Only show toast on final attempt
                  if (attempt >= 5 && msg) addToast(msg, 'error'); 
                  resolve(false); 
              };

              const connectionTimeout = setTimeout(() => { fail(attempt >= 5 ? "Tempo esgotado. Verifique sua conexão." : undefined); }, 15000); // 15s timeout

              const uniqueClientId = `player_${user.uid}_${Date.now().toString(36)}`;
              const clientPeer = new Peer(uniqueClientId, PEER_CONFIG);
              
              clientPeer.on('open', (id) => {
                  const conn = clientPeer.connect(code, { reliable: true });

                  conn.on('open', () => {
                      clearTimeout(connectionTimeout);
                      hostConnRef.current = conn;
                      setPeer(clientPeer);
                      conn.send({ type: 'JOIN_REQUEST', user: { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL } });
                  });

                  conn.on('data', (data: any) => {
                      if (data.type === 'SYNC_LOBBY') {
                          setLobby(data.lobby);
                          // Add host to recent players
                          if (data.lobby.players[0]) addToRecentPlayers(data.lobby.players[0]);
                          if (!isResolved) { 
                              isResolved = true; 
                              resolve(true); 
                              navigate(`/lobby/${code}`); 
                          }
                      }
                      // ... handlers (will be re-attached or persistent, simpler to just resolve true here)
                      if (data.type === 'DATA_CHUNK') handleIncomingChunk(data);
                      if (data.type === 'CHAT_MESSAGE') {
                          setChatMessages(prev => {
                              if (prev.some(m => m.id === data.message.id)) return prev;
                              return [...prev, data.message];
                          });
                      }
                  });
                  
                  // If connection closes immediately, trigger fail to retry
                  conn.on('close', () => { 
                      if(isResolved) { 
                          setLobby(null); setCurrentEventData(null); addToast('Desconectado.', 'error'); navigate('/'); 
                      } else { 
                          fail(); 
                      } 
                  });
                  
                  // Wait for 8s for SYNC_LOBBY, if not received, consider failed attempt
                  setTimeout(() => {
                      if (!isResolved) {
                          conn.close();
                          fail();
                      }
                  }, 8000);
              });

              clientPeer.on('error', (err: any) => { 
                  clearTimeout(connectionTimeout); 
                  fail(attempt >= 5 ? `Erro P2P: ${err.type}` : undefined); 
              });
          });
      };

      // Retry Loop - 5 attempts with increasing delays
      for (let i = 1; i <= 5; i++) {
          addToast(`Conectando... tentativa ${i}/5`, 'info');
          const success = await tryConnect(i);
          if (success) return true;
          // Increasing delay: 1s, 2s, 3s, 4s
          await new Promise(r => setTimeout(r, i * 1000));
      }
      
      addToast('Não foi possível conectar à sala. A sala pode ter sido encerrada ou o host pode estar offline.', 'error');
      return false;
  };

  const requestEventData = () => {
      if (hostConnRef.current && user) hostConnRef.current.send({ type: 'REQUEST_EVENT_DATA', uid: user.uid });
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
          setCurrentEventData(fullEvent);
          broadcastFullEvent(fullEvent);

          // SET STATE TO LOADING
          const now = Date.now();
          loadingStartTimeRef.current = now; // Local ref for backup
          
          updateHostState(l => {
              l.status = 'loading';
              l.currentEventId = eventId;
              l.loadingStartTime = now; // Sync with everyone
              l.roundEndTime = null; // RESET TIMER FROM PREVIOUS ROUND
              l.players.forEach(p => { 
                  p.hasSubmitted = false; 
                  p.lastRoundScore = 0; 
                  p.lastRoundDistance = 0;
                  p.loadProgress = p.isHost ? 100 : 0; // Host already has data
              });
          });
          
          // Navigation happens automatically when client sees 'playing' status in Lobby.tsx
          // Host navigates himself because he sets state locally. Wait, Host state is synced.
          // Host needs to navigate to /jogar ONLY when status becomes playing.
      } else {
          addToast("Erro: Evento não encontrado.", 'error');
      }
  };

  const leaveLobby = () => {
      if (lobby && user) {
          if (lobby.hostId === user.uid) { peer?.destroy(); setLobby(null); setPeer(null); setCurrentEventData(null); navigate('/'); } 
          else { if (hostConnRef.current) { hostConnRef.current.send({ type: 'LEAVE', uid: user.uid }); hostConnRef.current.close(); } peer?.destroy(); setLobby(null); setPeer(null); setCurrentEventData(null); navigate('/'); }
      }
  };

  const submitRoundScore = (score: number, distance: number, streak: number) => {
      if (!user) return;
      if (lobby?.hostId === user.uid) {
          updateHostState(l => {
              const me = l.players.find(p => p.uid === user.uid);
              if (me) { me.hasSubmitted = true; me.lastRoundScore = score; me.lastRoundDistance = distance; me.totalScore += score; me.streakCount = streak; }
          });
      } else { hostConnRef.current?.send({ type: 'SUBMIT_SCORE', uid: user.uid, score, distance, streak }); }
  };

  const nextRound = (eventId: string) => { startGame(eventId); };
  const triggerForceFinish = () => { if (lobbyRef.current?.hostId === user?.uid) updateHostState(l => { l.roundEndTime = Date.now() + 15000; }); };
  const forceEndRound = () => { if (lobbyRef.current?.hostId === user?.uid) updateHostState(l => { l.players.forEach(p => { if (!p.hasSubmitted) { p.hasSubmitted = true; p.lastRoundScore = 0; p.lastRoundDistance = 99999; } }); }); };
  const endMatch = () => { if (lobbyRef.current?.hostId === user?.uid) updateHostState(l => { l.status = 'finished'; }); };

  return (
    <MultiplayerContext.Provider value={{ 
      lobby, currentEventData, downloadProgress, isHost: lobby?.hostId === user?.uid,
      createLobby, joinLobby, leaveLobby, startGame, requestEventData, submitRoundScore, 
      triggerForceFinish, forceEndRound, nextRound, endMatch,
      sendInvite, incomingInvite, acceptInvite, declineInvite, recentPlayers,
      chatMessages, sendChatMessage, forceStartGame
    }}>
      {children}
    </MultiplayerContext.Provider>
  );
}

export function useMultiplayer() {
  const context = useContext(MultiplayerContext);
  if (context === undefined) throw new Error('useMultiplayer must be used within a MultiplayerProvider');
  return context;
}