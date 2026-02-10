import { PREVISAO_SCORING } from './constants';
import type { StormReport, PrevisaoDifficulty } from './types';

export function kmToMiles(km: number): number {
  return km / PREVISAO_SCORING.MILES_TO_KM;
}

export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; 
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function minDistanceToReports(
  forecastLat: number,
  forecastLng: number,
  reports: StormReport[]
): number {
  if (reports.length === 0) return 0;
  return Math.min(
    ...reports.map((r) => distanceKm(forecastLat, forecastLng, r.lat, r.lng))
  );
}

export function basePointsFromDistanceMiles(miles: number): number {
  if (miles <= PREVISAO_SCORING.MAX_DISTANCE_MILES) return PREVISAO_SCORING.BASE_MAX;
  const maxMilesForPoints = 5000;
  if (miles >= maxMilesForPoints) return 0;
  const slope = PREVISAO_SCORING.BASE_MAX / (maxMilesForPoints - PREVISAO_SCORING.MAX_DISTANCE_MILES);
  return Math.round(Math.max(0, PREVISAO_SCORING.BASE_MAX - slope * (miles - PREVISAO_SCORING.MAX_DISTANCE_MILES)));
}

export function streakBonusPercent(streakCount: number): number {
  if (streakCount >= 7) return PREVISAO_SCORING.STREAK_BONUS_MAX;
  if (streakCount <= 0) return 0;
  return Math.min(PREVISAO_SCORING.STREAK_BONUS_MAX, (streakCount / 7) * PREVISAO_SCORING.STREAK_BONUS_MAX);
}

export function computeScore(
  distanceKm: number,
  difficulty: PrevisaoDifficulty,
  streakCount: number
): {
  basePoints: number;
  difficultyMultiplier: number;
  streakBonus: number;
  finalScore: number;
} {
  const miles = kmToMiles(distanceKm);
  const basePoints = basePointsFromDistanceMiles(miles);
  const mult = PREVISAO_SCORING.MULTIPLIERS[difficulty];
  const streakBonus = streakBonusPercent(streakCount);
  const finalScore = Math.round(basePoints * mult * (1 + streakBonus));
  return {
    basePoints,
    difficultyMultiplier: mult,
    streakBonus,
    finalScore,
  };
}

export function isGoodForecastForStreak(distanceKm: number): boolean {
  return kmToMiles(distanceKm) <= PREVISAO_SCORING.STREAK_THRESHOLD_MILES;
}
