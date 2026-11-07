import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'Figtree', ...defaultTheme.fontFamily.sans],
        display: ['Inter', 'Figtree', ...defaultTheme.fontFamily.sans],
        mono:    ['JetBrains Mono', 'ui-monospace', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        background: 'var(--color-background)',
        surface: {
          DEFAULT:   'var(--color-surface)',
          lowest:    'var(--color-surface-lowest)',
          low:       'var(--color-surface-low)',
          container: 'var(--color-surface-container)',
          high:      'var(--color-surface-high)',
        },
        'on-surface': {
          DEFAULT: 'var(--color-on-surface)',
          variant: 'var(--color-on-surface-variant)',
        },
        'on-primary': 'var(--color-on-primary)',
        outline: {
          DEFAULT: 'var(--color-outline)',
          variant: 'rgb(var(--color-outline-variant) / <alpha-value>)',
        },
        primary: {
          DEFAULT:   'var(--color-primary)',
          container: 'var(--color-primary-container)',
          fixed:     'var(--color-primary-fixed)',
        },
        border:  'var(--color-border)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger:  'var(--color-danger)',
        'input-bg':    'var(--color-input-bg)',
        'input-border':'var(--color-input-border)',
        'input-focus': 'var(--color-input-focus-border)',
      },
    },
  },
  plugins: [],
};

export default config;
