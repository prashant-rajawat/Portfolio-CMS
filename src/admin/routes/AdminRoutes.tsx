import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { AdminLoginPage } from '../pages/AdminLoginPage.tsx';
import { AdminDashboardPage } from '../pages/AdminDashboardPage.tsx';
import { AdminAboutPage } from '../pages/AdminAboutPage.tsx';
import { AdminSkillsPage } from '../pages/AdminSkillsPage.tsx';
import { AdminPlaceholderPage } from '../pages/AdminPlaceholderPage.tsx';
import { AdminLayout } from '../layouts/AdminLayout.tsx';
import { ProtectedRoute } from '../components/ProtectedRoute.tsx';

export const AdminRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Login Route */}
      <Route path="login" element={<AdminLoginPage />} />

      {/* Protected Admin Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="about" element={<AdminAboutPage />} />
        <Route path="skills" element={<AdminSkillsPage />} />
        <Route path="projects" element={<AdminPlaceholderPage />} />
        <Route path="blogs" element={<AdminPlaceholderPage />} />
        <Route path="experience" element={<AdminPlaceholderPage />} />
        <Route path="testimonials" element={<AdminPlaceholderPage />} />
        <Route path="services" element={<AdminPlaceholderPage />} />
        <Route path="media" element={<AdminPlaceholderPage />} />
        <Route path="messages" element={<AdminPlaceholderPage />} />
        {/* Wildcard Fallback */}
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Route>
    </Routes>
  );
};
