import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './admin/auth/AuthContext.tsx';
import { AdminRoutes } from './admin/routes/AdminRoutes.tsx';
import { PublicApiExplorer } from './pages/PublicApiExplorer.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Developer View & System Overview */}
          <Route path="/" element={<PublicApiExplorer />} />

          {/* Admin CMS Sub-Routes */}
          <Route path="/admin/*" element={<AdminRoutes />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
