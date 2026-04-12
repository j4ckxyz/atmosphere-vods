import tailwindcssAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'oklch(0.13 0.03 247 / <alpha-value>)',
        surface: 'oklch(0.22 0.03 247 / <alpha-value>)',
        line: 'oklch(0.65 0.03 244 / <alpha-value>)',
        text: 'oklch(0.93 0.02 250 / <alpha-value>)',
        muted: 'oklch(0.8 0.02 248 / <alpha-value>)',
        accent: 'oklch(0.78 0.12 205 / <alpha-value>)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        glass: '0 24px 70px oklch(0.03 0.02 250 / 0.5)',
        lift: '0 30px 60px oklch(0.03 0.02 250 / 0.45)',
      },
      keyframes: {
        aurora: {
          '0%': { transform: 'translate3d(-8%, -6%, 0) scale(1)' },
          '50%': { transform: 'translate3d(10%, 8%, 0) scale(1.08)' },
          '100%': { transform: 'translate3d(-8%, -6%, 0) scale(1)' },
        },
        noise: {
          '0%': { transform: 'translate(0, 0)' },
          '25%': { transform: 'translate(-4%, 3%)' },
          '50%': { transform: 'translate(2%, -3%)' },
          '75%': { transform: 'translate(3%, 2%)' },
          '100%': { transform: 'translate(0, 0)' },
        },
        rise: {
          '0%': { opacity: '0', transform: 'translate3d(0, 10px, 0)' },
          '100%': { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
      },
      animation: {
        aurora: 'aurora 34s ease-in-out infinite',
        noise: 'noise 800ms steps(6) infinite',
        rise: 'rise 440ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
