import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { applySize } from './textsize.js';

applySize();

createRoot(document.getElementById('root')).render(<App />);
