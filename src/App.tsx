import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Role = 'Admin' | 'Sales'

type User = {
  id: string
  name: string
  email: string
  role: Role
  avatar: string
}

type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Negotiation' | 'Won'

type Lead = {
  id: string
  name: string
  company: string
  source: string
  city: string
  industry: string
  budget: number
  status: LeadStatus
  aiScore: number
  aiPrediction: string
  assignedTo: string
  lastContact: string
}

type Reminder = {
  id: string
  text: string
  dueAt: string
  priority: 'High' | 'Medium' | 'Low'
}

type ModuleKey =
  | 'dashboard'
  | 'leads'
  | 'inbox'
  | 'comms'
  | 'reminders'
  | 'analytics'
  | 'calling'
  | 'documents'
  | 'leaderboard'
  | 'social'
  | 'team'
  | 'settings'
  | 'workflows'
  | 'support'

type NavModule = {
  key: ModuleKey
  label: string
  group: 'Core' | 'Growth' | 'Ops'
  short: string
}

const users: User[] = [
  {
    id: 'admin-1',
    name: 'Pranav Singhal',
    email: 'pranav@velara.com',
    role: 'Admin',
    avatar: 'PS',
  },
  {
    id: 'sales-1',
    name: 'Sneha Gupta',
    email: 'sneha@velara.com',
    role: 'Sales',
    avatar: 'SG',
  },
  {
    id: 'sales-2',
    name: 'Amit Sharma',
    email: 'amit@velara.com',
    role: 'Sales',
    avatar: 'AS',
  },
]

const leadsSeed: Lead[] = [
  {
    id: 'L-001',
    name: 'Rajesh Kumar',
    company: 'RK Manufacturing',
    source: 'JustDial',
    city: 'Mumbai',
    industry: 'Auto Components',
    budget: 500000,
    status: 'Qualified',
    aiScore: 92,
    aiPrediction: 'High likelihood to win in 2 weeks',
    assignedTo: 'Sneha Gupta',
    lastContact: '2026-03-12',
  },
  {
    id: 'L-002',
    name: 'Amit Verma',
    company: 'Delhi Logistics',
    source: 'IndiaMART',
    city: 'Delhi',
    industry: 'Logistics',
    budget: 1200000,
    status: 'Negotiation',
    aiScore: 85,
    aiPrediction: 'Strong intent, pricing sensitivity detected',
    assignedTo: 'Pranav Singhal',
    lastContact: '2026-03-11',
  },
  {
    id: 'L-003',
    name: 'Priya Singh',
    company: 'Tech Solutions',
    source: 'Website',
    city: 'Bangalore',
    industry: 'IT Services',
    budget: 300000,
    status: 'New',
    aiScore: 64,
    aiPrediction: 'Nurture with solution story and proof points',
    assignedTo: 'Amit Sharma',
    lastContact: '2026-03-13',
  },
  {
    id: 'L-004',
    name: 'Suresh Patil',
    company: 'Patil Construction',
    source: 'WhatsApp',
    city: 'Pune',
    industry: 'Construction',
    budget: 2000000,
    status: 'Contacted',
    aiScore: 48,
    aiPrediction: 'Low engagement, requires executive outreach',
    assignedTo: 'Pranav Singhal',
    lastContact: '2026-03-08',
  },
  {
    id: 'L-005',
    name: 'Anjali Desai',
    company: 'Desai Textiles',
    source: 'Referral',
    city: 'Surat',
    industry: 'Textiles',
    budget: 450000,
    status: 'Won',
    aiScore: 100,
    aiPrediction: 'Closed and onboarding completed',
    assignedTo: 'Sneha Gupta',
    lastContact: '2026-03-05',
  },
  {
    id: 'L-006',
    name: 'Vikram Iyer',
    company: 'Global Exports',
    source: 'IndiaMART',
    city: 'Chennai',
    industry: 'Exports',
    budget: 800000,
    status: 'Qualified',
    aiScore: 88,
    aiPrediction: 'Hot lead with short decision window',
    assignedTo: 'Amit Sharma',
    lastContact: '2026-03-12',
  },
]

const reminders: Reminder[] = [
  {
    id: 'R-001',
    text: 'Follow up with RK Manufacturing proposal',
    dueAt: 'Today, 3:00 PM',
    priority: 'High',
  },
  {
    id: 'R-002',
    text: 'Call Delhi Logistics procurement head',
    dueAt: 'Today, 5:30 PM',
    priority: 'High',
  },
  {
    id: 'R-003',
    text: 'Review weekly pipeline with Sales team',
    dueAt: 'Tomorrow, 10:00 AM',
    priority: 'Medium',
  },
]

