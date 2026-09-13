import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

/**
 * Initialises and renders the root React application tree.
 */
{
  let root_element = document.getElementById('root');
  if (root_element) {
    let root = createRoot(root_element);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }
}
