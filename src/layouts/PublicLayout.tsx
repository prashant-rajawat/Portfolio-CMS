import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/public/Navbar.tsx';
import { Footer } from '../components/public/Footer.tsx';
import { publicApi } from '../lib/publicApi.ts';
import { AboutRecord } from '../types.ts';

export const PublicLayout: React.FC = () => {
  const [aboutData, setAboutData] = useState<AboutRecord | null>(null);

  useEffect(() => {
    let isMounted = true;
    publicApi.getAbout().then((data) => {
      if (isMounted && data) {
        setAboutData(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const portfolioName = aboutData?.title || 'Portfolio';
  const shortBio = aboutData?.short_description || undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased flex flex-col selection:bg-cyan-500/20 selection:text-cyan-300">
      <Navbar portfolioTitle={portfolioName} />
      <main className="flex-1 w-full flex flex-col">
        <Outlet context={{ aboutData }} />
      </main>
      <Footer portfolioTitle={portfolioName} shortBio={shortBio} />
    </div>
  );
};
