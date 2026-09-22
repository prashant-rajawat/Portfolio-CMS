import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './admin/auth/AuthContext.tsx';
import { AdminRoutes } from './admin/routes/AdminRoutes.tsx';
import { PublicLayout } from './layouts/PublicLayout.tsx';
import { HomePage } from './pages/public/HomePage.tsx';
import { AboutPage } from './pages/public/AboutPage.tsx';
import { ProjectsPage } from './pages/public/ProjectsPage.tsx';
import { SkillsPage } from './pages/public/SkillsPage.tsx';
import { ExperiencePage } from './pages/public/ExperiencePage.tsx';
import { BlogPage } from './pages/public/BlogPage.tsx';
import { ContactPage } from './pages/public/ContactPage.tsx';
import { PublicApiExplorer } from './pages/PublicApiExplorer.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Portfolio Website Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/experience" element={<ExperiencePage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/contact" element={<ContactPage />} />
          </Route>

          {/* Developer API & Architecture Explorer */}
          <Route path="/api-explorer" element={<PublicApiExplorer />} />

          {/* Admin CMS Sub-Routes */}
          <Route path="/admin/*" element={<AdminRoutes />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
