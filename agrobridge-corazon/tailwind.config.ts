import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        tierra: {
          DEFAULT: '#8B4513',
          light: '#D2691E',
          dark: '#654321',
        },
        aguacate: {
          DEFAULT: '#568203',
          light: '#86B817',
          dark: '#3D5A00',
        },
        fresa: {
          DEFAULT: '#C1272D',
          light: '#E63946',
          dark: '#8B1A1D',
        },
        cielo: {
          DEFAULT: '#87CEEB',
          light: '#B0E0E6',
          dark: '#4682B4',
        },
        tech: {
          blue: '#436AB3',
          green: '#4ECDC4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'sans-serif'],
      },
      borderRadius: {
        '3xl': '2rem',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'warm': '0 10px 40px -10px rgba(139, 69, 19, 0.15)',
      },
    },
  },
  plugins: [],
}
export default config