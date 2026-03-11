# Velara CRM — AI-First CRM for Indian Businesses

> **The CRM that thinks, feels, and acts for you.**

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-purple?logo=vite)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## What is Velara CRM?

Velara CRM is an **AI-First Customer Relationship Management** platform built specifically for Indian businesses and SMBs. Unlike traditional CRMs that bolt AI on as an afterthought, Velara is designed with AI as its operating system — automating admin, surfacing emotional context, and acting autonomously so your team can focus on building real relationships.

**Built for the Mattr Platform | March 2026**

---

## Key Features

### Core CRM
- **Contact & Account Management** — Unified profiles with auto-enrichment, activity timeline, smart deduplication
- **Lead Pipeline** — Visual Kanban pipeline with AI-powered deal health scoring
- **Omnichannel Inbox** — Email, WhatsApp, SMS, and calls in one unified view
- **Reminders & Tasks** — Smart task creation auto-extracted from conversations
- **Documents** — Centralized document management linked to deals and contacts
- **Analytics Dashboard** — Real-time pipeline metrics, team performance, and revenue forecasting
- **Leaderboard** — Gamified sales team performance tracking
- **Social Media** — Monitor and engage social channels linked to CRM contacts

### AI-Powered Intelligence
- **AI Assistant (VelaraChat)** — Conversational interface to query your CRM in plain English
- **Predictive Lead Scoring** — ML-based scoring that explains *why* a lead ranks high or low
- **Emotional Context Engine** — Tracks relationship sentiment over time across all channels
- **AI Meeting Briefs** — Pre-call summaries with relationship context and suggested openers
- **Smart Follow-ups** — AI drafts and schedules follow-ups based on deal stage and engagement
- **Calling Intelligence** — Built-in call widget with AI-assisted call flows

### India-Native Features
- WhatsApp Business integration as a first-class channel
- Mobile-first Progressive Web App (PWA) design
- Role-based access control (Admin, Manager, Sales Rep)
- Lightweight, fast — optimized for low-bandwidth environments

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 19 + TypeScript |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS 4 |
| Routing | React Router DOM 7 |
| Charts & Analytics | Recharts 3.8 |
| Icons | Lucide React |
| State Persistence | LocalStorage (custom hooks) |
| Linting | ESLint + TypeScript ESLint |

---

## Project Structure

```
velara-crm/
├── public/              # Static assets
├── src/
│   ├── assets/          # Images and icons
│   ├── components/      # Reusable UI components
│   │   ├── AIAssistant.tsx
│   │   ├── CallWidget.tsx
│   │   ├── Layout.tsx
│   │   ├── Notifications.tsx
│   │   └── Sidebar.tsx
│   ├── data/
│   │   └── mockData.ts  # Seed data for demo
│   ├── hooks/
│   │   └── useLocalStorage.ts
│   ├── pages/
│   │   ├── Analytics.tsx
│   │   ├── Calling.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Documents.tsx
│   │   ├── Inbox.tsx
│   │   ├── LeadPipeline.tsx
│   │   ├── Leaderboard.tsx
│   │   ├── Login.tsx
│   │   ├── Reminders.tsx
│   │   ├── Settings.tsx
│   │   └── SocialMedia.tsx
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Helper utilities
│   ├── App.tsx          # Root component + routing
│   ├── App.css
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js >= 18
- npm >= 9

### Installation

```bash
# Clone the repository
git clone https://github.com/pranavsinghal77/velara-crm.git
cd velara-crm

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@velara.ai | admin123 |
| Sales Rep | rep@velara.ai | rep123 |

---

## Screenshots

> Dashboard with AI Morning Briefing, pipeline metrics, and real-time activity feed.

---

## Roadmap

- [ ] WhatsApp Business API live integration
- [ ] Real AI backend (OpenAI / Gemini API)
- [ ] GST-native invoicing module
- [ ] Mobile app (React Native)
- [ ] Vernacular language support (Hindi, Tamil, Telugu)
- [ ] Agentic AI Sales Agent (autonomous outreach)
- [ ] Relationship Memory Graph
- [ ] Vercel/Netlify deployment with CI/CD

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

---

## Author

**Pranav Singhal** — [@pranavsinghal77](https://github.com/pranavsinghal77)

---

## License

MIT © 2026 Velara CRM
