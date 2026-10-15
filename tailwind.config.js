/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./public/**/*.{html,js}",
    "./views/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        yt: {
          bg: '#0f0f0f',
          surface: '#181818',
          card: '#212121',
          hover: '#2a2a2a',
          border: '#2f2f2f',
          text: '#f1f1f1',
          muted: '#aaaaaa',
          dim: '#717171',
          red: '#cc0000'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif']
      }
    },
  },
  plugins: [],
}
