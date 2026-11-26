export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

export type AccentId = 'eucalyptus' | 'ocean' | 'lavender' | 'amber';

export interface AccentPalette {
  id: AccentId;
  name: string;
  description: string;
  lightHex: string;
  darkHex: string;
  lightTextOnAccent: string;
  darkTextOnAccent: string;
}

export const ACCENT_PALETTES: Record<AccentId, AccentPalette> = {
  eucalyptus: {
    id: 'eucalyptus',
    name: 'Eucalipto',
    description: 'Verde mineral suave para foco prolongado',
    lightHex: '#2E6F5E',
    darkHex: '#4BA890',
    lightTextOnAccent: '#FFFFFF',
    darkTextOnAccent: '#0F1714',
  },
  ocean: {
    id: 'ocean',
    name: 'Oceano',
    description: 'Azul sereno de baixo contraste visual',
    lightHex: '#2F6583',
    darkHex: '#5DA0C5',
    lightTextOnAccent: '#FFFFFF',
    darkTextOnAccent: '#0D171D',
  },
  lavender: {
    id: 'lavender',
    name: 'Lavanda',
    description: 'Índigo calmo para leitura e escrita',
    lightHex: '#56599C',
    darkHex: '#878AD1',
    lightTextOnAccent: '#FFFFFF',
    darkTextOnAccent: '#10111F',
  },
  amber: {
    id: 'amber',
    name: 'Âmbar Suave',
    description: 'Tom terroso acolhedor e quente',
    lightHex: '#9C5B34',
    darkHex: '#D59064',
    lightTextOnAccent: '#FFFFFF',
    darkTextOnAccent: '#1C120B',
  },
};

export const PRESET_TASKS: string[] = [
  'Estudar',
  'Programar',
  'Ler',
  'Escrever',
  'Planejar o dia',
  'Revisar anotações',
];

export interface PomodoroTask {
  id: string;
  title: string;
  completed: boolean;
  completedPomodoros: number;
  createdAt: string;
}

export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  autoStartNext: boolean;
  soundEnabled: boolean;
  theme: 'light' | 'dark';
  accent: AccentId;
}

export interface CompletedSession {
  id: string;
  mode: TimerMode;
  durationMinutes: number;
  completedAt: string;
  taskTitle?: string;
}

export interface PersistedState {
  onboardingCompleted: boolean;
  userName: string;
  tasks: PomodoroTask[];
  activeTaskId: string | null;
  mode: TimerMode;
  isRunning: boolean;
  timeLeft: number;
  targetEndTime: number | null;
  completedFocusCount: number;
  todayDate: string;
  todaySessions: CompletedSession[];
  settings: PomodoroSettings;
}

export const STORAGE_KEY = 'cadencia_pomodoro_v1';

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  autoStartNext: false,
  soundEnabled: true,
  theme: 'light',
  accent: 'eucalyptus',
};
