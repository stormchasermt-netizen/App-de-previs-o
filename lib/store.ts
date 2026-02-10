import { PrevisaoEvent, PrevisaoScore } from './types';
import { db } from './db';

// Initial dummy data if empty (fallback)
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
  getEvents: async (): Promise<PrevisaoEvent[]> => {
    const events = await db.getEvents();
    if (events.length === 0) {
      // Seed initial data if DB is empty
      for (const evt of INITIAL_EVENTS) {
        await db.saveEvent(evt);
      }
      return INITIAL_EVENTS;
    }
    return events;
  },

  getEventById: async (id: string): Promise<PrevisaoEvent | undefined> => {
    const events = await db.getEvents();
    return events.find(e => e.id === id);
  },

  addEvent: async (event: Omit<PrevisaoEvent, 'id' | 'createdAt'>) => {
    const newEvent: PrevisaoEvent = {
      ...event,
      id: `evt-${Date.now()}`,
      createdAt: Date.now(),
    };
    await db.saveEvent(newEvent);
    return newEvent;
  },

  updateEvent: async (event: PrevisaoEvent) => {
    await db.saveEvent(event);
    return event;
  },

  deleteEvent: async (id: string) => {
    await db.deleteEvent(id);
  },

  getScores: async (): Promise<PrevisaoScore[]> => {
    return await db.getScores();
  },

  addScore: async (score: Omit<PrevisaoScore, 'id' | 'createdAt'>) => {
    const newScore: PrevisaoScore = {
      ...score,
      id: `score-${Date.now()}`,
      createdAt: Date.now(),
    };
    await db.saveScore(newScore);
    return newScore;
  },

  clearScores: async () => {
    await db.clearScores();
  }
};