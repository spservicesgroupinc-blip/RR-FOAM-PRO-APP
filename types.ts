
export enum CalculationMode {
  BUILDING = 'Building',
  WALLS_ONLY = 'Walls Only',
  FLAT_AREA = 'Flat Area',
  CUSTOM = 'Custom',
}

export enum FoamType {
  OPEN_CELL = 'Open Cell',
  CLOSED_CELL = 'Closed Cell',
}

export enum AreaType {
  WALL = 'Wall',
  ROOF = 'Roof',
}

export interface FoamSettings {
  type: FoamType;
  thickness: number;
  wastePercentage: number;
}

export interface AdditionalArea {
  type: AreaType;
  length: number;
  width: number;
}

export interface InventoryItem {
  id: string;
  warehouseItemId?: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost?: number;
}

export interface WarehouseItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

export interface EquipmentItem {
  id: string;
  name: string;
  status: 'Available' | 'In Use' | 'Maintenance' | 'Lost';
  lastSeen?: {
    customerName: string;
    date: string;
    crewMember: string;
    jobId: string;
  };
}

export interface CompanyProfile {
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  crewAccessPin: string;
}

export type CustomerSource = 'referral' | 'website' | 'google' | 'social_media' | 'repeat' | 'walk_in' | 'cold_call' | 'other';
export type CustomerTag = 'residential' | 'commercial' | 'industrial' | 'new_construction' | 'retrofit' | 'vip' | 'builder' | 'contractor' | 'property_manager';
export type LeadStage = 'new_lead' | 'contacted' | 'site_visit' | 'quoted' | 'negotiating' | 'won' | 'lost';
export type ActivityType = 'call' | 'email' | 'text' | 'site_visit' | 'meeting' | 'note' | 'follow_up' | 'estimate_sent' | 'status_change';

export interface CustomerActivity {
  id: string;
  customerId: string;
  type: ActivityType;
  subject: string;
  description: string;
  outcome?: string;
  duration?: number; // minutes (for calls/meetings)
  loggedBy: string;
  createdAt: string;
  followUpDate?: string;
  followUpCompleted?: boolean;
}

export interface CustomerProfile {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  email: string;
  phone: string;
  notes: string;
  status: 'Active' | 'Archived' | 'Lead';
  // CRM Enhancements
  leadStage?: LeadStage;
  source?: CustomerSource;
  tags?: CustomerTag[];
  companyName?: string;
  alternatePhone?: string;
  lastContactDate?: string;
  nextFollowUp?: string;
  estimatedValue?: number;
  activities?: CustomerActivity[];
}

export interface EstimateExpenses {
  manHours: number;
  laborRate?: number;
  tripCharge: number;
  fuelSurcharge: number;
  other: {
    description: string;
    amount: number;
  };
}

export interface InvoiceLineItem {
  id: string;
  item: string;
  description: string;
  qty: string;
  amount: number;
}

export interface MaterialUsageLogEntry {
  id?: string;
  date: string;
  jobId?: string;
  customerName: string;
  materialName: string;
  quantity: number;
  unit: string;
  loggedBy: string;
  logType?: 'estimated' | 'actual';
}

export interface PurchaseOrderItem {
  description: string;
  quantity: number;
  unitCost: number;
  total: number;
  type: 'open_cell' | 'closed_cell' | 'inventory';
  inventoryId?: string;
}

export interface PurchaseOrder {
  id: string;
  date: string;
  vendorName: string;
  status: 'Draft' | 'Sent' | 'Received' | 'Cancelled';
  items: PurchaseOrderItem[];
  totalCost: number;
  notes?: string;
}

export interface CalculationResults {
  perimeter: number;
  slopeFactor: number;
  baseWallArea: number;
  gableArea: number;
  totalWallArea: number;
  baseRoofArea: number;
  totalRoofArea: number;
  
  wallBdFt: number;
  roofBdFt: number;
  
  totalOpenCellBdFt: number;
  totalClosedCellBdFt: number;
  
  openCellSets: number;
  closedCellSets: number;

  // Added Stroke Counts
  openCellStrokes: number;
  closedCellStrokes: number;

  openCellCost: number;
  closedCellCost: number;
  
  inventoryCost: number; 

  laborCost: number;
  miscExpenses: number;
  materialCost: number; 
  totalCost: number; 
}

export interface EstimateRecord {
  id: string;
  customerId: string;
  date: string;
  
  customer: CustomerProfile;
  
  status: 'Draft' | 'Work Order' | 'Invoiced' | 'Paid' | 'Archived';
  executionStatus: 'Not Started' | 'In Progress' | 'Completed';
  
  inputs: {
    mode: CalculationMode;
    length: number;
    width: number;
    wallHeight: number;
    roofPitch: string;
    includeGables: boolean;
    isMetalSurface: boolean;
    additionalAreas: AdditionalArea[];
  };
  
  results: CalculationResults;
  
  materials: {
    openCellSets: number;
    closedCellSets: number;
    inventory: InventoryItem[];
    equipment: EquipmentItem[];
  };
  
  totalValue: number;
  
  wallSettings: FoamSettings;
  roofSettings: FoamSettings;
  expenses: EstimateExpenses;
  
  notes?: string;
  pricingMode?: 'level_pricing' | 'sqft_pricing';
  sqFtRates?: {
    wall: number;
    roof: number;
  };
  
  scheduledDate?: string;
  invoiceDate?: string;
  invoiceNumber?: string;
  paymentTerms?: string;
  
  estimateLines?: InvoiceLineItem[]; 
  invoiceLines?: InvoiceLineItem[];
  workOrderLines?: InvoiceLineItem[];
  
