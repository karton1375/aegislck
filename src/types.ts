export type Role = 'master' | 'wearer';

export type PairingMode = 'autonomous' | 'paired';

export type GoalType = 'fixed' | 'indefinite';

export type LockStatus = 'ENFORCED' | 'INDEFINITE' | 'EMERGENCY_OVERRIDE';

export type AuditEventType =
  | 'GENESIS'
  | 'LOCK_INIT'
  | 'CHECK_IN'
  | 'STATE_CHANGE'
  | 'TAMPER_ALERT'
  | 'HYGIENE_WINDOW'
  | 'EMERGENCY_BREAK'
  | 'DIRECTIVE_ACK';

export interface AuditLogEntry {
  index: number;
  timestamp: number; // epoch ms
  formattedTime: string; // DD.MM.YY HH:MM
  eventType: AuditEventType;
  details: string;
  prevHash: string;
  hash: string;
  isValidSignature?: boolean;
}

export interface SessionConfig {
  deviceSize: string; // e.g. '90 мм'
  modelName: string;  // e.g. 'Aegis Titanium Core'
  goalType: GoalType;
  durationSeconds: number; // e.g. 259200 (3 days)
  startLockTimestamp: number;
  lastCheckinTimestamp: number;
  isEmergencyOverridden: boolean;
  emergencyOverrideTimestamp?: number;
}

export interface SecurityState {
  role: Role;
  pairingMode: PairingMode;
  secretKeyBase32: string;
  genesisHash: string;
  isSetupComplete: boolean;
  camouflageApp: 'aegis' | 'notes' | 'calc' | 'fitness';
  hygieneWindow: {
    isActive: boolean;
    startedAt: number | null;
    durationMinutes: number;
    inspectedTissue: boolean;
  };
}

export interface ChainVerificationResult {
  allValid: boolean;
  tamperedIndex: number | null;
  totalBlocks: number;
  verifiedAt: number;
}
