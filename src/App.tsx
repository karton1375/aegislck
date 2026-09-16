import React, { useState, useEffect } from 'react';
import {
  Shield,
  Wifi,
  Battery,
  Lock,
  Smartphone,
  Crown,
  User,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { AuditLogEntry, SecurityState, SessionConfig } from './types';
import {
  initializeNewSession,
  loadAuditLog,
  loadSecurityState,
  loadSessionConfig,
  saveSecurityState,
  saveSessionConfig,
  verifySystemIntegrity
} from './storage/db';
import { Navigation, TabType } from './components/Navigation';
import { Onboarding } from './components/Onboarding';
import { HomeTab } from './components/HomeTab';
import { AuditLogTab } from './components/AuditLogTab';
import { HubTab } from './components/HubTab';
import { SettingsTab } from './components/SettingsTab';
import { DisguiseScreen } from './components/DisguiseScreen';

export default function App() {
  const [secState, setSecState] = useState<SecurityState>(loadSecurityState());
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>(loadSessionConfig());
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(loadAuditLog());
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isIntegrityOk, setIsIntegrityOk] = useState<boolean>(true);
  const [activeDisguise, setActiveDisguise] = useState<'notes' | 'calc' | 'fitness' | null>(null);

  // Device frame view mode (native phone bezel vs full screen)
  const [isDeviceFramed, setIsDeviceFramed] = useState<boolean>(true);

  // Status bar simulated clock
  const [clockStr, setClockStr] = useState<string>('12:00');

  // Background integrity check and data load
  const refreshAllData = async () => {
    const sState = loadSecurityState();
    const sCfg = loadSessionConfig();
    const log = loadAuditLog();
    setSecState(sState);
    setSessionConfig(sCfg);
    setAuditLog(log);

    if (sState.isSetupComplete) {
      const check = await verifySystemIntegrity();
      setIsIntegrityOk(check.allValid);
    }
  };

  useEffect(() => {
    refreshAllData();

    // Clock updater
    const updateClock = () => {
      const d = new Date();
      setClockStr(
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 30000);
    return () => clearInterval(interval);
  }, []);

  // Complete Onboarding
  const handleCompleteOnboarding = async (
    newSecState: Partial<SecurityState>,
    newSessionCfg: Partial<SessionConfig>
  ) => {
    const res = await initializeNewSession(newSecState, newSessionCfg);
    setSecState(res.state);
    setSessionConfig(res.config);
    setAuditLog(res.log);
    setActiveTab('home');
  };

  // Reset to Onboarding
  const handleResetToOnboarding = () => {
    setSecState(loadSecurityState());
    setSessionConfig(loadSessionConfig());
    setAuditLog(loadAuditLog());
    setActiveTab('home');
  };

  // Quick switch role between Master & Wearer for testing
  const handleToggleRole = () => {
    const nextRole = secState.role === 'master' ? 'wearer' : 'master';
    const updated = { ...secState, role: nextRole };
    saveSecurityState(updated);
    setSecState(updated);
  };

  // If in Camouflage mode, render Disguise Screen
  if (activeDisguise) {
    return (
      <DisguiseScreen
        type={activeDisguise}
        onExit={() => setActiveDisguise(null)}
      />
    );
  }

  // If setup not completed, show Onboarding Screen
  if (!secState.isSetupComplete) {
    return (
      <div className="min-h-screen bg-[#08080A] flex flex-col justify-center items-center">
        <Onboarding onComplete={handleCompleteOnboarding} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050507] text-[#E4E4E7] flex flex-col items-center justify-center sm:p-4">
      {/* Mobile Device Container (OLED Black #08080A) */}
      <div
        id="aegis-mobile-frame"
        className={`w-full max-w-md bg-[#08080A] flex flex-col relative overflow-hidden transition-all duration-300 min-h-screen sm:min-h-[820px] sm:max-h-[920px] sm:rounded-[36px] sm:border sm:border-[#1E1E26] sm:shadow-[0_0_50px_rgba(0,0,0,0.8)] ${
          isDeviceFramed ? 'sm:border-[#1E1E26]' : ''
        }`}
      >
        {/* NATIVE MOBILE STATUS BAR */}
        <div className="pt-2 px-5 pb-1 flex items-center justify-between text-xs text-[#71717A] select-none border-b border-[#1E1E26]/40 bg-[#08080A]/90 sticky top-0 z-40 backdrop-blur-sm">
          {/* Time & Role Badge */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-white tracking-tight">
              {clockStr}
            </span>
            <button
              id="quick-role-toggle-badge"
              onClick={handleToggleRole}
              className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all ${
                secState.role === 'master'
                  ? 'bg-amber-950/40 text-amber-300 border-amber-800/40 hover:bg-amber-900/40'
                  : 'bg-[#FF2A85]/10 text-[#FF2A85] border-[#FF2A85]/30 hover:bg-[#FF2A85]/20'
              }`}
              title="Нажмите для переключения Master / Wearer"
            >
              {secState.role === 'master' ? <Crown size={10} /> : <User size={10} />}
              <span>{secState.role === 'master' ? 'MASTER' : 'WEARER'}</span>
            </button>
          </div>

          {/* Security & System Indicators */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1 text-[10px] font-mono ${
                isIntegrityOk ? 'text-emerald-400' : 'text-red-400'
              }`}
              title={isIntegrityOk ? 'Цепочка HMAC целостна' : 'Нарушение целостности!'}
            >
              {isIntegrityOk ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
              <span className="hidden xs:inline">HMAC</span>
            </div>

            <Wifi size={13} className="text-[#71717A]" />
            <div className="flex items-center gap-0.5">
              <span className="text-[10px] font-mono text-[#71717A]">98%</span>
              <Battery size={13} className="text-emerald-400" />
            </div>
          </div>
        </div>

        {/* MAIN ACTIVE SCREEN CONTENT */}
        <main className="flex-1 overflow-y-auto px-4 pt-3 pb-6">
          {activeTab === 'home' && (
            <HomeTab
              secState={secState}
              sessionConfig={sessionConfig}
              auditLog={auditLog}
              onRefreshData={refreshAllData}
              onNavigateTab={(t) => setActiveTab(t)}
            />
          )}

          {activeTab === 'log' && (
            <AuditLogTab
              secState={secState}
              auditLog={auditLog}
            />
          )}

          {activeTab === 'hub' && (
            <HubTab
              secState={secState}
              sessionConfig={sessionConfig}
              onRefreshData={refreshAllData}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              secState={secState}
              sessionConfig={sessionConfig}
              onRefreshData={refreshAllData}
              onLaunchDisguise={(t) => setActiveDisguise(t)}
              onResetToOnboarding={handleResetToOnboarding}
            />
          )}
        </main>

        {/* 4 TAB BOTTOM NAVIGATION */}
        <Navigation
          activeTab={activeTab}
          onChangeTab={(tab) => setActiveTab(tab)}
          isOverridden={sessionConfig.isEmergencyOverridden}
        />
      </div>

      {/* Desktop helper bar below phone frame */}
      <div className="hidden sm:flex items-center gap-3 mt-3 text-[11px] text-[#71717A] font-mono">
        <span>Aegis Enforcer Mobile Arch • OLED #08080A</span>
        <span>•</span>
        <button
          onClick={handleToggleRole}
          className="text-[#FF2A85] hover:underline cursor-pointer"
        >
          Переключить роль ({secState.role === 'master' ? 'Текущая: Master' : 'Текущая: Wearer'})
        </button>
      </div>
    </div>
  );
}
