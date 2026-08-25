import React from 'react';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-xl bg-slate-800/80 light:bg-slate-200/80 hover:bg-slate-700 text-slate-300 light:text-slate-700 transition-all duration-300 focus:outline-none border border-slate-700/50"
      title="Toggle Light/Dark Theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 text-amber-400 animate-spin-slow" />
      ) : (
        <Moon className="w-5 h-5 text-indigo-600" />
      )}
    </button>
  );
}
