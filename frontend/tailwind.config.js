/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        dark: {
          bg: '#0b0f19',
          card: 'rgba(15, 23, 42, 0.75)',
          border: 'rgba(255, 255, 255, 0.1)'
        },
        // Terminal / telemetry accent palette - distinct from the generic
        // indigo-purple SaaS gradient, in keeping with an ops/SRE tool.
        signal: {
          bg: '#080b10',
          panel: '#0d1219',
          line: '#1a212c',
          green: '#2bd97c',
          cyan: '#38d0e0',
          amber: '#f5a623',
          red: '#ff5470',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'blip': 'blip 1.6s ease-in-out infinite',
        'scan': 'scan 3.2s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)' },
          '100%': { boxShadow: '0 0 25px rgba(168, 85, 247, 0.7)' }
        },
        blip: {
          '0%, 100%': { opacity: 0.4, transform: 'scale(1)' },
          '50%': { opacity: 1, transform: 'scale(1.15)' }
        },
        scan: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        }
      }
    },
  },
  plugins: [],
}
