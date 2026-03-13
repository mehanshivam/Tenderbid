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

export interface ExtractedForm {
  id: string;
  title: string;
  type: "form" | "annexure" | "schedule" | "declaration" | "other";
  sourcePages: number[];
  contentHtml: string;
}
