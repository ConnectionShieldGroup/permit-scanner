// Permits reais de Massachusetts — agregados de múltiplas cidades
// V1 cobertura local (sem Supabase ainda):
//   - Hingham (PermitEyes AJAX direto)
//   - Reading (CivicPlus XLSX mensal)
//   - Lexington (CivicPlus CSV mensal)
//   - Wakefield (CivicPlus PDF mensal)
//   - Braintree, North Reading, Randolph, Hanson (PermitEyes via Browserless intercept)
// Quando Supabase for plugado, esses dados vêm do banco e esse mock fica como fallback offline.

import type { Permit } from './types';
import hinghamPermits from './hingham-real.json';
import readingPermits from './reading-real.json';
import lexingtonPermits from './lexington-real.json';
import wakefieldPermits from './wakefield-real.json';
import braintreePermits from './braintree-real.json';
import northreadingPermits from './northreading-real.json';
import randolphPermits from './randolph-real.json';
import hansonPermits from './hanson-real.json';
import somervillePermits from './somerville-real.json';

export const MOCK_PERMITS: Permit[] = [
  ...(hinghamPermits as Permit[]),
  ...(readingPermits as Permit[]),
  ...(lexingtonPermits as Permit[]),
  ...(wakefieldPermits as Permit[]),
  ...(braintreePermits as Permit[]),
  ...(northreadingPermits as Permit[]),
  ...(randolphPermits as Permit[]),
  ...(hansonPermits as Permit[]),
  ...(somervillePermits as Permit[]),
].sort((a, b) => (b.permit_date || '').localeCompare(a.permit_date || ''));
