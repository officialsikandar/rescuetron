import React, { useState, useEffect } from 'react';
import { Wifi, Battery, Signal, Code, Smartphone, Monitor } from 'lucide-react';

interface MobileFrameProps {
  children: React.ReactNode;
  title?: string;
  activeTab?: string;
  onToggleDevMode?: () => void;
  isDevMode?: boolean;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({
  children,
  title = 'Rescuetron Mobile',
  onToggleDevMode,
  isDevMode = false,
}) => {
  const [time, setTime] = useState<string>('');
  const [deviceOs, setDeviceOs] = useState<'ios' | 'android'>('ios');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-2 sm:p-6 font-sans selection:bg-rose-500 selection:text-white">
      {/* Top Bar / Controls */}
      <div className="w-full max-w-md sm:max-w-xl mb-4 flex items-center justify-between bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-800 shadow-lg text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="font-semibold tracking-wide text-slate-300">
            Rescuetron Engine Active
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Platform toggle */}
          <button
            onClick={() => setDeviceOs(deviceOs === 'ios' ? 'android' : 'ios')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-[11px] font-medium border border-slate-700/60"
            title="Toggle OS Frame UI"
          >
            <Smartphone className="w-3.5 h-3.5 text-rose-400" />
            <span>{deviceOs === 'ios' ? 'iOS Frame' : 'Android Frame'}</span>
          </button>

          {/* Developer / NestJS Code toggle */}
          <button
            onClick={onToggleDevMode}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition text-[11px] font-semibold border ${
              isDevMode
                ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-900/40'
                : 'bg-slate-800 hover:bg-slate-700 text-rose-300 border-slate-700/60'
            }`}
          >
            {isDevMode ? (
              <>
                <Smartphone className="w-3.5 h-3.5" />
                <span>View Mobile App</span>
              </>
            ) : (
              <>
                <Code className="w-3.5 h-3.5" />
                <span>NestJS & Firebase API</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content / Mobile Phone Simulator Container */}
      {!isDevMode ? (
        <div className="w-full max-w-[410px] bg-slate-900 rounded-[44px] p-3 shadow-2xl border-[8px] border-slate-800 shadow-rose-950/20 relative overflow-hidden flex flex-col h-[820px] max-h-[92vh]">
          {/* iOS Dynamic Island or Android Camera Notch */}
          {deviceOs === 'ios' ? (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-50 flex items-center justify-between px-3 shadow-md">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-900/90 border border-slate-800"></div>
              <div className="w-2 h-2 rounded-full bg-emerald-900/60 border border-emerald-500/40 animate-pulse"></div>
            </div>
          ) : (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-black rounded-full z-50 border border-slate-800 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-900"></div>
            </div>
          )}

          {/* Status Bar */}
          <div className="w-full pt-2 px-6 pb-2 flex items-center justify-between text-[12px] font-semibold text-slate-300 select-none z-40 bg-slate-950/40 backdrop-blur-sm rounded-t-[36px]">
            <span>{time || '09:41'}</span>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Signal className="w-3.5 h-3.5" />
              <Wifi className="w-3.5 h-3.5" />
              <Battery className="w-4 h-4 text-emerald-400 fill-emerald-400" />
            </div>
          </div>

          {/* Screen Content Wrapper */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden rounded-b-[32px] bg-slate-950 relative flex flex-col scrollbar-thin scrollbar-thumb-slate-800">
            {children}
          </div>

          {/* Bottom Home Indicator */}
          <div className="w-full py-1.5 flex items-center justify-center bg-slate-950 rounded-b-[36px] z-40">
            <div className="w-32 h-1 bg-slate-700/80 rounded-full"></div>
          </div>
        </div>
      ) : (
        /* Expanded NestJS API & Architecture View */
        <div className="w-full max-w-5xl bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-2xl border border-slate-800 flex flex-col min-h-[750px]">
          {children}
        </div>
      )}
    </div>
  );
};
