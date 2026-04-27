"use client";

import { useTheme, type ThemeId } from "./theme-provider";

const OPTIONS: Array<{ id: ThemeId; label: string }> = [
  { id: "ocean", label: "Ocean (default)" },
  { id: "dark", label: "Dark" },
  { id: "rose", label: "Rose" },
  { id: "light", label: "Light" },
  { id: "mint", label: "Mint (white/teal)" },
];

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value as ThemeId)}
      className={className}
      aria-label="Theme"
    >
      {OPTIONS.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

