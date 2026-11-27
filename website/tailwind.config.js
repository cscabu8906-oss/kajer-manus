/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#1D4ED8',
          blueDark: '#1E3A8A',
          green: '#0F5C4D',
          greenLight: '#15803D',
          orange: '#F97316',
          surface: '#F8FAFC'
        }
      },
      fontFamily: {
        bengali: ['"Noto Sans Bengali"', '"Hind Siliguri"', 'sans-serif'],
        sans: ['"Inter"', '"Noto Sans Bengali"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
