import React from 'react';
import { Link } from 'react-router-dom';
import { Terminal, Shield, ArrowUp } from 'lucide-react';

interface FooterProps {
  portfolioTitle?: string;
  shortBio?: string;
}

export const Footer: React.FC<FooterProps> = ({
  portfolioTitle = 'Portfolio',
  shortBio = 'Architectural engineering, full-stack systems, and robust software solutions.',
}) => {
  const currentYear = new Date().getFullYear();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer
      id="main-public-footer"
      className="border-t border-slate-800/80 bg-slate-950 text-slate-400 font-sans"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-slate-100 font-bold text-lg hover:text-cyan-400 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white">
                <Terminal className="w-3.5 h-3.5" />
              </div>
              <span className="font-mono">{portfolioTitle}</span>
            </Link>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              {shortBio}
            </p>
          </div>

          {/* Quick Navigation */}
          <div>
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200 mb-4">
              Navigation
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="hover:text-cyan-400 transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-cyan-400 transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link to="/projects" className="hover:text-cyan-400 transition-colors">
                  Projects
                </Link>
              </li>
              <li>
                <Link to="/skills" className="hover:text-cyan-400 transition-colors">
                  Skills
                </Link>
              </li>
              <li>
                <Link to="/experience" className="hover:text-cyan-400 transition-colors">
                  Experience
                </Link>
              </li>
              <li>
                <Link to="/blog" className="hover:text-cyan-400 transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-cyan-400 transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Admin & System */}
          <div>
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200 mb-4">
              Management
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/admin/login"
                  className="inline-flex items-center gap-1.5 hover:text-cyan-400 transition-colors"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin CMS Login</span>
                </Link>
              </li>
              <li>
                <a
                  href="/api/health"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors"
                >
                  System API Health
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
          <p>© {currentYear} {portfolioTitle}. All rights reserved.</p>
          <button
            type="button"
            onClick={scrollToTop}
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-cyan-400 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500 rounded px-2 py-1"
          >
            <span>Back to top</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};
