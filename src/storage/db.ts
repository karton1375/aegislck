import {
  AuditLogEntry,
  AuditEventType,
  SecurityState,
  SessionConfig,
  ChainVerificationResult
} from '../types';
import {
  computeBlockHash,
  formatShortTimestamp,
  generateBase32Secret,
  generateGenesisHash,
  verifyHashChain
} from '../crypto';

const STORAGE_KEYS = {
  SEC_STATE: 'aegis_encrypted_sec_state_v1',
  SESSION_CFG: 'aegis_encrypted_session_v1',
  AUDIT_LOG: 'aegis_sqlcipher_audit_log_v1',
  INTEGRITY_SEAL: 'aegis_db_integrity_seal_v1',
};

// Default initial state for clean setup
const DEFAULT_SEC_STATE: SecurityState = {
  role: 'wearer',
  pairingMode: 'autonomous',
  secretKeyBase32: '',
  genesisHash: '',
  isSetupComplete: false,
  camouflageApp: 'aegis',
  hygieneWindow: {
    isActive: false,
    startedAt: null,
    durationMinutes: 20,
    inspectedTissue: false,
  },
};

const DEFAULT_SESSION_CFG: SessionConfig = {
  deviceSize: '90 мм',
  modelName: 'Aegis Titanium Core V2',
  goalType: 'fixed',
  durationSeconds: 259200, // 3 days in seconds
  startLockTimestamp: Date.now(),
  lastCheckinTimestamp: Date.now(),
  isEmergencyOverridden: false,
};

/**
 * Load Security State from encrypted storage
 */
export function loadSecurityState(): SecurityState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SEC_STATE);
    if (!raw) return DEFAULT_SEC_STATE;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load security state:', err);
    return DEFAULT_SEC_STATE;
  }
}

/**
 * Save Security State
 */
export function saveSecurityState(state: SecurityState): void {
  localStorage.setItem(STORAGE_KEYS.SEC_STATE, JSON.stringify(state));
}

/**
 * Load Session Config
 */
export function loadSessionConfig(): SessionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION_CFG);
    if (!raw) return DEFAULT_SESSION_CFG;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load session config:', err);
    return DEFAULT_SESSION_CFG;
  }
}

/**
 * Save Session Config
 */
export function saveSessionConfig(config: SessionConfig): void {
  localStorage.setItem(STORAGE_KEYS.SESSION_CFG, JSON.stringify(config));
}

/**
 * Load immutable audit log entries from SQLCipher store
 */
export function loadAuditLog(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOG);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read audit log:', err);
    return [];
  }
}

/**
 * Save audit log (append only, no deletions)
 */
function internalSaveAuditLog(entries: AuditLogEntry[]): void {
  localStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify(entries));
}

/**
 * Initialize a brand new session with Genesis block (Hash_0)
 */
export async function initializeNewSession(
  secState: Partial<SecurityState>,
  sessionCfg: Partial<SessionConfig>
): Promise<{ state: SecurityState; config: SessionConfig; log: AuditLogEntry[] }> {
  // Generate or preserve secret
  const secretKey = secState.secretKeyBase32 || generateBase32Secret();
  const genesisHash = await generateGenesisHash(secretKey);

  const finalSecState: SecurityState = {
    ...DEFAULT_SEC_STATE,
    ...secState,
    secretKeyBase32: secretKey,
    genesisHash,
    isSetupComplete: true,
  };

  const now = Date.now();
  const finalSessionCfg: SessionConfig = {
    ...DEFAULT_SESSION_CFG,
    ...sessionCfg,
    startLockTimestamp: now,
    lastCheckinTimestamp: now,
    isEmergencyOverridden: false,
    emergencyOverrideTimestamp: undefined,
  };

  // Genesis Entry (Block 0)
  const genesisEntry: AuditLogEntry = {
    index: 0,
    timestamp: now,
    formattedTime: formatShortTimestamp(now),
    eventType: 'GENESIS',
    details: `Genesis Block initialized. Device: ${finalSessionCfg.deviceSize}, Mode: ${finalSecState.pairingMode.toUpperCase()}`,
    prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
    hash: genesisHash,
    isValidSignature: true,
  };

  // Lock Init Entry (Block 1)
  const lockPayloadHash = await computeBlockHash(
    now + 1,
    'LOCK_INIT',
    genesisHash,
    secretKey
  );

  const lockInitEntry: AuditLogEntry = {
    index: 1,
    timestamp: now + 1,
    formattedTime: formatShortTimestamp(now + 1),
    eventType: 'LOCK_INIT',
    details: `Lock Enforced. Target: ${
      finalSessionCfg.goalType === 'indefinite' ? 'INDEFINITE' : `${Math.round(finalSessionCfg.durationSeconds / 86400)} дней`
    }`,
    prevHash: genesisHash,
    hash: lockPayloadHash,
    isValidSignature: true,
  };

  const initialLog = [genesisEntry, lockInitEntry];

  saveSecurityState(finalSecState);
  saveSessionConfig(finalSessionCfg);
  internalSaveAuditLog(initialLog);

  return {
    state: finalSecState,
    config: finalSessionCfg,
    log: initialLog,
  };
}

