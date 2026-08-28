import { Request, Response } from 'express';
import { prisma } from '../config/db';

export const seedDatabase = async (req: Request, res: Response) => {
  try {
    // Clear and repopulate cleanly if requested or if empty
    const leadCount = await prisma.lead.count();
    if (leadCount > 0 && !req.query.force) {
      return res.json({ message: 'Database already has data', count: leadCount });
    }

    // 1. Seed Users
    const users = [
      {
        id: 'u1',
        name: 'Pranav Singhal',
        email: 'admin@velara.com',
        password: 'password123',
        role: 'Admin',
        isActive: true,
        permissions: ['all'],
      },
      {
        id: 'u2',
        name: 'Rahul Joshi',
        email: 'manager@velara.com',
        password: 'password123',
        role: 'Manager',
        isActive: true,
        permissions: ['leads', 'inbox', 'reminders', 'analytics'],
      },
      {
        id: 'u3',
        name: 'Sneha Kapoor',
        email: 'sneha@velara.com',
        password: 'password123',
        role: 'Sales',
        isActive: true,
        permissions: ['leads', 'inbox', 'reminders'],
      },
      {
        id: 'u4',
        name: 'Karan Malhotra',
        email: 'karan@velara.com',
        password: 'password123',
        role: 'Sales',
        isActive: true,
        permissions: ['leads', 'inbox', 'reminders'],
      },
    ];

    for (const u of users) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: u,
        create: u,
      });
    }

    // 2. Seed Leads
    const mockLeads = [
      {
        id: 'lead_1',
        name: 'Rajesh Kumar',
        phone: '+91 98765 43210',
        email: 'rajesh.kumar@gmail.com',
        source: 'JustDial',
        status: 'Qualified',
        aiScore: 92,
        aiScoreBreakdown: { sourceQuality: 30, recency: 32, profileCompleteness: 30 },
        lastContact: '2026-08-27',
        isHot: true,
        tags: ['High Value', 'Manufacturing', 'Urgent'],
        notes: 'Interested in full CRM suite for his manufacturing unit. Wants integration with Tally and GST portal. Decision expected this week.',
        assignedTo: 'Sneha Kapoor',
        createdAt: '2026-08-20',
        company: 'Kumar Enterprises',
        designation: 'Director',
        city: 'Mumbai',
        budget: '₹5L',
      },
      {
        id: 'lead_2',
        name: 'Priya Sharma',
        phone: '+91 87654 32109',
        email: 'priya.sharma@outlook.com',
        source: 'IndiaMART',
        status: 'Contacted',
        aiScore: 85,
        aiScoreBreakdown: { sourceQuality: 28, recency: 30, profileCompleteness: 27 },
        lastContact: '2026-08-26',
        isHot: true,
        tags: ['Textiles', 'B2B', 'Demo Scheduled'],
        notes: 'Runs a large textile export business in Karol Bagh. Needs multi-user access and WhatsApp integration. Demo booked for Thursday.',
        assignedTo: 'Karan Malhotra',
        createdAt: '2026-08-21',
        company: 'Sharma Textiles',
        designation: 'MD',
        city: 'Delhi',
        budget: '₹3L',
      },
      {
        id: 'lead_3',
        name: 'Amit Patel',
        phone: '+91 76543 21098',
        email: 'amit.patel@yahoo.com',
        source: 'Website',
        status: 'New',
        aiScore: 78,
        aiScoreBreakdown: { sourceQuality: 25, recency: 28, profileCompleteness: 25 },
        lastContact: '2026-08-25',
        isHot: true,
        tags: ['Construction', 'New Enquiry', 'Gujarat'],
        notes: 'Filled contact form on website. Looking for project management + CRM combo. Has 50+ workforce.',
        assignedTo: 'Sneha Kapoor',
        createdAt: '2026-08-22',
        company: 'Patel Constructions',
        designation: 'Owner',
        city: 'Ahmedabad',
        budget: '₹2L',
      },
      {
        id: 'lead_4',
        name: 'Sunita Verma',
        phone: '+91 65432 10987',
        email: 'sunita.v@gmail.com',
        source: 'WhatsApp',
        status: 'Negotiation',
        aiScore: 71,
        aiScoreBreakdown: { sourceQuality: 22, recency: 26, profileCompleteness: 23 },
        lastContact: '2026-08-26',
        isHot: false,
        tags: ['Legal', 'Negotiation', 'Returning Client'],
        notes: 'Partner at a law firm needing client management system. Comparing us with Zoho. Price negotiation in progress.',
        assignedTo: 'Karan Malhotra',
        createdAt: '2026-08-18',
        company: 'Verma Associates',
        designation: 'Partner',
        city: 'Mumbai',
        budget: '₹4L',
      },
      {
        id: 'lead_5',
        name: 'Vikram Singh',
        phone: '+91 54321 09876',
        email: 'vikram.s@gmail.com',
        source: 'JustDial',
        status: 'New',
        aiScore: 65,
        aiScoreBreakdown: { sourceQuality: 22, recency: 22, profileCompleteness: 21 },
        lastContact: '2026-08-24',
        isHot: false,
        tags: ['IT Services', 'Startup', 'Bangalore'],
        notes: 'Runs a mid-size IT services company. Exploring CRM options for the first time. Asked for a feature comparison sheet.',
        assignedTo: 'Sneha Kapoor',
        createdAt: '2026-08-19',
        company: 'Singh Technologies',
        designation: 'CEO',
        city: 'Bangalore',
        budget: '₹1.5L',
      },
      {
        id: 'lead_6',
        name: 'Meera Nair',
        phone: '+91 43210 98765',
        email: 'meera.n@gmail.com',
        source: 'IndiaMART',
        status: 'Contacted',
        aiScore: 58,
        aiScoreBreakdown: { sourceQuality: 20, recency: 18, profileCompleteness: 20 },
        lastContact: '2026-08-23',
        isHot: false,
        tags: ['Exports', 'Chennai', 'Follow-up Needed'],
        notes: 'Export business dealing in spices and commodities. Needs multi-currency support and email campaign features.',
        assignedTo: 'Karan Malhotra',
        createdAt: '2026-08-20',
        company: 'Nair Exports',
        designation: 'Director',
        city: 'Chennai',
        budget: '₹2.5L',
      },
      {
        id: 'lead_7',
        name: 'Arjun Mehta',
        phone: '+91 32109 87654',
        email: 'arjun.m@gmail.com',
        source: 'Referral',
        status: 'Won',
        aiScore: 88,
        aiScoreBreakdown: { sourceQuality: 30, recency: 29, profileCompleteness: 29 },
        lastContact: '2026-08-27',
        isHot: true,
        tags: ['High Value', 'Real Estate', 'Deal Closed'],
        notes: 'Closed ₹6L annual deal. Signed up for enterprise plan with API access. Referred by existing client from Pune.',
        assignedTo: 'Sneha Kapoor',
        createdAt: '2026-08-15',
        company: 'Mehta Group',
        designation: 'Chairman',
        city: 'Pune',
        budget: '₹6L',
      },
      {
        id: 'lead_8',
        name: 'Kavya Reddy',
        phone: '+91 21098 76543',
        email: 'kavya.r@gmail.com',
        source: 'WhatsApp',
        status: 'Lost',
        aiScore: 35,
        aiScoreBreakdown: { sourceQuality: 12, recency: 10, profileCompleteness: 13 },
        lastContact: '2026-08-14',
        isHot: false,
        tags: ['Retail', 'Lost Deal', 'Budget Issue'],
        notes: 'Chose a cheaper alternative. Budget was the primary concern. Small retail shop with 5 employees. May revisit next quarter.',
        assignedTo: 'Karan Malhotra',
        createdAt: '2026-08-10',
        company: 'Reddy Retail',
        designation: 'Manager',
        city: 'Hyderabad',
        budget: '₹1L',
      },
      {
        id: 'lead_9',
        name: 'Rohit Gupta',
        phone: '+91 11987 65432',
        email: 'rohit.g@gmail.com',
        source: 'Website',
        status: 'New',
        aiScore: 55,
        aiScoreBreakdown: { sourceQuality: 18, recency: 19, profileCompleteness: 18 },
        lastContact: '2026-08-25',
        isHot: false,
        tags: ['Trading', 'Rajasthan', 'Small Business'],
        notes: 'Wholesale trader in Jaipur dealing in hardware supplies. Wants basic lead tracking and invoicing features.',
        assignedTo: 'Sneha Kapoor',
        createdAt: '2026-08-22',
        company: 'Gupta Traders',
        designation: 'Owner',
        city: 'Jaipur',
        budget: '₹1L',
      },
      {
        id: 'lead_10',
        name: 'Anita Desai',
        phone: '+91 99876 54321',
        email: 'anita.d@gmail.com',
        source: 'IndiaMART',
        status: 'Qualified',
        aiScore: 80,
        aiScoreBreakdown: { sourceQuality: 27, recency: 27, profileCompleteness: 26 },
        lastContact: '2026-08-27',
        isHot: true,
        tags: ['Diamonds', 'Surat', 'High Value'],
        notes: 'Diamond export firm in Surat. Needs CRM with advanced contact management and international calling support. Very interested.',
        assignedTo: 'Karan Malhotra',
        createdAt: '2026-08-23',
        company: 'Desai Diamonds',
        designation: 'Director',
        city: 'Surat',
        budget: '₹3.5L',
      },
      {
        id: 'lead_11',
        name: 'Manoj Tiwari',
        phone: '+91 88765 43210',
        email: 'manoj.t@gmail.com',
        source: 'JustDial',
        status: 'Contacted',
        aiScore: 62,
        aiScoreBreakdown: { sourceQuality: 20, recency: 22, profileCompleteness: 20 },
        lastContact: '2026-08-26',
        isHot: false,
        tags: ['Logistics', 'UP', 'Fleet Management'],
        notes: 'Logistics company with 30+ trucks. Wants CRM integrated with GPS tracking and driver management. Initial call done.',
        assignedTo: 'Sneha Kapoor',
        createdAt: '2026-08-21',
        company: 'Tiwari Logistics',
        designation: 'MD',
        city: 'Lucknow',
        budget: '₹2L',
      },
      {
        id: 'lead_12',
        name: 'Pooja Iyer',
        phone: '+91 77654 32109',
        email: 'pooja.i@gmail.com',
        source: 'Referral',
        status: 'New',
        aiScore: 74,
        aiScoreBreakdown: { sourceQuality: 26, recency: 24, profileCompleteness: 24 },
        lastContact: '2026-08-25',
        isHot: false,
        tags: ['Textiles', 'South India', 'Referral Lead'],
        notes: 'Referred by Arjun Mehta. Textile manufacturer in Coimbatore exporting to Middle East. Looking for end-to-end sales pipeline tool.',
        assignedTo: 'Karan Malhotra',
        createdAt: '2026-08-24',
        company: 'Iyer Textiles',
        designation: 'CEO',
        city: 'Coimbatore',
        budget: '₹2.8L',
      },
    ];

    for (const lead of mockLeads) {
      await prisma.lead.upsert({
        where: { id: lead.id },
        update: lead,
        create: lead,
      });
    }

    // 3. Seed Messages
    const mockMessages = [
      {
        id: 'msg_1_1',
        leadId: 'lead_1',
        content: 'Namaste Rajesh ji, this is Sneha from Velara CRM. We noticed your enquiry on JustDial regarding CRM solutions for manufacturing.',
        sender: 'sent',
        channel: 'WhatsApp',
        isRead: true,
        isAISuggested: false,
        timestamp: new Date('2026-08-25T10:30:00Z'),
      },
      {
        id: 'msg_1_2',
        leadId: 'lead_1',
        content: 'Haan Sneha ji, we are looking for a complete solution. Currently using Excel sheets and managing 200+ clients. Can you tell me about Tally integration?',
        sender: 'received',
        channel: 'WhatsApp',
        isRead: true,
        isAISuggested: false,
        timestamp: new Date('2026-08-25T10:35:00Z'),
      },
      {
        id: 'msg_1_3',
        leadId: 'lead_1',
        content: 'Absolutely! We have direct Tally ERP 9 and TallyPrime integration. It syncs invoices, payments, and client data automatically.',
        sender: 'sent',
        channel: 'WhatsApp',
        isRead: true,
        isAISuggested: true,
        timestamp: new Date('2026-08-25T10:40:00Z'),
      },
      {
        id: 'msg_2_1',
        leadId: 'lead_2',
        content: 'Dear Priya ji, Thank you for your enquiry on IndiaMART. Sharma Textiles can benefit greatly from our omnichannel communication hub.',
        sender: 'sent',
        channel: 'Email',
        isRead: true,
        isAISuggested: false,
        timestamp: new Date('2026-08-26T11:00:00Z'),
      },
      {
        id: 'msg_2_2',
        leadId: 'lead_2',
        content: 'Hi Karan, We have a team of 15 sales executives and need role-based access. Also interested in WhatsApp broadcast.',
        sender: 'received',
        channel: 'Email',
        isRead: true,
        isAISuggested: false,
        timestamp: new Date('2026-08-26T11:20:00Z'),
      },
    ];

    for (const msg of mockMessages) {
      await prisma.message.upsert({
        where: { id: msg.id },
        update: msg,
        create: msg,
      });
    }

    // 4. Seed Reminders
    const mockReminders = [
      {
        id: 'rem_1',
        leadId: 'lead_1',
        leadName: 'Rajesh Kumar',
        task: 'Call Rajesh Kumar — HOT lead, follow up on Tally integration and send enterprise proposal.',
        dueDate: '2026-08-28',
        dueTime: '10:00',
        isToday: true,
        isTomorrow: false,
        isCompleted: false,
        priority: 'High',
        type: 'AI-Generated',
      },
      {
        id: 'rem_2',
        leadId: 'lead_2',
        leadName: 'Priya Sharma',
        task: 'Send customised proposal to Priya Sharma with WhatsApp integration pricing details.',
        dueDate: '2026-08-29',
        dueTime: '11:00',
        isToday: false,
        isTomorrow: true,
        isCompleted: false,
        priority: 'Medium',
        type: 'Manual',
      },
      {
        id: 'rem_3',
        leadId: 'lead_3',
        leadName: 'Amit Patel',
        task: 'Share 3-minute video walkthrough of project pipeline view for Patel Constructions.',
        dueDate: '2026-08-28',
        dueTime: '14:30',
        isToday: true,
        isTomorrow: false,
        isCompleted: false,
        priority: 'High',
        type: 'AI-Generated',
      },
    ];

    for (const rem of mockReminders) {
      await prisma.reminder.upsert({
        where: { id: rem.id },
        update: rem,
        create: rem,
      });
    }

    // 5. Seed Notifications
    const mockNotifications = [
      {
        id: 'notif_1',
        title: 'AI Deal Prediction',
        message: 'AI detected Rajesh Kumar is ready to close — 92% confidence. Recommend sending final proposal today.',
        type: 'ai',
        isRead: false,
        timestamp: new Date(),
      },
      {
        id: 'notif_2',
        title: 'New Lead Captured',
        message: 'New lead from JustDial: Vikram Singh — Singh Technologies, Bangalore. Auto-assigned to Sneha Kapoor.',
        type: 'lead',
        isRead: false,
        timestamp: new Date(Date.now() - 3600000),
      },
      {
        id: 'notif_3',
        title: 'Follow-up Due',
        message: 'Follow-up due: Priya Sharma in 30 minutes. Demo feedback pending.',
        type: 'reminder',
        isRead: false,
        timestamp: new Date(Date.now() - 7200000),
      },
    ];

    for (const n of mockNotifications) {
      await prisma.notification.upsert({
        where: { id: n.id },
        update: n,
        create: n,
      });
    }

    // 6. Seed Field Campaigns & Tasks
    const campaign = await prisma.fieldCampaign.upsert({
      where: { id: 'camp_1' },
      update: {
        name: 'Metro Retail Store Branding Drive',
        description: 'Verification of in-store POS displays across Mumbai & Delhi retail outlets.',
        budget: 150000,
        status: 'Active',
      },
      create: {
        id: 'camp_1',
        name: 'Metro Retail Store Branding Drive',
        description: 'Verification of in-store POS displays across Mumbai & Delhi retail outlets.',
        budget: 150000,
        status: 'Active',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-09-01'),
      },
    });

    const tasks = [
      {
        id: 'task_1',
        campaignId: campaign.id,
        title: 'Andheri West Store Display Setup',
        location: 'Mumbai, MH',
        status: 'Pending',
      },
      {
        id: 'task_2',
        campaignId: campaign.id,
        title: 'Karol Bagh Textile Showroom Standee',
        location: 'Delhi, DL',
        status: 'Completed',
        aiComplianceScore: 0.96,
        aiFeedback: 'Perfect lighting, crisp logo visibility, compliant with brand banner specs.',
      },
    ];

    for (const t of tasks) {
      await prisma.fieldTask.upsert({
        where: { id: t.id },
        update: t,
        create: t,
      });
    }

    res.json({
      success: true,
      message: 'PostgreSQL database seeded successfully with enterprise data!',
      stats: {
        users: users.length,
        leads: mockLeads.length,
        messages: mockMessages.length,
        reminders: mockReminders.length,
        notifications: mockNotifications.length,
        campaigns: 1,
      },
    });
  } catch (error: any) {
    console.error('Seed Error:', error);
    res.status(500).json({ error: error.message || 'Failed to seed database' });
  }
};
