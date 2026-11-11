import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

// The design system ships as a classic script that reads window.React and defines window.Dash,
// so it has to be loaded before any module that touches the components.
(window as any).React = React;
(window as any).ReactDOM = ReactDOM;

await new Promise<void>((resolve, reject) => {
  const s = document.createElement('script');
  s.src = '/ds/bundle.js';
  s.onload = () => resolve();
  s.onerror = () => reject(new Error('failed to load /ds/bundle.js'));
  document.head.appendChild(s);
});

const { App } = await import('./App.tsx');
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
