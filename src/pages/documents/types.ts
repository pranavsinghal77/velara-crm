import { shortDateOffset } from '../../utils/dates';

export type DocCategory = 'All Documents' | 'Contracts' | 'Proposals' | 'KYC Documents' | 'Reports' | 'Other';
export type FileType = 'pdf' | 'docx' | 'xlsx' | 'img';

export interface Doc {
  id: string;
  name: string;
  leadName: string;
  leadId: string;
  size: string;
  date: string;
  category: Exclude<DocCategory, 'All Documents'>;
  fileType: FileType;
}

export const MOCK_DOCS: Doc[] = [
  { id: 'd1', name: 'Rajesh_Kumar_Contract.pdf',       leadName: 'Rajesh Kumar',  leadId: 'lead_1',  size: '2.3 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Contracts',     fileType: 'pdf'  },
  { id: 'd2', name: 'Priya_Sharma_Proposal.pdf',        leadName: 'Priya Sharma',  leadId: 'lead_2',  size: '1.1 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Proposals',     fileType: 'pdf'  },
  { id: 'd3', name: 'Amit_Patel_KYC.pdf',               leadName: 'Amit Patel',    leadId: 'lead_3',  size: '0.8 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'KYC Documents', fileType: 'pdf'  },
  { id: 'd4', name: 'Kumar_Enterprises_Agreement.docx', leadName: 'Rajesh Kumar',  leadId: 'lead_1',  size: '1.5 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Contracts',     fileType: 'docx' },
  { id: 'd5', name: 'Q1_Sales_Report.xlsx',             leadName: '—',             leadId: '',        size: '3.2 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Reports',       fileType: 'xlsx' },
  { id: 'd6', name: 'Sunita_Verma_Proposal.pdf',        leadName: 'Sunita Verma',  leadId: 'lead_4',  size: '0.9 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Proposals',     fileType: 'pdf'  },
  { id: 'd7', name: 'Arjun_Mehta_Contract.pdf',         leadName: 'Arjun Mehta',   leadId: 'lead_5',  size: '2.1 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Contracts',     fileType: 'pdf'  },
  { id: 'd8', name: 'Team_Performance_Q1.xlsx',         leadName: '—',             leadId: '',        size: '1.8 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Reports',       fileType: 'xlsx' },
  { id: 'd9', name: 'Anita_Desai_KYC.pdf',              leadName: 'Anita Desai',   leadId: 'lead_6',  size: '0.7 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'KYC Documents', fileType: 'pdf'  },
  { id: 'd10', name: 'Rajesh_Kumar_Onboarding_Form.pdf', leadName: 'Rajesh Kumar', leadId: 'lead_1',  size: '0.6 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'KYC Documents', fileType: 'pdf'  },
  { id: 'd11', name: 'Rajesh_Kumar_Pricing_Revision.pdf', leadName: 'Rajesh Kumar', leadId: 'lead_1',  size: '1.2 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Proposals',     fileType: 'pdf'  },
  { id: 'd12', name: 'Priya_Sharma_MSA.docx',            leadName: 'Priya Sharma', leadId: 'lead_2',  size: '1.0 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Contracts',     fileType: 'docx' },
  { id: 'd13', name: 'Priya_Sharma_KYC_ID.pdf',          leadName: 'Priya Sharma', leadId: 'lead_2',  size: '0.5 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'KYC Documents', fileType: 'pdf'  },
  { id: 'd14', name: 'Amit_Patel_Proposal_V2.pdf',       leadName: 'Amit Patel',   leadId: 'lead_3',  size: '1.4 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Proposals',     fileType: 'pdf'  },
  { id: 'd15', name: 'Amit_Patel_Address_Proof.pdf',     leadName: 'Amit Patel',   leadId: 'lead_3',  size: '0.4 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'KYC Documents', fileType: 'pdf'  },
  { id: 'd16', name: 'Sunita_Verma_Service_Agreement.docx', leadName: 'Sunita Verma', leadId: 'lead_4', size: '1.3 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Contracts', fileType: 'docx' },
  { id: 'd17', name: 'Sunita_Verma_Invoice_Terms.pdf',   leadName: 'Sunita Verma', leadId: 'lead_4',  size: '0.8 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Other',         fileType: 'pdf'  },
  { id: 'd18', name: 'Arjun_Mehta_Proposal_Annexure.pdf', leadName: 'Arjun Mehta', leadId: 'lead_5',  size: '1.7 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Proposals',     fileType: 'pdf'  },
  { id: 'd19', name: 'Arjun_Mehta_GST_Certificate.pdf',  leadName: 'Arjun Mehta',  leadId: 'lead_5',  size: '0.5 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'KYC Documents', fileType: 'pdf'  },
  { id: 'd20', name: 'Anita_Desai_Contract_Amendment.docx', leadName: 'Anita Desai', leadId: 'lead_6', size: '1.1 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Contracts',   fileType: 'docx' },
  { id: 'd21', name: 'Anita_Desai_Proposal_Deck.pdf',    leadName: 'Anita Desai',  leadId: 'lead_6',  size: '1.6 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Proposals',     fileType: 'pdf'  },
  { id: 'd22', name: 'Rajesh_Kumar_QBR_Report_Q1.xlsx',  leadName: 'Rajesh Kumar', leadId: 'lead_1',  size: '2.0 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Reports',       fileType: 'xlsx' },
  { id: 'd23', name: 'Priya_Sharma_QBR_Report_Q1.xlsx',  leadName: 'Priya Sharma', leadId: 'lead_2',  size: '1.9 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Reports',       fileType: 'xlsx' },
  { id: 'd24', name: 'Sunita_Verma_QBR_Report_Q1.xlsx',  leadName: 'Sunita Verma', leadId: 'lead_4',  size: '1.9 MB', date: shortDateOffset(Math.floor(Math.random() * -30)), category: 'Reports',       fileType: 'xlsx' },
];

export const CATEGORIES: { label: DocCategory; emoji: string; count: number }[] = [
  { label: 'All Documents',  emoji: '📋', count: 47 },
  { label: 'Contracts',      emoji: '📜', count: 12 },
  { label: 'Proposals',      emoji: '💰', count: 8  },
  { label: 'KYC Documents',  emoji: '🪪', count: 11 },
  { label: 'Reports',        emoji: '📊', count: 9  },
  { label: 'Other',          emoji: '📸', count: 7  },
];

export const catBadge: Record<string, string> = {
  Contracts:     'bg-blue-100 text-blue-700',
  Proposals:     'bg-amber-100 text-amber-700',
  'KYC Documents': 'bg-purple-100 text-purple-700',
  Reports:       'bg-green-100 text-green-700',
  Other:         'bg-slate-100 text-slate-600',
};

