export interface Tender {
  id: number;
  tender_id: string;
  source: string;
  portal_id: string;
  title: string;
  reference_number: string;
  work_description: string | null;
  organisation_name: string;
  department_name: string;
  state_name: string;
  product_category: string | null;
  category: string | null;
  tender_type: string | null;
  form_of_contract: string | null;
  payment_mode: string | null;
  number_of_covers: number | null;
  published_date: string;
  closing_date: string;
  opening_date: string | null;
  document_sale_start: string | null;
  document_sale_end: string | null;
  bid_submission_start: string | null;
  bid_submission_end: string | null;
  estimated_value: number | null;
  emd_amount: string | null;
  emd_percentage: string | null;
  tender_fee: string | null;
  processing_fee: string | null;
  location: string | null;
  detail_page_fetched: boolean;
  documents_downloaded: boolean;
  has_corrigendum: boolean;
  corrigendum_count: number;
  is_active: boolean;
  document_count: number;
}

export interface TenderDocument {
  id: number;
  tender_id: string;
  portal_id: string;
  filename: string;
  file_size: number;
  file_type: string;
  checksum: string | null;
  downloaded_at: string;
}

export interface TenderListResponse {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  tenders: Tender[];
}

export interface TenderFilters {
  keyword?: string;
  keyword_logic?: "OR" | "AND";
  exclude_keywords?: string;
  source?: string;
  state?: string;
  organisation?: string;
  department?: string;
  product_category?: string;
  closing_after?: string;
  closing_before?: string;
  published_after?: string;
  published_before?: string;
  min_value?: number;
  max_value?: number;
  has_corrigendum?: boolean;
  portal_id?: string;
  has_documents?: boolean;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface Portal {
  portal_id: string;
  tender_count: number;
}

export interface StatsOverview {
  total_tenders: number;
  active_tenders: number;
  total_documents: number;
  portals_count: number;
}

export interface Corrigendum {
  id: number;
  tender_id: string;
  title: string;
  description: string | null;
  published_date: string;
}

export type MyBidStatus = "ongoing" | "exploring";

export interface MyBid {
  tender: Tender;
  status: MyBidStatus;
  savedAt: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  blobUrl: string;
}

export interface VaultDocument {
  id: string;
  name: string;
  category: string;
  fileType: string;
  fileSize: number;
  base64Data: string;
  uploadedAt: string;
}

export const VAULT_CATEGORIES = [
  "Registration Certificates",
  "Financial Documents",
  "Experience",
  "Work Orders (LOA/WO)",
  "Firm Profile",
  "Rent Agreements",
  "Net Worth",
  "Other",
] as const;

export type VaultCategory = (typeof VAULT_CATEGORIES)[number];

export type FormTag =
  | "Needs Notarization"
  | "Needs Stamp Paper"
  | "Needs Company Seal"
  | "Needs Attestation"
  | "Needs Affidavit"
  | "Needs Witness Signature"
  | "Needs Court Fee Stamp"
  | "Needs Board Resolution";

export interface ExtractedForm {
  id: string;
  title: string;
  type: "form" | "annexure" | "schedule" | "declaration" | "other";
  sourcePages: number[];
  contentHtml: string;
  tags: FormTag[];
}

// ─── Vault v2 Types (IndexedDB-backed) ───

export type ExtractionStatus = "pending" | "extracting" | "done" | "failed";

export interface VaultDocumentMeta {
  id: string;
  name: string;
  category: VaultCategory;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  extractionStatus: ExtractionStatus;
  isOnboardingDoc?: boolean;
}

export interface ExtractedMetadata {
  companyName?: string;
  pan?: string;
  gstin?: string;
  registeredAddress?: string;
  partners?: string[];
  turnover?: { year: string; amount: string }[];
  pastProjects?: {
    name: string;
    client: string;
    value: string;
    year: string;
  }[];
  certifications?: string[];
  rawSummary?: string;
  suggestedCategory?: VaultCategory;
  categoryConfidence?: "high" | "medium" | "low";
  alternateCategories?: VaultCategory[];
}

export type EntityType =
  | "Partnership Firm"
  | "Private Limited"
  | "Public Limited"
  | "LLP"
  | "Proprietorship"
  | "Society"
  | "Trust"
  | "Other";

export interface CompanyProfile {
  entityType?: EntityType;
  companyName: string;
  yearOfEstablishment?: number;
  businessDomain?: string[];
  stateCity?: string;
  pan: string;
  gstin: string;
  registeredAddress: string;
  partners: string[];
  turnoverHistory: { year: string; amount: string }[];
  totalProjects: number;
  pastProjects: {
    name: string;
    client: string;
    value: string;
    year: string;
  }[];
  certifications: string[];
  registrations?: string[];
  lastUpdated: string;
  onboardingDocId?: string;
}

/** Business domains for "similar work" matching in RFP eligibility */
export const BUSINESS_DOMAINS = [
  "Event Management & Tent Services",
  "Civil Construction",
  "Road & Highway Construction",
  "Building Construction",
  "Electrical Works",
  "Plumbing & Sanitary",
  "IT Services & Software",
  "Consulting Services",
  "Supply & Trading",
  "Catering & Hospitality",
  "Security Services",
  "Cleaning & Housekeeping",
  "Transport & Logistics",
  "Printing & Stationery",
  "Medical & Healthcare",
  "Agriculture & Farming",
  "Education & Training",
  "Other",
] as const;

export type BusinessDomain = (typeof BUSINESS_DOMAINS)[number];

// ─── Compliance Checklist Types ───

export type ChecklistStatus = "met" | "not_met" | "partial" | "unknown";

export interface ChecklistItem {
  requirement: string;
  status: ChecklistStatus;
  reasoning: string;
  sourcePages: number[];
  matchedVaultDocs?: string[];
  matchedProfileField?: string;
}

export interface ChecklistSection {
  title: string;
  items: ChecklistItem[];
}

export interface ComplianceChecklist {
  sections: ChecklistSection[];
  summary: {
    total: number;
    met: number;
    notMet: number;
    partial: number;
    unknown: number;
  };
}

// ─── Bid Checklist Types (Workspace Workflow) ───

export interface BidChecklistItem {
  id: number;
  name: string;
  particular: string;
  sourcePages: number[];
  status: "pending" | "approved";
}

/** Maps common folder names to vault categories for auto-categorization */
export const FOLDER_CATEGORY_MAP: Record<string, VaultCategory> = {
  "registration certificate": "Registration Certificates",
  "registration certificates": "Registration Certificates",
  "financial document": "Financial Documents",
  "financial documents": "Financial Documents",
  experience: "Experience",
  "individual_form_event": "Experience",
  "loa&wo": "Work Orders (LOA/WO)",
  loa: "Work Orders (LOA/WO)",
  "work order": "Work Orders (LOA/WO)",
  "work orders": "Work Orders (LOA/WO)",
  "firm profile": "Firm Profile",
  profile: "Firm Profile",
  "rent agreement": "Rent Agreements",
  "rent agreements": "Rent Agreements",
  "net worth": "Net Worth",
  networth: "Net Worth",
};
