import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/images/worklenz-light-mode.png';
import './LandingPage.css';

// ─── Inline SVG Dashboard Illustration (Dark Theme Premium) ───────────────
const DashboardIllustration: React.FC = () => (
  <svg viewBox="0 0 560 380" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
    <rect width="560" height="380" rx="20" fill="#0d1117" />
    <rect x="0" y="0" width="52" height="380" rx="20" fill="#161b22" />
    <circle cx="26" cy="32" r="10" fill="#1890ff" opacity="0.9" />
    <rect x="16" y="60" width="20" height="3" rx="1.5" fill="#30363d" />
    <rect x="16" y="80" width="20" height="3" rx="1.5" fill="#30363d" />
    <rect x="16" y="100" width="20" height="3" rx="1.5" fill="#1890ff" opacity="0.5" />
    <rect x="52" y="0" width="508" height="44" fill="#161b22" />
    <rect x="68" y="14" width="120" height="16" rx="4" fill="#21262d" />
    <circle cx="520" cy="22" r="12" fill="#238636" />
    <rect x="68" y="58" width="148" height="22" rx="4" fill="#21262d" />
    <text x="82" y="73" fill="#8b949e" fontSize="10" fontWeight="600" fontFamily="Inter, sans-serif">TO DO</text>
    <rect x="68" y="88" width="148" height="72" rx="8" fill="#161b22" stroke="#30363d" strokeWidth="1" />
    <rect x="228" y="58" width="148" height="22" rx="4" fill="#21262d" />
    <text x="242" y="73" fill="#1890ff" fontSize="10" fontWeight="600" fontFamily="Inter, sans-serif">IN PROGRESS</text>
    <rect x="228" y="88" width="148" height="86" rx="8" fill="#161b22" stroke="#1890ff" strokeWidth="1" />
    <rect x="388" y="58" width="148" height="22" rx="4" fill="#21262d" />
    <text x="402" y="73" fill="#3fb950" fontSize="10" fontWeight="600" fontFamily="Inter, sans-serif">DONE</text>
    <rect x="388" y="88" width="148" height="64" rx="8" fill="#161b22" stroke="#30363d" strokeWidth="1" />
  </svg>
);

const features = [
  {
    icon: '📋',
    title: 'Smart Tasking',
    desc: 'Plan and prioritize with interactive boards, deadlines, and smart priority tags.',
  },
  {
    icon: '👥',
    title: 'Team Sync',
    desc: 'Seamless collaboration with real-time updates, comments, and file sharing.',
  },
  {
    icon: '📊',
    title: 'Visual Insights',
    desc: 'Automated reports and performance tracking to keep your projects on course.',
  },
  {
    icon: '📅',
    title: 'Timeline View',
    desc: 'Interactive Gantt charts to visualize your project schedule and dependencies.',
  },
  {
    icon: '🔔',
    title: 'Live Alerts',
    desc: 'Real-time notifications across web and mobile to never miss a beat.',
  },
  {
    icon: '🔒',
    title: 'Data Security',
    desc: 'Enterprise-grade encryption and access controls to keep your data safe.',
  },
];

const stats = [
  { value: '10K+', label: 'Active Users' },
  { value: '50K+', label: 'Tasks Done' },
  { value: '99.9%', label: 'Uptime' },
  { value: '4.9★', label: 'Rating' },
];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const goToSignup = () => navigate('/auth/signup');
  const goToLogin = () => navigate('/auth/login');

  return (
    <div className="landing-page">
      <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="landing-nav-inner">
          <a href="/" className="landing-logo">
            <img src={logo} alt="Worklenz" />
          </a>
          <div className="landing-nav-links">
            <button className="landing-nav-link" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>Features</button>
            <button className="landing-nav-link" onClick={() => document.getElementById('stats')?.scrollIntoView({ behavior: 'smooth' })}>About</button>
            <button className="landing-btn landing-btn-ghost" onClick={goToLogin}>Login</button>
            <button className="landing-btn landing-btn-primary" onClick={goToSignup}>Get Started</button>
          </div>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-content landing-animate-in">
            <div className="landing-badge">
              <span className="landing-badge-dot" />
              The future of work is here
            </div>
            <h1 className="landing-animate-in-delay-1">
              Manage Your Work <span>Smarter</span>
            </h1>
            <p className="landing-hero-subtitle landing-animate-in-delay-2">
              The all-in-one platform to organize tasks, teams, and projects. Beautifully designed for clarity and lightning-fast execution.
            </p>
            <div className="landing-hero-actions landing-animate-in-delay-3">
              <button className="landing-btn landing-btn-primary landing-btn-large" onClick={goToSignup}>
                Get Started — It's Free
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
              <button className="landing-btn landing-btn-secondary landing-btn-large" onClick={goToLogin}>
                Login
              </button>
            </div>
          </div>
          <div className="landing-hero-visual landing-animate-in landing-animate-in-delay-2">
            <div className="landing-dashboard-frame">
              <DashboardIllustration />
            </div>
          </div>
        </div>
      </section>

      <section className="landing-features" id="features">
        <div className="landing-section-header landing-animate-in">
          <span className="landing-section-label">Features</span>
          <h2 className="landing-section-title">Built for Performance</h2>
        </div>
        <div className="landing-features-grid">
          {features.map((f, i) => (
            <div key={i} className={`landing-feature-card landing-animate-in landing-animate-in-delay-${(i % 3) + 1}`}>
              <div className="landing-feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-stats" id="stats">
        <div className="landing-stats-inner">
          {stats.map((s, i) => (
            <div key={i} className="landing-stat landing-animate-in">
              <div className="landing-stat-value">{s.value}</div>
              <div className="landing-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-cta-inner landing-animate-in">
          <h2>Ready to transform your team?</h2>
          <p>Join thousands of professionals who have simplified their workflow with Worklenz.</p>
          <button className="landing-btn landing-btn-white landing-btn-large" onClick={goToSignup}>
            Start for free today
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-text">
            © {new Date().getFullYear()} Worklenz. Designed for the modern team.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
