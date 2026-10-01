/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          750: '#1E2D48',
          850: '#131F35',
        },
        brand: {
          navy: '#0F172A',
          dark: '#1E293B',
          green: '#059669',
          'green-hover': '#047857',
          blue: '#168CF5',
          'blue-hover': '#1270C4',
          sky: '#E7F0FC',
          border: '#BDDDFA',
          'border-dark': '#1E293B',
          bg: '#F4F6F9',
          danger: '#FF7A7A',
          'danger-hover': '#EF4444',
          text: '#0F172A',
          'text-body': '#334155',
          'text-muted': '#55647C',
          'nav-text': '#CBD5E1',
          'nav-muted': '#94A3B8',
          'input-bg': '#E7F0FC',
          'input-text': '#111827',
          'input-placeholder': '#4B5563',
        },
        medical: {
          darkBg: 'var(--bg-app)',
          cardBg: 'var(--bg-card)',
          cardSubtle: 'var(--bg-card-subtle)',
          cardElevated: 'var(--bg-card-elevated)',
          borderBg: 'var(--border-card)',
          borderStrong: 'var(--border-card-strong)',
          textMain: 'var(--text-main)',
          textBody: 'var(--text-body)',
          textMuted: 'var(--text-muted)',
          primary: 'var(--color-primary)',
          primaryHover: 'var(--color-primary-hover)',
          primaryLight: 'var(--color-primary-light)',
          teal: 'var(--color-secondary)',
          indigo: 'var(--color-primary)',
          rose: 'var(--color-error)',
          emerald: 'var(--color-success)',
          amber: 'var(--color-warning)',
          success: 'var(--color-success)',
          warning: 'var(--color-warning)',
          error: 'var(--color-error)',
          danger: 'var(--color-danger)',
          info: 'var(--color-info)',
          disabled: 'var(--color-disabled)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'Nunito', 'Hind Siliguri', 'Noto Sans Bengali', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        'healthcare': '0 1px 3px 0 rgba(15, 23, 42, 0.05)',
        'healthcare-md': '0 4px 6px -1px rgba(15, 23, 42, 0.07)',
        'healthcare-lg': '0 10px 15px -3px rgba(15, 23, 42, 0.08)',
        'healthcare-dark': '0 4px 12px 0 rgba(0, 0, 0, 0.35)',
      }
    },
  },
  plugins: [],
}


