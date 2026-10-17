export type UserRole =
  | 'SUPER_ADMIN'
  | 'ORGANIZER'
  | 'EVENT_MANAGER'
  | 'SELLER'
  | 'CONTROLLER'
  | 'FINANCE';

export type EventStatus = 'PUBLISHED' | 'DRAFT' | 'CLOSED';
export type TicketStatus = 'VALID' | 'USED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'WAVE' | 'ORANGE_MONEY' | 'FREE_MONEY' | 'CASH';
export type ScanResultType = 'VALID' | 'ALREADY_SCANNED' | 'INVALID';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  role: UserRole;
  avatarUrl?: string;
  organization?: string;
  /** UUID of the Organizer who created this team member (for SELLER / CONTROLLER) */
  organizationId?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface TicketType {
  id: string;
  eventId: string;
  name: string; // e.g. "Standard", "Tribune", "VIP Prestige"
  price: number; // in FCFA
  badge?: string; // e.g. "Populaire", "VIP", "Gradins"
  description: string;
  totalQuantity: number;
  soldQuantity: number;
  isActive: boolean;
}

export type EventCategory =
  | 'Football'
  | 'Basketball'
  | 'Lutte Sénégalaise'
  | 'Concert / Festival'
  | 'Oscars & Soirées Gala'
  | 'Théâtre & Humour'
  | 'Conférence / Salon'
  | 'Autre Événement';

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  category: EventCategory;
  venue: string;
  locationDetails: string;
  startDate: string; // ISO string
  endDate?: string; // ISO string
  timeString: string; // e.g. "18:00 UTC"
  bannerImage: string;
  description: string;
  importantInfo?: string[];
  status: EventStatus;
  totalCapacity: number;
  soldCapacity: number;
  organizerId: string;
  organizerName: string;
  ticketTypes: TicketType[];
  createdAt: string;
}

export type Event = EventItem;

export interface OrderItem {
  ticketTypeId: string;
  ticketTypeName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  reference: string; // e.g. "CMD-2026-9812"
  eventId: string;
  eventTitle: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  sellerId?: string; // If sold via POS Guichet
  channel: 'ONLINE' | 'POS_GUICHET';
  createdAt: string;
}

export interface Ticket {
  id: string;
  ticketCode: string; // e.g. "FT-8921-X"
  orderId: string;
  eventId: string;
  eventTitle: string;
  ticketTypeId: string;
  ticketTypeName: string;
  gateRecommendation: string; // e.g. "Porte A - Entrée Principale"
  seatNumber?: string;
  customerName: string;
  customerPhone: string;
  pricePaid: number;
  status: TicketStatus;
  qrData: string; // Cryptographic validation string
  usedAt?: string;
  usedGate?: string;
  usedByController?: string;
  createdAt: string;
}

export interface ScanLog {
  id: string;
  ticketId: string;
  ticketCode: string;
  eventId: string;
  ticketTypeName: string;
  gate: string; // e.g. "Porte A - Entrée Principale"
  controllerName: string;
  result: ScanResultType;
  scannedAt: string; // ISO string
  errorMessage?: string;
}

export interface POSCartItem {
  ticketTypeId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface DashboardKPIs {
  totalRevenue: number;
  revenueGrowth: number;
  totalTicketsSold: number;
  ticketsGrowth: number;
  activeEventsCount: number;
  successfulScansCount: number;
  globalFillRate: number;
}

// ─────────────────────────────────────────────────────────────
// RBAC Matrix Definitions & Permission Helpers
// ─────────────────────────────────────────────────────────────

export interface WithdrawalRequest {
  id: string;
  organizerId: string;
  organizerName: string;
  organizerEmail: string;
  amount: number;
  method: 'WAVE' | 'ORANGE_MONEY' | 'BANK_TRANSFER';
  phoneNumber?: string;
  bankDetails?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  requestedAt: string;
  processedAt?: string;
  note?: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  performedBy: string;
  target?: string;
  details?: string;
  timestamp: string;
  ipAddress?: string;
}

/** Voir dashboard : Super Admin (Global) | Organisateur (Ses évts) */
export function canAccessDashboard(role?: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'ORGANIZER';
}

/** Créer / Modifier / Publier événements : Super Admin (Tous) | Organisateur (Les siens) */
export function canManageEvents(role?: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'ORGANIZER';
}

/** Vente guichet (POS) : Super Admin | Vendeur (POS) */
export function canAccessPOS(role?: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'SELLER';
}

/** Scanner billets : Super Admin | Scanneur (Contrôleur) */
export function canAccessScanner(role?: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'CONTROLLER';
}

/** Voir ventes : Super Admin (Global) | Organisateur (Ses évts) | Vendeur (Ses ventes) */
export function canAccessSales(role?: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'ORGANIZER' || role === 'SELLER';
}

/** Voir rapports : Super Admin (Global) | Organisateur (Ses évts) */
export function canAccessReports(role?: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'ORGANIZER';
}

/** Gérer utilisateurs : Super Admin (Global) UNIQUEMENT */
export function canManageUsers(role?: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}

/** Approuver organisateurs : Super Admin UNIQUEMENT */
export function canApproveOrganizers(role?: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}

/** Traiter retraits : Super Admin UNIQUEMENT */
export function canProcessWithdrawals(role?: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}

/** Demander retrait : Organisateur UNIQUEMENT */
export function canRequestWithdrawal(role?: UserRole): boolean {
  return role === 'ORGANIZER';
}

/** Exporter données : Super Admin (Global) | Organisateur (Ses évts) */
export function canExportData(role?: UserRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'ORGANIZER';
}

/** Audit logs : Super Admin UNIQUEMENT */
export function canViewAuditLogs(role?: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}

/** Redirection automatique par rôle lors de l'accès */
export function getDefaultRouteForRole(role?: UserRole): string {
  switch (role) {
    case 'SELLER':
      return '/sales/pos';
    case 'CONTROLLER':
      return '/scan';
    case 'SUPER_ADMIN':
    case 'ORGANIZER':
    default:
      return '/dashboard';
  }
}
