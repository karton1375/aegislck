import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Crown,
  User,
  ShieldCheck,
  QrCode,
  Sliders,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Key,
  Clock,
  Sparkles,
  Lock,
  Copy,
  Check
} from 'lucide-react';
import { GoalType, PairingMode, Role, SecurityState, SessionConfig } from '../types';
import { generateBase32Secret, generateTotp } from '../crypto';

interface OnboardingProps {
  onComplete: (secState: Partial<SecurityState>, sessionCfg: Partial<SessionConfig>) => Promise<void>;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  // Step flow: 1: Role -> 2: Mode/Key -> 3: Session Config -> 4: Crypto Init
  const [step, setStep] = useState<number>(1);
  const [role, setRole] = useState<Role>('wearer');
  const [pairingMode, setPairingMode] = useState<PairingMode>('paired');
  const [secretKey, setSecretKey] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  // TOTP live preview for Master
  const [totpCode, setTotpCode] = useState<string>('000000');
  const [totpRemaining, setTotpRemaining] = useState<number>(60);
  const [totpProgress, setTotpProgress] = useState<number>(0);

  // Session Config
  const [deviceSize, setDeviceSize] = useState<string>('90 мм');
  const [customSize, setCustomSize] = useState<string>('');
  const [modelName, setModelName] = useState<string>('Aegis Titanium Core V2');
  const [goalType, setGoalType] = useState<GoalType>('fixed');
  const [durationDays, setDurationDays] = useState<number>(7);
  const [customDays, setCustomDays] = useState<string>('7');

  // Input for Wearer pairing
  const [scannedKeyInput, setScannedKeyInput] = useState<string>('');
  const [keyInputError, setKeyInputError] = useState<string>('');

  // Initializing state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize random secret when entering step 1
  useEffect(() => {
    if (!secretKey) {
      setSecretKey(generateBase32Secret());
    }
  }, [secretKey]);

