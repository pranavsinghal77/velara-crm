/**
 * Demo data seeder.
 *
 * Run explicitly:  npm run db:seed
 *
 * This replaces the old `GET /api/seed` endpoint, which was unauthenticated,
 * destructive (`upsert` with `update: <seed row>`, so it overwrote real edits),
 * and called automatically by the browser whenever the lead list came back
 * empty. Seeding is an operator action, not something a web request can
 * trigger.
 *
 * It is additive: existing rows are left alone. Pass --reset to wipe the demo
 * organisation first.
 */
import crypto from 'crypto';
import {
  LeadStatus,
  PlanTier,
  Priority,
  PrismaClient,
  Role,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool, { schema: process.env.DB_SCHEMA || 'public' }),
});

const ORG_SLUG = 'velara-demo';
const RESET = process.argv.includes('--reset');

/**
 * Passwords come from the environment, or are generated and printed once.
 * Nothing is hardcoded, so a seeded deployment does not ship with a password
 * that is also sitting in the git history.
 */
function resolvePassword(): { password: string; generated: boolean } {
  const fromEnv = process.env.SEED_PASSWORD;
  if (fromEnv) {
    if (fromEnv.length < 12) {
      throw new Error('SEED_PASSWORD must be at least 12 characters');
    }
    return { password: fromEnv, generated: false };
  }
  return { password: crypto.randomBytes(12).toString('base64url'), generated: true };
}

