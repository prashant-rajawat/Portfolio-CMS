import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AdminSidebar } from '../components/AdminSidebar.tsx';
import { AdminHeader } from '../components/AdminHeader.tsx';

// Mapping pathname to friendly title
const routeTitles: Record<string, string> = {
  '/admin': 'Dashboard Overview',
  '/admin/dashboard': 'Dashboard Overview',
  '/admin/about': 'About & Biography',
  '/admin/skills': 'Technical Skills',
  '/admin/projects': 'Portfolio Projects',
  '/admin/blogs': 'Blog Management',
  '/admin/experience': 'Career & Experience',
  '/admin/testimonials': 'Client Testimonials',
  '/admin/services': 'Service Offerings',
  '/admin/media': 'Media & Upload Library',
  '/admin/messages': 'Contact Messages',
};

export const AdminLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const currentTitle = routeTitles[location.pathname] || 'Admin Console';

  return (
    <div id="admin-layout-root" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      {/* Sidebar Component */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col flex-1 min-h-screen">
        <AdminHeader
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          title={currentTitle}
        />

        <main id="admin-content-viewport" className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
