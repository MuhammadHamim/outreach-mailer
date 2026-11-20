import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ToastProvider } from './ui.jsx';
import './styles.css';
import './resume/core/fontFaces';
import { applyTheme } from './theme.jsx';

applyTheme();

createRoot(document.getElementById('root')).render(
  <BrowserRouter><ToastProvider><App /></ToastProvider></BrowserRouter>
);
