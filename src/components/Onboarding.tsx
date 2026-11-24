'use client';

import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Plus, Sun, Moon, Trash2 } from 'lucide-react';
import {
  ACCENT_PALETTES,
  AccentId,
  PRESET_TASKS,
  PomodoroTask,
} from '../types/pomodoro';

interface OnboardingProps {
  initialName: string;
  initialTheme: 'light' | 'dark';
  initialAccent: AccentId;
  initialTasks: PomodoroTask[];
  onThemeChange: (theme: 'light' | 'dark') => void;
  onAccentChange: (accent: AccentId) => void;
  onComplete: (payload: {
    userName: string;
    theme: 'light' | 'dark';
    accent: AccentId;
    tasks: PomodoroTask[];
  }) => void;
}

export default function Onboarding({
  initialName,
  initialTheme,
  initialAccent,
  initialTasks,
  onThemeChange,
  onAccentChange,
  onComplete,
}: OnboardingProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState<string>(initialName);
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);
  const [accent, setAccent] = useState<AccentId>(initialAccent);
  const [selectedTitles, setSelectedTitles] = useState<string[]>(
    initialTasks.length > 0 ? initialTasks.map((t) => t.title) : ['Estudar', 'Programar']
  );
  const [customTaskInput, setCustomTaskInput] = useState<string>('');

  const palette = ACCENT_PALETTES[accent];
  const accentHex = theme === 'dark' ? palette.darkHex : palette.lightHex;
  const textOnAccent =
    theme === 'dark' ? palette.darkTextOnAccent : palette.lightTextOnAccent;

  const trimmedName = name.trim();
  const displayName = trimmedName || 'Você';

  const handleThemeSelect = (nextTheme: 'light' | 'dark') => {
    setTheme(nextTheme);
    onThemeChange(nextTheme);
  };

  const handleAccentSelect = (nextAccent: AccentId) => {
    setAccent(nextAccent);
    onAccentChange(nextAccent);
  };

  const toggleTaskTitle = (title: string) => {
    setSelectedTitles((prev) =>
      prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title]
    );
  };

  const handleAddCustomTask = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customTaskInput.trim();
    if (!cleaned) return;
    if (!selectedTitles.some((t) => t.toLowerCase() === cleaned.toLowerCase())) {
      setSelectedTitles((prev) => [...prev, cleaned]);
    }
    setCustomTaskInput('');
  };

  const handleFinish = () => {
    const finalName = trimmedName || 'Visitante';
    const nowIso = new Date().toISOString();
    const tasks: PomodoroTask[] = selectedTitles.map((title, idx) => ({
      id: `task-${Date.now()}-${idx}`,
      title,
      completed: false,
      completedPomodoros: 0,
      createdAt: nowIso,
    }));

    onComplete({
      userName: finalName,
      theme,
      accent,
      tasks,
    });
  };

  const customOnlyTitles = selectedTitles.filter((t) => !PRESET_TASKS.includes(t));

  return (
    <div className="min-h-dvh w-full bg-[#F4F5F3] text-[#18201D] dark:bg-[#111514] dark:text-[#EEF1EF] transition-colors duration-200 flex flex-col">
      {/* Compact Header with Live Preview of Name in Top-Right Corner */}
      <header className="w-full pt-safe px-4 sm:px-6 lg:px-10">
        <div className="max-w-2xl mx-auto h-14 flex items-center justify-between gap-4">
          <span className="text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
            Cadência
          </span>

          <div className="flex items-center gap-2 min-h-[48px] max-w-[180px] shrink-0">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: accentHex }}
              aria-hidden="true"
            />
            <span className="text-sm font-semibold truncate text-[#18201D] dark:text-[#EEF1EF]">
              {displayName}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8 pb-safe flex flex-col justify-between">
        {/* Step Progress Indicator */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2" aria-label={`Etapa ${step} de 3`}>
              {[1, 2, 3].map((idx) => (
                <span
                  key={idx}
                  className={`h-2 rounded-full transition-all duration-200 ${
                    step === idx ? 'w-8' : 'w-4'
                  }`}
                  style={{
                    backgroundColor:
                      idx <= step
                        ? accentHex
                        : theme === 'dark'
                        ? '#26302D'
                        : '#DCE0DA',
                    opacity: idx < step ? 0.5 : 1,
                  }}
                />
              ))}
            </div>
            <span className="font-timer text-xs font-medium text-[#5A6862] dark:text-[#98A6A0]">
              Etapa {step} de 3
            </span>
          </div>

          {/* STEP 1: Nome */}
          {step === 1 && (
            <section className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
                  Deixe o seu Pomodoro com a sua cara
                </h1>
                <p className="mt-2 text-sm sm:text-base text-[#5A6862] dark:text-[#98A6A0]">
                  Como você gostaria de ser chamado? Seu nome aparecerá no canto superior direito do app.
                </p>
              </div>

              <div className="rounded-3xl bg-white dark:bg-[#191F1D] border border-[#DCE0DA] dark:border-[#26302D] p-5 sm:p-6 space-y-5">
                <div>
                  <label
                    htmlFor="onboarding-name"
                    className="block text-sm font-semibold text-[#18201D] dark:text-[#EEF1EF] mb-2"
                  >
                    Seu nome ou apelido
                  </label>
                  <input
                    id="onboarding-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Emanuel"
                    maxLength={32}
                    autoFocus
                    className="w-full min-h-[52px] px-4 rounded-2xl bg-[#F4F5F3] dark:bg-[#111514] border border-[#DCE0DA] dark:border-[#2B3532] text-base font-medium text-[#18201D] dark:text-[#EEF1EF] placeholder:text-[#7E8C86] focus:outline-none focus:ring-2"
                    style={{ ['--tw-ring-color' as string]: accentHex }}
                  />
                </div>

                <div>
                  <span className="block text-sm font-semibold text-[#18201D] dark:text-[#EEF1EF] mb-2">
                    Aparência inicial
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleThemeSelect('light')}
                      className={`min-h-[52px] px-4 rounded-2xl border text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                        theme === 'light'
                          ? 'bg-[#F4F5F3] dark:bg-[#232B28] border-current'
                          : 'bg-transparent border-[#DCE0DA] dark:border-[#26302D] text-[#5A6862] dark:text-[#98A6A0]'
                      }`}
                      style={theme === 'light' ? { borderColor: accentHex } : undefined}
                    >
                      <Sun className="w-4 h-4" />
                      <span>Claro</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleThemeSelect('dark')}
                      className={`min-h-[52px] px-4 rounded-2xl border text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                        theme === 'dark'
                          ? 'bg-[#F4F5F3] dark:bg-[#232B28] border-current'
                          : 'bg-transparent border-[#DCE0DA] dark:border-[#26302D] text-[#5A6862] dark:text-[#98A6A0]'
                      }`}
                      style={theme === 'dark' ? { borderColor: accentHex } : undefined}
                    >
                      <Moon className="w-4 h-4" />
                      <span>Escuro</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* STEP 2: Cores */}
          {step === 2 && (
            <section className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
                  Escolha a cor do seu ambiente de foco
                </h1>
                <p className="mt-2 text-sm sm:text-base text-[#5A6862] dark:text-[#98A6A0]">
                  Tons suaves pensados para reduzir o cansaço visual durante longas sessões.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(ACCENT_PALETTES) as AccentId[]).map((paletteId) => {
                  const item = ACCENT_PALETTES[paletteId];
                  const isSelected = accent === paletteId;
                  const swatchColor = theme === 'dark' ? item.darkHex : item.lightHex;

                  return (
                    <button
                      key={paletteId}
                      type="button"
                      onClick={() => handleAccentSelect(paletteId)}
                      className={`min-h-[76px] p-4 rounded-3xl border text-left flex items-center gap-4 transition-all active:scale-[0.98] ${
                        isSelected
                          ? 'bg-white dark:bg-[#1E2623]'
                          : 'bg-white/70 dark:bg-[#191F1D] border-[#DCE0DA] dark:border-[#26302D]'
                      }`}
                      style={
                        isSelected
                          ? { borderColor: swatchColor, borderWidth: '2px' }
                          : undefined
                      }
                    >
                      <span
                        className="w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: swatchColor }}
                      >
                        {isSelected && (
                          <Check
                            className="w-5 h-5"
                            style={{
                              color:
                                theme === 'dark'
                                  ? item.darkTextOnAccent
                                  : item.lightTextOnAccent,
                            }}
                          />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-[#18201D] dark:text-[#EEF1EF]">
                          {item.name}
                        </div>
                        <div className="text-xs text-[#5A6862] dark:text-[#98A6A0] mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* STEP 3: Tarefas que você faz no Pomodoro */}
          {step === 3 && (
            <section className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
                  Quais tarefas você costuma fazer no Pomodoro?
                </h1>
                <p className="mt-2 text-sm sm:text-base text-[#5A6862] dark:text-[#98A6A0]">
                  Selecione ou adicione suas atividades. Você poderá marcar e acompanhar ciclos em cada uma delas.
                </p>
              </div>

              <div className="rounded-3xl bg-white dark:bg-[#191F1D] border border-[#DCE0DA] dark:border-[#26302D] p-5 space-y-5">
                <div>
                  <span className="block text-xs font-semibold text-[#5A6862] dark:text-[#98A6A0] mb-3">
                    Sugestões rápidas
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    {PRESET_TASKS.map((taskLabel) => {
                      const active = selectedTitles.includes(taskLabel);
                      return (
                        <button
                          key={taskLabel}
                          type="button"
                          onClick={() => toggleTaskTitle(taskLabel)}
                          className={`min-h-[48px] px-3.5 rounded-2xl border text-sm font-semibold flex items-center justify-between gap-2 transition-all active:scale-[0.98] ${
                            active
                              ? 'bg-[#F4F5F3] dark:bg-[#232B28] text-[#18201D] dark:text-[#EEF1EF]'
                              : 'bg-transparent border-[#DCE0DA] dark:border-[#26302D] text-[#5A6862] dark:text-[#98A6A0]'
                          }`}
                          style={active ? { borderColor: accentHex } : undefined}
                        >
                          <span className="truncate">{taskLabel}</span>
                          {active && (
                            <Check className="w-4 h-4 shrink-0" style={{ color: accentHex }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <form onSubmit={handleAddCustomTask} className="pt-2 border-t border-[#EAECE8] dark:border-[#242C29]">
                  <label
                    htmlFor="custom-task-input"
                    className="block text-xs font-semibold text-[#5A6862] dark:text-[#98A6A0] mb-2"
                  >
                    Adicionar tarefa personalizada
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="custom-task-input"
                      type="text"
                      value={customTaskInput}
                      onChange={(e) => setCustomTaskInput(e.target.value)}
                      placeholder="Ex.: TCC, Inglês, Design..."
                      maxLength={60}
                      className="flex-1 min-h-[48px] px-4 rounded-2xl bg-[#F4F5F3] dark:bg-[#111514] border border-[#DCE0DA] dark:border-[#2B3532] text-sm font-medium text-[#18201D] dark:text-[#EEF1EF] placeholder:text-[#7E8C86] focus:outline-none"
                    />
                    <button
                      type="submit"
                      aria-label="Adicionar tarefa"
                      className="min-h-[48px] min-w-[48px] px-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform shrink-0"
                      style={{ backgroundColor: accentHex, color: textOnAccent }}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Adicionar</span>
                    </button>
                  </div>
                </form>

                {customOnlyTitles.length > 0 && (
                  <div className="space-y-2">
                    <span className="block text-xs font-semibold text-[#5A6862] dark:text-[#98A6A0]">
                      Suas tarefas adicionadas
                    </span>
                    <ul className="divide-y divide-[#EAECE8] dark:divide-[#242C29]">
                      {customOnlyTitles.map((title) => (
                        <li
                          key={title}
                          className="min-h-[48px] flex items-center justify-between gap-2 py-1"
                        >
                          <span className="text-sm font-medium text-[#18201D] dark:text-[#EEF1EF] truncate">
                            {title}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleTaskTitle(title)}
                            aria-label={`Remover ${title}`}
                            className="min-h-[48px] min-w-[48px] flex items-center justify-center text-[#6B7872] dark:text-[#8E9C96] active:scale-95"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Bottom Thumb-Zone Navigation Actions (>= 48px height) */}
        <div className="mt-8 pt-4 flex items-center gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev === 3 ? 2 : 1))}
              className="min-h-[52px] px-5 rounded-2xl bg-white dark:bg-[#191F1D] border border-[#DCE0DA] dark:border-[#26302D] text-sm font-semibold text-[#18201D] dark:text-[#EEF1EF] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="min-h-[52px] px-4 rounded-2xl text-sm font-semibold text-[#5A6862] dark:text-[#98A6A0] active:opacity-75 whitespace-nowrap"
            >
              Pular
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev === 1 ? 2 : 3))}
              className="flex-1 min-h-[52px] px-6 rounded-2xl text-base font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{ backgroundColor: accentHex, color: textOnAccent }}
            >
              <span>Continuar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="flex-1 min-h-[52px] px-6 rounded-2xl text-base font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{ backgroundColor: accentHex, color: textOnAccent }}
            >
              <span>Começar a focar</span>
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
