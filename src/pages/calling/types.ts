

export type CallType = 'VoIP' | 'GSM';
export type CallDirection = 'outgoing' | 'incoming' | 'missed';
export type HistoryFilter = 'All' | 'Incoming' | 'Outgoing' | 'Missed' | 'Recorded';

export interface CallRecord {
  id: string;
  leadName: string;
  phone: string;
  source: string;
  direction: CallDirection;
  duration: string;
  callType: CallType;
  date: string;
  recorded: boolean;
  hasTranscript: boolean;
  hasNotes: boolean;
  notes?: string;
}

export const MOCK_CALLS: CallRecord[] = [
  { id: 'c1',  leadName: 'Rajesh Kumar',  phone: '+91 98765 43210', source: 'JustDial',  direction: 'outgoing', duration: '5:23',   callType: 'VoIP', date: 'Today, 10:32 AM',      recorded: true,  hasTranscript: true,  hasNotes: false },
  { id: 'c2',  leadName: 'Priya Sharma',  phone: '+91 87654 32109', source: 'IndiaMART', direction: 'incoming', duration: '3:12',   callType: 'GSM',  date: 'Today, 09:15 AM',      recorded: true,  hasTranscript: false, hasNotes: false },
  { id: 'c3',  leadName: 'Amit Patel',    phone: '+91 76543 21098', source: 'Website',   direction: 'outgoing', duration: '8:45',   callType: 'VoIP', date: 'Today, 08:50 AM',      recorded: true,  hasTranscript: false, hasNotes: true,  notes: 'Interested in bulk order. Needs pricing sheet.' },
  { id: 'c4',  leadName: 'Sunita Verma',  phone: '+91 65432 10987', source: 'WhatsApp',  direction: 'missed',   duration: 'Missed', callType: 'GSM',  date: 'Yesterday, 05:40 PM',  recorded: false, hasTranscript: false, hasNotes: false },
  { id: 'c5',  leadName: 'Vikram Singh',  phone: '+91 54321 09876', source: 'Referral',  direction: 'outgoing', duration: '2:30',   callType: 'VoIP', date: 'Yesterday, 03:10 PM',  recorded: true,  hasTranscript: false, hasNotes: false },
  { id: 'c6',  leadName: 'Meera Nair',    phone: '+91 43210 98765', source: 'JustDial',  direction: 'incoming', duration: '6:15',   callType: 'GSM',  date: 'Yesterday, 01:25 PM',  recorded: true,  hasTranscript: true,  hasNotes: false },
  { id: 'c7',  leadName: 'Arjun Mehta',   phone: '+91 32109 87654', source: 'IndiaMART', direction: 'outgoing', duration: '11:20',  callType: 'VoIP', date: 'Mar 10, 11:05 AM',     recorded: true,  hasTranscript: false, hasNotes: true,  notes: 'Demo scheduled for Friday 2 PM.' },
  { id: 'c8',  leadName: 'Kavya Reddy',   phone: '+91 21098 76543', source: 'Website',   direction: 'missed',   duration: 'Missed', callType: 'GSM',  date: 'Mar 10, 09:30 AM',     recorded: false, hasTranscript: false, hasNotes: false },
  { id: 'c9',  leadName: 'Rohit Gupta',   phone: '+91 10987 65432', source: 'Website',   direction: 'incoming', duration: '4:05',   callType: 'VoIP', date: 'Mar 09, 03:15 PM',     recorded: true,  hasTranscript: false, hasNotes: false },
  { id: 'c10', leadName: 'Anita Desai',   phone: '+91 09876 54321', source: 'Referral',  direction: 'outgoing', duration: '7:33',   callType: 'GSM',  date: 'Mar 09, 01:00 PM',     recorded: true,  hasTranscript: true,  hasNotes: false },
];

export const TRANSCRIPT_LINES = [
  { time: '00:00', speaker: 'You',    text: 'Namaste Rajesh ji, this is Sneha from Velara...' },
  { time: '00:08', speaker: 'Rajesh', text: 'Yes, namaste. I was expecting your call...' },
  { time: '00:15', speaker: 'You',    text: 'I wanted to discuss the enterprise package with you.' },
  { time: '00:28', speaker: 'Rajesh', text: "Yes, we've reviewed the proposal you sent last week." },
  { time: '00:45', speaker: 'You',    text: 'What are your thoughts on the pricing?' },
  { time: '01:02', speaker: 'Rajesh', text: "The pricing seems reasonable, ₹5L is within our budget." },
  { time: '01:18', speaker: 'You',    text: 'Great! Should I send a formal proposal document?' },
  { time: '01:35', speaker: 'Rajesh', text: "Yes please, send it by Friday. I'll review with the team." },
  { time: '01:50', speaker: 'You',    text: "Absolutely. I'll also include the implementation timeline." },
  { time: '02:10', speaker: 'Rajesh', text: 'Perfect. We were also looking at Salesforce but your pricing is better.' },
];

export const sourceBadgeColor: Record<string, string> = {
  JustDial:  'bg-blue-100 text-blue-700',
  IndiaMART: 'bg-orange-100 text-orange-700',
  Website:   'bg-green-100 text-green-700',
  WhatsApp:  'bg-teal-100 text-teal-700',
  Referral:  'bg-purple-100 text-purple-700',
};

export const DIAL_KEYS = ['1','2','3','4','5','6','7','8','9','*','0','#'];
export const HISTORY_TABS: HistoryFilter[] = ['All', 'Incoming', 'Outgoing', 'Missed', 'Recorded'];

