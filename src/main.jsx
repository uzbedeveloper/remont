import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { applyEasy } from './components/EasyToggle.jsx';

applyEasy();

createRoot(document.getElementById('root')).render(<App />);
