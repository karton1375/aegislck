import React from 'react';
import { Shield, Activity, Layers, Settings } from 'lucide-react';

export type TabType = 'home' | 'log' | 'hub' | 'settings';

interface NavigationProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  isOverridden?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onChangeTab,
  isOverridden,
}) => {
  const tabs = [
    { id: 'home' as TabType, label: 'Статус', icon: Activity },
    { id: 'log' as TabType, label: 'Журнал', icon: Shield },
    { id: 'hub' as TabType, label: 'Другое', icon: Layers },
    { id: 'settings' as TabType, label: 'Настройки', icon: Settings },
  ];

  return (
    <nav
      id="bottom-navigation-bar"
      className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 bg-[#08080A]/95 backdrop-blur-md border-t border-[#1E1E26] px-3 py-2"
    >
      <div className="grid grid-cols-4 gap-1 items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-[#FF2A85]'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              {/* Active glow dot */}
              {isActive && (
                <span className="absolute -top-2 w-1.5 h-1.5 rounded-full bg-[#FF2A85] shadow-[0_0_8px_#FF2A85]" />
              )}

              <div className="relative">
                <Icon
                  size={20}
                  className={`transition-transform duration-200 ${
                    isActive ? 'scale-105 stroke-[2.2]' : 'stroke-[1.8]'
                  }`}
                />
                {tab.id === 'home' && isOverridden && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                )}
              </div>

              <span
                className={`text-[11px] mt-1 tracking-tight font-medium ${
                  isActive ? 'text-[#FF2A85]' : 'text-[#71717A]'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
