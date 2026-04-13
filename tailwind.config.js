import tailwindcssAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'oklch(0 0 0 / <alpha-value>)',
        surface: 'oklch(0.12 0 0 / <alpha-value>)',
        line: 'oklch(0.34 0 0 / <alpha-value>)',
        text: 'oklch(0.95 0 0 / <alpha-value>)',
        muted: 'oklch(0.72 0 0 / <alpha-value>)',
        accent: 'oklch(0.75 0.11 190 / <alpha-value>)',
        info: 'oklch(0.72 0 0 / <alpha-value>)',
        success: 'oklch(0.72 0 0 / <alpha-value>)',
        warning: 'oklch(0.72 0 0 / <alpha-value>)',
        danger: 'oklch(0.72 0 0 / <alpha-value>)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        glass: '0 12px 28px oklch(0 0 0 / 0.45)',
        lift: '0 12px 28px oklch(0 0 0 / 0.45)',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translate3d(0, 10px, 0)' },
          '100%': { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
      },
      animation: {
        rise: 'rise 440ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
