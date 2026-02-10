export const PREDEFINED_LAYERS = [
  // WPC Surface
  { id: 'wpc_surface', name: 'Análise de Superfície', category: 'Superfície WPC' },
  // SPC Surface
  { id: 'spc_temp_dewpoint', name: 'Temp / Ponto de Orvalho', category: 'Superfície SPC' },
  { id: 'spc_msl_pressure', name: 'Pressão Nível do Mar / Vento', category: 'Superfície SPC' },
  { id: 'spc_moisture', name: 'Convergência de Umidade', category: 'Superfície SPC' },
  // SPC Upper Air
  { id: 'spc_850mb', name: 'Análise 850mb', category: 'Ar Superior SPC' },
  { id: 'spc_700mb', name: 'Análise 700mb', category: 'Ar Superior SPC' },
  { id: 'spc_500mb', name: 'Análise 500mb', category: 'Ar Superior SPC' },
  { id: 'spc_300mb', name: 'Análise 300mb', category: 'Ar Superior SPC' },
  // Thermodynamics
  { id: 'spc_sbcape', name: 'SBCAPE / SBCIN', category: 'Termodinâmica SPC' },
  { id: 'spc_mlcape', name: 'MLCAPE / MLCIN', category: 'Termodinâmica SPC' },
  { id: 'spc_mucape', name: 'MUCAPE', category: 'Termodinâmica SPC' },
  // Shear
  { id: 'spc_effective_shear', name: 'Cisalhamento Efetivo', category: 'Cisalhamento' },
  { id: 'spc_0_6km_shear', name: 'Cisalhamento 0-6km', category: 'Cisalhamento' },
  { id: 'spc_srh', name: 'Helicidade Relativa (SRH)', category: 'Cisalhamento' },
] as const;

export const LAYER_CATEGORIES = [
  'Superfície WPC',
  'Superfície SPC',
  'Ar Superior SPC',
  'Termodinâmica SPC',
  'Cisalhamento',
] as const;

export const LAYER_TIMES = ['00Z', '03Z', '06Z', '09Z', '12Z', '15Z', '18Z', '21Z', '00Z (+1)'];

export const PREVISAO_SCORING = {
  BASE_MAX: 5000,
  MAX_DISTANCE_MILES: 25,
  MILES_TO_KM: 1.60934,
  STREAK_THRESHOLD_MILES: 100,
  STREAK_BONUS_MAX: 0.3,
  MULTIPLIERS: {
    iniciante: 0.6,
    intermediario: 0.8,
    especialista: 1.0,
    mestre: 1.2,
  },
} as const;

// AUTH CONFIGURATION
// Configuração real do Google Cloud
export const GOOGLE_CLIENT_ID = "275898169040-cofl63h80h6rmbg1bjlso3p3vrsb4mv8.apps.googleusercontent.com";

// Lista de emails que têm permissão de ADMIN
export const ADMIN_EMAILS = [
  'stormchasermt@gmail.com', // Criador do App
  'admin@previsaomaster.com'
];