const modules: NavModule[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'Core', short: 'DB' },
  { key: 'leads', label: 'Leads', group: 'Core', short: 'LD' },
  { key: 'inbox', label: 'Inbox', group: 'Core', short: 'IN' },
  { key: 'comms', label: 'Comms', group: 'Core', short: 'CM' },
  { key: 'reminders', label: 'Reminders', group: 'Core', short: 'RM' },
  { key: 'analytics', label: 'Analytics', group: 'Core', short: 'AN' },
  { key: 'calling', label: 'Calling Center', group: 'Growth', short: 'CC' },
  { key: 'documents', label: 'Document Manager', group: 'Growth', short: 'DM' },
  { key: 'leaderboard', label: 'Leaderboard', group: 'Growth', short: 'LB' },
  { key: 'social', label: 'Social Media AI', group: 'Growth', short: 'SM' },
  { key: 'team', label: 'Team', group: 'Ops', short: 'TM' },
  { key: 'settings', label: 'Settings', group: 'Ops', short: 'ST' },
  { key: 'workflows', label: 'Workflows', group: 'Ops', short: 'WF' },
  { key: 'support', label: 'Support', group: 'Ops', short: 'SP' },
]

const storage = {
  user: 'velara_user',
  token: 'velara_token',
  theme: 'velara_theme',
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

function statusTone(status: LeadStatus) {
  if (status === 'Won') return 'tone-success'
  if (status === 'Negotiation') return 'tone-attention'
  if (status === 'Qualified') return 'tone-brand'
  if (status === 'Contacted') return 'tone-neutral'
  return 'tone-muted'
}

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'All'>('All')
  const [theme, setTheme] = useState<'mist' | 'sunset'>(() => {
    const stored = localStorage.getItem(storage.theme)
    return stored === 'sunset' ? 'sunset' : 'mist'
  })

  const [loginEmail, setLoginEmail] = useState('pranav@velara.com')
  const [loginRole, setLoginRole] = useState<Role>('Admin')
  const [authError, setAuthError] = useState('')
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(storage.user)
    return raw ? (JSON.parse(raw) as User) : null
  })

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
    localStorage.setItem(storage.theme, theme)
  }, [theme])

  const leads = leadsSeed

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const text = `${lead.name} ${lead.company} ${lead.city} ${lead.industry}`.toLowerCase()
      const queryMatch = text.includes(query.toLowerCase())
      const statusMatch = statusFilter === 'All' ? true : lead.status === statusFilter
      return queryMatch && statusMatch
    })
  }, [leads, query, statusFilter])

  const metrics = useMemo(() => {
    const won = leads.filter((lead) => lead.status === 'Won').length
    const hot = leads.filter((lead) => lead.aiScore >= 85).length
    const totalValue = leads.reduce((sum, lead) => sum + lead.budget, 0)
    const activeValue = leads
      .filter((lead) => lead.status !== 'Won')
      .reduce((sum, lead) => sum + lead.budget, 0)
    const winRate = leads.length === 0 ? 0 : Math.round((won / leads.length) * 100)
    return {
      totalLeads: leads.length,
      hotLeads: hot,
      totalValue,
      activeValue,
      winRate,
    }
  }, [leads])

  const pipeline = useMemo(() => {
    const statuses: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Negotiation', 'Won']
    return statuses.map((status) => {
      const count = leads.filter((lead) => lead.status === status).length
      const value = leads
        .filter((lead) => lead.status === status)
        .reduce((sum, lead) => sum + lead.budget, 0)
      return { status, count, value }
    })
  }, [leads])

  const leaderboard = useMemo(() => {
    return users
      .map((user) => {
        const wonValue = leads
          .filter((lead) => lead.assignedTo === user.name && lead.status === 'Won')
          .reduce((sum, lead) => sum + lead.budget, 0)
        const pipelineCount = leads.filter((lead) => lead.assignedTo === user.name).length
        return {
          ...user,
          wonValue,
          pipelineCount,
        }
      })
      .sort((a, b) => b.wonValue - a.wonValue)
  }, [leads])

  const coreModules = modules.filter((item) => item.group === 'Core')
  const growthModules = modules.filter((item) => item.group === 'Growth')
  const opsModules = modules.filter((item) => item.group === 'Ops')

  function handleLogin() {
    const user = users.find((entry) => entry.email === loginEmail && entry.role === loginRole)
    if (!user) {
      setAuthError('No user found for this email and role.')
      return
    }
    localStorage.setItem(storage.user, JSON.stringify(user))
    localStorage.setItem(storage.token, 'mock-token')
    setCurrentUser(user)
    setAuthError('')
  }

  function handleLogout() {
    localStorage.removeItem(storage.user)
    localStorage.removeItem(storage.token)
    setCurrentUser(null)
    setActiveModule('dashboard')
  }

  if (!currentUser) {
    return (
      <main className="auth-layout">
        <section className="auth-panel">
          <p className="chip">AI Native CRM</p>
          <h1>Velara Command Center</h1>
          <p className="muted-text">
            Unified sales intelligence with smart lead scoring, multichannel workflows, and pipeline clarity.
          </p>

          <div className="auth-grid">
            <label>
              Work email
              <input
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                placeholder="name@velara.com"
              />
            </label>

            <label>
              Role
              <select value={loginRole} onChange={(event) => setLoginRole(event.target.value as Role)}>
                <option>Admin</option>
                <option>Sales</option>
              </select>
            </label>
          </div>

          {authError ? <p className="error-text">{authError}</p> : null}

          <button className="primary-btn" onClick={handleLogin}>
            Sign in
          </button>

          <p className="helper-text">
            Try: pranav@velara.com (Admin), sneha@velara.com (Sales), amit@velara.com (Sales)
          </p>
        </section>
      </main>
    )
  }

  const activeLabel = modules.find((item) => item.key === activeModule)?.label ?? 'Dashboard'

  return (
    <main className="crm-root">
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark">VC</div>
          <div>
            <p className="brand-title">Velara CRM</p>
            <p className="brand-subtitle">AI Native B2B Stack</p>
          </div>
          <button className="ghost-btn mobile-close" onClick={() => setIsSidebarOpen(false)}>
            Close
          </button>
        </div>

        <p className="nav-group-label">Core</p>
        {coreModules.map((item) => (
          <button
            key={item.key}
            className={`nav-btn ${activeModule === item.key ? 'active' : ''}`}
            onClick={() => {
              setActiveModule(item.key)
              setIsSidebarOpen(false)
            }}
          >
            <span className="nav-short">{item.short}</span>
            {item.label}
          </button>
        ))}

        <p className="nav-group-label">Growth</p>
        {growthModules.map((item) => (
          <button
            key={item.key}
            className={`nav-btn ${activeModule === item.key ? 'active' : ''}`}
            onClick={() => {
              setActiveModule(item.key)
              setIsSidebarOpen(false)
            }}
          >
            <span className="nav-short">{item.short}</span>
            {item.label}
          </button>
        ))}

        <p className="nav-group-label">Ops</p>
        {opsModules.map((item) => (
          <button
            key={item.key}
            className={`nav-btn ${activeModule === item.key ? 'active' : ''}`}
            onClick={() => {
              setActiveModule(item.key)
              setIsSidebarOpen(false)
            }}
          >
            <span className="nav-short">{item.short}</span>
            {item.label}
          </button>
        ))}
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button className="ghost-btn menu-btn" onClick={() => setIsSidebarOpen((state) => !state)}>
              Menu
            </button>
            <div>
              <p className="topbar-kicker">Command Center</p>
              <h2>{activeLabel}</h2>
            </div>
          </div>

          <div className="topbar-right">
            <input
              className="search"
              placeholder="Search leads, company, city"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              className="ghost-btn"
              onClick={() => setTheme((value) => (value === 'mist' ? 'sunset' : 'mist'))}
            >
              Theme: {theme}
            </button>
            <button className="ghost-btn" onClick={handleLogout}>
              Logout
            </button>
            <div className="user-pill">
              <span className="avatar-mini">{currentUser.avatar}</span>
              <span>
                {currentUser.name} ({currentUser.role})
              </span>
            </div>
          </div>
        </header>

        {activeModule === 'dashboard' ? (
          <>
            <section className="hero">
              <div>
                <h3>Revenue intelligence for your sales motion</h3>
                <p>
                  Combined workflow from both CRM versions: predictive scoring, multi-team visibility, and action-first pipeline tracking.
                </p>
              </div>
              <div className="hero-actions">
                <button className="primary-btn">Create Lead</button>
                <button className="ghost-btn">Open Calling Center</button>
              </div>
            </section>

            <section className="kpi-grid">
              <article className="kpi-card">
                <p>Total Leads</p>
                <h4>{metrics.totalLeads}</h4>
              </article>
              <article className="kpi-card">
                <p>Hot Leads</p>
                <h4>{metrics.hotLeads}</h4>
              </article>
              <article className="kpi-card">
                <p>Open Pipeline Value</p>
                <h4>{formatMoney(metrics.activeValue)}</h4>
              </article>
              <article className="kpi-card">
                <p>Win Rate</p>
                <h4>{metrics.winRate}%</h4>
              </article>
            </section>

            <section className="panel-grid">
              <article className="panel">
                <h4>Pipeline Stages</h4>
                <div className="pipeline-list">
                  {pipeline.map((stage) => {
                    const percent = Math.max(8, Math.round((stage.count / Math.max(leads.length, 1)) * 100))
                    return (
                      <div key={stage.status} className="pipeline-row">
                        <div className="pipeline-head">
                          <span>{stage.status}</span>
                          <span>
                            {stage.count} leads | {formatMoney(stage.value)}
                          </span>
                        </div>
                        <div className="meter">
                          <span style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>

              <article className="panel">
                <h4>Priority Reminders</h4>
                <div className="reminder-list">
                  {reminders.map((item) => (
                    <div key={item.id} className="reminder-item">
                      <div>
                        <p>{item.text}</p>
                        <small>{item.dueAt}</small>
                      </div>
                      <span className={`chip ${item.priority === 'High' ? 'chip-high' : 'chip-muted'}`}>
                        {item.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </>
        ) : null}

        {activeModule === 'leads' ? (
          <section className="panel">
            <div className="panel-head">
              <h4>Lead Intelligence Table</h4>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LeadStatus | 'All')}>
                <option>All</option>
                <option>New</option>
                <option>Contacted</option>
                <option>Qualified</option>
                <option>Negotiation</option>
                <option>Won</option>
              </select>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Status</th>
                    <th>AI Score</th>
                    <th>Budget</th>
                    <th>Owner</th>
                    <th>Prediction</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td>
                        <strong>{lead.name}</strong>
                        <small>{lead.city}</small>
                      </td>
                      <td>
                        {lead.company}
                        <small>{lead.industry}</small>
                      </td>
                      <td>
                        <span className={`pill ${statusTone(lead.status)}`}>{lead.status}</span>
                      </td>
                      <td>{lead.aiScore}</td>
                      <td>{formatMoney(lead.budget)}</td>
                      <td>{lead.assignedTo}</td>
                      <td className="prediction">{lead.aiPrediction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeModule === 'analytics' ? (
          <section className="panel-grid">
            <article className="panel">
              <h4>Revenue Health</h4>
              <div className="analytics-stack">
                <div>
                  <p>Total Pipeline</p>
                  <h3>{formatMoney(metrics.totalValue)}</h3>
                </div>
                <div>
                  <p>Conversion Confidence</p>
                  <h3>{metrics.winRate + 18}%</h3>
                </div>
                <div>
                  <p>AI Assisted Deals</p>
                  <h3>{Math.round((metrics.hotLeads / metrics.totalLeads) * 100)}%</h3>
                </div>
              </div>
            </article>

            <article className="panel">
              <h4>Top Performers</h4>
              <div className="leaderboard-list">
                {leaderboard.map((member, index) => (
                  <div key={member.id} className="leader-row">
                    <span>{index + 1}</span>
                    <div>
                      <p>{member.name}</p>
                      <small>{member.pipelineCount} active leads</small>
                    </div>
                    <strong>{formatMoney(member.wonValue || 0)}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {activeModule === 'team' ? (
          <section className="panel">
            <h4>Team Workspace</h4>
            <div className="team-grid">
              {users.map((member) => (
                <article key={member.id} className="team-card">
                  <div className="avatar-large">{member.avatar}</div>
                  <h5>{member.name}</h5>
                  <p>{member.role}</p>
                  <small>{member.email}</small>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeModule === 'settings' ? (
          <section className="panel settings-panel">
            <h4>System Settings</h4>
            <div className="setting-row">
              <div>
                <p>Theme Profile</p>
                <small>Switch between Mist and Sunset workspace style</small>
              </div>
              <button className="ghost-btn" onClick={() => setTheme((value) => (value === 'mist' ? 'sunset' : 'mist'))}>
                Toggle Theme
              </button>
            </div>

            <div className="setting-row">
              <div>
                <p>Automation Baseline</p>
                <small>Workflows and reminders are enabled by default</small>
              </div>
              <span className="pill tone-success">Enabled</span>
            </div>

            <div className="setting-row">
              <div>
                <p>CRM Mode</p>
                <small>Unified mode combining starter and production features</small>
              </div>
              <span className="pill tone-brand">Unified</span>
            </div>
          </section>
        ) : null}

        {!['dashboard', 'leads', 'analytics', 'team', 'settings'].includes(activeModule) ? (
          <section className="panel placeholder">
            <h4>{activeLabel}</h4>
            <p>
              This module shell is live and aligned to the unified CRM navigation. Next extension step is wiring it to dedicated API endpoints.
            </p>
          </section>
        ) : null}
      </section>
    </main>
  )
}

export default App
