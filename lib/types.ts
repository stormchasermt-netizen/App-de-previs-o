export type UserType = 'user' | 'admin' | 'superadmin';

export interface AppUser {
  uid: string;
  displayName: string;
  photoURL?: string;
  type: UserType;
  email: string;
}

export type PrevisaoDifficulty = 'iniciante' | 'intermediario' | 'especialista' | 'mestre';

export interface MapBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface PrevisaoLayer {
  id: string;
  name: string;
  category?: string;
  time?: string;
  imageUrl: string;
  bounds?: MapBounds;
  validDifficulties: PrevisaoDifficulty[];
  order: number;
}

export interface StormReport {
  lat: number;
  lng: number;
  type: 'tornado' | 'vento' | 'granizo';
  rating?: string;
  track?: { lat: number; lng: number }[]; // Array of points defining the tornado path
}

export interface PrevisaoEvent {
  id: string;
  eventDate: string; // ISO String
  displayDate: string;
  monthHint?: string;
  region: 'america_do_sul';
  layers: PrevisaoLayer[];
  stormReports: StormReport[];
  bounds: MapBounds;
  active: boolean;
  createdAt: number;
}

export interface PrevisaoScore {
  id: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  eventId: string;
  difficulty: PrevisaoDifficulty;
  forecastLat: number;
  forecastLng: number;
  distanceKm: number;
  basePoints: number;
  difficultyMultiplier: number;
  streakBonus: number;
  finalScore: number;
  streakCount: number;
  createdAt: number;
}