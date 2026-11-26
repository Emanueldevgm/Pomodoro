'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  X,
  Minus,
  Plus,
  Check,
  Trash2,
  ListTodo,
  Clock,
  ChevronRight,
  Download,
} from 'lucide-react';
import Onboarding from './Onboarding';
import {
  ACCENT_PALETTES,
  AccentId,
  CompletedSession,
  DEFAULT_SETTINGS,
  PersistedState,
  PomodoroSettings,
  PomodoroTask,
  STORAGE_KEY,
  TimerMode,
} from '../types/pomodoro';

type MobileTab = 'timer' | 'tasks';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const MODE_META: Record<
  TimerMode,
  {
    label: string;
    shortLabel: string;
    hint: string;
    breakLightHex: string;
    breakDarkHex: string;
  }
> = {
  focus: {
    label: 'Foco',
    shortLabel: 'Foco',
    hint: 'Concentre-se em uma única tarefa',
    breakLightHex: '#2E6F5E',
    breakDarkHex: '#4BA890',
  },
  shortBreak: {
    label: 'Pausa Curta',
    shortLabel: 'Curta',
    hint: 'Respire, hidrate-se e descanse os olhos',
    breakLightHex: '#356987',
    breakDarkHex: '#5B9EC4',
  },
  longBreak: {
    label: 'Pausa Longa',
    shortLabel: 'Longa',
    hint: 'Desconecte-se por alguns minutos',
    breakLightHex: '#56599C',
    breakDarkHex: '#8386CE',
  },
};

function getLocalDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDurationSeconds(mode: TimerMode, settings: PomodoroSettings): number {
  switch (mode) {
    case 'focus':
      return settings.focusMinutes * 60;
    case 'shortBreak':
      return settings.shortBreakMinutes * 60;
    case 'longBreak':
      return settings.longBreakMinutes * 60;
  }
}

