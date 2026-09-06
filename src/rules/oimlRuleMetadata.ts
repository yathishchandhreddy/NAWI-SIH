/**
 * OIML R 76-1:2006 Rule Metadata Registry
 * 
 * Authoritative traceability records based strictly on the official
 * OIML Recommendation R 76-1 (Edition 2006 (E)):
 * "Non-automatic weighing instruments - Part 1: Metrological and technical requirements - Tests"
 * https://www.oiml.org/en/files/pdf_r/r076-1-e06.pdf
 */

import { OimlRuleMetadata } from '../types';

export const OIML_R76_METADATA_REGISTRY: Record<string, OimlRuleMetadata> = {
  'R76-RULE-CLASS-TABLE3': {
    ruleId: 'R76-RULE-CLASS-TABLE3',
    standard: 'OIML R 76-1:2006',
    section: 'Clause 3.2, Table 3',
    description:
      'Principles of classification of Non-Automatic Weighing Instruments into accuracy classes (I, II, III, IIII), verification scale interval e, number of verification scale intervals n, and minimum capacity Min.',
    formula: 'n = Max / e; n_min <= n <= n_max; Min >= Min_required(e)',
    applicability: 'All Non-Automatic Weighing Instruments',
    lastVerified: '2026-09-06',
  },
  'R76-RULE-MULTI-INTERVAL': {
    ruleId: 'R76-RULE-MULTI-INTERVAL',
    standard: 'OIML R 76-1:2006',
    section: 'Clause 3.3.1 & 3.3.2',
    description:
      'Multi-interval instruments with partial weighing ranges: verification scale interval e_i applies to range Max_(i-1) < m <= Max_i. Maximum permissible errors are determined as a function of e_i and load m expressed in e_i.',
    formula: 'e_i applies for load range (Max_(i-1), Max_i]; n_i = Max_i / e_i',
    applicability: 'Instruments having multi-interval partial weighing ranges',
    lastVerified: '2026-09-06',
  },
  'R76-RULE-SCALE-INTERVALS-D-E': {
    ruleId: 'R76-RULE-SCALE-INTERVALS-D-E',
    standard: 'OIML R 76-1:2006',
    section: 'Clause 3.1.2 & Clause 3.4.1',
    description:
      'Verification scale interval e and actual scale interval d: d = e for standard instruments; d < e <= 10d for instruments with auxiliary indicating devices (Class I & II only).',
    formula: 'd <= e <= 10d',
    applicability: 'Class I and Class II instruments with auxiliary indicating devices',
    lastVerified: '2026-09-06',
  },
  'R76-RULE-MPE-INITIAL-TABLE6': {
    ruleId: 'R76-RULE-MPE-INITIAL-TABLE6',
    standard: 'OIML R 76-1:2006',
    section: 'Clause 3.5.1, Table 6',
    description:
      'Maximum permissible errors on initial verification: +/-0.5 e, +/-1.0 e, +/-1.5 e according to accuracy class and load m expressed in verification scale intervals (m/e).',
    formula: '|E| <= MPE where MPE in {0.5 e, 1.0 e, 1.5 e}',
    applicability: 'Initial verification and conformity evaluation of NAWI',
    lastVerified: '2026-09-06',
  },
  'R76-RULE-MPE-SERVICE': {
    ruleId: 'R76-RULE-MPE-SERVICE',
    standard: 'OIML R 76-1:2006',
    section: 'Clause 3.5.2',
    description:
      'Maximum permissible errors in service: The maximum permissible errors in service shall be twice the maximum permissible errors on initial verification.',
    formula: 'MPE_service = 2 * MPE_initial',
    applicability: 'In-service periodic inspection and routine surveillance',
    lastVerified: '2026-09-06',
  },
  'R76-RULE-ERROR-INDICATION': {
    ruleId: 'R76-RULE-ERROR-INDICATION',
    standard: 'OIML R 76-1:2006',
    section: 'Clause 3.5.3.1 & Clause A.4.4.3',
    description:
      'Calculation of indication error: Error E = I - L (direct reading) or E = I + 0.5d - deltaL - L for rounded digital indication where d > 0.2e.',
    formula: 'E = I - L; Decision: PASS when |E| <= MPE, FAIL otherwise',
    applicability: 'Weighing performance test points across capacity',
    lastVerified: '2026-09-06',
  },
  'R76-RULE-REPEATABILITY': {
    ruleId: 'R76-RULE-REPEATABILITY',
    standard: 'OIML R 76-1:2006',
    section: 'Clause 3.6.1 & Clause A.4.10',
    description:
      'Repeatability test: The difference between the results of several weighings of the same load shall not be greater than the absolute value of the maximum permissible error of the instrument for that load.',
    formula: 'Range Spread = (I_max - I_min) <= |MPE(L)|',
    applicability: 'Repeatability testing at ~50% Max and Max loads',
    lastVerified: '2026-09-06',
  },
  'R76-RULE-ECCENTRICITY': {
    ruleId: 'R76-RULE-ECCENTRICITY',
    standard: 'OIML R 76-1:2006',
    section: 'Clause 3.6.2 & Clause A.4.7',
    description:
      'Eccentric loading test: Errors of an instrument with eccentric loading at quarter positions shall not exceed the maximum permissible errors for the applied load (~1/3 Max for <= 4 support points).',
    formula: '|E_pos| <= MPE(L_ecc) and |I_pos - I_center| <= MPE(L_ecc)',
    applicability: 'Instruments with load receptors (pan, platform)',
    lastVerified: '2026-09-06',
  },
  'R76-RULE-ZERO-SETTING': {
    ruleId: 'R76-RULE-ZERO-SETTING',
    standard: 'OIML R 76-1:2006',
    section: 'Clause 4.5.2.2 & Clause A.4.2.1',
    description:
      'Zero-setting device accuracy: The zero-setting device shall set the instrument to zero within +/-0.25 e.',
    formula: '|E_0| <= 0.25 e',
    applicability: 'Non-automatic, semi-automatic, or automatic zero-setting devices',
    lastVerified: '2026-09-06',
  },
  'R76-RULE-ZERO-RETURN': {
    ruleId: 'R76-RULE-ZERO-RETURN',
    standard: 'OIML R 76-1:2006',
    section: 'Clause A.4.3',
    description:
      'Zero-return test: After unloading a test load that has been left on the instrument for a period, the zero indication shall not vary by more than +/-0.5 e.',
    formula: '|Indication_zero_return| <= 0.5 e',
    applicability: 'Electronic NAWI instruments with zero device',
    lastVerified: '2026-09-06',
  },
  'R76-RULE-TARE-DEVICE': {
    ruleId: 'R76-RULE-TARE-DEVICE',
    standard: 'OIML R 76-1:2006',
    section: 'Clause 3.5.3.3, Clause 4.6 & Clause A.4.6',
    description:
      'Tare weighing test: The maximum permissible errors apply to any tare value, for net loads between zero and maximum net capacity.',
    formula: 'E_net = I_net - L_net; |E_net| <= MPE(L_net)',
    applicability: 'Instruments equipped with tare device',
    lastVerified: '2026-09-06',
  },
  'R76-RULE-DISCRIMINATION': {
    ruleId: 'R76-RULE-DISCRIMINATION',
    standard: 'OIML R 76-1:2006',
    section: 'Clause 3.8.2.2 & Clause A.4.8',
    description:
      'Discrimination for digital indication: An extra load equal to 1.4 d gently placed on the loaded instrument shall produce an indication change of at least 1.0 d.',
    formula: 'Delta_I >= 1.0 d when extra load delta_L = 1.4 d',
    applicability: 'Instruments with digital indication without continuous zero-tracking',
    lastVerified: '2026-09-06',
  },
};

export function getRuleMetadata(ruleId: string): OimlRuleMetadata | null {
  return OIML_R76_METADATA_REGISTRY[ruleId] || null;
}
