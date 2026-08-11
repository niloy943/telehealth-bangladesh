/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        medical: {
          darkBg: 'var(--bg-app)',
          cardBg: 'var(--bg-card)',
          borderBg: 'var(--border-card)',
          textMain: 'var(--text-main)',
          textMuted: 'var(--text-muted)',
          teal: 'var(--color-secondary)',
          indigo: 'var(--color-primary)',
          rose: 'var(--color-error)',
          emerald: 'var(--color-success)',
          amber: 'var(--color-warning)'
        }
      },
      fontFamily: {
        sans: ['Times New Roman', 'Times', 'serif'],
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