function daysFromNow(days: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function daysAgo(days: number): Date {
  return daysFromNow(-days);
}

async function main() {
  const { password, generated } = resolvePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  if (RESET) {
    const existing = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
    if (existing) {
      // Cascades clear every child row for this org only.
      await prisma.organization.delete({ where: { id: existing.id } });
      console.log(`Removed existing "${ORG_SLUG}" organisation`);
    }
  }

  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: {},
    create: { name: 'Velara Demo Co', slug: ORG_SLUG },
  });

  // Every organisation must have a subscription: it is what makes the tenant
  // metered and billable. Creating one is an invariant of tenant creation, not
  // something that waits for the first usage event.
  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + 30 * 86_400_000);
  await prisma.subscription.upsert({
    where: { orgId: org.id },
    update: {},
    create: {
      orgId: org.id,
      tier: PlanTier.Business,
      status: SubscriptionStatus.Active,
      seats: 50,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  });

  // --- Users ---------------------------------------------------------------

  const userSpecs = [
    { name: 'Pranav Singhal', email: 'admin@velara.com', role: Role.Admin, permissions: ['all'] },
    {
      name: 'Rahul Joshi',
      email: 'manager@velara.com',
      role: Role.Manager,
      permissions: ['leads', 'inbox', 'reminders', 'analytics'],
    },
    {
      name: 'Sneha Kapoor',
      email: 'sneha@velara.com',
      role: Role.Sales,
      permissions: ['leads', 'inbox', 'reminders'],
    },
    {
      name: 'Karan Malhotra',
      email: 'karan@velara.com',
      role: Role.Sales,
      permissions: ['leads', 'inbox'],
    },
    { name: 'Aditi Rao', email: 'aditi@velara.com', role: Role.Viewer, permissions: ['leads'] },
  ];

  const users = [];
  for (const spec of userSpecs) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      // Never reset a password that an operator may have changed since.
      update: { name: spec.name, role: spec.role, permissions: spec.permissions },
      create: { ...spec, orgId: org.id, passwordHash, isActive: true },
    });
    users.push(user);
  }

  const [admin, manager, sneha, karan] = users;
  if (!admin || !manager || !sneha || !karan) throw new Error('User seeding failed');

  // --- Leads ---------------------------------------------------------------

  const leadSpecs = [
    {
      name: 'Rajesh Kumar',
      email: 'rajesh@bharatmanufacturing.in',
      phone: '+919876543210',
      company: 'Bharat Manufacturing Ltd',
      designation: 'Operations Head',
      city: 'Pune',
      source: 'JustDial',
      status: LeadStatus.Negotiation,
      aiScore: 92,
      isHot: true,
      budget: '4.5L',
      tags: ['manufacturing', 'enterprise'],
      notes: 'Needs Tally integration and 60-user rollout by Q2.',
      ownerId: sneha.id,
      lastContactAt: daysAgo(1),
    },
    {
      name: 'Priya Sharma',
      email: 'priya@sharmatextiles.com',
      phone: '+919812345678',
      company: 'Sharma Textiles',
      designation: 'Director',
      city: 'Surat',
      source: 'IndiaMART',
      status: LeadStatus.Qualified,
      aiScore: 78,
      isHot: true,
      budget: '2.8L',
      tags: ['textiles'],
      notes: 'Comparing against Zoho. Price-sensitive.',
      ownerId: sneha.id,
      lastContactAt: daysAgo(3),
    },
    {
      name: 'Arun Nair',
      email: 'arun@keralalogistics.co.in',
      phone: '+919845001122',
      company: 'Kerala Logistics',
      designation: 'CTO',
      city: 'Kochi',
      source: 'Website',
      status: LeadStatus.Contacted,
      aiScore: 64,
      isHot: false,
      budget: '1.2L',
      tags: ['logistics'],
      notes: 'Wants WhatsApp broadcast for driver coordination.',
      ownerId: karan.id,
      lastContactAt: daysAgo(6),
    },
    {
      name: 'Meera Iyer',
      email: 'meera@southernretail.in',
      phone: '+919900112233',
      company: 'Southern Retail Group',
      designation: 'VP Sales',
      city: 'Bengaluru',
      source: 'Referral',
      status: LeadStatus.Won,
      aiScore: 95,
      isHot: false,
      budget: '6L',
      tags: ['retail', 'enterprise'],
      notes: 'Closed annual contract with 20% prepay discount.',
      ownerId: manager.id,
      lastContactAt: daysAgo(9),
    },
    {
      name: 'Vikram Desai',
      email: 'vikram@desaiagro.com',
      phone: '+919723344556',
      company: 'Desai Agro Exports',
      designation: 'Owner',
      city: 'Ahmedabad',
      source: 'WhatsApp',
      status: LeadStatus.New,
      aiScore: 55,
      isHot: false,
      budget: '90000',
      tags: ['agro', 'smb'],
      notes: 'Inbound WhatsApp enquiry, not yet qualified.',
      ownerId: karan.id,
      lastContactAt: null,
    },
    {
      name: 'Fatima Sheikh',
      email: 'fatima@sheikhpharma.in',
      phone: '+919833445566',
      company: 'Sheikh Pharma Distributors',
      designation: 'GM',
      city: 'Mumbai',
      source: 'IndiaMART',
      status: LeadStatus.Lost,
      aiScore: 38,
      isHot: false,
      budget: '1.5L',
      tags: ['pharma'],
      notes: 'Went with an incumbent vendor. Revisit next fiscal.',
      ownerId: sneha.id,
      lastContactAt: daysAgo(30),
    },
  ];

  const parseBudgetToLakhs = (budget?: string) => {
    if (!budget) return 0;
    const n = Number.parseFloat(budget.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n)) return 0;
    const l = budget.toLowerCase();
    if (l.includes('cr')) return n * 100;
    if (l.includes('l')) return n;
    return n / 100_000;
  };

  const existingLeadEmails = new Set(
    (
      await prisma.lead.findMany({ where: { orgId: org.id }, select: { email: true } })
    ).map((l) => l.email)
  );

  const leads = [];
  for (const spec of leadSpecs) {
    if (existingLeadEmails.has(spec.email)) {
      const found = await prisma.lead.findFirst({
        where: { orgId: org.id, email: spec.email },
      });
      if (found) leads.push(found);
      continue;
    }
    leads.push(
      await prisma.lead.create({
        data: {
          ...spec,
          orgId: org.id,
          budgetLakhs: parseBudgetToLakhs(spec.budget),
          aiScoreBreakdown: {
            sourceQuality: Math.round(spec.aiScore * 0.4),
            recency: Math.round(spec.aiScore * 0.35),
            profileCompleteness: Math.round(spec.aiScore * 0.25),
          },
        },
      })
    );
  }

  const [rajesh, priya] = leads;

  // --- Messages, reminders, notifications ----------------------------------

  if ((await prisma.message.count({ where: { orgId: org.id } })) === 0 && rajesh && priya) {
    await prisma.message.createMany({
      data: [
        {
          orgId: org.id,
          leadId: rajesh.id,
          authorId: sneha.id,
          direction: 'sent',
          channel: 'WhatsApp',
          content:
            'Namaste Rajesh ji, Sneha from Velara here regarding your JustDial enquiry about CRM for manufacturing.',
          isRead: true,
          sentAt: daysAgo(2),
        },
        {
          orgId: org.id,
          leadId: rajesh.id,
          direction: 'received',
          channel: 'WhatsApp',
          content:
            'Yes, please share pricing for 60 users. We also need Tally integration.',
          isRead: true,
          intent: 'Sales',
          urgency: 'High',
          sentAt: daysAgo(1),
        },
        {
          orgId: org.id,
          leadId: priya.id,
          direction: 'received',
          channel: 'Email',
          content: 'What is your best price? Zoho quoted us significantly lower.',
          isRead: false,
          intent: 'Sales',
          urgency: 'Medium',
          sentAt: daysAgo(1),
        },
      ],
    });
  }

  if ((await prisma.reminder.count({ where: { orgId: org.id } })) === 0 && rajesh && priya) {
    await prisma.reminder.createMany({
      data: [
        {
          orgId: org.id,
          leadId: rajesh.id,
          leadName: rajesh.name,
          ownerId: sneha.id,
          task: 'Send 60-user proposal with GST breakdown',
          dueAt: daysFromNow(0, 15, 30),
          priority: Priority.High,
        },
        {
          orgId: org.id,
          leadId: priya.id,
          leadName: priya.name,
          ownerId: sneha.id,
          task: 'Counter Zoho pricing with annual discount',
          dueAt: daysFromNow(1, 11, 0),
          priority: Priority.High,
        },
        {
          orgId: org.id,
          leadName: 'Kerala Logistics',
          ownerId: karan.id,
          task: 'Demo WhatsApp broadcast module',
          dueAt: daysFromNow(4, 14, 0),
          priority: Priority.Medium,
        },
        {
          orgId: org.id,
          leadName: 'Desai Agro Exports',
          ownerId: karan.id,
          task: 'Qualification call - overdue',
          dueAt: daysAgo(2),
          priority: Priority.Low,
        },
      ],
    });
  }

  if ((await prisma.notification.count({ where: { orgId: org.id } })) === 0) {
    await prisma.notification.createMany({
      data: [
        {
          orgId: org.id,
          title: 'New hot lead',
          message: 'Rajesh Kumar scored 92 and moved to Negotiation.',
          type: 'lead',
        },
        {
          orgId: org.id,
          title: 'Reminder due today',
          message: 'Send the 60-user proposal to Bharat Manufacturing.',
          type: 'reminder',
          userId: sneha.id,
        },
      ],
    });
  }

  if ((await prisma.fieldCampaign.count({ where: { orgId: org.id } })) === 0) {
    const campaign = await prisma.fieldCampaign.create({
      data: {
        orgId: org.id,
        name: 'Q1 Retail Visibility Drive',
        description: 'In-store branding audit across Tier-2 cities.',
        startDate: daysAgo(10),
        endDate: daysFromNow(20),
        budget: 450000,
        status: 'Active',
      },
    });

    await prisma.fieldTask.createMany({
      data: [
        {
          orgId: org.id,
          campaignId: campaign.id,
          title: 'Install banner - Nashik outlet',
          location: 'Nashik, MH',
          status: 'Pending',
          assignedToId: karan.id,
        },
        {
          orgId: org.id,
          campaignId: campaign.id,
          title: 'Shelf audit - Indore outlet',
          location: 'Indore, MP',
          status: 'Pending',
          assignedToId: karan.id,
        },
      ],
    });
  }

  // --- Report --------------------------------------------------------------

  const counts = {
    users: await prisma.user.count({ where: { orgId: org.id } }),
    leads: await prisma.lead.count({ where: { orgId: org.id } }),
    messages: await prisma.message.count({ where: { orgId: org.id } }),
    reminders: await prisma.reminder.count({ where: { orgId: org.id } }),
  };

  console.log(`\nSeeded organisation "${org.name}" (${org.slug})`);
  console.table(counts);

  if (generated) {
    console.log(
      [
        '',
        '  Demo accounts were created with this generated password:',
        '',
        `      ${password}`,
        '',
        '  It is shown once and is not stored anywhere else. Set SEED_PASSWORD',
        '  in your environment to choose your own.',
        '',
        '  Accounts: admin@velara.com (Admin), manager@velara.com (Manager),',
        '            sneha@velara.com / karan@velara.com (Sales),',
        '            aditi@velara.com (Viewer)',
        '',
      ].join('\n')
    );
  } else {
    console.log('\n  Demo accounts use the password from SEED_PASSWORD.\n');
  }
}

main()
  .catch((err) => {
    console.error('\nSeeding failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
