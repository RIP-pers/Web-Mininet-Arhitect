import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Importăm paginile noastre
import LandingPage from './LandingPage.jsx';
import App from './App.jsx';

import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Când vizitezi site-ul prima dată (ruta "/"), arată LandingPage */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Când dai click pe buton (ruta "/app"), arată App (Spațiul de lucru) */}
        <Route path="/app" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);