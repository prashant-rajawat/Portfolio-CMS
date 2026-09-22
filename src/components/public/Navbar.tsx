import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Menu, X, Terminal, Shield, ArrowUpRight } from 'lucide-react';

interface NavbarProps {
  portfolioTitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ portfolioTitle = 'Portfolio' }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
    { name: 'Projects', path: '/projects' },
    { name: 'Skills', path: '/skills' },
    { name: 'Experience', path: '/experience' },
    { name: 'Blog', path: '/blog' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <header
      id="main-public-navbar"
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 shadow-lg shadow-black/20'
          : 'bg-slate-950/60 backdrop-blur-sm border-b border-slate-900'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          to="/"
          className="flex items-center gap-2.5 text-slate-100 font-bold text-base sm:text-lg tracking-tight hover:text-cyan-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-lg p-1"
          aria-label="Portfolio Home"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-950/50">
            <Terminal className="w-4 h-4" />
          </div>
          <span className="font-mono">{portfolioTitle}</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2" aria-label="Main Navigation">
          {navLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.path === '/'}
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-slate-800 text-cyan-400 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`
              }
            >
              {link.name}
            </NavLink>
          ))}

          {/* Admin Link shortcut */}
          <Link
            to="/admin/login"
            className="ml-3 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-slate-800 transition-colors flex items-center gap-1.5"
            title="Admin CMS Portal"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin</span>
          </Link>
        </nav>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <Link
            to="/admin/login"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 border border-slate-800"
            aria-label="Admin Portal"
          >
            <Shield className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 border border-slate-800"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-panel"
          className="md:hidden border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl px-4 pt-2 pb-6 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {navLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.path === '/'}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `block px-4 py-2.5 rounded-lg text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-cyan-400 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`
              }
            >
              {link.name}
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
};
