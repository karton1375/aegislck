import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  ShieldAlert,
  Key,
  Trash2,
  Lock,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Eye,
  EyeOff,
  Copy,
  Check,
  Crown,
  Clock,
  RefreshCw,
  HardDrive,
  X
} from 'lucide-react';
import { SecurityState, SessionConfig } from '../types';
import { generateTotp, verifyTotp } from '../crypto';
import {
  executeEmergencyOverride,
  getStorageFootprint,
  purgeSystemData,
  saveSecurityState
} from '../storage/db';

interface SettingsTabProps {
  secState: SecurityState;
  sessionConfig: SessionConfig;
  onRefreshData: () => Promise<void>;
  onLaunchDisguise: (type: 'notes' | 'calc' | 'fitness') => void;
  onResetToOnboarding: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  secState,
  sessionConfig,
  onRefreshData,
  onLaunchDisguise,
  onResetToOnboarding,
}) => {
  // Camouflage state
  const [camouflageApp, setCamouflageApp] = useState<'aegis' | 'notes' | 'calc' | 'fitness'>(
    secState.camouflageApp || 'aegis'
  );

  // Pairing & Key Details
  const [showKeyDetails, setShowKeyDetails] = useState<boolean>(false);
  const [qrPairingUrl, setQrPairingUrl] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  // Live Master Companion Helper (to preview TOTP code for testing/reset)
  const [showMasterCompanion, setShowMasterCompanion] = useState<boolean>(false);
  const [companionTotp, setCompanionTotp] = useState<string>('000000');
  const [companionRemaining, setCompanionRemaining] = useState<number>(60);
  const [companionProgress, setCompanionProgress] = useState<number>(0);

  // Reset Data TOTP field
  const [totpInput, setTotpInput] = useState<string>('');
  const [totpError, setTotpError] = useState<string>('');
  const [isVerifyingReset, setIsVerifyingReset] = useState<boolean>(false);
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);

  // Emergency Override Modal
  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);
  const [emergencyReason, setEmergencyReason] = useState<string>('Физический дискомфорт / сдавливание');
  const [isExecutingOverride, setIsExecutingOverride] = useState<boolean>(false);
  const [overrideConfirmationText, setOverrideConfirmationText] = useState<string>('');

  // Storage footprint
  const footprint = getStorageFootprint();

  // Update camouflage system
  const handleSelectCamouflage = (type: 'aegis' | 'notes' | 'calc' | 'fitness') => {
    setCamouflageApp(type);
    const updated = { ...secState, camouflageApp: type };
    saveSecurityState(updated);

    // Apply document title and favicon
    if (type === 'calc') {
      document.title = 'Калькулятор';
    } else if (type === 'notes') {
      document.title = 'Заметки';
    } else if (type === 'fitness') {
      document.title = 'Фитнес-трекер';
    } else {
      document.title = 'Aegis Lock';
    }
  };

  // Generate QR for Pairing
  useEffect(() => {
    if (showKeyDetails && secState.secretKeyBase32) {
      const uri = `otpauth://totp/AegisLock:Enforcer?secret=${secState.secretKeyBase32}&issuer=AegisLock&period=60&digits=6&algorithm=SHA256`;
      QRCode.toDataURL(uri, {
        width: 180,
        margin: 1,
        color: { dark: '#FF2A85', light: '#08080A' },
      })
        .then((url) => setQrPairingUrl(url))
        .catch((err) => console.error(err));
    }
  }, [showKeyDetails, secState.secretKeyBase32]);

  // Master Companion TOTP ticker
  useEffect(() => {
    if (showMasterCompanion && secState.secretKeyBase32) {
      let isMounted = true;
      const tick = async () => {
        try {
          const res = await generateTotp(secState.secretKeyBase32);
          if (isMounted) {
            setCompanionTotp(res.code);
            setCompanionRemaining(res.remainingSeconds);
            setCompanionProgress(res.progress);
          }
        } catch {
          // ignore
        }
      };
      tick();
      const interval = setInterval(tick, 1000);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
  }, [showMasterCompanion, secState.secretKeyBase32]);

  // Copy Key
  const handleCopySecretKey = () => {
    navigator.clipboard.writeText(secState.secretKeyBase32);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Validate TOTP and execute Reset
  const handleExecuteReset = async () => {
    setTotpError('');
    if (totpInput.trim().length !== 6) {
      setTotpError('Введите полный 6-значный TOTP-код');
      return;
    }

    setIsVerifyingReset(true);
    try {
      const isValid = await verifyTotp(totpInput, secState.secretKeyBase32);
      if (!isValid) {
        setTotpError('Неверный TOTP-код или истек 60-секундный интервал. Сброс заблокирован.');
        setIsVerifyingReset(false);
        return;
      }

      setResetSuccess(true);
      purgeSystemData();
      setTimeout(() => {
        onResetToOnboarding();
      }, 1500);
    } catch (err) {
      setTotpError('Ошибка криптографической проверки');
      setIsVerifyingReset(false);
    }
  };

  // Execute Emergency Override
  const handleConfirmEmergencyOverride = async () => {
    if (overrideConfirmationText.trim().toUpperCase() !== 'OVERRIDE') {
      return;
    }
    setIsExecutingOverride(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 100, 100]);
      }
      await executeEmergencyOverride(emergencyReason);
      await onRefreshData();
      setIsExecutingOverride(false);
      setShowEmergencyModal(false);
    } catch (err) {
      console.error(err);
      setIsExecutingOverride(false);
    }
  };

  return (
    <div id="settings-tab-view" className="space-y-4 pb-24 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="px-1">
        <h2 className="text-sm font-semibold text-white tracking-wider flex items-center gap-1.5">
          <Lock size={14} className="text-[#FF2A85]" />
          БЕЗОПАСНОСТЬ И КОНФИГУРАЦИЯ
        </h2>
        <p className="text-[10px] text-[#71717A] font-mono mt-0.5">
          КАМУФЛЯЖ, СВЯЗКА И АВАРИЙНЫЙ ПРОТОКОЛ
        </p>
      </div>

      {/* 1. КАМУФЛЯЖ (App Icon & Title via activity-alias) */}
      <div className="p-4 bg-[#121217] rounded-xl border border-[#1E1E26] space-y-3 mx-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone size={16} className="text-[#FF2A85]" />
            <h3 className="text-xs font-semibold text-white tracking-tight">
              Камуфляж (Activity-Alias)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-[#71717A]">
            СИСТЕМНЫЙ ЯРЛЫК
          </span>
        </div>

        <p className="text-[11px] text-[#71717A] leading-relaxed">
          Переключение ярлыка приложения и заголовка в AndroidManifest для сокрытия назначения программы:
        </p>

        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'aegis', name: 'Оригинал', sub: 'Aegis Enforcer' },
            { id: 'notes', name: 'Заметки', sub: 'com.android.notes' },
            { id: 'calc', name: 'Калькулятор', sub: 'com.android.calc' },
            { id: 'fitness', name: 'Фитнес-трекер', sub: 'com.fit.tracker' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelectCamouflage(item.id as any)}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                camouflageApp === item.id
                  ? 'bg-[#08080A] border-[#FF2A85] text-white shadow-neon-subtle'
                  : 'bg-[#08080A]/60 border-[#1E1E26] text-[#71717A]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">{item.name}</span>
                {camouflageApp === item.id && (
                  <CheckCircle2 size={12} className="text-[#FF2A85]" />
                )}
              </div>
              <span className="text-[9px] font-mono text-[#71717A] block mt-0.5 truncate">
                {item.sub}
              </span>
            </button>
          ))}
        </div>

        {camouflageApp !== 'aegis' && (
          <button
            id="launch-disguise-btn"
            onClick={() => onLaunchDisguise(camouflageApp as any)}
            className="w-full py-2 bg-[#1E1E26] hover:bg-[#2D2D3A] text-white text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Запустить маскировочный экран</span>
          </button>
        )}
      </div>

      {/* 2. СВЯЗКА С ХОЗЯИНОМ */}
      <div className="p-4 bg-[#121217] rounded-xl border border-[#1E1E26] space-y-3 mx-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-[#FF2A85]" />
            <h3 className="text-xs font-semibold text-white tracking-tight">
              Связка с Хозяином (Keystore)
            </h3>
          </div>
          <span
            className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
              secState.pairingMode === 'paired'
                ? 'bg-[#FF2A85]/10 text-[#FF2A85] border-[#FF2A85]/30'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700'
            }`}
          >
            {secState.pairingMode === 'paired' ? 'PAIRED (КЛЮЧ АКТИВЕН)' : 'AUTONOMOUS'}
          </span>
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-[#71717A]">
            <span>Статус соединения:</span>
            <span className="text-white font-mono">
              {secState.pairingMode === 'paired' ? 'Связан через HMAC Seed' : 'Автономное шифрование'}
            </span>
          </div>
          <div className="flex justify-between text-[#71717A]">
            <span>База данных:</span>
            <span className="text-white font-mono">{footprint.formattedSize}</span>
          </div>
          <div className="flex justify-between text-[#71717A]">
            <span>Genesis Hash:</span>
            <span className="text-[#A1A1AA] font-mono truncate max-w-[150px]">
              {secState.genesisHash}
            </span>
          </div>
        </div>

        <div className="pt-1 flex gap-2">
          <button
            onClick={() => setShowKeyDetails(!showKeyDetails)}
            className="flex-1 py-2 bg-[#08080A] hover:bg-[#1E1E26] border border-[#1E1E26] rounded-lg text-[11px] font-medium text-[#A1A1AA] hover:text-white flex items-center justify-center gap-1.5 transition-colors"
          >
            {showKeyDetails ? <EyeOff size={12} /> : <Eye size={12} />}
            <span>{showKeyDetails ? 'Скрыть ключ' : 'Показать ключ и QR'}</span>
          </button>

          {/* Quick open Companion TOTP test */}
          <button
            onClick={() => setShowMasterCompanion(!showMasterCompanion)}
            className="py-2 px-3 bg-[#FF2A85]/10 hover:bg-[#FF2A85]/20 border border-[#FF2A85]/30 rounded-lg text-[11px] font-medium text-[#FF2A85] flex items-center gap-1 transition-colors"
            title="Окно Хозяина для проверки TOTP"
          >
            <Crown size={13} />
            <span>Тест TOTP</span>
          </button>
        </div>

        {/* Revealed Secret Key & QR Code */}
        {showKeyDetails && (
          <div className="p-3 bg-[#08080A] rounded-xl border border-[#1E1E26] space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#71717A] font-mono">HMAC SEED (KEYSTORE):</span>
              <button
                onClick={handleCopySecretKey}
                className="text-[10px] text-[#FF2A85] flex items-center gap-1 hover:underline"
              >
                {copiedKey ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedKey ? 'Скопировано' : 'Копировать'}</span>
              </button>
            </div>
            <div className="p-2 bg-[#121217] rounded border border-[#1E1E26] font-mono text-[11px] text-white break-all">
              {secState.secretKeyBase32}
            </div>

            {qrPairingUrl && (
              <div className="flex flex-col items-center pt-1">
                <img
                  src={qrPairingUrl}
                  alt="Pairing QR"
                  className="w-32 h-32 rounded-lg border border-[#1E1E26] p-1 bg-black"
                />
                <span className="text-[9px] text-[#71717A] font-mono mt-1">
                  QR-код для связки другого устройства
                </span>
              </div>
            )}
          </div>
        )}

        {/* Master Companion Popup (shows live 60s TOTP code) */}
        {showMasterCompanion && (
          <div className="p-3.5 bg-[#FF2A85]/10 rounded-xl border border-[#FF2A85]/30 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white font-semibold flex items-center gap-1.5">
                <Crown size={14} className="text-[#FF2A85]" />
                Окно Хозяина (Live TOTP):
              </span>
              <span className="text-[10px] font-mono text-[#FF2A85]">
                Осталось: {companionRemaining}с
              </span>
            </div>
            <div className="text-center py-1 font-mono text-2xl font-bold tracking-[0.25em] text-white text-glow-pink">
              {companionTotp.slice(0, 3)} {companionTotp.slice(3)}
            </div>
            <div className="w-full bg-[#08080A] h-1 rounded-full overflow-hidden">
              <div
                className="bg-[#FF2A85] h-full transition-all duration-1000"
                style={{ width: `${100 - companionProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-[#A1A1AA] text-center leading-tight">
              Используйте этот код для валидации защищенного сброса ниже.
            </p>
          </div>
        )}
      </div>

      {/* 3. СБРОС ДАННЫХ (TOTP PROTECTED) */}
      <div className="p-4 bg-[#121217] rounded-xl border border-[#1E1E26] space-y-3 mx-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 size={16} className="text-amber-400" />
            <h3 className="text-xs font-semibold text-white tracking-tight">
              Сброс данных (Защита TOTP)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-amber-400">
            RFC 6238 60s
          </span>
        </div>

        <p className="text-[11px] text-[#71717A] leading-relaxed">
          Удаление локальной базы данных и сброс сессии строго заблокированы. Для очистки требуется 6-значный одноразовый код с устройства Хозяина:
        </p>

        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={6}
              value={totpInput}
              onChange={(e) => {
                setTotpInput(e.target.value.replace(/\D/g, ''));
                setTotpError('');
              }}
              placeholder="Введите 6 цифр"
              className="flex-1 bg-[#08080A] border border-[#1E1E26] focus:border-[#FF2A85] rounded-lg px-3 py-2 text-center font-mono text-base tracking-[0.25em] text-white placeholder:text-[#52525B] focus:outline-none"
            />
            <button
              onClick={handleExecuteReset}
              disabled={isVerifyingReset || totpInput.length !== 6 || resetSuccess}
              className="px-4 py-2 bg-red-950/60 hover:bg-red-900/80 border border-red-800/60 text-red-300 font-semibold text-xs rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              <span>Сбросить</span>
            </button>
          </div>

          {totpError && (
            <p className="text-[11px] text-red-400 font-mono">{totpError}</p>
          )}

          {resetSuccess && (
            <p className="text-[11px] text-emerald-400 font-mono">
              ✓ TOTP подтвержден. База данных очищена. Перезапуск...
            </p>
          )}
        </div>
      </div>

      {/* 4. АВАРИЙНЫЙ ПРОТОКОЛ (EMERGENCY OVERRIDE) */}
      <div className="p-4 bg-red-950/20 rounded-xl border border-red-900/40 space-y-3 mx-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-red-400" />
            <h3 className="text-xs font-semibold text-red-300 tracking-tight">
              Аварийный протокол (Emergency Override)
            </h3>
          </div>
          <span className="text-[9px] font-mono text-red-400 bg-red-950/60 px-1.5 py-0.5 rounded border border-red-800/40">
            CRITICAL SAFETY
          </span>
        </div>

        <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
          Принудительное завершение сессии в случае боли, отека или травмы. Действие мгновенно записывает неудаляемый статус <strong className="text-red-300">TAMPER / EMERGENCY BREAK</strong> в криптографический журнал, но оставляет доступ к приложению открытым.
        </p>

        <button
          id="emergency-override-open-btn"
          onClick={() => setShowEmergencyModal(true)}
          className="w-full py-2.5 bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-950/30"
        >
          <ShieldAlert size={16} />
          <span>Активировать аварийный протокол</span>
        </button>
      </div>

      {/* EMERGENCY MODAL CONFIRMATION */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#121217] border border-red-500/50 rounded-2xl w-full max-w-sm p-4 text-xs space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E1E26]">
              <div className="flex items-center gap-2 font-semibold text-red-400">
                <AlertTriangle size={18} />
                <span>ПОДТВЕРЖДЕНИЕ АВАРИЙНОГО ПРОТОКОЛА</span>
              </div>
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="text-[#71717A] hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 bg-red-950/40 rounded-xl border border-red-800/50 text-red-200 text-[11px] leading-relaxed">
              <strong>ВНИМАНИЕ:</strong> Фиксация будет прервана. В криптографическую HMAC цепочку будет навсегда внесен блок нарушения с меткой времени. Стереть или скрыть эту запись невозможно.
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-[#A1A1AA] block">
                Причина снятия фиксации:
              </label>
              <select
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
                className="w-full bg-[#08080A] border border-[#1E1E26] rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none"
              >
                <option value="Физический дискомфорт / сдавливание">
                  Физический дискомфорт / сдавливание
                </option>
                <option value="Отек тканей или нарушение кровообращения">
                  Отек тканей или нарушение кровообращения
                </option>
                <option value="Механическая неисправность замка">
                  Механическая неисправность замка
                </option>
                <option value="Внеплановое медицинское вмешательство">
                  Внеплановое медицинское вмешательство
                </option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-[#A1A1AA] block">
                Для подтверждения введите слово <strong>OVERRIDE</strong>:
              </label>
              <input
                type="text"
                value={overrideConfirmationText}
                onChange={(e) => setOverrideConfirmationText(e.target.value)}
                placeholder="OVERRIDE"
                className="w-full bg-[#08080A] border border-[#1E1E26] focus:border-red-500 rounded-lg px-3 py-2 font-mono text-center text-xs text-white focus:outline-none uppercase"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="flex-1 py-2.5 bg-[#1E1E26] hover:bg-[#2D2D3A] text-[#A1A1AA] hover:text-white rounded-xl font-medium text-xs transition-colors"
              >
                Отмена
              </button>
              <button
                id="emergency-confirm-execute-btn"
                onClick={handleConfirmEmergencyOverride}
                disabled={
                  isExecutingOverride ||
                  overrideConfirmationText.trim().toUpperCase() !== 'OVERRIDE'
                }
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl text-xs transition-colors disabled:opacity-40"
              >
                {isExecutingOverride ? 'Запись в цепь...' : 'Подтвердить разрыв'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
