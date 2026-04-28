/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'float':       'float 6s ease-in-out infinite',
        'float-delay': 'float 9s ease-in-out 2.5s infinite',
        'float-slow':  'float 12s ease-in-out 5s infinite',
        'slide-up':    'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) forwards',
        'fade-in':     'fade-in 0.4s ease forwards',
        'shimmer':     'shimmer 1.6s infinite linear',
        'score-in':    'score-in 0.9s cubic-bezier(0.16,1,0.3,1) forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-22px)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(22px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400% center' },
          '100%': { backgroundPosition: '400% center' },
        },
        'score-in': {
          from: { opacity: '0', transform: 'scale(0.7)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
