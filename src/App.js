import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, X, ChevronLeft, ChevronDown, ChevronRight,
  User, Calendar, CheckCircle, Circle, AlertTriangle,
  Trash2, BookOpen, MessageSquare, Anchor, Folder, FileText,
  Clock, Database, Moon, Sun, Search, Users, Copy, Zap,
  ArrowRight, Check, Image,
} from 'lucide-react';
import './index.css';

// ── Constants ──────────────────────────────────────────────────────────────────

const STALE_DAYS = 90;

const CONFIDENCE_LEVELS = [
  { score: 0, label: 'Not set',  color: '#78716C', bg: '#F5F0E8', border: '#D6D0C6' },
  { score: 1, label: 'Unstable', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  { score: 2, label: 'Low',      color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  { score: 3, label: 'Medium',   color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  { score: 4, label: 'High',     color: '#0369A1', bg: '#EFF6FF', border: '#BFDBFE' },
  { score: 5, label: 'Solid',    color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
];

const REVIEW_CADENCES = [
  { value: null, label: 'No cadence' },
  { value: 30,   label: 'Monthly' },
  { value: 90,   label: 'Quarterly' },
  { value: 180,  label: 'Every 6 months' },
  { value: 365,  label: 'Yearly' },
];

const generateId = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;


// ── Utilities ──────────────────────────────────────────────────────────────────

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return 'Never';
  const days = daysSince(dateStr);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 60) return '1 month ago';
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)}+ year ago`;
}

function isStale(page) {
  const cadence = page.reviewCadenceDays || STALE_DAYS;
  return daysSince(page.lastReviewedDate) >= cadence;
}

function isDueSoon(page) {
  if (isStale(page)) return false; // already past due
  const cadence = page.reviewCadenceDays || STALE_DAYS;
  const remaining = cadence - daysSince(page.lastReviewedDate);
  return remaining <= 14;
}


function openQuestionCount(page) {
  return (page.openQuestions || []).filter(q => !q.resolved).length;
}

function getHealthFlags(page) {
  return {
    unowned: !page.owner,
    stale: isStale(page),
    lowConf: page.confidenceScore > 0 && page.confidenceScore <= 2,
    hasQuestions: openQuestionCount(page) > 0,
    dueSoon: isDueSoon(page),
  };
}

function needsAttention(page) {
  const f = getHealthFlags(page);
  return f.unowned || f.stale || f.lowConf || f.hasQuestions;
}

// Returns 'questions' | 'review' | 'complete'
// 'questions' — has unresolved open questions (actively blocking)
// 'review'    — governance gap (unowned, stale, or low confidence) but no open questions
// 'complete'  — no health issues
function getPageTier(page) {
  const f = getHealthFlags(page);
  if (f.hasQuestions) return 'questions';
  if (f.unowned || f.stale || f.lowConf) return 'review';
  return 'complete';
}

function getSectionHealth(pages) {
  let unowned = 0, stale = 0, lowConf = 0, openQs = 0, attention = 0;
  for (const p of pages) {
    const f = getHealthFlags(p);
    if (f.unowned) unowned++;
    if (f.stale) stale++;
    if (f.lowConf) lowConf++;
    openQs += openQuestionCount(p);
    if (needsAttention(p)) attention++;
  }
  return { total: pages.length, unowned, stale, lowConf, openQs, attention };
}

// ── Small shared components ────────────────────────────────────────────────────

function HealthDot({ page }) {
  const f = getHealthFlags(page);
  if (f.unowned || f.stale) return <span className="health-dot red" title="Needs attention" />;
  if (f.lowConf || f.hasQuestions) return <span className="health-dot amber" title="Review recommended" />;
  if (f.dueSoon) return <span className="health-dot yellow" title="Review coming up" />;
  return null;
}


function HealthPills({ page }) {
  const f = getHealthFlags(page);
  const pills = [];
  if (f.unowned)      pills.push({ label: 'No owner',       cls: 'hp-red' });
  if (f.stale)        pills.push({ label: 'Past due',        cls: 'hp-orange' });
  if (f.lowConf)      pills.push({ label: 'Low confidence',  cls: 'hp-amber' });
  if (f.hasQuestions) pills.push({ label: `${openQuestionCount(page)} question${openQuestionCount(page) !== 1 ? 's' : ''}`, cls: 'hp-violet' });
  if (f.dueSoon)      pills.push({ label: 'Due soon',        cls: 'hp-amber' });

  if (pills.length === 0) {
    return <span className="hp-current">Current</span>;
  }
  return (
    <span style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>
      {pills.map(p => (
        <span key={p.label} className={`hp-pill ${p.cls}`}>{p.label}</span>
      ))}
    </span>
  );
}

// ── LoadingScreen ──────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>Loading...</span>
    </div>
  );
}

// ── WelcomeScreen ──────────────────────────────────────────────────────────────

function WelcomeScreen({ onSelectFolder, onCreateFolder }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-icon">
          <Anchor size={28} color="white" />
        </div>
        <h1 className="welcome-title">Anchor</h1>
        <p className="welcome-subtitle">
          Track who owns each part of your content model, when it was last reviewed, and what still needs work.
        </p>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={onCreateFolder} style={{ width: '190px', justifyContent: 'center' }}>
            <Plus size={14} />
            New library
          </button>
          <button className="btn-secondary" onClick={onSelectFolder} style={{ width: '190px', justifyContent: 'center' }}>
            Open library
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

function Sidebar({
  workspaces, selection, onSelect,
  expandedWorkspaces, onToggleWorkspace,
  expandedSections, onToggleSection,
  onAddPage, onCreateSection, onCreateWorkspace,
  darkMode, onToggleDark, onOpenSearch, onSwitchLibrary,
}) {
  const [creatingInWorkspace, setCreatingInWorkspace] = useState(null);
  const [newSectionName, setNewSectionName] = useState('');
  const newSectionRef = useRef(null);

  useEffect(() => {
    if (creatingInWorkspace) newSectionRef.current?.focus();
  }, [creatingInWorkspace]);

  function handleCreateSection(workspaceId) {
    if (!newSectionName.trim()) { setCreatingInWorkspace(null); return; }
    onCreateSection(workspaceId, newSectionName.trim());
    setNewSectionName('');
    setCreatingInWorkspace(null);
  }

  const totalPages = workspaces.reduce((a, w) => a + w.pages.length, 0);

  return (
    <aside className="sidebar">
      {/* Spacer for macOS traffic light buttons */}
      <div className="sidebar-traffic-lights" />

      {/* Brand */}
      <div className="sidebar-brand">
        <Anchor size={14} color="#4338CA" />
        <span className="sidebar-brand-name">Anchor</span>
      </div>

      <div className="sidebar-divider" />

      {/* Home + Owners + Search */}
      <div className="sidebar-nav" style={{ paddingTop: 4 }}>
        <button
          className={`sidebar-item${selection.type === 'home' ? ' active' : ''}`}
          onClick={() => onSelect({ type: 'home' })}
        >
          <span style={{ flex: 1 }}>All workspaces</span>
          <span className="sidebar-count">{totalPages}</span>
        </button>
        <button
          className={`sidebar-item${selection.type === 'owners' ? ' active' : ''}`}
          onClick={() => onSelect({ type: 'owners' })}
        >
          <Users size={12} style={{ flexShrink: 0, opacity: 0.65 }} />
          <span style={{ flex: 1 }}>Owners</span>
        </button>
        <button className="sidebar-item" onClick={onOpenSearch}>
          <Search size={12} style={{ flexShrink: 0, opacity: 0.65 }} />
          <span style={{ flex: 1 }}>Search</span>
          <span className="sidebar-shortcut">⌘K</span>
        </button>
      </div>

      <div className="sidebar-divider" style={{ marginTop: 6 }} />
      <div className="sidebar-section-label">Workspaces</div>

      {/* Workspace tree */}
      <div className="sidebar-nav sidebar-tree">
        {workspaces.map(workspace => {
          const isWsExpanded = expandedWorkspaces.has(workspace.id);
          const isWsSelected = selection.type === 'workspace' && selection.workspaceId === workspace.id;

          return (
            <div key={workspace.id} className="tree-workspace">
              {/* Workspace row */}
              <div
                className={`tree-workspace-header${isWsSelected ? ' selected' : ''}`}
                onClick={() => {
                  onToggleWorkspace(workspace.id);
                  onSelect({ type: 'workspace', workspaceId: workspace.id });
                }}
              >
                <span className="tree-chevron">
                  {isWsExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                </span>
                <Database size={12} style={{ flexShrink: 0, opacity: 0.65 }} />
                <span className="tree-workspace-name">{workspace.name}</span>
                <span className="sidebar-count">{workspace.pages.length}</span>
              </div>

              {isWsExpanded && (
                <div className="tree-workspace-body">
                  {workspace.sections.map(section => {
                    const sectionPages = workspace.pages.filter(p => p.sectionId === section.id);
                    const isSectionExpanded = expandedSections.has(section.id);
                    const isSectionSelected = selection.type === 'section' && selection.sectionId === section.id;

                    return (
                      <div key={section.id} className="tree-section">
                        <div
                          className={`tree-section-header${isSectionSelected ? ' selected' : ''}`}
                          onClick={() => {
                            onToggleSection(section.id);
                            onSelect({ type: 'section', workspaceId: workspace.id, sectionId: section.id });
                          }}
                        >
                          <span className="tree-chevron">
                            {isSectionExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          </span>
                          <Folder size={12} style={{ flexShrink: 0, opacity: 0.7 }} />
                          <span className="tree-section-name">{section.name}</span>
                          <span className="sidebar-count">{sectionPages.length}</span>
                        </div>

                        {isSectionExpanded && (
                          <div className="tree-pages">
                            {sectionPages.map(page => (
                              <button
                                key={page.id}
                                className={`tree-page${selection.type === 'page' && selection.pageId === page.id ? ' selected' : ''}`}
                                onClick={() => onSelect({ type: 'page', workspaceId: workspace.id, sectionId: section.id, pageId: page.id })}
                              >
                                <FileText size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
                                <span className="tree-page-name">{page.name}</span>
                                <HealthDot page={page} />
                              </button>
                            ))}
                            {sectionPages.length === 0 && (
                              <span className="tree-empty-section">No pages yet</span>
                            )}
                            <button
                              className="tree-add-page"
                              onClick={e => { e.stopPropagation(); onAddPage(workspace.id, section.id); }}
                            >
                              <Plus size={10} />
                              Add page
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Ungrouped pages */}
                  {(() => {
                    const ungrouped = workspace.pages.filter(
                      p => !p.sectionId || !workspace.sections.find(s => s.id === p.sectionId)
                    );
                    if (ungrouped.length === 0) return null;
                    const isExpanded = expandedSections.has(`${workspace.id}__ungrouped__`);
                    return (
                      <div className="tree-section">
                        <div
                          className="tree-section-header"
                          onClick={() => onToggleSection(`${workspace.id}__ungrouped__`)}
                        >
                          <span className="tree-chevron">
                            {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          </span>
                          <Folder size={12} style={{ flexShrink: 0, opacity: 0.4 }} />
                          <span className="tree-section-name" style={{ color: 'var(--text-3)' }}>Ungrouped</span>
                          <span className="sidebar-count">{ungrouped.length}</span>
                        </div>
                        {isExpanded && (
                          <div className="tree-pages">
                            {ungrouped.map(page => (
                              <button
                                key={page.id}
                                className={`tree-page${selection.type === 'page' && selection.pageId === page.id ? ' selected' : ''}`}
                                onClick={() => onSelect({ type: 'page', workspaceId: workspace.id, sectionId: null, pageId: page.id })}
                              >
                                <FileText size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
                                <span className="tree-page-name">{page.name}</span>
                                <HealthDot page={page} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Inline new section */}
                  {creatingInWorkspace === workspace.id ? (
                    <div style={{ padding: '4px 6px 4px 14px' }}>
                      <input
                        ref={newSectionRef}
                        className="sidebar-new-section-input"
                        placeholder="Section name"
                        value={newSectionName}
                        onChange={e => setNewSectionName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleCreateSection(workspace.id);
                          if (e.key === 'Escape') { setCreatingInWorkspace(null); setNewSectionName(''); }
                        }}
                        onBlur={() => handleCreateSection(workspace.id)}
                      />
                    </div>
                  ) : (
                    <button
                      className="tree-add-section"
                      onClick={e => { e.stopPropagation(); setCreatingInWorkspace(workspace.id); }}
                    >
                      <Plus size={10} />
                      New section
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: new workspace + library switch + theme toggle */}
      <div className="sidebar-footer">
        <button className="sidebar-new-section-btn" onClick={onCreateWorkspace}>
          <Plus size={12} />
          New workspace
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="sidebar-theme-btn"
            onClick={onSwitchLibrary}
            title="Switch library"
          >
            <Folder size={14} />
          </button>
          <button
            className="sidebar-theme-btn"
            onClick={onToggleDark}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── HomeView ───────────────────────────────────────────────────────────────────

function HomeView({ workspaces, onSelectWorkspace, onCreateWorkspace, onShowDigest, onStartReview }) {
  const allPages = workspaces.flatMap(w => w.pages);
  const totalPages = allPages.length;
  const attentionCount = allPages.filter(needsAttention).length;
  const openQCount = allPages.reduce((a, p) => a + openQuestionCount(p), 0);

  return (
    <div className="main-content">
      <div className="main-header">
        <span className="main-view-title">All workspaces</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {attentionCount > 0 && (
            <button className="btn-ghost" onClick={onStartReview}>
              <Zap size={13} />
              Review mode
            </button>
          )}
          <button className="btn-ghost" onClick={onShowDigest}>
            <FileText size={13} />
            Export digest
          </button>
          <button className="btn-primary" onClick={onCreateWorkspace}>
            <Plus size={13} />
            New workspace
          </button>
        </div>
      </div>

      <div className="overview-body">
        {/* Stats */}
        <div className="dash-stats">
          <div className="dash-stat">
            <span className="dash-stat-value">{totalPages}</span>
            <span className="dash-stat-label">{totalPages === 1 ? 'page' : 'pages'}</span>
          </div>
          {attentionCount > 0 && (
            <div className="dash-stat">
              <span className="dash-stat-value dash-stat-value--warn">{attentionCount}</span>
              <span className="dash-stat-label">need attention</span>
            </div>
          )}
          {openQCount > 0 && (
            <div className="dash-stat">
              <span className="dash-stat-value dash-stat-value--question">{openQCount}</span>
              <span className="dash-stat-label">open {openQCount === 1 ? 'question' : 'questions'}</span>
            </div>
          )}
          {attentionCount === 0 && totalPages > 0 && (
            <div className="dash-stat">
              <span className="dash-stat-value dash-stat-value--ok">All current</span>
            </div>
          )}
        </div>

        {/* Workspace list */}
        <div className="overview-section-list">
          {workspaces.map(workspace => {
            const health = getSectionHealth(workspace.pages);
            const pageCount = workspace.pages.length;
            return (
              <div
                key={workspace.id}
                className="overview-section-row"
                onClick={() => onSelectWorkspace(workspace.id)}
              >
                <div className="osrow-left">
                  <Database size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                  <span className="osrow-name">{workspace.name}</span>
                  <span className="osrow-count">{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span>
                </div>
                <div className="osrow-right">
                  {health.attention > 0 ? (
                    <span className="osrow-health osrow-health--issues">{health.attention} need attention</span>
                  ) : (
                    <span className="osrow-health osrow-health--ok">All current</span>
                  )}
                  <ChevronRight size={13} style={{ color: 'var(--text-6)', flexShrink: 0 }} />
                </div>
              </div>
            );
          })}
          {workspaces.length === 0 && (
            <p style={{ color: 'var(--text-3)', fontSize: '0.875rem', padding: '12px 0' }}>
              No workspaces yet.{' '}
              <button className="btn-link" onClick={onCreateWorkspace}>Create one</button> to get started.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── WorkspaceView ──────────────────────────────────────────────────────────────

const TRIAGE_LIMIT = 5;

function WorkspaceView({ workspace, onSelectSection, onSelectPage, onAddPage, onSaveWorkspace, onDeleteWorkspace, onStartReview }) {
  const [name, setName] = useState(workspace.name);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setName(workspace.name); }, [workspace.id]);

  function handleNameBlur() {
    if (name.trim() && name.trim() !== workspace.name) {
      onSaveWorkspace({ ...workspace, name: name.trim() });
    } else {
      setName(workspace.name);
    }
  }

  const { pages, sections } = workspace;
  const health = getSectionHealth(pages);
  const attentionPages = pages.filter(needsAttention);
  const pageWord = pages.length === 1 ? 'page' : 'pages';
  const secWord = sections.length === 1 ? 'section' : 'sections';

  return (
    <div className="main-content">
      <div className="main-header">
        <input
          className="section-title-input"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          {attentionPages.length > 0 && (
            <button className="btn-ghost" onClick={() => onStartReview(attentionPages)}>
              <Zap size={13} />
              Review mode
            </button>
          )}
          <button className="btn-primary" onClick={() => onAddPage(workspace.id, null)}>
            <Plus size={13} />
            Add page
          </button>
        </div>
      </div>

      <div className="overview-body">
        {/* Layer 1: Numbers */}
        <div className="dash-stats">
          <div className="dash-stat">
            <span className="dash-stat-value">{pages.length}</span>
            <span className="dash-stat-label">{pageWord} across {sections.length} {secWord}</span>
          </div>
          {health.attention > 0 && (
            <div className="dash-stat">
              <span className="dash-stat-value dash-stat-value--warn">{health.attention}</span>
              <span className="dash-stat-label">need attention</span>
            </div>
          )}
          {health.openQs > 0 && (
            <div className="dash-stat">
              <span className="dash-stat-value dash-stat-value--question">{health.openQs}</span>
              <span className="dash-stat-label">open {health.openQs === 1 ? 'question' : 'questions'}</span>
            </div>
          )}
          {health.attention === 0 && pages.length > 0 && (
            <div className="dash-stat">
              <span className="dash-stat-value dash-stat-value--ok">All current</span>
            </div>
          )}
        </div>

        {/* Layer 2: Triage */}
        {attentionPages.length > 0 && (
          <div className="dash-triage">
            <div className="dash-triage-label">Needs review</div>
            {attentionPages.slice(0, TRIAGE_LIMIT).map(page => {
              const section = sections.find(s => s.id === page.sectionId);
              return (
                <div
                  key={page.id}
                  className="dash-triage-row"
                  onClick={() => onSelectPage(workspace.id, page.id)}
                >
                  <div className="dash-triage-meta">
                    <span className="dash-triage-name">{page.name}</span>
                    {section && <span className="dash-triage-section">{section.name}</span>}
                  </div>
                  <HealthPills page={page} />
                </div>
              );
            })}
            {attentionPages.length > TRIAGE_LIMIT && (
              <div className="dash-triage-more">+{attentionPages.length - TRIAGE_LIMIT} more</div>
            )}
          </div>
        )}

        {/* Layer 2b: Open questions */}
        {(() => {
          const allOpenQs = pages.flatMap(page =>
            (page.openQuestions || [])
              .filter(q => !q.resolved)
              .map(q => ({ ...q, page }))
          );
          if (allOpenQs.length === 0) return null;
          return (
            <div className="dash-questions">
              <div className="dash-questions-label">
                <MessageSquare size={11} />
                Open questions
              </div>
              {allOpenQs.slice(0, TRIAGE_LIMIT).map(q => (
                <div
                  key={q.id}
                  className="dash-question-row"
                  onClick={() => onSelectPage(workspace.id, q.page.id)}
                >
                  <div className="dash-question-text">{q.question}</div>
                  <div className="dash-question-meta">{q.page.name} · {q.askedBy}</div>
                </div>
              ))}
              {allOpenQs.length > TRIAGE_LIMIT && (
                <div className="dash-triage-more">+{allOpenQs.length - TRIAGE_LIMIT} more</div>
              )}
            </div>
          );
        })()}

        {/* Layer 3: Section directory */}
        {sections.length > 0 && (
          <>
            <div className="dash-section-label">Sections</div>
            <div className="overview-section-list">
              {sections.map(section => {
                const sectionPages = pages.filter(p => p.sectionId === section.id);
                const sHealth = getSectionHealth(sectionPages);
                return (
                  <div
                    key={section.id}
                    className="overview-section-row"
                    onClick={() => onSelectSection(workspace.id, section.id)}
                  >
                    <div className="osrow-left">
                      <Folder size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                      <span className="osrow-name">{section.name}</span>
                      <span className="osrow-count">{sectionPages.length} {sectionPages.length === 1 ? 'page' : 'pages'}</span>
                    </div>
                    <div className="osrow-right">
                      {sHealth.attention > 0 ? (
                        <span className="osrow-health osrow-health--issues">{sHealth.attention} need attention</span>
                      ) : (
                        <span className="osrow-health osrow-health--ok">All current</span>
                      )}
                      <ChevronRight size={13} style={{ color: 'var(--text-6)', flexShrink: 0 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {pages.length === 0 && (
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem', padding: '8px 0' }}>
            No pages yet.{' '}
            <button className="btn-link" onClick={() => onAddPage(workspace.id, null)}>Add one</button> to get started.
          </p>
        )}

        {/* Danger zone */}
        <div style={{ marginTop: 'auto', paddingTop: 40 }}>
          <button
            className="btn-danger-ghost"
            style={{ fontSize: '0.775rem' }}
            onClick={() => {
              if (window.confirm(`Delete "${workspace.name}"? All pages will be permanently removed.`)) {
                onDeleteWorkspace(workspace.id);
              }
            }}
          >
            <Trash2 size={12} />
            Delete workspace
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SectionView ────────────────────────────────────────────────────────────────

function SectionView({ workspace, section, onSelectPage, onAddPage, onSaveSection, onDeleteSection, onSavePage }) {
  const [name, setName] = useState(section.name);
  const [selected, setSelected] = useState(new Set());
  const pages = workspace.pages.filter(p => p.sectionId === section.id);
  const health = getSectionHealth(pages);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSelected(new Set()); }, [section.id]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setName(section.name); }, [section.id]);

  function handleNameBlur() {
    if (name.trim() && name.trim() !== section.name) {
      onSaveSection(workspace.id, { ...section, name: name.trim() });
    } else {
      setName(section.name);
    }
  }

  function toggleSelect(pageId) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(pageId) ? next.delete(pageId) : next.add(pageId);
      return next;
    });
  }

  function handleBulkMarkReviewed() {
    const today = new Date().toISOString().split('T')[0];
    for (const pageId of selected) {
      const page = pages.find(p => p.id === pageId);
      if (!page) continue;
      onSavePage(workspace.id, { ...page, lastReviewedDate: today });
    }
    setSelected(new Set());
  }

  return (
    <div className="main-content">
      <div className="main-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--text-3)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Database size={11} />
            {workspace.name}
            <ChevronRight size={11} />
          </span>
          <input
            className="section-title-input"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
          />
        </div>
        <button className="btn-primary" onClick={() => onAddPage(workspace.id, section.id)}>
          <Plus size={13} />
          Add page
        </button>
      </div>

      <div className="overview-body">
        {/* Stats */}
        {health.total > 0 && (
          <div className="dash-stats">
            <div className="dash-stat">
              <span className="dash-stat-value">{pages.length}</span>
              <span className="dash-stat-label">{pages.length === 1 ? 'page' : 'pages'}</span>
            </div>
            {health.attention > 0 && (
              <div className="dash-stat">
                <span className="dash-stat-value dash-stat-value--warn">{health.attention}</span>
                <span className="dash-stat-label">need attention</span>
              </div>
            )}
            {health.openQs > 0 && (
              <div className="dash-stat">
                <span className="dash-stat-value dash-stat-value--question">{health.openQs}</span>
                <span className="dash-stat-label">open {health.openQs === 1 ? 'question' : 'questions'}</span>
              </div>
            )}
            {health.attention === 0 && (
              <div className="dash-stat">
                <span className="dash-stat-value dash-stat-value--ok">All current</span>
              </div>
            )}
          </div>
        )}

        {pages.length === 0 ? (
          <div style={{ padding: '24px 0', color: 'var(--text-4)', fontSize: '0.875rem' }}>
            No pages in this section.{' '}
            <button className="btn-link" onClick={() => onAddPage(workspace.id, section.id)}>Add one</button>
          </div>
        ) : (() => {
          const reviewPages = pages.filter(p => getPageTier(p) !== 'complete');
          const completePages = pages.filter(p => getPageTier(p) === 'complete');
          const multiTier = reviewPages.length > 0 && completePages.length > 0;

          function renderPageRow(page) {
            const isSelected = selected.has(page.id);
            return (
              <div
                key={page.id}
                className={`sec-page-row${isSelected ? ' selected' : ''}`}
                onClick={() => onSelectPage(workspace.id, page.id)}
              >
                <div
                  className="sec-page-checkbox"
                  onClick={e => { e.stopPropagation(); toggleSelect(page.id); }}
                  role="checkbox"
                  aria-checked={isSelected}
                >
                  {isSelected ? <Check size={10} /> : null}
                </div>
                <div className="sec-page-left">
                  <span className="sec-page-name">{page.name}</span>
                  <span className="sec-page-owner" style={!page.owner ? { color: 'var(--color-no-owner)' } : {}}>
                    {page.owner || 'No owner'}
                  </span>
                </div>
                <div className="sec-page-right">
                  <HealthPills page={page} />
                  <ChevronRight size={13} style={{ color: 'var(--text-6)', flexShrink: 0 }} />
                </div>
              </div>
            );
          }

          return (
            <div className="sec-page-list">
              {selected.size > 0 && (
                <div className="bulk-bar">
                  <span className="bulk-bar-count">{selected.size} selected</span>
                  <button className="btn-primary btn-sm" onClick={handleBulkMarkReviewed}>
                    <Check size={12} />
                    Mark reviewed today
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
                </div>
              )}
              {multiTier && <div className="sec-tier-label sec-tier-label--review">Needs review</div>}
              {reviewPages.map(renderPageRow)}
              {multiTier && <div className="sec-tier-label sec-tier-label--complete">Complete</div>}
              {completePages.map(renderPageRow)}
            </div>
          );
        })()}

        <div style={{ paddingTop: 32, marginTop: 'auto' }}>
          <button
            className="btn-danger-ghost"
            style={{ fontSize: '0.775rem' }}
            onClick={() => {
              if (window.confirm(`Delete "${section.name}"? Pages will become ungrouped.`)) {
                onDeleteSection(workspace.id, section.id);
              }
            }}
          >
            <Trash2 size={12} />
            Delete section
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QuestionItem ───────────────────────────────────────────────────────────────

function QuestionItem({ question, onResolve }) {
  const [showForm, setShowForm] = useState(false);
  const [resolution, setResolution] = useState('');

  function handleResolve() {
    if (!resolution.trim()) return;
    onResolve(question.id, resolution.trim());
    setShowForm(false);
    setResolution('');
  }

  return (
    <div className={`question-item${question.resolved ? ' resolved' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{ marginTop: 3, flexShrink: 0 }}>
          {question.resolved
            ? <CheckCircle size={14} color="var(--color-ok)" />
            : <Circle size={14} color="var(--text-6)" />
          }
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="question-text">{question.question}</div>
          <div className="question-meta">
            {question.askedBy} &middot; {formatRelativeDate(question.askedAt)}
          </div>
          {question.resolved && question.resolution && (
            <div className="question-resolution">
              <span style={{ color: 'var(--color-ok)', fontWeight: 700 }}>Resolution: </span>
              {question.resolution}
            </div>
          )}
          {!question.resolved && !showForm && (
            <button className="btn-link" onClick={() => setShowForm(true)}>Resolve</button>
          )}
          {showForm && (
            <div className="resolve-form">
              <textarea
                className="resolve-input"
                placeholder="How was this resolved?"
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                rows={2}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: 8 }}>
                <button className="btn-primary btn-sm" onClick={handleResolve}>Mark resolved</button>
                <button className="btn-ghost btn-sm" onClick={() => { setShowForm(false); setResolution(''); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PageView ───────────────────────────────────────────────────────────────────

function PageView({ page, workspace, libraryPath, onSave, onDelete, onBack }) {
  const [p, setP] = useState({ ...page });
  const [savedFlash, setSavedFlash] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newQ, setNewQ] = useState('');
  const [newQAsker, setNewQAsker] = useState('');
  const [showAddChangelog, setShowAddChangelog] = useState(false);
  const [newCLNote, setNewCLNote] = useState('');
  const [newCLAuthor, setNewCLAuthor] = useState('');
  const [screenshotUrls, setScreenshotUrls] = useState({});
  const [screenshotCaption, setScreenshotCaption] = useState('');
  const [editingCaptionId, setEditingCaptionId] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setP({ ...page }); }, [page.id]);

  useEffect(() => {
    if (!libraryPath || !workspace?.id) return;
    const shots = (p.screenshots || []);
    shots.forEach(async (shot) => {
      if (screenshotUrls[shot.id]) return;
      const url = await window.electronAPI?.getAssetUrl(libraryPath, workspace.id, shot.id);
      if (url) setScreenshotUrls(prev => ({ ...prev, [shot.id]: url }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.screenshots, libraryPath, workspace?.id]);

  function persist(updated) {
    setP(updated);
    onSave(updated);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  function field(key, value) {
    persist({ ...p, [key]: value });
  }

  function markToday() {
    field('lastReviewedDate', new Date().toISOString().split('T')[0]);
  }

  function addQuestion() {
    if (!newQ.trim()) return;
    const q = {
      id: generateId('q'),
      question: newQ.trim(),
      askedBy: newQAsker.trim() || 'Unknown',
      askedAt: new Date().toISOString().split('T')[0],
      resolved: false, resolution: null, resolvedAt: null,
    };
    persist({ ...p, openQuestions: [...(p.openQuestions || []), q] });
    setNewQ(''); setNewQAsker(''); setShowAddQuestion(false);
  }

  function resolveQuestion(qId, resolution) {
    persist({
      ...p,
      openQuestions: (p.openQuestions || []).map(q =>
        q.id === qId
          ? { ...q, resolved: true, resolution, resolvedAt: new Date().toISOString().split('T')[0] }
          : q
      ),
    });
  }

  function addChangelog() {
    if (!newCLNote.trim()) return;
    const entry = {
      id: generateId('cl'),
      date: new Date().toISOString().split('T')[0],
      author: newCLAuthor.trim() || 'Unknown',
      note: newCLNote.trim(),
    };
    persist({ ...p, changelog: [entry, ...(p.changelog || [])] });
    setNewCLNote(''); setNewCLAuthor(''); setShowAddChangelog(false);
  }

  function quickReview() {
    const today = new Date().toISOString().split('T')[0];
    const entry = {
      id: generateId('cl'),
      date: today,
      author: p.owner || 'Unknown',
      note: 'Reviewed — no changes.',
    };
    persist({ ...p, lastReviewedDate: today, changelog: [entry, ...(p.changelog || [])] });
  }

  async function addScreenshot() {
    const srcPath = await window.electronAPI?.pickImage();
    if (!srcPath) return;
    const result = await window.electronAPI?.addAsset(libraryPath, workspace.id, srcPath, '');
    if (!result?.success) return;
    const url = await window.electronAPI?.getAssetUrl(libraryPath, workspace.id, result.id);
    setScreenshotUrls(prev => ({ ...prev, [result.id]: url }));
    persist({ ...p, screenshots: [...(p.screenshots || []), { id: result.id, caption: '' }] });
  }

  async function deleteScreenshot(assetId) {
    await window.electronAPI?.deleteAsset(libraryPath, workspace.id, assetId);
    setScreenshotUrls(prev => { const n = { ...prev }; delete n[assetId]; return n; });
    persist({ ...p, screenshots: (p.screenshots || []).filter(s => s.id !== assetId) });
  }

  function saveCaption(assetId, caption) {
    persist({ ...p, screenshots: (p.screenshots || []).map(s => s.id === assetId ? { ...s, caption } : s) });
    setEditingCaptionId(null);
  }

  const section = workspace.sections.find(s => s.id === p.sectionId);
  const openQs = (p.openQuestions || []).filter(q => !q.resolved);
  const resolvedQs = (p.openQuestions || []).filter(q => q.resolved);
  return (
    <div className="main-content">
      {/* Header / breadcrumb */}
      <div className="main-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn-ghost btn-sm" onClick={onBack} style={{ padding: '3px 5px', color: 'var(--text-3)' }}>
            <ChevronLeft size={14} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-3)', fontSize: '0.8rem' }}>
            <Database size={11} />
            <span>{workspace.name}</span>
            {section && (
              <>
                <ChevronRight size={11} />
                <span>{section.name}</span>
              </>
            )}
            <ChevronRight size={11} />
            <span style={{ color: 'var(--text-2)' }}>{p.name}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {savedFlash && <span style={{ color: 'var(--color-ok)', fontSize: '0.75rem', fontWeight: 600 }}>Saved</span>}
          {!showDeleteConfirm ? (
            <button className="btn-danger-ghost" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={13} />
              Delete
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>Delete this page?</span>
              <button className="btn-danger" onClick={() => onDelete(p.id)}>Yes, delete</button>
              <button className="btn-ghost btn-sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* Document body */}
      <div className="page-body">
        {/* Title */}
        <input
          className="page-title-input"
          value={p.name}
          onChange={e => setP({ ...p, name: e.target.value })}
          onBlur={e => {
            const val = e.target.value.trim();
            if (val && val !== page.name) field('name', val);
            else if (!val) setP({ ...p, name: page.name });
          }}
          placeholder="Page title"
        />

        {/* Health status */}
        <div style={{ marginBottom: 24 }}>
          <HealthPills page={p} />
        </div>

        {/* Properties */}
        <div className="page-props">
          <div className="prop-row">
            <span className="prop-label"><User size={12} />Owner</span>
            <div className="prop-value">
              <input
                className="prop-input"
                value={p.owner || ''}
                onChange={e => setP({ ...p, owner: e.target.value })}
                onBlur={e => field('owner', e.target.value.trim() || null)}
                placeholder="No owner"
              />
            </div>
          </div>

          <div className="prop-row">
            <span className="prop-label"><Calendar size={12} />Last reviewed</span>
            <div className="prop-value" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                className="prop-input"
                type="date"
                value={p.lastReviewedDate || ''}
                onChange={e => field('lastReviewedDate', e.target.value || null)}
                style={{ width: 'auto' }}
              />
              {p.lastReviewedDate !== new Date().toISOString().split('T')[0] && (
                <button className="btn-link" onClick={markToday}>Reviewed today</button>
              )}
            </div>
          </div>

          <div className="prop-row">
            <span className="prop-label"><Clock size={12} />Review every</span>
            <div className="prop-value">
              <select
                className="prop-input prop-select"
                value={p.reviewCadenceDays ?? ''}
                onChange={e => field('reviewCadenceDays', e.target.value ? Number(e.target.value) : null)}
              >
                {REVIEW_CADENCES.map(c => (
                  <option key={String(c.value)} value={c.value ?? ''}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="prop-row">
            <span className="prop-label"><Folder size={12} />Section</span>
            <div className="prop-value">
              <select
                className="prop-input prop-select"
                value={p.sectionId || ''}
                onChange={e => field('sectionId', e.target.value || null)}
              >
                <option value="">No section</option>
                {workspace.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="prop-row prop-row-confidence">
            <span className="prop-label"><AlertTriangle size={12} />Confidence</span>
            <div className="prop-value">
              <div className="confidence-selector">
                {CONFIDENCE_LEVELS.map(level => (
                  <button
                    key={level.score}
                    className={`confidence-option${p.confidenceScore === level.score ? ` active active-${level.score}` : ''}`}
                    onClick={() => field('confidenceScore', level.score)}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="page-divider" />

        {/* Screenshots */}
        <div className="page-section">
          <div className="page-section-header">
            <span className="page-section-title">
              <Image size={13} />
              Screenshots
            </span>
            <button className="btn-ghost btn-sm" onClick={addScreenshot}>
              <Plus size={12} />
              Add
            </button>
          </div>

          {(p.screenshots || []).length === 0 ? (
            <div className="section-empty">
              No screenshots yet.{' '}
              <button className="btn-link" onClick={addScreenshot}>Add one</button> to document the visual pattern.
            </div>
          ) : (
            <div className="screenshot-grid">
              {(p.screenshots || []).map(shot => (
                <div key={shot.id} className="screenshot-card">
                  <div className="screenshot-img-wrap">
                    {screenshotUrls[shot.id]
                      ? <img src={screenshotUrls[shot.id]} alt={shot.caption || 'Screenshot'} className="screenshot-img" />
                      : <div className="screenshot-placeholder"><Image size={20} /></div>
                    }
                    <button className="screenshot-delete" onClick={() => deleteScreenshot(shot.id)} title="Remove">
                      <X size={11} />
                    </button>
                  </div>
                  {editingCaptionId === shot.id ? (
                    <input
                      className="form-input screenshot-caption-input"
                      autoFocus
                      value={screenshotCaption}
                      onChange={e => setScreenshotCaption(e.target.value)}
                      onBlur={() => saveCaption(shot.id, screenshotCaption)}
                      onKeyDown={e => { if (e.key === 'Enter') saveCaption(shot.id, screenshotCaption); if (e.key === 'Escape') setEditingCaptionId(null); }}
                    />
                  ) : (
                    <button
                      className="screenshot-caption"
                      onClick={() => { setEditingCaptionId(shot.id); setScreenshotCaption(shot.caption || ''); }}
                    >
                      {shot.caption || <span style={{ color: 'var(--text-4)' }}>Add caption…</span>}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="page-divider" />

        {/* Open questions */}
        <div className="page-section">
          <div className="page-section-header">
            <span className="page-section-title">
              <MessageSquare size={13} />
              Open questions
              {openQs.length > 0 && (
                <span style={{ color: 'var(--color-question)', fontWeight: 700, marginLeft: 4 }}>{openQs.length}</span>
              )}
            </span>
            <button className="btn-ghost btn-sm" onClick={() => setShowAddQuestion(v => !v)}>
              <Plus size={12} />
              Add
            </button>
          </div>

          {showAddQuestion && (
            <div className="add-form">
              <textarea
                className="form-input"
                placeholder="What is the open question?"
                value={newQ}
                onChange={e => setNewQ(e.target.value)}
                rows={2}
                autoFocus
              />
              <input
                className="form-input"
                placeholder="Asked by (name)"
                value={newQAsker}
                onChange={e => setNewQAsker(e.target.value)}
                style={{ marginTop: 6 }}
                onKeyDown={e => { if (e.key === 'Enter') addQuestion(); }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn-primary btn-sm" onClick={addQuestion} disabled={!newQ.trim()}>Add question</button>
                <button className="btn-ghost btn-sm" onClick={() => { setShowAddQuestion(false); setNewQ(''); setNewQAsker(''); }}>Cancel</button>
              </div>
            </div>
          )}

          {openQs.length === 0 && !showAddQuestion && (
            <div className="section-empty">No open questions.</div>
          )}
          {openQs.map(q => <QuestionItem key={q.id} question={q} onResolve={resolveQuestion} />)}
          {resolvedQs.length > 0 && (
            <details>
              <summary className="resolved-toggle">
                {resolvedQs.length} resolved question{resolvedQs.length !== 1 ? 's' : ''}
              </summary>
              {resolvedQs.map(q => <QuestionItem key={q.id} question={q} onResolve={resolveQuestion} />)}
            </details>
          )}
        </div>

        <div className="page-divider" />

        {/* Changelog */}
        <div className="page-section">
          <div className="page-section-header">
            <span className="page-section-title">
              <BookOpen size={13} />
              Changelog
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-ghost btn-sm" onClick={quickReview} title="Mark reviewed today with no changes">
                <Zap size={12} />
                Quick review
              </button>
              <button className="btn-ghost btn-sm" onClick={() => setShowAddChangelog(v => !v)}>
                <Plus size={12} />
                Add entry
              </button>
            </div>
          </div>

          {showAddChangelog && (
            <div className="add-form">
              <textarea
                className="form-input"
                placeholder="What changed and why?"
                value={newCLNote}
                onChange={e => setNewCLNote(e.target.value)}
                rows={2}
                autoFocus
              />
              <input
                className="form-input"
                placeholder="Author (name)"
                value={newCLAuthor}
                onChange={e => setNewCLAuthor(e.target.value)}
                style={{ marginTop: 6 }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn-primary btn-sm" onClick={addChangelog} disabled={!newCLNote.trim()}>Add entry</button>
                <button className="btn-ghost btn-sm" onClick={() => { setShowAddChangelog(false); setNewCLNote(''); setNewCLAuthor(''); }}>Cancel</button>
              </div>
            </div>
          )}

          {(p.changelog || []).length === 0 && !showAddChangelog && (
            <div className="section-empty">No changelog entries yet.</div>
          )}
          {(p.changelog || []).map(entry => (
            <div key={entry.id} className="changelog-item">
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div className="changelog-date">{entry.date}</div>
                <div style={{ flex: 1 }}>
                  <div className="changelog-author">{entry.author}</div>
                  <div className="changelog-note">{entry.note}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── AddPageModal ───────────────────────────────────────────────────────────────

function AddPageModal({ workspaces, defaultWorkspaceId, defaultSectionId, onAdd, onClose }) {
  const [name, setName] = useState('');
  const [workspaceId, setWorkspaceId] = useState(defaultWorkspaceId || workspaces[0]?.id || '');
  const [sectionId, setSectionId] = useState(defaultSectionId || '');
  const inputRef = useRef(null);

  const currentWorkspace = workspaces.find(w => w.id === workspaceId);
  const sections = currentWorkspace?.sections || [];

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Reset section when workspace changes
  useEffect(() => {
    const valid = sections.find(s => s.id === sectionId);
    if (!valid) setSectionId(sections[0]?.id || '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  function handleAdd() {
    if (!name.trim() || !workspaceId) return;
    onAdd(workspaceId, {
      id: generateId('ct'),
      sectionId: sectionId || null,
      name: name.trim(),
      owner: null,
      lastReviewedDate: null,
      reviewCadenceDays: 90,
      confidenceScore: 0,
      openQuestions: [],
      changelog: [],
      screenshots: [],
      createdAt: new Date().toISOString().split('T')[0],
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add page</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="modal-field">
            <label className="modal-label">Page title</label>
            <input
              ref={inputRef}
              className="form-input"
              placeholder="e.g. Toast notification"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') onClose();
              }}
            />
          </div>
          {workspaces.length > 1 && (
            <div className="modal-field">
              <label className="modal-label">Workspace</label>
              <select
                className="form-input"
                value={workspaceId}
                onChange={e => setWorkspaceId(e.target.value)}
              >
                {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}
          <div className="modal-field">
            <label className="modal-label">Section</label>
            <select
              className="form-input"
              value={sectionId}
              onChange={e => setSectionId(e.target.value)}
            >
              <option value="">No section</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-primary" onClick={handleAdd} disabled={!name.trim()}>Create</button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── AddWorkspaceModal ──────────────────────────────────────────────────────────

function AddWorkspaceModal({ onAdd, onClose }) {
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleAdd() {
    if (!name.trim()) return;
    onAdd(name.trim());
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">New workspace</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          <input
            ref={inputRef}
            className="form-input"
            placeholder="e.g. Design System, Mobile App"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>
        <div className="modal-footer">
          <button className="btn-primary" onClick={handleAdd} disabled={!name.trim()}>Create</button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── SearchModal ────────────────────────────────────────────────────────────────

function SearchModal({ workspaces, onSelectPage, onClose }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = query.trim().length === 0 ? [] : workspaces.flatMap(ws =>
    ws.pages
      .filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.owner || '').toLowerCase().includes(query.toLowerCase())
      )
      .map(p => ({ page: p, workspace: ws, section: ws.sections.find(s => s.id === p.sectionId) }))
  ).slice(0, 10);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-input-wrap">
          <Search size={14} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Search pages…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
          />
        </div>
        {results.length > 0 && (
          <div className="search-results">
            {results.map(({ page, workspace, section }) => (
              <div
                key={page.id}
                className="search-result-row"
                onClick={() => { onSelectPage(workspace.id, page.id); onClose(); }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="search-result-name">{page.name}</div>
                  <div className="search-result-meta">
                    {workspace.name}{section ? ` · ${section.name}` : ''}{page.owner ? ` · ${page.owner}` : ''}
                  </div>
                </div>
                <HealthDot page={page} />
              </div>
            ))}
          </div>
        )}
        {query.trim().length > 0 && results.length === 0 && (
          <div className="search-empty">No pages found</div>
        )}
        <div className="search-hint">⌘K to toggle · Esc to close</div>
      </div>
    </div>
  );
}

// ── OwnersView ─────────────────────────────────────────────────────────────────

function OwnersView({ workspaces, onSelectPage }) {
  const allPages = workspaces.flatMap(ws => ws.pages.map(p => ({ ...p, _ws: ws })));

  const ownerMap = {};
  for (const page of allPages) {
    const key = page.owner || '__unowned__';
    if (!ownerMap[key]) ownerMap[key] = [];
    ownerMap[key].push(page);
  }
  const owners = Object.keys(ownerMap).filter(k => k !== '__unowned__').sort();
  const unowned = ownerMap['__unowned__'] || [];

  function renderPageRow(page) {
    const ws = page._ws;
    const section = ws.sections.find(s => s.id === page.sectionId);
    return (
      <div key={page.id} className="owner-page-row" onClick={() => onSelectPage(ws.id, page.id)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="owner-page-name">{page.name}</span>
          <span className="owner-page-ws">{ws.name}{section ? ` · ${section.name}` : ''}</span>
        </div>
        <HealthPills page={page} />
        <ChevronRight size={13} style={{ color: 'var(--text-6)', flexShrink: 0 }} />
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="main-header">
        <span className="main-view-title">Owners</span>
      </div>
      <div className="overview-body">
        {allPages.length === 0 && (
          <p style={{ color: 'var(--text-4)', fontSize: '0.875rem' }}>No pages yet.</p>
        )}
        {owners.map(owner => (
          <div key={owner} className="owner-group">
            <div className="owner-group-header">
              <User size={13} style={{ flexShrink: 0 }} />
              <span className="owner-group-name">{owner}</span>
              <span className="owner-group-count">{ownerMap[owner].length}</span>
            </div>
            <div className="owner-page-list">{ownerMap[owner].map(renderPageRow)}</div>
          </div>
        ))}
        {unowned.length > 0 && (
          <div className="owner-group">
            <div className="owner-group-header owner-group-header--unowned">
              <User size={13} style={{ flexShrink: 0 }} />
              <span className="owner-group-name">Unowned</span>
              <span className="owner-group-count">{unowned.length}</span>
            </div>
            <div className="owner-page-list">{unowned.map(renderPageRow)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DigestModal ────────────────────────────────────────────────────────────────

function generateDigest(workspaces) {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const allPages = workspaces.flatMap(w => w.pages);
  const attentionPages = allPages.filter(needsAttention);
  const dueSoonPages = allPages.filter(p => isDueSoon(p));
  const allOpenQs = allPages.flatMap(p =>
    (p.openQuestions || []).filter(q => !q.resolved).map(q => ({ ...q, page: p }))
  );

  const lines = [
    `# Content Library Health — ${date}`,
    '',
    `**${allPages.length} ${allPages.length === 1 ? 'page' : 'pages'}** across ${workspaces.length} ${workspaces.length === 1 ? 'workspace' : 'workspaces'}.`,
  ];

  if (attentionPages.length === 0) {
    lines.push('Everything is current. ✓');
  } else {
    const extra = dueSoonPages.length > 0 ? ` ${dueSoonPages.length} more coming due within 14 days.` : '';
    lines.push(`**${attentionPages.length} need review.**${extra}`);
  }

  if (attentionPages.length > 0) {
    lines.push('', '## Needs Review');
    for (const ws of workspaces) {
      const wsPages = ws.pages.filter(needsAttention);
      if (wsPages.length === 0) continue;
      lines.push('', `### ${ws.name}`);
      for (const p of wsPages) {
        const f = getHealthFlags(p);
        const tags = [];
        if (f.unowned) tags.push('no owner');
        if (f.stale) tags.push('overdue');
        if (f.lowConf) tags.push('low confidence');
        if (f.hasQuestions) tags.push(`${openQuestionCount(p)} open question${openQuestionCount(p) !== 1 ? 's' : ''}`);
        lines.push(`- **${p.name}** — ${tags.join(', ')}`);
      }
    }
  }

  if (allOpenQs.length > 0) {
    lines.push('', '## Open Questions');
    for (const q of allOpenQs) {
      lines.push(`- **${q.page.name}:** ${q.question} _(${q.askedBy})_`);
    }
  }

  return lines.join('\n');
}

function DigestModal({ workspaces, onClose }) {
  const [copied, setCopied] = useState(false);
  const text = generateDigest(workspaces);

  function handleCopy() {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="digest-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Export digest</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary btn-sm" onClick={handleCopy}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy markdown'}
            </button>
            <button className="btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
          </div>
        </div>
        <div className="digest-body">
          <pre className="digest-text">{text}</pre>
        </div>
      </div>
    </div>
  );
}

// ── ReviewModeModal ────────────────────────────────────────────────────────────

function ReviewModeModal({ pages, workspaces, onSavePage, onClose }) {
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState('');
  const [author, setAuthor] = useState('');
  const [confidence, setConfidence] = useState(null);

  const page = pages[index];
  if (!page) return null;
  const ws = workspaces.find(w => w.id === page._workspaceId);
  const section = ws?.sections.find(s => s.id === page.sectionId);

  function advance() {
    if (index < pages.length - 1) {
      setIndex(i => i + 1);
      setNote(''); setAuthor(''); setConfidence(null);
    } else {
      onClose();
    }
  }

  function handleMarkReviewed() {
    const today = new Date().toISOString().split('T')[0];
    const updated = {
      ...page,
      lastReviewedDate: today,
      confidenceScore: confidence ?? page.confidenceScore,
      changelog: note.trim()
        ? [{ id: generateId('cl'), date: today, author: author.trim() || page.owner || 'Unknown', note: note.trim() }, ...(page.changelog || [])]
        : page.changelog,
    };
    onSavePage(page._workspaceId, updated);
    advance();
  }

  const progress = `${index + 1} of ${pages.length}`;

  return (
    <div className="modal-overlay">
      <div className="review-modal">
        <div className="review-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={14} style={{ color: 'var(--accent)' }} />
            <span className="review-modal-title">Review mode</span>
            <span className="review-modal-progress">{progress}</span>
          </div>
          <button className="btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="review-modal-body">
          <div className="review-breadcrumb">
            {ws?.name}{section ? ` · ${section.name}` : ''}
          </div>
          <div className="review-page-name">{page.name}</div>
          <div style={{ marginBottom: 20 }}><HealthPills page={page} /></div>

          <div className="review-fields">
            <div className="review-field">
              <label className="review-label">Confidence after review</label>
              <div className="confidence-selector">
                {CONFIDENCE_LEVELS.map(level => (
                  <button
                    key={level.score}
                    className={`confidence-option${(confidence ?? page.confidenceScore) === level.score ? ` active active-${level.score}` : ''}`}
                    onClick={() => setConfidence(level.score)}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="review-field">
              <label className="review-label">Note (optional)</label>
              <textarea
                className="form-input"
                placeholder="What did you find or change?"
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
              />
            </div>
            <div className="review-field">
              <label className="review-label">Your name (optional)</label>
              <input
                className="form-input"
                placeholder={page.owner || 'Name'}
                value={author}
                onChange={e => setAuthor(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="review-modal-footer">
          <button className="btn-primary" onClick={handleMarkReviewed}>
            <Check size={13} />
            Mark reviewed{index < pages.length - 1 ? ' & next' : ' & finish'}
          </button>
          <button className="btn-ghost" onClick={advance}>
            <ArrowRight size={13} />
            Skip
          </button>
        </div>

        <div className="review-progress-bar">
          <div className="review-progress-fill" style={{ width: `${((index) / pages.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────

export default function App() {
  const [appState, setAppState] = useState('loading');
  const [libraryPath, setLibraryPath] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [selection, setSelection] = useState({ type: 'home' });
  const [expandedWorkspaces, setExpandedWorkspaces] = useState(new Set());
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [showAddPageModal, setShowAddPageModal] = useState(false);
  const [addPageContext, setAddPageContext] = useState({ workspaceId: null, sectionId: null });
  const [showAddWorkspaceModal, setShowAddWorkspaceModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showDigest, setShowDigest] = useState(false);
  const [reviewModePages, setReviewModePages] = useState(null); // null = closed
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('anchor-theme') === 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (appState !== 'app') { document.title = 'Anchor'; return; }
    const attention = workspaces.flatMap(w => w.pages).filter(needsAttention).length;
    document.title = attention > 0 ? `Anchor — ${attention} need review` : 'Anchor';
  }, [workspaces, appState]);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(s => !s);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
        setShowDigest(false);
        setReviewModePages(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function handleToggleDark() {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('anchor-theme', next ? 'dark' : 'light');
      return next;
    });
  }

  useEffect(() => {
    const savedPath = localStorage.getItem('anchor-library');
    if (savedPath) loadLibrary(savedPath);
    else setAppState('welcome');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLibrary(path) {
    setAppState('loading');
    try {
      let loaded = [];
      if (window.electronAPI) {
        const result = await window.electronAPI.scanLibrary(path);
        loaded = result.workspaces || [];
      }
      setWorkspaces(loaded);
      setLibraryPath(path);
      setExpandedWorkspaces(new Set(loaded.map(w => w.id)));
      setAppState('app');
    } catch (err) {
      console.error('Failed to load library:', err);
      setAppState('welcome');
    }
  }

  function handleSwitchLibrary() {
    localStorage.removeItem('anchor-library');
    setLibraryPath(null);
    setWorkspaces([]);
    setSelection({ type: 'home' });
    setAppState('welcome');
  }

  async function handleSelectFolder() {
    if (!window.electronAPI) return;
    const path = await window.electronAPI.selectFolder();
    if (path) {
      localStorage.setItem('anchor-library', path);
      await loadLibrary(path);
    }
  }

  async function handleCreateFolder() {
    if (!window.electronAPI) return;
    const path = await window.electronAPI.createFolder();
    if (path) {
      localStorage.setItem('anchor-library', path);
      await loadLibrary(path);
    }
  }

  function toggleWorkspace(id) {
    setExpandedWorkspaces(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSection(id) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Workspace CRUD ───────────────────────────────────────────────────────────

  async function handleCreateWorkspace(name) {
    const id = generateId('ws');
    const newWs = { id, name, createdAt: new Date().toISOString(), sections: [], pages: [] };
    if (window.electronAPI && libraryPath) {
      await window.electronAPI.createWorkspace(libraryPath, newWs);
    }
    setWorkspaces(prev => [...prev, newWs]);
    setExpandedWorkspaces(prev => new Set([...prev, id]));
    setSelection({ type: 'workspace', workspaceId: id });
    setShowAddWorkspaceModal(false);
  }

  async function handleSaveWorkspace(updated) {
    if (window.electronAPI && libraryPath) {
      await window.electronAPI.saveWorkspaceMeta(libraryPath, updated.id, {
        id: updated.id, name: updated.name, createdAt: updated.createdAt,
      });
    }
    setWorkspaces(prev => prev.map(w => w.id === updated.id ? { ...w, name: updated.name } : w));
  }

  async function handleDeleteWorkspace(workspaceId) {
    if (window.electronAPI && libraryPath) {
      await window.electronAPI.deleteWorkspace(libraryPath, workspaceId);
    }
    setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));
    setSelection({ type: 'home' });
  }

  // ── Section CRUD ─────────────────────────────────────────────────────────────

  async function handleCreateSection(workspaceId, name) {
    const id = generateId('sec');
    const ws = workspaces.find(w => w.id === workspaceId);
    const newSection = { id, name, createdAt: new Date().toISOString(), order: ws?.sections.length || 0 };
    const updatedSections = [...(ws?.sections || []), newSection];
    if (window.electronAPI && libraryPath) {
      await window.electronAPI.saveSections(libraryPath, workspaceId, updatedSections);
    }
    setWorkspaces(prev => prev.map(w => w.id === workspaceId ? { ...w, sections: updatedSections } : w));
    setExpandedSections(prev => new Set([...prev, id]));
    setSelection({ type: 'section', workspaceId, sectionId: id });
  }

  async function handleSaveSection(workspaceId, updatedSection) {
    const ws = workspaces.find(w => w.id === workspaceId);
    const updatedSections = (ws?.sections || []).map(s => s.id === updatedSection.id ? updatedSection : s);
    if (window.electronAPI && libraryPath) {
      await window.electronAPI.saveSections(libraryPath, workspaceId, updatedSections);
    }
    setWorkspaces(prev => prev.map(w => w.id === workspaceId ? { ...w, sections: updatedSections } : w));
  }

  async function handleDeleteSection(workspaceId, sectionId) {
    const ws = workspaces.find(w => w.id === workspaceId);
    const updatedSections = (ws?.sections || []).filter(s => s.id !== sectionId);
    const updatedPages = (ws?.pages || []).map(p => p.sectionId === sectionId ? { ...p, sectionId: null } : p);
    if (window.electronAPI && libraryPath) {
      await window.electronAPI.saveSections(libraryPath, workspaceId, updatedSections);
      for (const pg of updatedPages.filter(p => !p.sectionId)) {
        await window.electronAPI.savePage(libraryPath, workspaceId, pg);
      }
    }
    setWorkspaces(prev => prev.map(w => w.id === workspaceId ? { ...w, sections: updatedSections, pages: updatedPages } : w));
    setSelection({ type: 'workspace', workspaceId });
  }

  // ── Page CRUD ────────────────────────────────────────────────────────────────

  function openAddPage(workspaceId, sectionId) {
    setAddPageContext({ workspaceId, sectionId });
    setShowAddPageModal(true);
  }

  async function handleAddPage(workspaceId, page) {
    if (window.electronAPI && libraryPath) {
      await window.electronAPI.savePage(libraryPath, workspaceId, page);
    }
    setWorkspaces(prev => prev.map(w => w.id === workspaceId ? { ...w, pages: [...w.pages, page] } : w));
    setSelection({ type: 'page', workspaceId, pageId: page.id });
    if (page.sectionId) setExpandedSections(prev => new Set([...prev, page.sectionId]));
    setShowAddPageModal(false);
  }

  async function handleSavePage(workspaceId, updatedPage) {
    if (window.electronAPI && libraryPath) {
      await window.electronAPI.savePage(libraryPath, workspaceId, updatedPage);
    }
    setWorkspaces(prev => prev.map(w =>
      w.id === workspaceId
        ? { ...w, pages: w.pages.map(p => p.id === updatedPage.id ? updatedPage : p) }
        : w
    ));
  }

  async function handleDeletePage(workspaceId, pageId) {
    if (window.electronAPI && libraryPath) {
      await window.electronAPI.deletePage(libraryPath, workspaceId, pageId);
    }
    setWorkspaces(prev => prev.map(w =>
      w.id === workspaceId ? { ...w, pages: w.pages.filter(p => p.id !== pageId) } : w
    ));
    setSelection({ type: 'workspace', workspaceId });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (appState === 'loading') return <LoadingScreen />;
  if (appState === 'welcome') return (
    <WelcomeScreen onSelectFolder={handleSelectFolder} onCreateFolder={handleCreateFolder} />
  );

  const selectedWorkspace = workspaces.find(w => w.id === selection.workspaceId);
  const selectedSection = selectedWorkspace?.sections.find(s => s.id === selection.sectionId);
  const selectedPage = selectedWorkspace?.pages.find(p => p.id === selection.pageId);

  function startReviewMode(pages) {
    // Attach workspaceId to each page so ReviewModeModal can save correctly
    const tagged = pages.map(p => {
      const ws = workspaces.find(w => w.pages.some(pg => pg.id === p.id));
      return { ...p, _workspaceId: ws?.id };
    });
    setReviewModePages(tagged);
  }

  function renderMain() {
    switch (selection.type) {
      case 'owners':
        return (
          <OwnersView
            workspaces={workspaces}
            onSelectPage={(wsId, pgId) => setSelection({ type: 'page', workspaceId: wsId, pageId: pgId })}
          />
        );
      case 'workspace':
        if (!selectedWorkspace) break;
        return (
          <WorkspaceView
            workspace={selectedWorkspace}
            onSelectSection={(wsId, secId) => setSelection({ type: 'section', workspaceId: wsId, sectionId: secId })}
            onSelectPage={(wsId, pgId) => setSelection({ type: 'page', workspaceId: wsId, pageId: pgId })}
            onAddPage={openAddPage}
            onSaveWorkspace={handleSaveWorkspace}
            onDeleteWorkspace={handleDeleteWorkspace}
            onStartReview={startReviewMode}
          />
        );
      case 'section':
        if (!selectedWorkspace || !selectedSection) break;
        return (
          <SectionView
            workspace={selectedWorkspace}
            section={selectedSection}
            onSelectPage={(wsId, pgId) => setSelection({ type: 'page', workspaceId: wsId, pageId: pgId })}
            onAddPage={openAddPage}
            onSaveSection={handleSaveSection}
            onDeleteSection={handleDeleteSection}
            onSavePage={handleSavePage}
          />
        );
      case 'page':
        if (!selectedWorkspace || !selectedPage) break;
        return (
          <PageView
            page={selectedPage}
            workspace={selectedWorkspace}
            libraryPath={libraryPath}
            onSave={pg => handleSavePage(selectedWorkspace.id, pg)}
            onDelete={pgId => handleDeletePage(selectedWorkspace.id, pgId)}
            onBack={() => {
              const backSection = selectedWorkspace.sections.find(s => s.id === selectedPage.sectionId);
              if (backSection) {
                setSelection({ type: 'section', workspaceId: selectedWorkspace.id, sectionId: backSection.id });
              } else {
                setSelection({ type: 'workspace', workspaceId: selectedWorkspace.id });
              }
            }}
          />
        );
      default:
        break;
    }
    return (
      <HomeView
        workspaces={workspaces}
        onSelectWorkspace={id => setSelection({ type: 'workspace', workspaceId: id })}
        onCreateWorkspace={() => setShowAddWorkspaceModal(true)}
        onShowDigest={() => setShowDigest(true)}
        onStartReview={() => startReviewMode(workspaces.flatMap(w => w.pages).filter(needsAttention))}
      />
    );
  }

  return (
    <div className="app">
      <Sidebar
        workspaces={workspaces}
        selection={selection}
        onSelect={setSelection}
        expandedWorkspaces={expandedWorkspaces}
        onToggleWorkspace={toggleWorkspace}
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
        onAddPage={openAddPage}
        onCreateSection={handleCreateSection}
        onCreateWorkspace={() => setShowAddWorkspaceModal(true)}
        darkMode={darkMode}
        onToggleDark={handleToggleDark}
        onOpenSearch={() => setShowSearch(true)}
        onSwitchLibrary={handleSwitchLibrary}
      />
      {renderMain()}

      {showAddPageModal && (
        <AddPageModal
          workspaces={workspaces}
          defaultWorkspaceId={addPageContext.workspaceId}
          defaultSectionId={addPageContext.sectionId}
          onAdd={handleAddPage}
          onClose={() => setShowAddPageModal(false)}
        />
      )}
      {showAddWorkspaceModal && (
        <AddWorkspaceModal
          onAdd={handleCreateWorkspace}
          onClose={() => setShowAddWorkspaceModal(false)}
        />
      )}
      {showSearch && (
        <SearchModal
          workspaces={workspaces}
          onSelectPage={(wsId, pgId) => setSelection({ type: 'page', workspaceId: wsId, pageId: pgId })}
          onClose={() => setShowSearch(false)}
        />
      )}
      {showDigest && (
        <DigestModal
          workspaces={workspaces}
          onClose={() => setShowDigest(false)}
        />
      )}
      {reviewModePages && (
        <ReviewModeModal
          pages={reviewModePages}
          workspaces={workspaces}
          onSavePage={handleSavePage}
          onClose={() => setReviewModePages(null)}
        />
      )}
    </div>
  );
}
