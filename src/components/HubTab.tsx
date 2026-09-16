import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  FileText,
  HeartPulse,
  Send,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  QrCode,
  X,
  Play,
  RotateCcw,
  Sparkles,
  Check
} from 'lucide-react';
import { SecurityState, SessionConfig } from '../types';
import { appendAuditEvent, saveSecurityState } from '../storage/db';

interface HubTabProps {
  secState: SecurityState;
  sessionConfig: SessionConfig;
  onRefreshData: () => Promise<void>;
}

type ActiveCard = 'none' | 'instructions' | 'hygiene' | 'interactive';

export const HubTab: React.FC<HubTabProps> = ({
  secState,
  sessionConfig,
  onRefreshData,
}) => {
  const [activeCard, setActiveCard] = useState<ActiveCard>('none');

  // Hygiene Window State
  const [hygieneDuration, setHygieneDuration] = useState<number>(20); // 15, 20, 30 min
  const [hygieneSecondsRemaining, setHygieneSecondsRemaining] = useState<number>(20 * 60);
  const [isHygieneTimerRunning, setIsHygieneTimerRunning] = useState<boolean>(false);
  const [tissueCheckOk, setTissueCheckOk] = useState<boolean>(false);
  const [hygieneLogged, setHygieneLogged] = useState<boolean>(false);

  // Interactive Token State
  const [statusQrUrl, setStatusQrUrl] = useState<string>('');
  const [statusPayload, setStatusPayload] = useState<string>('');
  const [interactiveLogged, setInteractiveLogged] = useState<string>('');

  // Directive acknowledgement
  const [directiveAckSuccess, setDirectiveAckSuccess] = useState<boolean>(false);

  // Hygiene timer interval
  useEffect(() => {
    let interval: any;
    if (isHygieneTimerRunning && hygieneSecondsRemaining > 0) {
      interval = setInterval(() => {
        setHygieneSecondsRemaining((prev) => prev - 1);
      }, 1000);
    } else if (hygieneSecondsRemaining <= 0 && isHygieneTimerRunning) {
      setIsHygieneTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isHygieneTimerRunning, hygieneSecondsRemaining]);

  // Generate QR status for Interactive
  useEffect(() => {
    if (activeCard === 'interactive') {
      const payload = JSON.stringify({
        protocol: 'AEGIS-V1',
        time: Date.now(),
        role: secState.role,
        size: sessionConfig.deviceSize,
        status: sessionConfig.isEmergencyOverridden ? 'OVERRIDE' : 'LOCKED',
        genesis: secState.genesisHash.slice(0, 16),
      });
      setStatusPayload(payload);
      QRCode.toDataURL(payload, {
        width: 180,
        margin: 1,
        color: { dark: '#FF2A85', light: '#08080A' },
      })
        .then((url) => setStatusQrUrl(url))
        .catch((err) => console.error('QR status error', err));
    }
  }, [activeCard, secState, sessionConfig]);

  // Handle Hygiene Inspection Submit
  const handleCompleteHygiene = async () => {
    try {
      await appendAuditEvent(
        'HYGIENE_WINDOW',
        `Hygiene maintenance window completed (${hygieneDuration}m). Tissue inspection verified: OK. Cleanliness certified.`
      );
      setHygieneLogged(true);
      setIsHygieneTimerRunning(false);
      await onRefreshData();
      setTimeout(() => {
        setHygieneLogged(false);
        setActiveCard('none');
      }, 2000);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Directive Ack
  const handleAcknowledgeDirectives = async () => {
    try {
      await appendAuditEvent(
        'DIRECTIVE_ACK',
        'Wearer acknowledged current directives, safety boundaries, and hygiene protocols.'
      );
      setDirectiveAckSuccess(true);
      await onRefreshData();
      setTimeout(() => {
        setDirectiveAckSuccess(false);
      }, 2500);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Log Custom Cycle Event
  const handleLogCycleEvent = async (eventName: string) => {
    try {
      await appendAuditEvent(
        'STATE_CHANGE',
        `Cycle event recorded: ${eventName}. Status confirmed.`
      );
      setInteractiveLogged(eventName);
      await onRefreshData();
      setTimeout(() => setInteractiveLogged(''), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div id="hub-tab-view" className="space-y-4 pb-20 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="px-1">
        <h2 className="text-sm font-semibold text-white tracking-wider flex items-center gap-1.5">
          <Clock size={14} className="text-[#FF2A85]" />
          ХАБ УПРАВЛЕНИЯ И ОБСЛУЖИВАНИЯ
        </h2>
        <p className="text-[10px] text-[#71717A] font-mono mt-0.5">
          ДИРЕКТИВЫ, ГИГИЕНА И СВЯЗЬ
        </p>
      </div>

      {/* THREE CONCISE TILE BUTTONS */}
      <div className="grid grid-cols-1 gap-2.5 px-1">
        {/* Tile 1: Instructions */}
        <div
          id="hub-tile-instructions"
          onClick={() => setActiveCard('instructions')}
          className="p-4 bg-[#121217] rounded-xl border border-[#1E1E26] hover:border-[#FF2A85] transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF2A85]/10 border border-[#FF2A85]/20 flex items-center justify-center text-[#FF2A85] shrink-0 group-hover:scale-105 transition-transform">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white group-hover:text-[#FF2A85] transition-colors">
                  Инструкции
                </h3>
                <p className="text-xs text-[#71717A] mt-1 leading-relaxed">
                  Просмотр действующих директив, ограничений и правил безопасности ношения.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tile 2: Hygiene */}
        <div
          id="hub-tile-hygiene"
          onClick={() => setActiveCard('hygiene')}
          className="p-4 bg-[#121217] rounded-xl border border-[#1E1E26] hover:border-[#FF2A85] transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-950/30 border border-cyan-800/30 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
                <HeartPulse size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">
                  Гигиена и обслуживание
                </h3>
                <p className="text-xs text-[#71717A] mt-1 leading-relaxed">
                  Таймер окна обслуживания (15–30 минут) и фиксация осмотра тканей.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tile 3: Interactive */}
        <div
          id="hub-tile-interactive"
          onClick={() => setActiveCard('interactive')}
          className="p-4 bg-[#121217] rounded-xl border border-[#1E1E26] hover:border-[#FF2A85] transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-950/30 border border-purple-800/30 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
                <Send size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white group-hover:text-purple-400 transition-colors">
                  Интерактив
                </h3>
                <p className="text-xs text-[#71717A] mt-1 leading-relaxed">
                  Отправка статуса Хозяину, фиксация событий цикла или запрос инструкций.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CARD 1 MODAL: INSTRUCTIONS & DIRECTIVES */}
      {activeCard === 'instructions' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#121217] border border-[#1E1E26] rounded-2xl w-full max-w-sm p-4 text-xs space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E1E26]">
              <div className="flex items-center gap-2 font-semibold text-white">
                <FileText size={16} className="text-[#FF2A85]" />
                <span>Действующие директивы</span>
              </div>
              <button
                onClick={() => setActiveCard('none')}
                className="text-[#71717A] hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 bg-[#08080A] rounded-xl border border-[#1E1E26] space-y-1">
                <span className="text-[11px] font-semibold text-[#FF2A85] block">
                  1. Регламент ношения и чекинов
                </span>
                <p className="text-[#A1A1AA] text-[11px] leading-relaxed">
                  Обязательный чекин состояния выполняется каждые 12–24 часа. Каждый чекин подписывается аппаратным HMAC хэшем и фиксируется в неизменяемой цепи.
                </p>
              </div>

              <div className="p-3 bg-[#08080A] rounded-xl border border-[#1E1E26] space-y-1">
                <span className="text-[11px] font-semibold text-[#FF2A85] block">
                  2. Медицинские границы и безопасность
                </span>
                <p className="text-[#A1A1AA] text-[11px] leading-relaxed">
                  При возникновении острой боли, нарушении кровообращения или отечности тканей немедленно используйте аварийный протокол (Emergency Override) в настройках. Здоровье является безусловным приоритетом.
                </p>
              </div>

              <div className="p-3 bg-[#08080A] rounded-xl border border-[#1E1E26] space-y-1">
                <span className="text-[11px] font-semibold text-[#FF2A85] block">
                  3. Регулярная гигиена
                </span>
                <p className="text-[#A1A1AA] text-[11px] leading-relaxed">
                  Окно обслуживания открывается на 15–30 минут для дезинфекции и полного осмотра кожных покровов с последующей отметкой в журнале.
                </p>
              </div>
            </div>

            <button
              onClick={handleAcknowledgeDirectives}
              disabled={directiveAckSuccess}
              className={`w-full py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 ${
                directiveAckSuccess
                  ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/40'
                  : 'bg-[#FF2A85] hover:bg-[#FF2A85]/90 text-white shadow-neon-subtle'
              }`}
            >
              {directiveAckSuccess ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>Ознакомление зафиксировано в цепи</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Подтвердить соблюдение директив</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* CARD 2 MODAL: HYGIENE & TISSUE INSPECTION */}
      {activeCard === 'hygiene' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#121217] border border-[#1E1E26] rounded-2xl w-full max-w-sm p-4 text-xs space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E1E26]">
              <div className="flex items-center gap-2 font-semibold text-white">
                <HeartPulse size={16} className="text-cyan-400" />
                <span>Окно обслуживания и гигиены</span>
              </div>
              <button
                onClick={() => setActiveCard('none')}
                className="text-[#71717A] hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Duration Selector */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-[#71717A] block">Длительность окна:</span>
              <div className="grid grid-cols-3 gap-2">
                {[15, 20, 30].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => {
                      setHygieneDuration(mins);
                      setHygieneSecondsRemaining(mins * 60);
                    }}
                    disabled={isHygieneTimerRunning}
                    className={`py-1.5 rounded-lg border text-xs font-mono transition-all ${
                      hygieneDuration === mins
                        ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300'
                        : 'border-[#1E1E26] text-[#71717A]'
                    }`}
                  >
                    {mins} минут
                  </button>
                ))}
              </div>
            </div>

            {/* Countdown Box */}
            <div className="p-4 bg-[#08080A] rounded-xl border border-[#1E1E26] text-center space-y-2">
              <span className="text-[10px] text-[#71717A] font-mono block uppercase">
                Оставшееся время окна
              </span>
              <div className="font-mono text-3xl font-bold text-cyan-400 tracking-wider">
                {String(Math.floor(hygieneSecondsRemaining / 60)).padStart(2, '0')}:
                {String(hygieneSecondsRemaining % 60).padStart(2, '0')}
              </div>

              <div className="flex justify-center gap-2 pt-1">
                <button
                  onClick={() => setIsHygieneTimerRunning(!isHygieneTimerRunning)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    isHygieneTimerRunning
                      ? 'bg-amber-950/40 text-amber-300 border border-amber-800'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  }`}
                >
                  <Play size={12} className={isHygieneTimerRunning ? 'rotate-90' : ''} />
                  {isHygieneTimerRunning ? 'Пауза' : 'Запустить таймер'}
                </button>
                <button
                  onClick={() => {
                    setIsHygieneTimerRunning(false);
                    setHygieneSecondsRemaining(hygieneDuration * 60);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#121217] border border-[#1E1E26] text-[#71717A]"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            </div>

            {/* Tissue inspection checklist */}
            <div className="p-3 bg-[#08080A] rounded-xl border border-[#1E1E26] space-y-2">
              <span className="text-[11px] font-semibold text-white block">
                Обязательный осмотр тканей:
              </span>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tissueCheckOk}
                  onChange={(e) => setTissueCheckOk(e.target.checked)}
                  className="mt-0.5 accent-cyan-500 rounded"
                />
                <span className="text-[11px] text-[#A1A1AA] leading-snug">
                  Подтверждаю: кожные покровы чистые, микротравмы и отеки отсутствуют, дезинфекция проведена.
                </span>
              </label>
            </div>

            {/* Confirm button */}
            <button
              onClick={handleCompleteHygiene}
              disabled={!tissueCheckOk || hygieneLogged}
              className={`w-full py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 ${
                hygieneLogged
                  ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/40'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-black font-semibold disabled:opacity-40'
              }`}
            >
              {hygieneLogged ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>Осмотр зафиксирован в HMAC цепи</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Завершить и подтвердить осмотр</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* CARD 3 MODAL: INTERACTIVE WITH MASTER */}
      {activeCard === 'interactive' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#121217] border border-[#1E1E26] rounded-2xl w-full max-w-sm p-4 text-xs space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E1E26]">
              <div className="flex items-center gap-2 font-semibold text-white">
                <Send size={16} className="text-purple-400" />
                <span>Интерактив со статусом</span>
              </div>
              <button
                onClick={() => setActiveCard('none')}
                className="text-[#71717A] hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Status QR Code to show to Master */}
            <div className="p-3 bg-[#08080A] rounded-xl border border-[#1E1E26] flex flex-col items-center">
              <span className="text-[10px] text-[#71717A] font-mono mb-2 uppercase">
                QR-код криптографического статуса
              </span>
              {statusQrUrl ? (
                <img
                  src={statusQrUrl}
                  alt="Status QR"
                  className="w-36 h-36 rounded-lg border border-[#1E1E26] p-1 bg-black"
                />
              ) : (
                <div className="w-36 h-36 bg-black rounded-lg flex items-center justify-center">
                  <QrCode size={28} className="text-purple-400 animate-pulse" />
                </div>
              )}
              <span className="text-[10px] text-[#71717A] font-mono mt-2 text-center">
                Предъявите экран Хозяину для считывания метки
              </span>
            </div>

            {/* Quick Cycle Event Logging */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-white block">
                Фиксация событий цикла:
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Прием душа',
                  'Тренировка',
                  'Осмотр замка',
                  'Запрос директивы',
                ].map((ev) => (
                  <button
                    key={ev}
                    onClick={() => handleLogCycleEvent(ev)}
                    className="p-2 rounded-lg bg-[#08080A] border border-[#1E1E26] hover:border-purple-500/50 text-[#A1A1AA] hover:text-white text-left text-[11px] transition-colors"
                  >
                    + {ev}
                  </button>
                ))}
              </div>
              {interactiveLogged && (
                <p className="text-[11px] text-emerald-400 font-mono text-center pt-1">
                  ✓ Событие «{interactiveLogged}» добавлено в HMAC цепь
                </p>
              )}
            </div>

            <button
              onClick={() => setActiveCard('none')}
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
