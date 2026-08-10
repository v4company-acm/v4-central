/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './links.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Sistema cromático — ee-s3-manual-marca.json (extraído das fotos reais do espaço)
        'preto-barbearia': '#141210',
        'dourado-latao': '#B8874A',
        'couro-conhaque': '#6B4A38',
        'cinza-concreto': '#8C877E',
        'madeira-carvalho': '#B08D5E',
        'branco-osso': '#F2EDE6',
        sucesso: '#4B7A5E',
        erro: '#A33B2E',
        alerta: '#C99A3E',
        info: '#5E7A8C',
      },
      fontFamily: {
        display: ['Bitter', 'Georgia', 'Times New Roman', 'serif'],
        body: ['"Work Sans"', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
