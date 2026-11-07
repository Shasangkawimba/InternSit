export function initTheme() {
  const saved = localStorage.getItem('theme');
  document.documentElement.classList.toggle('dark', saved !== 'light');
}

export function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}