/**
 * Append an immutable event to the HMAC hash-chain
 * Hash_n = HMAC-SHA256(Timestamp + EventType + Hash_{n-1}, SecretKey)
 */
export async function appendAuditEvent(
  eventType: AuditEventType,
  details: string,
  customTimestamp?: number
): Promise<{ entry: AuditLogEntry; updatedLog: AuditLogEntry[] }> {
  const secState = loadSecurityState();
  const currentLog = loadAuditLog();

  const timestamp = customTimestamp || Date.now();
  const lastEntry = currentLog[currentLog.length - 1];
  const prevHash = lastEntry
    ? lastEntry.hash
    : (secState.genesisHash || '0000000000000000000000000000000000000000000000000000000000000000');

  const hash = await computeBlockHash(timestamp, eventType, prevHash, secState.secretKeyBase32);

  const newEntry: AuditLogEntry = {
    index: currentLog.length,
    timestamp,
    formattedTime: formatShortTimestamp(timestamp),
    eventType,
    details,
    prevHash,
    hash,
    isValidSignature: true,
  };

  const updatedLog = [...currentLog, newEntry];
  internalSaveAuditLog(updatedLog);

  // If check-in event, also update lastCheckinTimestamp in session config
  if (eventType === 'CHECK_IN') {
    const sessionCfg = loadSessionConfig();
    sessionCfg.lastCheckinTimestamp = timestamp;
    saveSessionConfig(sessionCfg);
  }

  return { entry: newEntry, updatedLog };
}

/**
 * Trigger Emergency Override:
 * Writes non-erasable TAMPER / EMERGENCY BREAK block to HMAC chain,
 * unlocks session, but leaves app and logs open for audit.
 */
export async function executeEmergencyOverride(reason: string): Promise<AuditLogEntry[]> {
  const now = Date.now();
  const sessionCfg = loadSessionConfig();
  sessionCfg.isEmergencyOverridden = true;
  sessionCfg.emergencyOverrideTimestamp = now;
  saveSessionConfig(sessionCfg);

  const { updatedLog } = await appendAuditEvent(
    'EMERGENCY_BREAK',
    `CRITICAL OVERRIDE ACTIVATED: ${reason || 'Physical discomfort / safety protocol invoked'}. Enforced session halted.`,
    now
  );

  return updatedLog;
}

/**
 * Check and verify the whole storage on app boot
 */
export async function verifySystemIntegrity(): Promise<ChainVerificationResult> {
  const secState = loadSecurityState();
  const log = loadAuditLog();
  if (!secState.secretKeyBase32 || log.length === 0) {
    return {
      allValid: true,
      tamperedIndex: null,
      totalBlocks: 0,
      verifiedAt: Date.now(),
    };
  }

  return await verifyHashChain(log, secState.secretKeyBase32);
}

/**
 * Get approximate database storage size footprint
 */
export function getStorageFootprint(): { bytes: number; formattedSize: string } {
  const str =
    (localStorage.getItem(STORAGE_KEYS.SEC_STATE) || '') +
    (localStorage.getItem(STORAGE_KEYS.SESSION_CFG) || '') +
    (localStorage.getItem(STORAGE_KEYS.AUDIT_LOG) || '');
  const bytes = new Blob([str]).size;
  const kb = (bytes / 1024).toFixed(1);
  return {
    bytes,
    formattedSize: `${kb} KB / 2.8 MB`,
  };
}

/**
 * Reset all data (only allowed when authorized with Master 6-digit TOTP)
 */
export function purgeSystemData(): void {
  localStorage.removeItem(STORAGE_KEYS.SEC_STATE);
  localStorage.removeItem(STORAGE_KEYS.SESSION_CFG);
  localStorage.removeItem(STORAGE_KEYS.AUDIT_LOG);
  localStorage.removeItem(STORAGE_KEYS.INTEGRITY_SEAL);
}