  // Generate QR code whenever secretKey changes
  useEffect(() => {
    if (secretKey) {
      // Standard OTPAuth or Aegis Protocol URI format
      const uri = `otpauth://totp/AegisLock:Enforcer?secret=${secretKey}&issuer=AegisLock&period=60&digits=6&algorithm=SHA256`;
      QRCode.toDataURL(uri, {
        width: 220,
        margin: 2,
        color: {
          dark: '#FF2A85',
          light: '#08080A',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR code error', err));
    }
  }, [secretKey]);

  // Live TOTP ticker for Master preview
  useEffect(() => {
    if (role === 'master' && secretKey) {
      let isMounted = true;
      const update = async () => {
        try {
          const res = await generateTotp(secretKey);
          if (isMounted) {
            setTotpCode(res.code);
            setTotpRemaining(res.remainingSeconds);
            setTotpProgress(res.progress);
          }
        } catch {
          // ignore
        }
      };

      update();
      const interval = setInterval(update, 1000);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
  }, [role, secretKey]);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(secretKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleConfirmPairingKey = () => {
    if (role === 'wearer' && pairingMode === 'paired') {
      const clean = scannedKeyInput.trim().toUpperCase().replace(/\s+/g, '');
      if (clean.length < 16) {
        setKeyInputError('Секретный ключ должен содержать не менее 16 символов Base32');
        return;
      }
      setSecretKey(clean);
      setKeyInputError('');
    }
    setStep(3);
  };

  const handleFinishOnboarding = async () => {
    setIsSubmitting(true);
    try {
      const selectedSize = deviceSize === 'custom' ? (customSize ? `${customSize} мм` : '90 мм') : deviceSize;
      const days = goalType === 'indefinite' ? 9999 : (durationDays === 0 ? Math.max(1, parseInt(customDays) || 1) : durationDays);
      const durationSeconds = days * 86400;

      await onComplete(
        {
          role,
          pairingMode,
          secretKeyBase32: secretKey,
        },
        {
          deviceSize: selectedSize,
          modelName,
          goalType,
          durationSeconds,
        }
      );
    } catch (err) {
      console.error('Setup error', err);
      setIsSubmitting(false);
    }
  };

  return (
    <div id="onboarding-container" className="min-h-screen bg-[#08080A] text-[#E4E4E7] flex flex-col justify-between p-5 max-w-md mx-auto">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between mb-6 pt-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#121217] border border-[#1E1E26] flex items-center justify-center text-[#FF2A85]">
              <Lock size={18} />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-wider text-white">AEGIS ENFORCER</h1>
              <p className="text-[10px] text-[#71717A] font-mono">HMAC SHA-256 HASH-CHAIN</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono text-[#FF2A85] bg-[#FF2A85]/10 px-2 py-0.5 rounded border border-[#FF2A85]/20">
              ШАГ {step}/4
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-[#121217] rounded-full overflow-hidden mb-6 border border-[#1E1E26]">
          <div
            className="h-full bg-[#FF2A85] transition-all duration-300 shadow-[0_0_8px_#FF2A85]"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* STEP 1: ROLE SELECTION */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Выберите профиль</h2>
              <p className="text-xs text-[#71717A] mt-1">
                Определяет уровень криптографического контроля и полномочий на этом устройстве.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {/* Wearer Option */}
              <div
                id="role-wearer-card"
                onClick={() => setRole('wearer')}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  role === 'wearer'
                    ? 'bg-[#121217] border-[#FF2A85] shadow-neon-subtle'
                    : 'bg-[#121217]/50 border-[#1E1E26] hover:border-[#2D2D3A]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      role === 'wearer'
                        ? 'bg-[#FF2A85]/15 text-[#FF2A85]'
                        : 'bg-[#1E1E26] text-[#71717A]'
                    }`}
                  >
                    <User size={22} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Property / Wearer</h3>
                      {role === 'wearer' && (
                        <CheckCircle2 size={16} className="text-[#FF2A85]" />
                      )}
                    </div>
                    <p className="text-xs text-[#71717A] mt-1 leading-relaxed">
                      Режим отслеживания и ношения. Фиксация чекинов, автономный учет времени, локальное шифрование и выполнение директив.
                    </p>
                  </div>
                </div>
              </div>

              {/* Master Option */}
              <div
                id="role-master-card"
                onClick={() => setRole('master')}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  role === 'master'
                    ? 'bg-[#121217] border-[#FF2A85] shadow-neon-subtle'
                    : 'bg-[#121217]/50 border-[#1E1E26] hover:border-[#2D2D3A]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      role === 'master'
                        ? 'bg-[#FF2A85]/15 text-[#FF2A85]'
                        : 'bg-[#1E1E26] text-[#71717A]'
                    }`}
                  >
                    <Crown size={22} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Master / Owner</h3>
                      {role === 'master' && (
                        <CheckCircle2 size={16} className="text-[#FF2A85]" />
                      )}
                    </div>
                    <p className="text-xs text-[#71717A] mt-1 leading-relaxed">
                      Режим управления. Генерация мастер-ключа (HMAC seed), QR-кода связки и 60-секундных кодов TOTP для подтверждения действий.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#121217]/40 border border-[#1E1E26] text-[11px] text-[#71717A] flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#FF2A85] shrink-0" />
              <span>Целостность журнала подтверждается аппаратным крипто-хэшированием.</span>
            </div>
          </div>
        )}

        {/* STEP 2: PAIRING / CRYPTO SEED */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {role === 'master' ? (
              // MASTER MODE: Show QR Code & Master Seed & TOTP Generator
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Генерация ключа Master</h2>
                  <p className="text-xs text-[#71717A] mt-1">
                    Отсканируйте этот QR-код на устройстве Wearer или передайте секретный seed.
                  </p>
                </div>

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center p-4 bg-[#121217] rounded-xl border border-[#1E1E26]">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Pairing QR Code"
                      className="w-48 h-48 rounded-lg border border-[#1E1E26] shadow-neon-subtle p-1 bg-[#08080A]"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center bg-[#08080A] rounded-lg">
                      <QrCode className="animate-spin text-[#FF2A85]" size={36} />
                    </div>
                  )}

                  {/* Seed display */}
                  <div className="w-full mt-3 flex items-center justify-between bg-[#08080A] border border-[#1E1E26] rounded-lg px-3 py-2">
                    <div className="overflow-hidden">
                      <div className="text-[10px] text-[#71717A]">HMAC SEED (BASE32):</div>
                      <div className="font-mono text-xs text-white tracking-widest truncate">
                        {secretKey}
                      </div>
                    </div>
                    <button
                      id="copy-secret-key-btn"
                      onClick={handleCopyKey}
                      className="p-1.5 rounded bg-[#121217] hover:bg-[#1E1E26] text-[#FF2A85] transition-colors"
                      title="Копировать ключ"
                    >
                      {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* Live TOTP Display */}
                <div className="p-3 bg-[#121217] rounded-xl border border-[#1E1E26] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#71717A] font-medium flex items-center gap-1.5">
                      <Clock size={14} className="text-[#FF2A85]" />
                      Генератор 60s TOTP (RFC 6238):
                    </span>
                    <span className="font-mono text-[#FF2A85]">{totpRemaining}с</span>
                  </div>

                  <div className="flex items-baseline justify-center gap-2 py-2">
                    <span className="font-mono text-3xl font-bold tracking-[0.25em] text-white text-glow-pink">
                      {totpCode.slice(0, 3)} {totpCode.slice(3)}
                    </span>
                  </div>

                  {/* Progress bar inside TOTP box */}
                  <div className="w-full bg-[#08080A] h-1 rounded-full overflow-hidden">
                    <div
                      className="bg-[#FF2A85] h-full transition-all duration-1000"
                      style={{ width: `${100 - totpProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              // WEARER MODE: Choose Autonomous or Paired
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Режим связки девайса</h2>
                  <p className="text-xs text-[#71717A] mt-1">
                    Выберите, как будет управляться устройство носителя:
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="pairing-mode-paired-btn"
                    onClick={() => setPairingMode('paired')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      pairingMode === 'paired'
                        ? 'bg-[#121217] border-[#FF2A85] shadow-neon-subtle'
                        : 'bg-[#121217]/50 border-[#1E1E26]'
                    }`}
                  >
                    <Crown
                      size={18}
                      className={pairingMode === 'paired' ? 'text-[#FF2A85]' : 'text-[#71717A]'}
                    />
                    <div className="text-xs font-semibold text-white mt-2">Связка с Хозяином</div>
                    <div className="text-[10px] text-[#71717A] mt-0.5">
                      QR / Ввод общего HMAC секрета
                    </div>
                  </button>

                  <button
                    id="pairing-mode-auto-btn"
                    onClick={() => {
                      setPairingMode('autonomous');
                      setSecretKey(generateBase32Secret());
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      pairingMode === 'autonomous'
                        ? 'bg-[#121217] border-[#FF2A85] shadow-neon-subtle'
                        : 'bg-[#121217]/50 border-[#1E1E26]'
                    }`}
                  >
                    <Sliders
                      size={18}
                      className={pairingMode === 'autonomous' ? 'text-[#FF2A85]' : 'text-[#71717A]'}
                    />
                    <div className="text-xs font-semibold text-white mt-2">Автономный режим</div>
                    <div className="text-[10px] text-[#71717A] mt-0.5">
                      Локальный таймер и правила
                    </div>
                  </button>
                </div>

                {pairingMode === 'paired' ? (
                  <div className="p-4 bg-[#121217] rounded-xl border border-[#1E1E26] space-y-3">
                    <div className="text-xs font-medium text-white flex items-center gap-1.5">
                      <Key size={14} className="text-[#FF2A85]" />
                      Ввод HMAC / TOTP секрета
                    </div>
                    <p className="text-[11px] text-[#71717A]">
                      Вставьте секретный Base32 ключ с экрана Хозяина (или используйте сгенерированный тестовый ключ):
                    </p>

                    <input
                      id="wearer-secret-key-input"
                      type="text"
                      value={scannedKeyInput}
                      onChange={(e) => {
                        setScannedKeyInput(e.target.value);
                        setKeyInputError('');
                      }}
                      placeholder="Вставьте Base32 ключ (например: JBSWY3DPEHPK3PXP...)"
                      className="w-full bg-[#08080A] border border-[#1E1E26] focus:border-[#FF2A85] rounded-lg px-3 py-2 font-mono text-xs text-white placeholder:text-[#52525B] focus:outline-none"
                    />

                    {keyInputError && (
                      <p className="text-[11px] text-red-400">{keyInputError}</p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const demoKey = secretKey || generateBase32Secret();
                          setScannedKeyInput(demoKey);
                        }}
                        className="text-[11px] text-[#FF2A85] hover:underline"
                      >
                        Использовать демо-ключ Хозяина
                      </button>
                      <span className="text-[10px] text-[#71717A]">RFC 6238 60s</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-[#121217] rounded-xl border border-[#1E1E26] space-y-2">
                    <div className="text-xs font-medium text-white flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-[#FF2A85]" />
                      Автономный ключ сгенерирован
                    </div>
                    <p className="text-[11px] text-[#71717A]">
                      Для автономного режима создан локальный криптографический сид. Все действия и чекины будут фиксироваться в изолированном SQLCipher хранилище.
                    </p>
                    <div className="font-mono text-xs text-[#A1A1AA] bg-[#08080A] p-2 rounded border border-[#1E1E26] truncate">
                      {secretKey}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: SESSION CONFIGURATION */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h2 className="text-lg font-bold text-white">Параметры сессии</h2>
              <p className="text-xs text-[#71717A] mt-1">
                Укажите физическую конфигурацию девайса и целевую длительность фиксации.
              </p>
            </div>

            {/* Device Size */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#A1A1AA] block">
                Конфигурация / размер девайса:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['80 мм', '90 мм', '110 мм'].map((sz) => (
                  <button
                    key={sz}
                    id={`device-size-${sz}`}
                    onClick={() => setDeviceSize(sz)}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                      deviceSize === sz
                        ? 'bg-[#121217] border-[#FF2A85] text-white shadow-neon-subtle'
                        : 'bg-[#121217]/60 border-[#1E1E26] text-[#71717A]'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>

              {/* Custom size option */}
              <div className="pt-1">
                <button
                  id="device-size-custom-toggle"
                  onClick={() => setDeviceSize('custom')}
                  className={`text-xs py-1.5 px-2.5 rounded-lg border transition-all ${
                    deviceSize === 'custom'
                      ? 'border-[#FF2A85] text-white bg-[#121217]'
                      : 'border-[#1E1E26] text-[#71717A]'
                  }`}
                >
                  Другой размер
                </button>
                {deviceSize === 'custom' && (
                  <input
                    type="text"
                    value={customSize}
                    onChange={(e) => setCustomSize(e.target.value)}
                    placeholder="Например: 95 мм, Спец-кольцо..."
                    className="mt-2 w-full bg-[#121217] border border-[#1E1E26] focus:border-[#FF2A85] rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                  />
                )}
              </div>
            </div>

            {/* Model Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#A1A1AA] block">
                Модель девайса:
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="Aegis Titanium Core V2"
                className="w-full bg-[#121217] border border-[#1E1E26] focus:border-[#FF2A85] rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono"
              />
            </div>

            {/* Goal Type */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-semibold text-[#A1A1AA] block">
                Целевой режим фиксации (Goal):
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  id="goal-type-fixed-btn"
                  onClick={() => setGoalType('fixed')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    goalType === 'fixed'
                      ? 'bg-[#121217] border-[#FF2A85] shadow-neon-subtle'
                      : 'bg-[#121217]/50 border-[#1E1E26]'
                  }`}
                >
                  <div className="text-xs font-semibold text-white">Фиксированный таймер</div>
                  <div className="text-[10px] text-[#71717A] mt-1">
                    Обратный отсчет до целевой даты
                  </div>
                </button>

                <button
                  id="goal-type-indefinite-btn"
                  onClick={() => setGoalType('indefinite')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    goalType === 'indefinite'
                      ? 'bg-[#121217] border-[#FF2A85] shadow-neon-subtle'
                      : 'bg-[#121217]/50 border-[#1E1E26]'
                  }`}
                >
                  <div className="text-xs font-semibold text-white">Бессрочно (Indefinite)</div>
                  <div className="text-[10px] text-[#71717A] mt-1">
                    Прямой учет до команды Хозяина
                  </div>
                </button>
              </div>

              {goalType === 'fixed' && (
                <div className="p-3 bg-[#121217] rounded-xl border border-[#1E1E26] space-y-2 mt-2">
                  <span className="text-xs text-[#71717A] block">Продолжительность:</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 3, 7, 14].map((d) => (
                      <button
                        key={d}
                        onClick={() => setDurationDays(d)}
                        className={`py-1.5 text-xs rounded-lg border font-mono transition-all ${
                          durationDays === d
                            ? 'bg-[#FF2A85]/20 border-[#FF2A85] text-[#FF2A85]'
                            : 'border-[#1E1E26] text-[#71717A]'
                        }`}
                      >
                        {d} дн.
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: GENESIS & SQLCIPHER INITIALIZATION */}
        {step === 4 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h2 className="text-lg font-bold text-white">Инициализация шифрования</h2>
              <p className="text-xs text-[#71717A] mt-1">
                Генерация нулевого хэша (genesis_hash) и создание зашифрованной базы данных SQLCipher.
              </p>
            </div>

            <div className="p-4 bg-[#121217] rounded-xl border border-[#1E1E26] space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#1E1E26]">
                <span className="text-[#71717A]">Алгоритм хэш-цепи:</span>
                <span className="text-[#FF2A85] font-semibold">HMAC-SHA256</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-[#1E1E26]">
                <span className="text-[#71717A]">Хранилище:</span>
                <span className="text-white">SQLCipher / Key-Value AES</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-[#1E1E26]">
                <span className="text-[#71717A]">Размер девайса:</span>
                <span className="text-white">
                  {deviceSize === 'custom' ? (customSize || '90 мм') : deviceSize}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-[#1E1E26]">
                <span className="text-[#71717A]">Режим цели:</span>
                <span className="text-white">
                  {goalType === 'indefinite' ? 'INDEFINITE' : `${durationDays} дней (Enforced)`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#71717A]">Роль сессии:</span>
                <span className="text-[#FF2A85] uppercase">{role}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FF2A85]/10 border border-[#FF2A85]/30 text-xs text-[#E4E4E7] flex items-start gap-2.5">
              <Sparkles size={18} className="text-[#FF2A85] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white block">Неизменяемый журнал:</span>
                <span className="text-[#A1A1AA] text-[11px] leading-relaxed">
                  После инициализации нулевой блок (Genesis Block 0) будет криптографически подписан. Любое редактирование локальных файлов нарушит целостность цепочки.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation Buttons */}
      <div className="pt-6 pb-2">
        <div className="flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              id="onboarding-prev-btn"
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-[#1E1E26] bg-[#121217] text-xs font-semibold text-[#A1A1AA] hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
              Назад
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              id="onboarding-next-btn"
              onClick={() => {
                if (step === 2) {
                  handleConfirmPairingKey();
                } else {
                  setStep(step + 1);
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#FF2A85] hover:bg-[#FF2A85]/90 text-white font-semibold text-xs transition-all shadow-neon-subtle"
            >
              Продолжить
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              id="onboarding-init-genesis-btn"
              onClick={handleFinishOnboarding}
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#FF2A85] hover:bg-[#FF2A85]/90 text-white font-semibold text-xs transition-all shadow-neon-pink disabled:opacity-50"
            >
              {isSubmitting ? 'Генерация блоков...' : 'Запустить крипто-сессию'}
              <CheckCircle2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
