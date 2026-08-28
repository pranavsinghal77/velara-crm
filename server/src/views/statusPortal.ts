export function renderStatusPortal(stats: {
  uptime: number;
  dbStatus: string;
  leadCount: number;
  port: number | string;
}) {
  const uptimeHours = Math.floor(stats.uptime / 3600);
  const uptimeMinutes = Math.floor((stats.uptime % 3600) / 60);
  const uptimeSeconds = Math.floor(stats.uptime % 60);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Velara CRM — Enterprise Backend API & System Hub</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: radial-gradient(circle at 50% 0%, #0f172a 0%, #020617 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
    }
    .container {
      max-width: 960px;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .header {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(12px);
      padding: 32px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 20px;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
    }
    .logo-badge {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .icon-box {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: 0 8px 16px rgba(59, 130, 246, 0.4);
    }
    .title-area h1 {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(to right, #ffffff, #94a3b8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .title-area p {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 4px;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    .card {
      background: rgba(30, 41, 59, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(8px);
      padding: 20px;
      border-radius: 16px;
      transition: all 0.2s;
    }
    .card:hover {
      border-color: rgba(59, 130, 246, 0.4);
      transform: translateY(-2px);
    }
    .card-label {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-value {
      font-size: 18px;
      font-weight: 700;
      color: #f1f5f9;
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card-sub {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 4px;
    }
    .endpoints-section {
      background: rgba(30, 41, 59, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 28px;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .endpoint-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .endpoint-item {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      transition: all 0.2s;
    }
    .endpoint-item:hover {
      background: rgba(15, 23, 42, 0.9);
      border-color: rgba(59, 130, 246, 0.3);
    }
    .endpoint-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .method {
      font-size: 10px;
      font-weight: 800;
      padding: 4px 8px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }
    .get { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
    .post { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .path { color: #f8fafc; font-weight: 600; }
    .endpoint-desc { color: #94a3b8; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; }
    .test-btn {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #93c5fd;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .test-btn:hover {
      background: #3b82f6;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }
    .btn-launch {
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: #ffffff;
      font-weight: 700;
      padding: 10px 20px;
      border-radius: 12px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      transition: all 0.2s;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
    }
    .btn-launch:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.6);
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="logo-badge">
        <div class="icon-box">⚡</div>
        <div class="title-area">
          <h1>Velara CRM — Enterprise Backend Hub</h1>
          <p>Production REST API • Socket.IO Gateway • Gemini AI 1.5 Engine</p>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="status-pill">
          <div class="pulse-dot"></div>
          SERVER HEALTHY (PORT ${stats.port})
        </div>
        <a href="http://localhost:5173" target="_blank" class="btn-launch">
          Open Frontend ↗
        </a>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid">
      <div class="card">
        <div class="card-label">Database Engine</div>
        <div class="card-value">🐘 PostgreSQL</div>
        <div class="card-sub">Supabase Pooler (${stats.dbStatus})</div>
      </div>
      <div class="card">
        <div class="card-label">Active Leads Synced</div>
        <div class="card-value">📈 ${stats.leadCount} Records</div>
        <div class="card-sub">Hydrated in Database</div>
      </div>
      <div class="card">
        <div class="card-label">AI Intelligence</div>
        <div class="card-value">🧠 Gemini 1.5 Flash</div>
        <div class="card-sub">ZeroBT Grievance & RAG</div>
      </div>
      <div class="card">
        <div class="card-label">Server Uptime</div>
        <div class="card-value">⏱️ ${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s</div>
        <div class="card-sub">Node.js Express + TS</div>
      </div>
    </div>

    <!-- Active API Endpoints -->
    <div class="endpoints-section">
      <div class="section-header">
        <div class="section-title">
          <span>📡</span>
          <span>Core REST API Endpoints</span>
        </div>
        <span style="font-size: 12px; color: #94a3b8;">JSON API Spec ready</span>
      </div>

      <div class="endpoint-list">
        <div class="endpoint-item">
          <div class="endpoint-left">
            <span class="method get">GET</span>
            <span class="path">/api/leads</span>
            <span class="endpoint-desc">• Full PostgreSQL lead pipeline with AI scores</span>
          </div>
          <a href="/api/leads" target="_blank" class="test-btn">Test ↗</a>
        </div>

        <div class="endpoint-item">
          <div class="endpoint-left">
            <span class="method get">GET</span>
            <span class="path">/api/analytics</span>
            <span class="endpoint-desc">• Live revenue & deal velocity analytics</span>
          </div>
          <a href="/api/analytics" target="_blank" class="test-btn">Test ↗</a>
        </div>

        <div class="endpoint-item">
          <div class="endpoint-left">
            <span class="method get">GET</span>
            <span class="path">/api/messages</span>
            <span class="endpoint-desc">• Omnichannel WhatsApp/SMS message threads</span>
          </div>
          <a href="/api/messages" target="_blank" class="test-btn">Test ↗</a>
        </div>

        <div class="endpoint-item">
          <div class="endpoint-left">
            <span class="method post">POST</span>
            <span class="path">/api/ai/sentiment-analysis</span>
            <span class="endpoint-desc">• ZeroBT Frustration Radar (0-100 score)</span>
          </div>
          <span style="font-size: 11px; color: #64748b; font-family: sans-serif;">JSON Body</span>
        </div>

        <div class="endpoint-item">
          <div class="endpoint-left">
            <span class="method post">POST</span>
            <span class="path">/api/ai/escalate</span>
            <span class="endpoint-desc">• 8-Tier Multi-Level Executive Dossier Generator</span>
          </div>
          <span style="font-size: 11px; color: #64748b; font-family: sans-serif;">JSON Body</span>
        </div>

        <div class="endpoint-item">
          <div class="endpoint-left">
            <span class="method post">POST</span>
            <span class="path">/api/ai/knowledge-query</span>
            <span class="endpoint-desc">• Knowledge Base Policy RAG Copilot</span>
          </div>
          <span style="font-size: 11px; color: #64748b; font-family: sans-serif;">JSON Body</span>
        </div>

        <div class="endpoint-item">
          <div class="endpoint-left">
            <span class="method post">POST</span>
            <span class="path">/api/seed</span>
            <span class="endpoint-desc">• 1-Click Database Hydration & Seeder</span>
          </div>
          <a href="/health" target="_blank" class="test-btn">Health ↗</a>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; color: #64748b; font-size: 12px; margin-top: 10px;">
      Velara Technologies Pvt Ltd • Enterprise CRM Backend Gateway v0.1.0
    </div>
  </div>
</body>
</html>`;
}
