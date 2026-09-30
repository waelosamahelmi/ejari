/** Applies theme + accent to <html> immediately (no reload). */
export function applyTheme(theme: "light" | "dark" | "system", accent?: string) {
  const root = document.documentElement;
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.dataset.theme = theme;
  if (accent) root.dataset.accent = accent;
  document.cookie = `ijari-theme=${theme};path=/;max-age=31536000;samesite=lax`;
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) meta.setAttribute("content", dark ? "#0B0B0D" : "#ECEEF2");
}

/** Inline script (before paint) that resolves "system" theme and prevents a flash. */
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )ijari-theme=([^;]+)/);var t=m?m[1]:'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');else r.classList.remove('dark');r.dataset.theme=t;if(t==='system'){matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(e){if(r.dataset.theme==='system')r.classList.toggle('dark',e.matches)})}}catch(e){}})();`;
