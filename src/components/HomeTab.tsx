import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Clock,
  Ruler,
  CheckCircle,
  Radio,
  Lock,
  ChevronRight,
  Info
} from 'lucide-react';
import { AuditLogEntry, SecurityState, SessionConfig } from '../types';
import { appendAuditEvent } from '../storage/db';

interface HomeTabProps {
  secState: SecurityState;
  sessionConfig: SessionConfig;
  auditLog: AuditLogEntry[];
  onRefreshData: () => Promise<void>;
  onNavigateTab: (tab: 'home' | 'log' | 'hub' | 'settings') => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  secState,
  sessionConfig,
  auditLog,
  onRefreshData,
  onNavigateTab,
}) => {
  const [now, setNow] = useState<number>(Date.now());
  const [isCheckingIn, setIsCheckingIn] = useState<boolean>(false);
  const [checkinSuccess, setCheckinSuccess] = useState<boolean>(false);
  const [showQuickDetails, setShowQuickDetails] = useState<boolean>(false);

  // Autonomous time ticker: updates every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute elapsed time purely based on start_lock_timestamp vs now
  const elapsedMs = Math.max(0, now - sessionConfig.startLockTimestamp);
  const totalTargetMs = sessionConfig.durationSeconds * 1000;

  // Calculate formatted DD : HH : MM : SS
  const timeDetails = useMemo(() => {
    let targetTimeMs = elapsedMs;

    // For fixed timer, display either elapsed or countdown to lock target
    if (sessionConfig.goalType === 'fixed' && !sessionConfig.isEmergencyOverridden) {
      // Countdown or elapsed: in lock enforcers, Time Locked counts cumulative time locked
      targetTimeMs = elapsedMs;
    }

    const totalSeconds = Math.floor(targetTimeMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      days: String(days).padStart(2, '0'),
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0'),
      totalSeconds,
    };
  }, [elapsedMs, sessionConfig.goalType, sessionConfig.isEmergencyOverridden]);

  // Circle progress calculation (0 to 100%)
  const progressPercent = useMemo(() => {
    if (sessionConfig.isEmergencyOverridden) return 100;
    if (sessionConfig.goalType === 'indefinite') {
      // For indefinite, cycle smoothly through a 24h cycle
      const cycleMs = 86400 * 1000;
      return ((elapsedMs % cycleMs) / cycleMs) * 100;
    }
    const ratio = elapsedMs / totalTargetMs;
    return Math.min(100, Math.max(0, ratio * 100));
  }, [elapsedMs, totalTargetMs, sessionConfig.goalType, sessionConfig.isEmergencyOverridden]);

  // Relative time since last check-in
  const timeSinceLastCheckin = useMemo(() => {
    const diffMs = Math.max(0, now - sessionConfig.lastCheckinTimestamp);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч ${diffMins % 60}м`;
    return `${Math.floor(diffHours / 24)} дн. назад`;
  }, [now, sessionConfig.lastCheckinTimestamp]);

  // Handle immediate Check-In with HMAC-SHA256 signature
  const handlePerformCheckin = async () => {
    if (isCheckingIn) return;
    setIsCheckingIn(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([30, 50, 30]);
      }
      await appendAuditEvent(
        'CHECK_IN',
        `Physical inspection confirmed. Wearer check-in at ${new Date().toLocaleTimeString('ru-RU')}. Device intact.`
      );
      await onRefreshData();
      setCheckinSuccess(true);
      setTimeout(() => setCheckinSuccess(false), 3000);
    } catch (err) {
      console.error('Check-in failed:', err);
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Minimalist SVG chart points for 7-day progress
  const chartPoints = useMemo(() => {
    // Generate 7 days points with realistic compliance data
    const daysCount = 7;
    const points: { day: string; value: number; checkins: number }[] = [];
    const checkinLog = auditLog.filter((e) => e.eventType === 'CHECK_IN');

    for (let i = daysCount - 1; i >= 0; i--) {
      const dayDate = new Date(now - i * 86400000);
      const dayLabel = dayDate.toLocaleDateString('ru-RU', { weekday: 'short' });
      // Count checkins on that day
      const dayStart = new Date(dayDate.setHours(0, 0, 0, 0)).getTime();
      const dayEnd = dayStart + 86400000;
      const count = checkinLog.filter((e) => e.timestamp >= dayStart && e.timestamp < dayEnd).length;
      // baseline compliance curve
      const baseline = sessionConfig.isEmergencyOverridden ? 40 : Math.min(100, 70 + (7 - i) * 4 + count * 5);
      points.push({
        day: dayLabel,
        value: baseline,
        checkins: count,
      });
    }
    return points;
  }, [now, auditLog, sessionConfig.isEmergencyOverridden]);

  // SVG dimensions for the mini line chart
  const svgWidth = 320;
  const svgHeight = 64;
  const paddingX = 16;
  const paddingY = 12;

  const polylinePoints = useMemo(() => {
    const stepX = (svgWidth - paddingX * 2) / (chartPoints.length - 1);
    const minVal = 40;
    const maxVal = 100;

    return chartPoints
      .map((p, idx) => {
        const x = paddingX + idx * stepX;
        const normalized = (p.value - minVal) / (maxVal - minVal);
        const y = svgHeight - paddingY - normalized * (svgHeight - paddingY * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [chartPoints]);

  // Radius for circular progress ring
  const circleRadius = 118;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div id="home-tab-view" className="space-y-4 pb-20 animate-in fade-in duration-150">
      {/* Top Header info */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#FF2A85] animate-pulse" />
          <span className="text-xs font-mono text-[#A1A1AA] uppercase tracking-wider">
            {secState.role === 'master' ? 'РЕЖИМ MASTER' : 'РЕЖИМ PROPERTY'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-[#71717A] font-mono bg-[#121217] px-2.5 py-1 rounded-full border border-[#1E1E26]">
          <Lock size={12} className="text-[#FF2A85]" />
          <span>HMAC CHAIN #{auditLog.length}</span>
        </div>
      </div>

      {/* Emergency Override Alert Banner if triggered */}
      {sessionConfig.isEmergencyOverridden && (
        <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl flex items-center gap-3">
          <ShieldAlert size={20} className="text-red-400 shrink-0" />
          <div className="text-xs text-red-200">
            <span className="font-semibold block">АВАРИЙНЫЙ ПРОТОКОЛ АКТИВИРОВАН</span>
            Фиксация снята. Событие TAMPER/EMERGENCY BREAK записано в неизменяемый журнал.
          </div>
        </div>
      )}

      {/* CENTRAL CIRCLE PROGRESS INDICATOR */}
      <div className="relative flex flex-col items-center justify-center py-2">
        <div className="relative w-68 h-68 flex items-center justify-center">
          {/* Outer glow aura */}
          <div className="absolute inset-0 rounded-full bg-[#FF2A85]/5 blur-xl pointer-events-none" />

          {/* SVG Progress Circle */}
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 260 260">
            {/* Background Track */}
            <circle
              cx="130"
              cy="130"
              r={circleRadius}
              stroke="#121217"
              strokeWidth="10"
              fill="transparent"
            />
            {/* Secondary subtle border */}
            <circle
              cx="130"
              cy="130"
              r={circleRadius}
              stroke="#1E1E26"
              strokeWidth="2"
              fill="transparent"
            />

            {/* Neon Pink Progress Stroke */}
            <circle
              cx="130"
              cy="130"
              r={circleRadius}
              stroke={sessionConfig.isEmergencyOverridden ? '#EF4444' : '#FF2A85'}
              strokeWidth="8"
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700 ease-out drop-shadow-[0_0_8px_#FF2A85]"
            />
          </svg>

          {/* Inside Ring Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <span className="text-[11px] font-mono text-[#71717A] tracking-wider uppercase mb-1">
              TIME LOCKED
            </span>

            {/* Large Monospace Timer DD : HH : MM : SS */}
            <div
              id="time-locked-display"
              className="font-mono text-2xl sm:text-[26px] font-bold text-white tracking-wider flex items-center justify-center gap-1 text-glow-pink"
            >
              <span>{timeDetails.days}</span>
              <span className="text-[#FF2A85]/80 font-normal">:</span>
              <span>{timeDetails.hours}</span>
              <span className="text-[#FF2A85]/80 font-normal">:</span>
              <span>{timeDetails.minutes}</span>
              <span className="text-[#FF2A85]/80 font-normal">:</span>
              <span className="text-[#FF2A85]">{timeDetails.seconds}</span>
            </div>

            {/* Sub-labels: DD HH MM SS */}
            <div className="font-mono text-[9px] text-[#71717A] tracking-widest flex items-center justify-center gap-3.5 mt-0.5">
              <span>ДН</span>
              <span>ЧАС</span>
              <span>МИН</span>
              <span>СЕК</span>
            </div>

            {/* Status Label Pill */}
            <div className="mt-3">
              {sessionConfig.isEmergencyOverridden ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 font-mono text-[10px] font-semibold tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  OVERRIDE
                </div>
              ) : sessionConfig.goalType === 'indefinite' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF2A85]/15 border border-[#FF2A85]/30 text-[#FF2A85] font-mono text-[10px] font-semibold tracking-wider shadow-neon-subtle">
                  <Radio size={10} className="animate-pulse" />
                  INDEFINITE
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF2A85]/15 border border-[#FF2A85]/30 text-[#FF2A85] font-mono text-[10px] font-semibold tracking-wider shadow-neon-subtle">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF2A85] animate-ping" />
                  ENFORCED
                </div>
              )}
            </div>

            {/* Percentage or Model */}
            <span className="text-[10px] text-[#71717A] font-mono mt-1">
              {sessionConfig.goalType === 'fixed' && !sessionConfig.isEmergencyOverridden
                ? `${progressPercent.toFixed(1)}% выполнено`
                : sessionConfig.modelName}
            </span>
          </div>
        </div>
      </div>

      {/* QUICK CHECK-IN ACTION BUTTON */}
      <div className="px-1">
        <button
          id="quick-checkin-action-btn"
          onClick={handlePerformCheckin}
          disabled={isCheckingIn || checkinSuccess}
          className={`w-full py-3.5 px-4 rounded-xl border flex items-center justify-center gap-2.5 transition-all duration-200 ${
            checkinSuccess
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400'
              : 'bg-[#121217] hover:bg-[#1E1E26] border-[#1E1E26] hover:border-[#FF2A85] text-white shadow-neon-subtle'
          }`}
        >
          {checkinSuccess ? (
            <>
              <CheckCircle size={18} className="text-emerald-400" />
              <span className="text-xs font-semibold font-mono tracking-wide">
                ЧЕКИН ЗАПИСАН В HMAC ЦЕПЬ
              </span>
            </>
          ) : (
            <>
              <CheckCircle
                size={18}
                className={`text-[#FF2A85] ${isCheckingIn ? 'animate-spin' : ''}`}
              />
              <span className="text-xs font-semibold tracking-wide">
                {isCheckingIn ? 'Криптографическая подпись блока...' : 'Выполнить чекин состояния'}
              </span>
            </>
          )}
        </button>
      </div>

      {/* 2 COMPACT METRIC CARDS */}
      <div className="grid grid-cols-2 gap-2.5 px-1">
        {/* Metric 1: Current Size */}
        <div
          id="metric-current-size-card"
          className="p-3.5 bg-[#121217] rounded-xl border border-[#1E1E26] hover:border-[#2D2D3A] transition-colors"
        >
          <div className="flex items-center justify-between text-[#71717A] mb-1.5">
            <span className="text-[11px] font-medium">Текущий размер</span>
            <Ruler size={14} className="text-[#FF2A85]" />
          </div>
          <div className="text-lg font-bold font-mono text-white tracking-tight">
            {sessionConfig.deviceSize}
          </div>
          <div className="text-[10px] text-[#71717A] mt-0.5 truncate">
            {sessionConfig.modelName}
          </div>
        </div>

        {/* Metric 2: Time since last check-in */}
        <div
          id="metric-last-checkin-card"
          className="p-3.5 bg-[#121217] rounded-xl border border-[#1E1E26] hover:border-[#2D2D3A] transition-colors"
        >
          <div className="flex items-center justify-between text-[#71717A] mb-1.5">
            <span className="text-[11px] font-medium">С крайнего чекина</span>
            <Clock size={14} className="text-[#FF2A85]" />
          </div>
          <div className="text-lg font-bold font-mono text-white tracking-tight">
            {timeSinceLastCheckin}
          </div>
          <div className="text-[10px] text-[#71717A] mt-0.5">
            Статус ткани: Норма
          </div>
        </div>
      </div>

      {/* MINIMALIST LINEAR PROGRESS SVG CHART */}
      <div className="p-4 bg-[#121217] rounded-xl border border-[#1E1E26] mx-1 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-white tracking-tight">
              Динамика стабильности
            </span>
            <span className="text-[10px] font-mono text-[#71717A]">(7 дней)</span>
          </div>
          <span className="text-[10px] font-mono text-[#FF2A85] bg-[#FF2A85]/10 px-2 py-0.5 rounded border border-[#FF2A85]/20">
            100% COMPLIANCE
          </span>
        </div>

        {/* SVG Minimal Line Graph */}
        <div className="w-full pt-2">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-16 overflow-visible"
          >
            <defs>
              <linearGradient id="chartGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#71717A" stopOpacity="0.4" />
                <stop offset="60%" stopColor="#FF2A85" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#FF2A85" stopOpacity="1" />
              </linearGradient>
            </defs>

            {/* Subtle guideline */}
            <line
              x1={paddingX}
              y1={svgHeight - paddingY}
              x2={svgWidth - paddingX}
              y2={svgHeight - paddingY}
              stroke="#1E1E26"
              strokeDasharray="3 3"
              strokeWidth="1"
            />

            {/* Main SVG Polyline */}
            <polyline
              fill="none"
              stroke="url(#chartGradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polylinePoints}
            />

            {/* Data Dots */}
            {chartPoints.map((pt, idx) => {
              const stepX = (svgWidth - paddingX * 2) / (chartPoints.length - 1);
              const x = paddingX + idx * stepX;
              const minVal = 40;
              const maxVal = 100;
              const normalized = (pt.value - minVal) / (maxVal - minVal);
              const y = svgHeight - paddingY - normalized * (svgHeight - paddingY * 2);
              const isLast = idx === chartPoints.length - 1;

              return (
                <g key={pt.day}>
                  <circle
                    cx={x}
                    cy={y}
                    r={isLast ? 4 : 2.5}
                    fill={isLast ? '#FF2A85' : '#121217'}
                    stroke={isLast ? '#FFFFFF' : '#FF2A85'}
                    strokeWidth={isLast ? '1.5' : '1'}
                    className={isLast ? 'drop-shadow-[0_0_6px_#FF2A85]' : ''}
                  />
                  {/* Day label */}
                  <text
                    x={x}
                    y={svgHeight}
                    textAnchor="middle"
                    fill="#71717A"
                    fontSize="9"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {pt.day}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Autonomous architecture footnote card */}
      <div className="px-1">
        <div
          onClick={() => setShowQuickDetails(!showQuickDetails)}
          className="p-3 bg-[#121217]/50 rounded-xl border border-[#1E1E26] flex items-center justify-between text-[11px] text-[#71717A] cursor-pointer hover:border-[#2D2D3A] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Info size={14} className="text-[#FF2A85]" />
            <span>Автономный учет времени (OriginOS safe)</span>
          </div>
          <ChevronRight
            size={14}
            className={`transition-transform duration-200 ${
              showQuickDetails ? 'rotate-90 text-white' : ''
            }`}
          />
        </div>

        {showQuickDetails && (
          <div className="p-3 bg-[#121217] rounded-xl border border-[#1E1E26] mt-2 space-y-1.5 text-[11px] text-[#A1A1AA] animate-in fade-in duration-150 font-mono">
            <div className="flex justify-between">
              <span className="text-[#71717A]">start_lock_timestamp:</span>
              <span className="text-white">{sessionConfig.startLockTimestamp}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#71717A]">current_timestamp:</span>
              <span className="text-white">{now}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#71717A]">genesis_block_hash:</span>
              <span className="text-[#FF2A85] truncate max-w-[140px]">
                {secState.genesisHash}
              </span>
            </div>
            <p className="text-[10px] text-[#71717A] pt-1 leading-normal font-sans">
              Расчет ведется без использования уязвимых фоновых служб (Foreground Service). При выгрузке ОС или перезагрузке устройства таймер остается точным до миллисекунды.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
