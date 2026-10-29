import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../ui/styles.css';
import { Dashboard } from './Dashboard';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Dashboard />
    </StrictMode>,
  );
}