function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatTimeOfDay(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function Pomodoro() {
  const [hydrated, setHydrated] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>('');
  const [tasks, setTasks] = useState<PomodoroTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [newTaskInput, setNewTaskInput] = useState<string>('');
  const [mobileTab, setMobileTab] = useState<MobileTab>('timer');

  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState<number>(DEFAULT_SETTINGS.focusMinutes * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [targetEndTime, setTargetEndTime] = useState<number | null>(null);
  const [completedFocusCount, setCompletedFocusCount] = useState<number>(0);
  const [todaySessions, setTodaySessions] = useState<CompletedSession[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [wakeLockSupported, setWakeLockSupported] = useState<boolean>(false);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(false);
  const [isIOSDevice, setIsIOSDevice] = useState<boolean>(false);
  const [showInstallHelp, setShowInstallHelp] = useState<boolean>(false);
  const [installError, setInstallError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const completionHandledRef = useRef<boolean>(false);

  // Active accent colors derived from user's chosen palette
  const userPalette = ACCENT_PALETTES[settings.accent] ?? ACCENT_PALETTES.eucalyptus;
  const focusAccentHex =
    settings.theme === 'dark' ? userPalette.darkHex : userPalette.lightHex;
  const focusTextOnAccent =
    settings.theme === 'dark'
      ? userPalette.darkTextOnAccent
      : userPalette.lightTextOnAccent;

  const currentAccentHex =
    mode === 'focus'
      ? focusAccentHex
      : settings.theme === 'dark'
      ? MODE_META[mode].breakDarkHex
      : MODE_META[mode].breakLightHex;

  const currentTextOnAccent =
    mode === 'focus'
      ? focusTextOnAccent
      : settings.theme === 'dark'
      ? '#0E171D'
      : '#FFFFFF';

  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null;

  // Unlock Web Audio API cleanly inside a direct user touch/click gesture
  const unlockAudio = useCallback(() => {
    if (typeof window === 'undefined') return;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContextClass();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
  }, []);

  // Synthesize a gentle, soothing harmonic chime using Web Audio API (no <audio> element)
  const playNotificationChime = useCallback(
    (finishedMode: TimerMode) => {
      if (!settings.soundEnabled || typeof window === 'undefined') return;

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContextClass();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const notes =
          finishedMode === 'focus'
            ? [523.25, 659.25, 783.99] // C5 -> E5 -> G5
            : [659.25, 523.25]; // E5 -> C5

        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.22);

          gain.gain.setValueAtTime(0.0001, now + idx * 0.22);
          gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.22 + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.22 + 0.95);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.22);
          osc.stop(now + idx * 0.22 + 1.0);
        });

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([120, 70, 120]);
        }
      } catch {
        // Ignore audio errors on restricted devices
      }
    },
    [settings.soundEnabled]
  );

  // Sync theme class on <html>
  useEffect(() => {
    if (!hydrated || typeof document === 'undefined') return;
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', settings.theme === 'dark' ? '#111514' : '#F4F5F3');
    }
  }, [settings.theme, hydrated]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIOSStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
    setIsIOSDevice(isIOS);
    setIsAppInstalled(
      window.matchMedia('(display-mode: standalone)').matches || isIOSStandalone === true
    );

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setInstallPromptEvent(null);
      setShowInstallHelp(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Hydrate persisted state from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setWakeLockSupported('wakeLock' in navigator);

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const todayKey = getLocalDateKey();

      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        const restoredSettings: PomodoroSettings = {
          ...DEFAULT_SETTINGS,
          ...(parsed.settings ?? {}),
        };
        const restoredMode: TimerMode = parsed.mode ?? 'focus';
        const restoredFocusCount =
          typeof parsed.completedFocusCount === 'number' ? parsed.completedFocusCount : 0;
        const restoredSessions =
          parsed.todayDate === todayKey && Array.isArray(parsed.todaySessions)
            ? parsed.todaySessions
            : [];
        const restoredTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];

        setOnboardingCompleted(Boolean(parsed.onboardingCompleted));
        setUserName(typeof parsed.userName === 'string' ? parsed.userName : '');
        setTasks(restoredTasks);
        setActiveTaskId(
          typeof parsed.activeTaskId === 'string' &&
            restoredTasks.some((t) => t.id === parsed.activeTaskId)
            ? parsed.activeTaskId
            : restoredTasks[0]?.id ?? null
        );
        setSettings(restoredSettings);
        setMode(restoredMode);
        setCompletedFocusCount(restoredFocusCount);
        setTodaySessions(restoredSessions);

        if (parsed.isRunning && typeof parsed.targetEndTime === 'number') {
          const remaining = Math.ceil((parsed.targetEndTime - Date.now()) / 1000);
          if (remaining > 0) {
            setTimeLeft(remaining);
            setTargetEndTime(parsed.targetEndTime);
            setIsRunning(true);
          } else {
            const defaultSecs = getDurationSeconds(restoredMode, restoredSettings);
            setTimeLeft(defaultSecs);
            setTargetEndTime(null);
            setIsRunning(false);
          }
        } else {
          const fallbackSecs = getDurationSeconds(restoredMode, restoredSettings);
          setTimeLeft(
            typeof parsed.timeLeft === 'number' && parsed.timeLeft > 0
              ? parsed.timeLeft
              : fallbackSecs
          );
          setTargetEndTime(null);
          setIsRunning(false);
        }
      }
    } catch {
      // Fallback safely to defaults if storage is corrupted
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist state changes to localStorage
  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;

    const payload: PersistedState = {
      onboardingCompleted,
      userName,
      tasks,
      activeTaskId,
      mode,
      isRunning,
      timeLeft,
      targetEndTime,
      completedFocusCount,
      todayDate: getLocalDateKey(),
      todaySessions,
      settings,
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    hydrated,
    onboardingCompleted,
    userName,
    tasks,
    activeTaskId,
    mode,
    isRunning,
    timeLeft,
    targetEndTime,
    completedFocusCount,
    todaySessions,
    settings,
  ]);

  // Manage Screen Wake Lock API while timer is running
  const acquireWakeLock = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    if (document.visibilityState !== 'visible') return;
    if (wakeLockRef.current) return;

    try {
      const sentinel = await navigator.wakeLock.request('screen');
      wakeLockRef.current = sentinel;
      setWakeLockActive(true);
      sentinel.addEventListener('release', () => {
        wakeLockRef.current = null;
        setWakeLockActive(false);
      });
    } catch {
      setWakeLockActive(false);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // Ignore release errors
      }
      wakeLockRef.current = null;
    }
    setWakeLockActive(false);
  }, []);

  useEffect(() => {
    if (isRunning) {
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunning) {
        acquireWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRunning, acquireWakeLock, releaseWakeLock]);

  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  // Advance to next cycle phase
  const advancePhase = useCallback(
    (wasNaturalCompletion: boolean) => {
      if (wasNaturalCompletion) {
        playNotificationChime(mode);
      }

      let nextMode: TimerMode = 'focus';
      let nextFocusCount = completedFocusCount;

      if (mode === 'focus') {
        nextFocusCount = completedFocusCount + 1;
        setCompletedFocusCount(nextFocusCount);

        if (wasNaturalCompletion) {
          const currentTaskTitle = activeTask?.title;

          if (activeTaskId) {
            setTasks((prev) =>
              prev.map((task) =>
                task.id === activeTaskId
                  ? { ...task, completedPomodoros: task.completedPomodoros + 1 }
                  : task
              )
            );
          }

          setTodaySessions((prev) => [
            {
              id: `${Date.now()}`,
              mode: 'focus',
              durationMinutes: settings.focusMinutes,
              completedAt: new Date().toISOString(),
              taskTitle: currentTaskTitle,
            },
            ...prev,
          ]);
        }

        nextMode = nextFocusCount % 4 === 0 ? 'longBreak' : 'shortBreak';
      } else {
        nextMode = 'focus';
      }

      const nextDuration = getDurationSeconds(nextMode, settings);
      setMode(nextMode);
      setTimeLeft(nextDuration);

      if (wasNaturalCompletion && settings.autoStartNext) {
        const nextEnd = Date.now() + nextDuration * 1000;
        setTargetEndTime(nextEnd);
        setIsRunning(true);
      } else {
        setTargetEndTime(null);
        setIsRunning(false);
      }
    },
    [mode, completedFocusCount, settings, playNotificationChime, activeTask, activeTaskId]
  );

  // Accurate timestamp-based countdown interval
  useEffect(() => {
    if (!isRunning || targetEndTime === null) {
      completionHandledRef.current = false;
      return;
    }

    const tick = () => {
      const remaining = Math.ceil((targetEndTime - Date.now()) / 1000);
      if (remaining <= 0) {
        if (!completionHandledRef.current) {
          completionHandledRef.current = true;
          setTimeLeft(0);
          advancePhase(true);
        }
      } else {
        setTimeLeft(remaining);
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [isRunning, targetEndTime, advancePhase]);

  // Sync browser document title with live countdown
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (onboardingCompleted && isRunning) {
      document.title = `${formatClock(timeLeft)} · ${MODE_META[mode].label} — Cadência`;
    } else {
      document.title = 'Cadência — Pomodoro Mobile';
    }
  }, [timeLeft, isRunning, mode, onboardingCompleted]);

  const handleToggleTimer = () => {
    unlockAudio();
    if (isRunning) {
      const remaining =
        targetEndTime !== null
          ? Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000))
          : timeLeft;
      setTimeLeft(remaining);
      setTargetEndTime(null);
      setIsRunning(false);
    } else {
      const baseSeconds = timeLeft > 0 ? timeLeft : getDurationSeconds(mode, settings);
      setTimeLeft(baseSeconds);
      setTargetEndTime(Date.now() + baseSeconds * 1000);
      setIsRunning(true);
    }
  };

  const handleReset = () => {
    unlockAudio();
    setIsRunning(false);
    setTargetEndTime(null);
    setTimeLeft(getDurationSeconds(mode, settings));
  };

  const handleSelectMode = (nextMode: TimerMode) => {
    unlockAudio();
    setIsRunning(false);
    setTargetEndTime(null);
    setMode(nextMode);
    setTimeLeft(getDurationSeconds(nextMode, settings));
  };

  const handleSkipPhase = () => {
    unlockAudio();
    advancePhase(false);
  };

  const updateSettingMinutes = (
    key: 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes',
    delta: number,
    minVal: number,
    maxVal: number
  ) => {
    setSettings((prev) => {
      const nextVal = Math.min(maxVal, Math.max(minVal, prev[key] + delta));
      const updated = { ...prev, [key]: nextVal };

      if (!isRunning) {
        const modeMatches =
          (key === 'focusMinutes' && mode === 'focus') ||
          (key === 'shortBreakMinutes' && mode === 'shortBreak') ||
          (key === 'longBreakMinutes' && mode === 'longBreak');
        if (modeMatches) {
          setTimeLeft(nextVal * 60);
          setTargetEndTime(null);
        }
      }
      return updated;
    });
  };

  // Task CRUD handlers
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTaskInput.trim();
    if (!cleaned) return;

    const newTask: PomodoroTask = {
      id: `task-${Date.now()}`,
      title: cleaned,
      completed: false,
      completedPomodoros: 0,
      createdAt: new Date().toISOString(),
    };

    setTasks((prev) => [newTask, ...prev]);
    if (!activeTaskId) {
      setActiveTaskId(newTask.id);
    }
    setNewTaskInput('');
  };

  const handleToggleTaskComplete = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => {
      const filtered = prev.filter((t) => t.id !== taskId);
      if (activeTaskId === taskId) {
        setActiveTaskId(filtered.find((t) => !t.completed)?.id ?? filtered[0]?.id ?? null);
      }
      return filtered;
    });
  };

  const handleSelectActiveTask = (taskId: string) => {
    setActiveTaskId(taskId);
    setMobileTab('timer');
  };

  const handleInstallApp = async () => {
    setInstallError(null);
    if (!installPromptEvent) {
      setShowInstallHelp((current) => !current);
      return;
    }

    try {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setIsAppInstalled(true);
      }
      setInstallPromptEvent(null);
    } catch (error) {
      console.error('Não foi possível iniciar a instalação do Cadência.', error);
      setInstallError('Não foi possível abrir a instalação. Tente pelo menu do navegador.');
    }
  };

  // Avoid flashing timer screen before localStorage check completes
  if (!hydrated) {
    return (
      <div className="min-h-dvh w-full bg-[#F4F5F3] dark:bg-[#111514]" aria-hidden="true" />
    );
  }

  // Onboarding screen shown before the main Pomodoro screen
  if (!onboardingCompleted) {
    return (
      <Onboarding
        initialName={userName}
        initialTheme={settings.theme}
        initialAccent={settings.accent}
        initialTasks={tasks}
        onThemeChange={(nextTheme) =>
          setSettings((prev) => ({ ...prev, theme: nextTheme }))
        }
        onAccentChange={(nextAccent) =>
          setSettings((prev) => ({ ...prev, accent: nextAccent }))
        }
        onComplete={({ userName: finalName, theme, accent, tasks: initialTasks }) => {
          setUserName(finalName);
          setSettings((prev) => ({ ...prev, theme, accent }));
          setTasks(initialTasks);
          setActiveTaskId(initialTasks[0]?.id ?? null);
          setOnboardingCompleted(true);
        }}
      />
    );
  }

  const totalSecondsForMode = getDurationSeconds(mode, settings);
  const progressRatio =
    totalSecondsForMode > 0
      ? Math.min(1, Math.max(0, (totalSecondsForMode - timeLeft) / totalSecondsForMode))
      : 0;

  const ringRadius = 114;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference * (1 - progressRatio);

  const cycleIndex = (completedFocusCount % 4) + (mode === 'focus' ? 1 : 0);
  const displayRound = Math.min(4, Math.max(1, cycleIndex || 4));
  const totalFocusMinutesToday = todaySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const currentMeta = MODE_META[mode];
  const displayUserName = userName.trim() || 'Visitante';
  const pendingTasksCount = tasks.filter((t) => !t.completed).length;

  const renderTasksAndHistoryContent = () => (
    <div className="space-y-6">
      {/* Tasks Card */}
      <div className="rounded-3xl bg-white dark:bg-[#191F1D] border border-[#DCE0DA] dark:border-[#26302D] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#18201D] dark:text-[#EEF1EF]">
              Tarefas no Pomodoro
            </h2>
            <p className="mt-0.5 text-xs text-[#5A6862] dark:text-[#98A6A0]">
              Toque em uma tarefa para focar nela durante o ciclo
            </p>
          </div>
          <span className="font-timer text-xs font-medium text-[#5A6862] dark:text-[#98A6A0] shrink-0">
            {pendingTasksCount} {pendingTasksCount === 1 ? 'pendente' : 'pendentes'}
          </span>
        </div>

        {/* Add Task Form (48px touch targets) */}
        <form onSubmit={handleAddTask} className="mt-4 flex gap-2">
          <input
            type="text"
            value={newTaskInput}
            onChange={(e) => setNewTaskInput(e.target.value)}
            placeholder="Nova tarefa..."
            maxLength={60}
            aria-label="Nome da nova tarefa"
            className="flex-1 min-h-[48px] px-4 rounded-2xl bg-[#F4F5F3] dark:bg-[#111514] border border-[#DCE0DA] dark:border-[#2B3532] text-sm font-medium text-[#18201D] dark:text-[#EEF1EF] placeholder:text-[#7E8C86] focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Adicionar tarefa"
            className="min-h-[48px] min-w-[48px] px-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform shrink-0"
            style={{ backgroundColor: focusAccentHex, color: focusTextOnAccent }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Adicionar</span>
          </button>
        </form>

        {/* Task List */}
        {tasks.length === 0 ? (
          <p className="mt-5 text-sm text-[#6B7872] dark:text-[#84928C] py-3">
            Nenhuma tarefa cadastrada ainda. Adicione acima o que você vai fazer hoje.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[#EAECE8] dark:divide-[#242C29]">
            {tasks.map((task) => {
              const isSelected = task.id === activeTaskId;
              return (
                <li key={task.id} className="min-h-[56px] py-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleTaskComplete(task.id)}
                    aria-label={
                      task.completed
                        ? `Marcar ${task.title} como pendente`
                        : `Concluir ${task.title}`
                    }
                    className="min-h-[48px] min-w-[48px] -ml-2 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                  >
                    <span
                      className="w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors"
                      style={
                        task.completed
                          ? { backgroundColor: focusAccentHex, borderColor: focusAccentHex }
                          : {
                              borderColor:
                                settings.theme === 'dark' ? '#3B4843' : '#C5CBC2',
                            }
                      }
                    >
                      {task.completed && (
                        <Check className="w-3.5 h-3.5" style={{ color: focusTextOnAccent }} />
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectActiveTask(task.id)}
                    className="flex-1 min-h-[48px] px-2 text-left flex flex-col justify-center min-w-0 active:opacity-75"
                  >
                    <span
                      className={`text-sm font-semibold truncate ${
                        task.completed
                          ? 'line-through text-[#84928C] dark:text-[#66736D]'
                          : 'text-[#18201D] dark:text-[#EEF1EF]'
                      }`}
                    >
                      {task.title}
                    </span>
                    <span className="text-xs text-[#5A6862] dark:text-[#98A6A0] flex items-center gap-1.5">
                      <span className="font-timer">
                        {task.completedPomodoros}{' '}
                        {task.completedPomodoros === 1 ? 'ciclo' : 'ciclos'}
                      </span>
                      {isSelected && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold" style={{ color: focusAccentHex }}>
                            Em foco
                          </span>
                        </>
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task.id)}
                    aria-label={`Excluir ${task.title}`}
                    className="min-h-[48px] min-w-[48px] -mr-2 rounded-2xl flex items-center justify-center text-[#78857F] dark:text-[#7E8C86] active:scale-95 transition-transform shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Today Summary & Session History */}
      <div className="rounded-3xl bg-white dark:bg-[#191F1D] border border-[#DCE0DA] dark:border-[#26302D] p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#18201D] dark:text-[#EEF1EF]">
            Resumo de hoje
          </h2>
          {todaySessions.length > 0 && (
            <button
              type="button"
              onClick={() => setTodaySessions([])}
              className="min-h-[44px] px-2 -mr-2 text-xs font-medium text-[#5A6862] dark:text-[#98A6A0] active:opacity-70"
            >
              Limpar hoje
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#F4F5F3] dark:bg-[#121715] p-4">
            <div className="text-xs font-medium text-[#5A6862] dark:text-[#98A6A0]">
              Sessões concluídas
            </div>
            <div className="mt-1 font-timer text-2xl font-bold text-[#18201D] dark:text-[#EEF1EF]">
              {todaySessions.length}
            </div>
          </div>
          <div className="rounded-2xl bg-[#F4F5F3] dark:bg-[#121715] p-4">
            <div className="text-xs font-medium text-[#5A6862] dark:text-[#98A6A0]">
              Tempo focado
            </div>
            <div className="mt-1 font-timer text-2xl font-bold text-[#18201D] dark:text-[#EEF1EF]">
              {totalFocusMinutesToday} min
            </div>
          </div>
        </div>

        {todaySessions.length > 0 && (
          <ul className="mt-4 pt-3 border-t border-[#EAECE8] dark:border-[#242C29] divide-y divide-[#EAECE8] dark:divide-[#242C29] max-h-48 overflow-y-auto">
            {todaySessions.slice(0, 8).map((session) => (
              <li
                key={session.id}
                className="py-2.5 flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex items-center gap-2 font-medium text-[#18201D] dark:text-[#EEF1EF] truncate">
                  <Check className="w-4 h-4 shrink-0" style={{ color: focusAccentHex }} />
                  <span className="truncate">{session.taskTitle || 'Bloco de foco'}</span>
                </span>
                <span className="font-timer text-xs text-[#5A6862] dark:text-[#98A6A0] shrink-0">
                  {session.durationMinutes} min · {formatTimeOfDay(session.completedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh w-full bg-[#F4F5F3] text-[#18201D] dark:bg-[#111514] dark:text-[#EEF1EF] transition-colors duration-200 flex flex-col">
      {/* Compact Header (56px) with User Name in Top-Right Corner */}
      <header className="w-full pt-safe px-4 sm:px-6 lg:px-10">
        <div className="max-w-5xl mx-auto h-14 flex items-center justify-between gap-2">
          <span className="text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
            Cadência
          </span>

          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                unlockAudio();
                setSettings((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
              }}
              aria-label={settings.soundEnabled ? 'Silenciar alerta sonoro' : 'Ativar alerta sonoro'}
              className="min-h-[48px] min-w-[48px] rounded-2xl flex items-center justify-center text-[#52605A] dark:text-[#98A6A0] active:scale-95 transition-transform"
            >
              {settings.soundEnabled ? (
                <Volume2 className="w-5 h-5" />
              ) : (
                <VolumeX className="w-5 h-5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Abrir ajustes"
              className="min-h-[48px] min-w-[48px] rounded-2xl flex items-center justify-center text-[#52605A] dark:text-[#98A6A0] active:scale-95 transition-transform"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>

            {/* User Name in Top-Right Corner (Canto Superior Direito) */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label={`Personalizar perfil de ${displayUserName}`}
              className="min-h-[48px] pl-2.5 pr-1 flex items-center gap-2 max-w-[140px] sm:max-w-[190px] active:opacity-75 transition-opacity"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: focusAccentHex }}
                aria-hidden="true"
              />
              <span className="text-sm font-semibold truncate text-[#18201D] dark:text-[#EEF1EF]">
                {displayUserName}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area: Single-Column Mobile Tabs + 2-Column Desktop */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 pt-2 pb-24 lg:py-6 flex flex-col lg:grid lg:grid-cols-12 lg:gap-10 lg:items-start">
        {/* TIMER VIEW (Always visible on Desktop, visible on Mobile when mobileTab === 'timer') */}
        <section
          className={`${
            mobileTab === 'timer' ? 'flex' : 'hidden lg:flex'
          } lg:col-span-6 flex-1 flex-col items-center justify-between w-full max-w-md mx-auto lg:max-w-none`}
        >
          {/* Interactive Mode Segmented Selector (>= 48px) */}
          <div
            role="tablist"
            aria-label="Modo do temporizador"
            className="w-full max-w-md grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-[#E7EAE6] dark:bg-[#1B2220] border border-[#DCE0DA] dark:border-[#26302D]"
          >
            {(['focus', 'shortBreak', 'longBreak'] as TimerMode[]).map((itemMode) => {
              const isSelected = mode === itemMode;
              return (
                <button
                  key={itemMode}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleSelectMode(itemMode)}
                  className={`min-h-[48px] px-2 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 transition-all active:scale-[0.98] ${
                    isSelected
                      ? 'bg-white dark:bg-[#252E2B] text-[#18201D] dark:text-[#EEF1EF] shadow-xs'
                      : 'text-[#52605A] dark:text-[#98A6A0]'
                  }`}
                >
                  <span className="sm:hidden">{MODE_META[itemMode].shortLabel}</span>
                  <span className="hidden sm:inline">{MODE_META[itemMode].label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Task Bar on Timer Screen */}
          <button
            type="button"
            onClick={() => setMobileTab('tasks')}
            className="mt-3 w-full max-w-md min-h-[48px] px-4 rounded-2xl bg-white/80 dark:bg-[#191F1D] border border-[#DCE0DA] dark:border-[#26302D] flex items-center justify-between gap-3 text-left active:scale-[0.99] transition-transform lg:cursor-default lg:active:scale-100"
          >
            <span className="min-w-0 flex items-center gap-2 text-sm">
              <span className="text-[#5A6862] dark:text-[#98A6A0] shrink-0">Tarefa:</span>
              <span className="font-semibold text-[#18201D] dark:text-[#EEF1EF] truncate">
                {activeTask ? activeTask.title : 'Selecionar atividade'}
              </span>
            </span>
            <ChevronRight className="w-4 h-4 text-[#78857F] dark:text-[#8E9C96] shrink-0 lg:hidden" />
          </button>

          {/* Focal Circular Progress Ring */}
          <div className="my-5 sm:my-7 flex flex-col items-center">
            <div className="relative w-[252px] h-[252px] sm:w-[284px] sm:h-[284px] flex items-center justify-center">
              <svg
                className="w-full h-full -rotate-90"
                viewBox="0 0 260 260"
                aria-hidden="true"
              >
                <circle
                  cx="130"
                  cy="130"
                  r={ringRadius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-[#E3E6E1] dark:text-[#222A27]"
                />
                <circle
                  cx="130"
                  cy="130"
                  r={ringRadius}
                  fill="none"
                  stroke={currentAccentHex}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-[stroke-dashoffset,stroke] duration-300 ease-out"
                />
              </svg>

              {/* Center Readout */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <span
                  className="text-sm font-semibold tracking-tight mb-1"
                  style={{ color: currentAccentHex }}
                >
                  {currentMeta.label}
                </span>
                <div
                  className="font-timer text-[54px] sm:text-[62px] font-bold leading-none tracking-tight text-[#18201D] dark:text-[#EEF1EF]"
                  aria-live="polite"
                >
                  {formatClock(timeLeft)}
                </div>
                <div className="mt-3 text-xs font-medium text-[#5A6862] dark:text-[#98A6A0] flex items-center gap-2">
                  <span>Ciclo {displayRound} de 4</span>
                  {wakeLockSupported && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{wakeLockActive ? 'Tela ativa' : 'Tela normal'}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 4-Round Cycle Progress Bars */}
            <div className="mt-4 flex items-center gap-2.5" aria-label={`Rodada ${displayRound} de 4`}>
              {[1, 2, 3, 4].map((step) => {
                const completedCountInCycle = completedFocusCount % 4;
                const isDone =
                  completedCountInCycle >= step ||
                  (mode === 'longBreak' && completedFocusCount > 0 && completedCountInCycle === 0);
                const isCurrent = mode === 'focus' && displayRound === step;
                return (
                  <span
                    key={step}
                    className={`h-2 rounded-full transition-all duration-200 ${
                      isCurrent ? 'w-8' : 'w-4'
                    }`}
                    style={{
                      backgroundColor:
                        isDone || isCurrent
                          ? currentAccentHex
                          : settings.theme === 'dark'
                          ? '#26302D'
                          : '#DCE0DA',
                      opacity: isDone ? 0.55 : 1,
                    }}
                  />
                );
              })}
            </div>

            <p className="mt-3 text-sm text-[#5A6862] dark:text-[#98A6A0] text-center max-w-xs">
              {currentMeta.hint}
            </p>
          </div>

          {/* Thumb-Zone Touch Controls (All buttons >= 48px high) */}
          <div className="w-full max-w-md flex flex-col gap-3">
            <button
              type="button"
              onClick={handleToggleTimer}
              className="w-full min-h-[56px] rounded-2xl text-base font-semibold flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.98] transition-transform"
              style={{ backgroundColor: currentAccentHex, color: currentTextOnAccent }}
            >
              {isRunning ? (
                <>
                  <Pause className="w-5 h-5 fill-current" />
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>
                    {timeLeft < totalSecondsForMode && timeLeft > 0 ? 'Continuar' : 'Iniciar'}
                  </span>
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="min-h-[48px] px-4 rounded-2xl bg-white dark:bg-[#191F1D] border border-[#DCE0DA] dark:border-[#26302D] text-sm font-semibold text-[#2E3834] dark:text-[#D5DDD9] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Resetar</span>
              </button>

              <button
                type="button"
                onClick={handleSkipPhase}
                className="min-h-[48px] px-4 rounded-2xl bg-white dark:bg-[#191F1D] border border-[#DCE0DA] dark:border-[#26302D] text-sm font-semibold text-[#2E3834] dark:text-[#D5DDD9] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <SkipForward className="w-4 h-4" />
                <span>Avançar</span>
              </button>
            </div>
          </div>
        </section>

        {/* TASKS & HISTORY VIEW (Always visible on Desktop right column, tab on Mobile) */}
        <aside
          className={`${
            mobileTab === 'tasks' ? 'block' : 'hidden lg:block'
          } lg:col-span-6 w-full max-w-md mx-auto lg:max-w-none`}
        >
          {renderTasksAndHistoryContent()}
        </aside>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (Thumb Zone: Timer | Tarefas) */}
      <nav
        aria-label="Navegação principal"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#151A18]/95 backdrop-blur-md border-t border-[#DCE0DA] dark:border-[#26302D] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-md mx-auto grid grid-cols-2 h-[60px]">
          <button
            type="button"
            onClick={() => setMobileTab('timer')}
            className={`flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors ${
              mobileTab === 'timer'
                ? 'text-[#18201D] dark:text-[#EEF1EF]'
                : 'text-[#6B7872] dark:text-[#84928C]'
            }`}
            style={mobileTab === 'timer' ? { color: focusAccentHex } : undefined}
          >
            <Clock className="w-5 h-5" />
            <span>Timer</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('tasks')}
            className={`flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors ${
              mobileTab === 'tasks'
                ? 'text-[#18201D] dark:text-[#EEF1EF]'
                : 'text-[#6B7872] dark:text-[#84928C]'
            }`}
            style={mobileTab === 'tasks' ? { color: focusAccentHex } : undefined}
          >
            <ListTodo className="w-5 h-5" />
            <span>Tarefas ({pendingTasksCount})</span>
          </button>
        </div>
      </nav>

      {/* Bottom Sheet Settings & Personalization Drawer */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Ajustes e personalização"
        >
          <div
            className="fixed inset-0"
            onClick={() => setIsSettingsOpen(false)}
            aria-hidden="true"
          />

          <div className="relative z-10 w-full sm:max-w-md max-h-[88dvh] overflow-y-auto bg-white dark:bg-[#191F1D] rounded-t-3xl sm:rounded-3xl border-t sm:border border-[#DCE0DA] dark:border-[#26302D] px-5 pt-3 pb-safe sm:p-6 shadow-xl">
            <div className="sm:hidden w-10 h-1.5 bg-[#D4D9D2] dark:bg-[#313D39] rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#18201D] dark:text-[#EEF1EF]">
                Ajustes e perfil
              </h2>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                aria-label="Fechar ajustes"
                className="min-h-[48px] min-w-[48px] -mr-2 rounded-2xl flex items-center justify-center text-[#52605A] dark:text-[#98A6A0] active:scale-95 transition-transform"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name & Theme & Color Personalization */}
              <div>
                <label
                  htmlFor="settings-name"
                  className="block text-xs font-semibold text-[#5A6862] dark:text-[#98A6A0] mb-1.5"
                >
                  Nome exibido no canto superior direito
                </label>
                <input
                  id="settings-name"
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  maxLength={32}
                  placeholder="Seu nome"
                  className="w-full min-h-[48px] px-4 rounded-2xl bg-[#F4F5F3] dark:bg-[#111514] border border-[#DCE0DA] dark:border-[#2B3532] text-sm font-medium text-[#18201D] dark:text-[#EEF1EF] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[#18201D] dark:text-[#EEF1EF]">
                  Cor do app
                </span>
                <div className="flex items-center gap-2">
                  {(Object.keys(ACCENT_PALETTES) as AccentId[]).map((paletteId) => {
                    const p = ACCENT_PALETTES[paletteId];
                    const swatch = settings.theme === 'dark' ? p.darkHex : p.lightHex;
                    const active = settings.accent === paletteId;
                    return (
                      <button
                        key={paletteId}
                        type="button"
                        onClick={() => setSettings((prev) => ({ ...prev, accent: paletteId }))}
                        aria-label={`Cor ${p.name}`}
                        className="min-h-[48px] min-w-[48px] rounded-2xl flex items-center justify-center border active:scale-95 transition-transform"
                        style={{
                          borderColor: active
                            ? swatch
                            : settings.theme === 'dark'
                            ? '#26302D'
                            : '#DCE0DA',
                          borderWidth: active ? '2px' : '1px',
                        }}
                      >
                        <span
                          className="w-6 h-6 rounded-full"
                          style={{ backgroundColor: swatch }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#EAECE8] dark:border-[#242C29]">
                <span className="text-sm font-medium text-[#18201D] dark:text-[#EEF1EF]">
                  Tema
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettings((prev) => ({ ...prev, theme: 'light' }))}
                    className={`min-h-[48px] px-4 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                      settings.theme === 'light'
                        ? 'bg-[#F4F5F3] dark:bg-[#232B28]'
                        : 'border-[#DCE0DA] dark:border-[#26302D] text-[#5A6862]'
                    }`}
                    style={
                      settings.theme === 'light' ? { borderColor: focusAccentHex } : undefined
                    }
                  >
                    <Sun className="w-4 h-4" />
                    <span>Claro</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings((prev) => ({ ...prev, theme: 'dark' }))}
                    className={`min-h-[48px] px-4 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                      settings.theme === 'dark'
                        ? 'bg-[#F4F5F3] dark:bg-[#232B28]'
                        : 'border-[#DCE0DA] dark:border-[#26302D] text-[#98A6A0]'
                    }`}
                    style={
                      settings.theme === 'dark' ? { borderColor: focusAccentHex } : undefined
                    }
                  >
                    <Moon className="w-4 h-4" />
                    <span>Escuro</span>
                  </button>
                </div>
              </div>

              {/* Duration Steppers */}
              {(
                [
                  {
                    key: 'focusMinutes',
                    label: 'Duração do Foco',
                    min: 5,
                    max: 90,
                    step: 5,
                  },
                  {
                    key: 'shortBreakMinutes',
                    label: 'Pausa Curta',
                    min: 1,
                    max: 30,
                    step: 1,
                  },
                  {
                    key: 'longBreakMinutes',
                    label: 'Pausa Longa',
                    min: 5,
                    max: 45,
                    step: 5,
                  },
                ] as const
              ).map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between py-1 border-b border-[#EAECE8] dark:border-[#242C29]"
                >
                  <span className="text-sm font-medium text-[#18201D] dark:text-[#EEF1EF]">
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateSettingMinutes(item.key, -item.step, item.min, item.max)
                      }
                      aria-label={`Diminuir ${item.label}`}
                      className="min-h-[48px] min-w-[48px] rounded-xl bg-[#F4F5F3] dark:bg-[#232B28] flex items-center justify-center text-[#18201D] dark:text-[#EEF1EF] active:scale-95 transition-transform"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-timer w-14 text-center text-sm font-semibold text-[#18201D] dark:text-[#EEF1EF]">
                      {settings[item.key]} min
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateSettingMinutes(item.key, item.step, item.min, item.max)
                      }
                      aria-label={`Aumentar ${item.label}`}
                      className="min-h-[48px] min-w-[48px] rounded-xl bg-[#F4F5F3] dark:bg-[#232B28] flex items-center justify-center text-[#18201D] dark:text-[#EEF1EF] active:scale-95 transition-transform"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Auto-start toggle */}
              <button
                type="button"
                onClick={() =>
                  setSettings((prev) => ({ ...prev, autoStartNext: !prev.autoStartNext }))
                }
                className="w-full min-h-[52px] py-1 flex items-center justify-between text-left"
              >
                <div>
                  <div className="text-sm font-medium text-[#18201D] dark:text-[#EEF1EF]">
                    Iniciar próximo ciclo automaticamente
                  </div>
                  <div className="text-xs text-[#5A6862] dark:text-[#98A6A0]">
                    Avança direto para a pausa ou foco seguinte
                  </div>
                </div>
                <span
                  className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ml-3 flex items-center ${
                    settings.autoStartNext
                      ? 'justify-end'
                      : 'bg-[#D4D9D2] dark:bg-[#2E3835] justify-start'
                  }`}
                  style={
                    settings.autoStartNext ? { backgroundColor: focusAccentHex } : undefined
                  }
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                </span>
              </button>

              <section className="rounded-2xl border border-[#DCE0DA] dark:border-[#2B3532] bg-[#F8F9F7] dark:bg-[#151A18] p-4">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center bg-[#E4ECE7] dark:bg-[#24332D] text-[#2E6F5E] dark:text-[#75B69F]">
                    <Download className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-[#18201D] dark:text-[#EEF1EF]">
                      Instale no seu dispositivo
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#5A6862] dark:text-[#98A6A0]">
                      Use o Cadência como aplicativo no computador ou celular.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleInstallApp}
                  disabled={isAppInstalled}
                  aria-expanded={showInstallHelp}
                  className="mt-3 w-full min-h-[48px] rounded-xl px-4 text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-70"
                  style={{ backgroundColor: focusAccentHex, color: focusTextOnAccent }}
                >
                  {isAppInstalled
                    ? 'Aplicativo já instalado'
                    : isIOSDevice
                    ? 'Como instalar no iPhone ou iPad'
                    : 'Instalar aplicativo'}
                </button>

                {showInstallHelp && !isAppInstalled && (
                  <div className="mt-3 rounded-xl bg-white dark:bg-[#191F1D] p-3 text-xs leading-relaxed text-[#52605A] dark:text-[#B5C0BB]">
                    {isIOSDevice ? (
                      <ol className="list-decimal space-y-1.5 pl-4">
                        <li>Abra esta página no Safari.</li>
                        <li>Toque em Compartilhar (ícone de quadrado com seta para cima).</li>
                        <li>Escolha “Adicionar à Tela de Início” e toque em “Adicionar”.</li>
                      </ol>
                    ) : (
                      <p>
                        No Chrome ou Edge, abra o menu do navegador e escolha “Instalar
                        aplicativo” ou “Adicionar à tela inicial”. Se o ícone de instalação
                        aparecer na barra de endereço, você também pode usá-lo.
                      </p>
                    )}
                  </div>
                )}

                {installError && (
                  <p className="mt-2 text-xs text-red-700 dark:text-red-300" role="alert">
                    {installError}
                  </p>
                )}
              </section>

              {/* Bottom Sheet Action Buttons */}
              <div className="pt-1 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    unlockAudio();
                    playNotificationChime('focus');
                  }}
                  className="flex-1 min-h-[48px] rounded-2xl bg-[#F4F5F3] dark:bg-[#232B28] text-sm font-semibold text-[#18201D] dark:text-[#EEF1EF] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Testar som</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="flex-1 min-h-[48px] rounded-2xl text-sm font-semibold active:scale-[0.98] transition-transform"
                  style={{ backgroundColor: focusAccentHex, color: focusTextOnAccent }}
                >
                  Concluir
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsSettingsOpen(false);
                  setOnboardingCompleted(false);
                }}
                className="w-full min-h-[48px] text-xs font-semibold text-[#5A6862] dark:text-[#98A6A0] active:opacity-70"
              >
                Reabrir apresentação inicial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
