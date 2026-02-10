import { PrevisaoEvent, PrevisaoScore } from './types';

// Mock Data Initialization
const MOCK_EVENTS_KEY = 'previsao_master_events';
const MOCK_SCORES_KEY = 'previsao_master_scores';

// Initial dummy data if empty
const INITIAL_EVENTS: PrevisaoEvent[] = [
  {
    id: 'demo-event-1',
    eventDate: '2016-04-27',
    displayDate: '27 de Abril de 2016',
    monthHint: 'Abril',
    region: 'america_do_sul',
    active: true,
    createdAt: Date.now(),
    bounds: { south: -35, north: -20, west: -65, east: -45 },
    stormReports: [
      { lat: -25.5, lng: -54.5, type: 'tornado' },
      { lat: -26.1, lng: -53.2, type: 'vento' },
      { lat: -24.8, lng: -55.0, type: 'granizo' }
    ],
    layers: [] 
  }
];

export const mockStore = {
  getEvents: (): PrevisaoEvent[] => {
    const stored = localStorage.getItem(MOCK_EVENTS_KEY);
    if (!stored) {
      localStorage.setItem(MOCK_EVENTS_KEY, JSON.stringify(INITIAL_EVENTS));
      return INITIAL_EVENTS;
    }
    return JSON.parse(stored);
  },

  addEvent: (event: Omit<PrevisaoEvent, 'id' | 'createdAt'>) => {
    const events = mockStore.getEvents();
    const newEvent: PrevisaoEvent = {
      ...event,
      id: `evt-${Date.now()}`,
      createdAt: Date.now(),
    };
    events.push(newEvent);
    localStorage.setItem(MOCK_EVENTS_KEY, JSON.stringify(events));
    return newEvent;
  },

  getScores: (): PrevisaoScore[] => {
    const stored = localStorage.getItem(MOCK_SCORES_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  addScore: (score: Omit<PrevisaoScore, 'id' | 'createdAt'>) => {
    const scores = mockStore.getScores();
    const newScore: PrevisaoScore = {
      ...score,
      id: `score-${Date.now()}`,
      createdAt: Date.now(),
    };
    scores.push(newScore);
    localStorage.setItem(MOCK_SCORES_KEY, JSON.stringify(scores));
    return newScore;
  },

  clearScores: () => {
    localStorage.removeItem(MOCK_SCORES_KEY);
  }
};