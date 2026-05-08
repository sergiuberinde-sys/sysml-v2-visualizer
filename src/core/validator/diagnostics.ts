// ── Parser ────────────────────────────────────────────────────────────────────
export const UNSUPPORTED_SYNTAX          = 'UNSUPPORTED_SYNTAX';

// ── Reference resolution ──────────────────────────────────────────────────────
export const DUPLICATE_NAME              = 'DUPLICATE_NAME';
export const UNKNOWN_PARTICIPANT         = 'UNKNOWN_PARTICIPANT';
export const UNKNOWN_INTERFACE           = 'UNKNOWN_INTERFACE';
export const UNKNOWN_PART                = 'UNKNOWN_PART';
export const UNKNOWN_PORT                = 'UNKNOWN_PORT';
export const UNKNOWN_ACTION              = 'UNKNOWN_ACTION';
export const UNKNOWN_STATE               = 'UNKNOWN_STATE';
export const WRONG_CONTEXT               = 'WRONG_CONTEXT';
export const AMBIGUOUS_REFERENCE         = 'AMBIGUOUS_REFERENCE';
export const UNRESOLVED_REFERENCE        = 'UNRESOLVED_REFERENCE';

// ── Type / structural compatibility ───────────────────────────────────────────
export const INCOMPATIBLE_PORT_TYPES      = 'INCOMPATIBLE_PORT_TYPES';
export const INCOMPATIBLE_PORT_DIRECTIONS = 'INCOMPATIBLE_PORT_DIRECTIONS';
export const SELF_FLOW                    = 'SELF_FLOW';
export const DUPLICATE_TRANSITION         = 'DUPLICATE_TRANSITION';

// ── State machine ─────────────────────────────────────────────────────────────
export const MISSING_INITIAL_STATE       = 'MISSING_INITIAL_STATE';
export const DUPLICATE_STATE             = 'DUPLICATE_STATE';
export const DUPLICATE_ACTION            = 'DUPLICATE_ACTION';

// ── Traceability ──────────────────────────────────────────────────────────────
export const BROKEN_TRACE_LINK           = 'BROKEN_TRACE_LINK';
export const SUSPICIOUS_TRACE_LINK       = 'SUSPICIOUS_TRACE_LINK';
export const DUPLICATE_REQUIREMENT_ID    = 'DUPLICATE_REQUIREMENT_ID';
export const MISSING_REQUIREMENT_ID      = 'MISSING_REQUIREMENT_ID';
export const MISSING_REQUIREMENT_TEXT    = 'MISSING_REQUIREMENT_TEXT';
