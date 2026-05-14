// Tipos canônicos — SINCRONIZADOS com CONTRACTS.md
// Não alterar sem atualizar contrato no Carlos.

// 7 categorias relevantes pro Reginaldo (vidraçaria + proteção):
// new_construction, kitchen_renovation, bath_renovation, addition,
// renovation (genérico), building_permit, foundation_permit.
// Permits que não batem em nenhuma palavra-chave dessas → SKIP no scraper.
export type WorkType =
  | 'new_construction'
  | 'kitchen_renovation'
  | 'bath_renovation'
  | 'addition'
  | 'renovation'
  | 'building_permit'
  | 'foundation_permit';

export type Permit = {
  id: string;
  permit_number: string;
  applicant_name: string | null;
  address: string;
  city: string;
  state: string;
  phone: string | null;
  email: string | null;
  work_type: WorkType;
  permit_date: string;          // IssueDate — data em que a cidade EMITIU o permit
  application_date: string | null; // ApplDate — data em que o cidadão APLICOU pro permit
  estimated_value: number | null;
  status_source: string | null;
  source_url: string | null; // link pro permit no portal da cidade
  description: string | null; // descrição da obra (col[12] do PermitEyes ou equivalente)
  created_at: string;
  updated_at: string;
  raw_data: Record<string, unknown>;
};

export type KanbanBoard = 'pipeline' | 'ativos' | 'nao_efetivados';

export type KanbanColumn =
  | 'encontrado'
  | 'visitado'
  | 'apresentacao'
  | 'proposta'
  | 'cliente'
  | 'nao_fechado'
  | 'ativos'
  | 'reabordar'
  | 'descartado';

export type KanbanCard = {
  id: string;
  permit_id: string;
  permit?: Permit;
  board: KanbanBoard;
  column_status: KanbanColumn;
  notes: string | null;
  moved_at: string;
  created_at: string;
};

export type PermitFilters = {
  city?: string;
  month_start?: string;
  month_end?: string;
  work_type?: WorkType;
};

// Helpers de label/cor por work_type
export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  new_construction: 'New Construction',
  kitchen_renovation: 'Kitchen Renovation',
  bath_renovation: 'Bath Renovation',
  addition: 'Addition',
  renovation: 'Renovation',
  building_permit: 'Building Permit',
  foundation_permit: 'Foundation Permit',
};

export const WORK_TYPE_COLORS: Record<WorkType, string> = {
  new_construction: '#FFCA50', // gold
  kitchen_renovation: '#00E68A', // green
  bath_renovation: '#5BC0EB', // blue
  addition: '#E879F9', // pink
  renovation: '#A855F7', // purple
  building_permit: '#F97316', // orange
  foundation_permit: '#FF6B6B', // red
};

// Config de colunas por board
export const PIPELINE_COLUMNS: { key: KanbanColumn; label: string; accent: string }[] = [
  { key: 'encontrado', label: 'Permits encontrados', accent: '#9898AA' },
  { key: 'visitado', label: 'Visitados', accent: '#5BC0EB' },
  { key: 'apresentacao', label: 'Apresentação enviada', accent: '#A855F7' },
  { key: 'proposta', label: 'Proposta enviada', accent: '#FFCA50' },
  { key: 'cliente', label: 'Cliente', accent: '#00E68A' },
  { key: 'nao_fechado', label: 'Não fechado', accent: '#FF6B6B' },
];

export const ATIVOS_COLUMNS: { key: KanbanColumn; label: string; accent: string }[] = [
  { key: 'ativos', label: 'Clientes Ativos', accent: '#00E68A' },
];

export const NAO_EFETIVADOS_COLUMNS: { key: KanbanColumn; label: string; accent: string }[] = [
  { key: 'reabordar', label: 'Reabordar', accent: '#FFCA50' },
  { key: 'descartado', label: 'Descartado', accent: '#65657A' },
];

// ============= CRM / LEADS =============
export type LeadStatus = 'novo' | 'contatado' | 'qualificado' | 'proposta' | 'fechado' | 'perdido';
export type LeadTemperature = 'quente' | 'morno' | 'frio';

export type Lead = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  temperature: LeadTemperature | null;
  estimated_value: number | null;
  owner_id: string | null;
  owner_email?: string | null;
  source: string | null;
  notes: string | null;
  next_followup_date: string | null;
  permit_id: string | null;
  created_by: string | null;
  created_by_email?: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadInteraction = {
  id: string;
  lead_id: string;
  type: 'note' | 'call' | 'email' | 'meeting' | 'status_change';
  content: string;
  created_by: string | null;
  created_at: string;
};

export const LEAD_STATUS_COLUMNS: { key: LeadStatus; label: string; accent: string }[] = [
  { key: 'novo',        label: 'Novo',        accent: '#9898AA' },
  { key: 'contatado',   label: 'Contatado',   accent: '#5BC0EB' },
  { key: 'qualificado', label: 'Qualificado', accent: '#A855F7' },
  { key: 'proposta',    label: 'Proposta',    accent: '#FFCA50' },
  { key: 'fechado',     label: 'Fechado',     accent: '#00E68A' },
  { key: 'perdido',     label: 'Perdido',     accent: '#FF6B6B' },
];

export const TEMPERATURE_COLORS: Record<LeadTemperature, string> = {
  quente: '#FF6B6B',
  morno:  '#FFCA50',
  frio:   '#5BC0EB',
};

// 30 cidades — V1 ativa Hingham (PermitEyes AJAX endpoint validado, 84 permits reais).
// Burlington foi descartada: subagent confundiu Burlington Ontario (Canadá) com Burlington MA.
// Burlington MA não tem API pública (OpenGov SPA React, V4).
// Outras cidades virão em V2-V5 conforme SPEC.md.
export const CITIES = [
  'Lexington',
  'Winchester',
  'Stoneham',
  'Reading',
  'Wakefield',
  'Wilmington',
  'North Reading',
  'Medford',
  'Melrose',
  'Arlington',
  'Malden',
  'Billerica',
  'Bedford',
  'Waltham',
  'Abington',
  'Whitman',
  'Hanover',
  'Hingham',
  'Weymouth',
  'Braintree',
  'Quincy',
  'Norwell',
  'Scituate',
  'Marshfield',
  'Pembroke',
  'Hanson',
  'East Bridgewater',
  'Brockton',
  'Randolph',
  'Cohasset',
  'Rockland',
  'Avon',
  'Stoughton',
  'West Bridgewater',
] as const;

// V1 ativa: 8 cidades MA com fontes extraíveis
//   - Hingham, Braintree, North Reading, Randolph, Hanson (PermitEyes — direct ou Browserless)
//   - Reading, Lexington, Wakefield (CivicPlus monthly XLSX/CSV/PDF)
// V2: pipeline LLM + login Reginaldo cobre demais 22 cidades (OpenGov, Tyler, etc)
export const ACTIVE_CITIES: readonly string[] = [
  'Somerville', 'Hingham', 'Braintree', 'North Reading', 'Randolph', 'Hanson',
  'Reading', 'Lexington', 'Wakefield', 'Cohasset', 'Rockland', 'Avon', 'Stoughton',
];
