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
          textBody: 'var(--text-body)',
          textMuted: 'var(--text-muted)',
          teal: 'var(--color-secondary)',
          indigo: 'var(--color-primary)',
          rose: 'var(--color-error)',
          emerald: 'var(--color-success)',
          amber: 'var(--color-warning)',
          gradientLeft: 'var(--gradient-left)',
          gradientRight: 'var(--gradient-right)',
          lavender: 'var(--accent-lavender)',
          decorLavender: 'var(--decor-lavender)',
          secondaryBlue: 'var(--color-secondary-blue)',
          decorBlue: 'var(--decor-blue)'
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
