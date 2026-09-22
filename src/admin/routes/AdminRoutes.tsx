import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { AdminLoginPage } from '../pages/AdminLoginPage.tsx';
import { AdminDashboardPage } from '../pages/AdminDashboardPage.tsx';
import { AdminAboutPage } from '../pages/AdminAboutPage.tsx';
import { AdminSkillsPage } from '../pages/AdminSkillsPage.tsx';
import { AdminProjectsPage } from '../pages/AdminProjectsPage.tsx';
import { AdminBlogsPage } from '../pages/AdminBlogsPage.tsx';
import { AdminExperiencePage } from '../pages/AdminExperiencePage.tsx';
import { AdminTestimonialsPage } from '../pages/AdminTestimonialsPage.tsx';
import { AdminServicesPage } from '../pages/AdminServicesPage.tsx';
import { AdminMediaPage } from '../pages/AdminMediaPage.tsx';
import { AdminMessagesPage } from '../pages/AdminMessagesPage.tsx';
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
        <Route path="projects" element={<AdminProjectsPage />} />
        <Route path="blogs" element={<AdminBlogsPage />} />
        <Route path="experience" element={<AdminExperiencePage />} />
        <Route path="testimonials" element={<AdminTestimonialsPage />} />
        <Route path="services" element={<AdminServicesPage />} />
        <Route path="media" element={<AdminMediaPage />} />
        <Route path="messages" element={<AdminMessagesPage />} />
        {/* Wildcard Fallback */}
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Route>
    </Routes>
  );
};