  actuals?: {
    openCellSets: number;
    closedCellSets: number;
    openCellStrokes?: number;
    closedCellStrokes?: number;
    laborHours: number;
    inventory: InventoryItem[];
    notes: string;
    completedBy?: string;
    completionDate?: string;
    lastStartedAt?: string;
    startedBy?: string;
  };
  
  financials?: {
    revenue: number;
    totalCOGS: number;
    chemicalCost: number;
    laborCost: number;
    inventoryCost: number;
    miscCost: number;
    netProfit: number;
    margin: number;
  };
  
  workOrderSheetUrl?: string;
  pdfLink?: string;
  sitePhotos?: string[];
  inventoryProcessed?: boolean;
  lastModified?: string;
}

export interface CalculatorState {
  mode: CalculationMode;
  length: number;
  width: number;
  wallHeight: number;
  roofPitch: string;
  includeGables: boolean;
  isMetalSurface: boolean; 
  wallSettings: FoamSettings;
  roofSettings: FoamSettings;
  yields: {
    openCell: number;
    closedCell: number;
    // Added Stroke Config
    openCellStrokes: number;
    closedCellStrokes: number;
  };
  costs: {
    openCell: number;
    closedCell: number;
    laborRate: number;
  };
  warehouse: {
    openCellSets: number;
    closedCellSets: number;
    items: WarehouseItem[]; 
  };
  equipment: EquipmentItem[]; 
  showPricing: boolean;
  additionalAreas: AdditionalArea[];
  inventory: InventoryItem[]; 
  jobEquipment: EquipmentItem[]; 
  companyProfile: CompanyProfile;
  
  customers: CustomerProfile[]; 
  customerProfile: CustomerProfile; 
  
  pricingMode: 'level_pricing' | 'sqft_pricing';
  sqFtRates: {
    wall: number;
    roof: number;
  };

  expenses: EstimateExpenses;
  savedEstimates: EstimateRecord[];
  purchaseOrders?: PurchaseOrder[];
  materialLogs?: MaterialUsageLogEntry[]; 
  
  lifetimeUsage: {
    openCell: number;
    closedCell: number;
  };

  jobNotes?: string;
  scheduledDate?: string;
  invoiceDate?: string;
  invoiceNumber?: string; 
  paymentTerms?: string;
}

// ── Document Type for PDF Builder ──
export enum DocumentType {
  ESTIMATE = 'ESTIMATE',
  WORK_ORDER = 'WORK ORDER',
  INVOICE = 'INVOICE',
}

export const statusToDocumentType = (status: EstimateRecord['status']): DocumentType => {
  switch (status) {
    case 'Invoiced':
    case 'Paid':
      return DocumentType.INVOICE;
    case 'Work Order':
      return DocumentType.WORK_ORDER;
    default:
      return DocumentType.ESTIMATE;
  }
};

export const formatDocumentNumber = (baseNumber: string, docType: DocumentType): string => {
  const raw = baseNumber.replace(/^(EST|WO|INV)-?/i, '');
  const prefixMap: Record<DocumentType, string> = {
    [DocumentType.ESTIMATE]: 'EST',
    [DocumentType.WORK_ORDER]: 'WO',
    [DocumentType.INVOICE]: 'INV',
  };
  return `${prefixMap[docType]}-${raw}`;
};

export interface UserSession {
  id: string;
  email?: string;
  username: string;
  companyName: string;
  organizationId: string;
  spreadsheetId: string; // backward compat — maps to organizationId
  folderId?: string;
  token?: string;
  role: 'admin' | 'crew'; 
}

// ─── EQUIPMENT MAINTENANCE TYPES ────────────────────────────────────────────

export interface MaintenanceEquipment {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  category: string;
  totalSetsSprayed: number;
  totalHoursOperated: number;
  lifetimeSets: number;
  lifetimeHours: number;
  status: 'active' | 'inactive' | 'retired';
  lastServiceDate: string | null;
  serviceItems: MaintenanceServiceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceServiceItem {
  id: string;
  equipmentId: string;
  organizationId: string;
  name: string;
  description: string;
  intervalSets: number;
  intervalHours: number;
  setsSinceLastService: number;
  hoursSinceLastService: number;
  lastServicedAt: string | null;
  lastServicedBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceServiceLog {
  id: string;
  organizationId: string;
  equipmentId: string;
  serviceItemId: string | null;
  serviceDate: string;
  performedBy: string;
  notes: string;
  setsAtService: number;
  hoursAtService: number;
  createdAt: string;
}

export interface MaintenanceJobUsage {
  id: string;
  organizationId: string;
  estimateId: string | null;
  openCellSets: number;
  closedCellSets: number;
  totalSets: number;
  operatingHours: number;
  jobDate: string;
  customerName: string;
  notes: string;
  applied: boolean;
  createdAt: string;
}

export type SubscriptionPlan = 'trial' | 'starter' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'suspended';

export interface SubscriptionInfo {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt?: string;
  isTrialExpired: boolean;
  currentPeriodEnd?: string;
  usage: {
    estimatesThisMonth: number;
    maxEstimates: number;
    customers: number;
    maxCustomers: number;
    users: number;
    maxUsers: number;
  };
}

export const PLAN_LIMITS: Record<SubscriptionPlan, { estimates: number; customers: number; users: number; storage: number; name: string; price: number }> = {
  trial:      { estimates: 10,    customers: 25,    users: 2,  storage: 100,   name: 'Free Trial',  price: 0    },
  starter:    { estimates: 50,    customers: 100,   users: 3,  storage: 500,   name: 'Starter',     price: 49   },
  pro:        { estimates: 500,   customers: 500,   users: 10, storage: 2000,  name: 'Pro',         price: 99   },
  enterprise: { estimates: 99999, customers: 99999, users: 50, storage: 10000, name: 'Enterprise',  price: 249  },
};
