// tailwind.config.js
export const content = [
  "./src/**/*.{js,jsx,ts,tsx}", // adjust based on your file structure
];
export const theme = {
  extend: {
    fontFamily: {
      serif: ['"Times New Roman"', 'serif'],
      mono: ['"Courier New"', 'monospace'],
      comic: ['"Comic Sans MS"', 'cursive'],
    }
  },
};
export const plugins = [
  require('tailwind-scrollbar'), // <-- Add this line
];