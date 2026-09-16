import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Hash,
  Clock,
  Sparkles,
  ExternalLink,
  X
} from 'lucide-react';
import { AuditLogEntry, ChainVerificationResult, SecurityState } from '../types';
import { verifyHashChain } from '../crypto';

interface AuditLogTabProps {
  secState: SecurityState;
  auditLog: AuditLogEntry[];
}

export const AuditLogTab: React.FC<AuditLogTabProps> = ({ secState, auditLog }) => {
  const [verificationResult, setVerificationResult] = useState<ChainVerificationResult>({
    allValid: true,
    tamperedIndex: null,
    totalBlocks: auditLog.length,
    verifiedAt: Date.now(),
  });
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [simulatedTamperedLog, setSimulatedTamperedLog] = useState<AuditLogEntry[] | null>(null);

  const activeLog = simulatedTamperedLog || auditLog;

  // Background verification on load / updates
  const runVerification = async (logToVerify: AuditLogEntry[] = auditLog) => {
    setIsVerifying(true);
    try {
      const res = await verifyHashChain(logToVerify, secState.secretKeyBase32);
      setVerificationResult(res);
    } catch (err) {
      console.error('Verification error:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    runVerification(activeLog);
  }, [auditLog, secState.secretKeyBase32, simulatedTamperedLog]);

  // Event badge colors and labels
  const getEventBadge = (type: string) => {
    switch (type) {
      case 'GENESIS':
        return {
          label: 'GENESIS BLOCK',
          bg: 'bg-purple-950/40 text-purple-300 border-purple-800/40',
        };
      case 'LOCK_INIT':
        return {
          label: 'LOCK INITIALIZED',
          bg: 'bg-[#FF2A85]/15 text-[#FF2A85] border-[#FF2A85]/30',
        };
      case 'CHECK_IN':
        return {
          label: 'CHECK-IN',
          bg: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40',
        };
      case 'HYGIENE_WINDOW':
        return {
          label: 'HYGIENE WINDOW',
          bg: 'bg-cyan-950/40 text-cyan-300 border-cyan-800/40',
        };
      case 'STATE_CHANGE':
        return {
          label: 'STATE CHANGE',
          bg: 'bg-amber-950/40 text-amber-300 border-amber-800/40',
        };
      case 'DIRECTIVE_ACK':
        return {
          label: 'DIRECTIVE ACK',
          bg: 'bg-blue-950/40 text-blue-300 border-blue-800/40',
        };
      case 'TAMPER_ALERT':
      case 'EMERGENCY_BREAK':
        return {
          label: type === 'EMERGENCY_BREAK' ? 'EMERGENCY OVERRIDE' : 'TAMPER ALERT',
          bg: 'bg-red-950/50 text-red-400 border-red-800/50',
        };
      default:
        return {
          label: type,
          bg: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        };
    }
  };

  // Toggle simulated tamper test for cryptographic proof
  const handleSimulateTamper = async () => {
    if (simulatedTamperedLog) {
      // Revert simulation
      setSimulatedTamperedLog(null);
    } else {
      // Tamper with block 1 text
      const cloned: AuditLogEntry[] = JSON.parse(JSON.stringify(auditLog));
      if (cloned.length > 1) {
        cloned[1].details = 'TAMPERED: Unauthorized modification of target days';
        setSimulatedTamperedLog(cloned);
      }
    }
  };

  return (
    <div id="audit-log-tab-view" className="space-y-4 pb-20 animate-in fade-in duration-150">
      {/* Top Header info */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-wider flex items-center gap-1.5">
            <Lock size={14} className="text-[#FF2A85]" />
            НЕИЗМЕНЯЕМЫЙ ЖУРНАЛ
          </h2>
          <p className="text-[10px] text-[#71717A] font-mono mt-0.5">
            HMAC HASH-CHAIN (READ-ONLY AUDIT)
          </p>
        </div>

        <button
          id="re-verify-chain-btn"
          onClick={() => runVerification(activeLog)}
          disabled={isVerifying}
          className="flex items-center gap-1 text-[11px] text-[#A1A1AA] hover:text-white bg-[#121217] border border-[#1E1E26] px-2.5 py-1 rounded-lg transition-colors"
        >
          <RefreshCw size={12} className={isVerifying ? 'animate-spin text-[#FF2A85]' : ''} />
          <span>Проверить</span>
        </button>
      </div>

      {/* CHAIN INTEGRITY BANNER */}
      <div
        className={`p-3.5 rounded-xl border transition-all ${
          verificationResult.allValid
            ? 'bg-[#121217] border-emerald-500/30'
            : 'bg-red-950/40 border-red-500/50 shadow-lg shadow-red-950/20'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                verificationResult.allValid
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-red-500/20 text-red-400 animate-pulse'
              }`}
            >
              {verificationResult.allValid ? (
                <ShieldCheck size={22} />
              ) : (
                <ShieldAlert size={22} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-white tracking-tight">
                  {verificationResult.allValid
                    ? 'Цепочка HMAC верифицирована'
                    : 'НАРУШЕНИЕ ЦЕЛОСТНОСТИ ДАННЫХ'}
                </h3>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                    verificationResult.allValid
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/30 text-red-300'
                  }`}
                >
                  {verificationResult.allValid ? '100% VALID' : 'TAMPER DETECTED'}
                </span>
              </div>
              <p className="text-[11px] text-[#71717A] mt-0.5 leading-relaxed">
                {verificationResult.allValid
                  ? `Все ${activeLog.length} блоков проверены от Genesis 0. Подписи HMAC-SHA256 валидны.`
                  : `Обнаружена модификация в блоке #${verificationResult.tamperedIndex}. Хэш-подпись не совпадает!`}
              </p>
            </div>
          </div>
        </div>

        {/* Cryptographic Proof Formula reminder */}
        <div className="mt-2.5 pt-2 border-t border-[#1E1E26] flex items-center justify-between text-[10px] text-[#71717A] font-mono">
          <span>Hash_n = HMAC(t + type + Hash_n-1)</span>
          <button
            id="simulate-tamper-btn"
            onClick={handleSimulateTamper}
            className={`hover:underline transition-colors ${
              simulatedTamperedLog ? 'text-red-400 font-bold' : 'text-[#71717A] hover:text-[#FF2A85]'
            }`}
          >
            {simulatedTamperedLog ? '← Отменить тест подделки' : 'Симуляция взлома'}
          </button>
        </div>
      </div>

      {/* READ-ONLY NOTICE */}
      <div className="px-1 flex items-center justify-between text-[11px] text-[#71717A]">
        <span>Всего записей: {activeLog.length}</span>
        <span className="text-[10px] font-mono text-[#52525B]">
          РЕЖИМ: ТОЛЬКО ДЛЯ ЧТЕНИЯ (APPEND-ONLY)
        </span>
      </div>

      {/* IMMUTABLE LOG VERTICAL LIST (Chronological, Genesis on top or reverse) */}
      <div className="space-y-2 px-1">
        {activeLog.map((entry, idx) => {
          const badge = getEventBadge(entry.eventType);
          const isTampered =
            !verificationResult.allValid && verificationResult.tamperedIndex === idx;

          return (
            <div
              key={entry.index}
              id={`audit-log-entry-${entry.index}`}
              onClick={() => setSelectedEntry(entry)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                isTampered
                  ? 'bg-red-950/30 border-red-500/80 shadow-md'
                  : 'bg-[#121217] border-[#1E1E26] hover:border-[#2D2D3A]'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-mono px-2 py-0.5 rounded border font-semibold tracking-wider ${badge.bg}`}
                  >
                    {badge.label}
                  </span>
                  <span className="text-[10px] font-mono text-[#71717A]">
                    БЛОК #{entry.index}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Integrity Indicator (Green marker) */}
                  {isTampered ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded border border-red-800/40">
                      <AlertTriangle size={10} />
                      TAMPERED
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-800/30">
                      <CheckCircle2 size={10} />
                      HMAC OK
                    </span>
                  )}
                </div>
              </div>

              {/* Event Details Text */}
              <p className="text-xs text-white/90 leading-snug mb-2 font-sans">
                {entry.details}
              </p>

              {/* Timestamp and Truncated Hash */}
              <div className="flex items-center justify-between text-[10px] font-mono text-[#71717A] pt-1.5 border-t border-[#1E1E26]/60">
                <div className="flex items-center gap-1">
                  <Clock size={11} className="text-[#71717A]" />
                  <span>{entry.formattedTime}</span>
                </div>
                <div className="flex items-center gap-1 truncate max-w-[140px] text-[#A1A1AA]">
                  <Hash size={11} className="text-[#FF2A85] shrink-0" />
                  <span className="truncate">{entry.hash.slice(0, 14)}...</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* BLOCK INSPECTION MODAL */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#121217] border border-[#1E1E26] rounded-2xl w-full max-w-sm p-4 text-xs space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E1E26]">
              <div className="flex items-center gap-1.5 font-mono text-[#FF2A85] font-semibold">
                <Hash size={14} />
                <span>БЛОК #{selectedEntry.index} ({selectedEntry.eventType})</span>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-[#71717A] hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 font-mono">
              <div>
                <span className="text-[10px] text-[#71717A] block">ВРЕМЯ ФИКСАЦИИ:</span>
                <span className="text-white">{selectedEntry.formattedTime} ({selectedEntry.timestamp} ms)</span>
              </div>

              <div>
                <span className="text-[10px] text-[#71717A] block">ОПИСАНИЕ СОБЫТИЯ:</span>
                <p className="text-white font-sans text-xs bg-[#08080A] p-2 rounded border border-[#1E1E26]">
                  {selectedEntry.details}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-[#71717A] block">ПРЕДЫДУЩИЙ ХЭШ (Hash_{selectedEntry.index - 1}):</span>
                <p className="text-[#71717A] text-[10px] break-all bg-[#08080A] p-2 rounded border border-[#1E1E26]">
                  {selectedEntry.prevHash}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-[#FF2A85] block">ХЭШ БЛОКА (Hash_{selectedEntry.index}):</span>
                <p className="text-[#FF2A85] text-[10px] break-all bg-[#08080A] p-2 rounded border border-[#FF2A85]/30 shadow-neon-subtle">
                  {selectedEntry.hash}
                </p>
              </div>

              <div className="pt-2">
                <span className="text-[10px] text-[#71717A] block">ФОРМУЛА ВЕРИФИКАЦИИ:</span>
                <p className="text-[9px] text-[#A1A1AA] bg-[#08080A] p-2 rounded border border-[#1E1E26]">
                  HMAC-SHA256("{selectedEntry.timestamp}{selectedEntry.eventType}{selectedEntry.prevHash.slice(0, 8)}...", Key)
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedEntry(null)}
              className="w-full py-2.5 rounded-xl bg-[#1E1E26] hover:bg-[#2D2D3A] text-white font-semibold text-xs transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
