import React, { useState, useEffect } from 'react';

interface FullTextDrawerProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  statusBadge?: string;
  rawText: string;
  sections?: Array<{
    section_id: string;
    heading: string;
    paragraphs?: Array<{ para_id: string; text: string }>;
  }>;
  onClose: () => void;
}

export const FullTextDrawer: React.FC<FullTextDrawerProps> = ({
  isOpen,
  title,
  subtitle,
  statusBadge,
  rawText,
  sections,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToSection = (secId: string) => {
    const el = document.getElementById(`fulltext-sec-${secId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', justifyContent: 'flex-end' }}>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(3px)',
        }}
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div
        className="card"
        style={{
          position: 'relative',
          width: '680px',
          maxWidth: '90vw',
          height: '100vh',
          borderRadius: 0,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 28px rgba(0, 0, 0, 0.6)',
          borderLeft: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            background: 'rgba(15, 23, 42, 0.95)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#f3f4f6' }}>
                {title}
              </h2>
              {statusBadge && (
                <span className={`badge ${statusBadge.includes('FINAL') ? 'badge-final' : 'badge-proposed'}`}>
                  {statusBadge}
                </span>
              )}
            </div>
            {subtitle && (
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                {subtitle}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleCopy}
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
            >
              {copied ? '✓ Copied' : 'Copy Text'}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              style={{ fontSize: '1.2rem', padding: '2px 8px', lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Search & Coordinate Jump Bar */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <input
            className="input"
            style={{ width: '100%', fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
            placeholder="Search within document text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {sections && sections.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflowX: 'auto', paddingBottom: '2px' }}>
              <span style={{ fontSize: '0.7rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>JUMP TO:</span>
              {sections.map((sec) => (
                <button
                  key={sec.section_id}
                  className="btn btn-ghost btn-sm"
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 7px',
                    whiteSpace: 'nowrap',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '4px',
                  }}
                  onClick={() => scrollToSection(sec.section_id)}
                >
                  {sec.heading.length > 25 ? sec.heading.substring(0, 25) + '...' : sec.heading}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Body - Full Text Content */}
        <div
          style={{
            flex: 1,
            padding: '1.5rem',
            overflowY: 'auto',
            fontSize: '0.88rem',
            lineHeight: 1.65,
            color: '#e5e7eb',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {sections && sections.length > 0 ? (
            sections.map((sec) => {
              return (
                <div
                  key={sec.section_id}
                  id={`fulltext-sec-${sec.section_id}`}
                  style={{
                    marginBottom: '1.75rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '0.5rem',
                      marginBottom: '0.65rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontFamily: 'var(--font-mono)',
                        color: '#a5b4fc',
                        background: 'rgba(99, 102, 241, 0.15)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {sec.section_id}
                    </span>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#f3f4f6' }}>
                      {sec.heading}
                    </h3>
                  </div>

                  {sec.paragraphs && sec.paragraphs.length > 0 ? (
                    sec.paragraphs.map((p) => {
                      const isMatch = searchQuery && p.text.toLowerCase().includes(searchQuery.toLowerCase());
                      return (
                        <div
                          key={p.para_id}
                          style={{
                            marginBottom: '0.75rem',
                            padding: isMatch ? '0.4rem 0.6rem' : undefined,
                            background: isMatch ? 'rgba(234, 179, 8, 0.2)' : undefined,
                            borderRadius: isMatch ? '4px' : undefined,
                            borderLeft: isMatch ? '3px solid #eab308' : undefined,
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontFamily: 'var(--font-mono)',
                              color: '#6b7280',
                              marginRight: '0.5rem',
                              userSelect: 'none',
                            }}
                          >
                            [{p.para_id}]
                          </span>
                          {p.text}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ color: '#9ca3af' }}>No paragraphs in section.</div>
                  )}
                </div>
              );
            })
          ) : (
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'inherit',
                margin: 0,
              }}
            >
              {rawText}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
