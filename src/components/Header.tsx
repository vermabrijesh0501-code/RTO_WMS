import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Warehouse as WarehouseIcon,
  LogOut,
  ChevronDown,
  Shield,
  CheckCircle2,
  RefreshCw,
  Wifi,
  WifiOff,
  Smartphone,
  Laptop,
} from 'lucide-react';
import { User, UserRole, Warehouse } from '../types';
import { ActiveTab } from './Sidebar';
import { SyncService, SyncStatus } from '../services/syncService';

interface HeaderProps {
  currentUser?: User | null;
  onSwitchUserRole: (role: UserRole) => void;
  warehouses: Warehouse[];
  activeWarehouseId: string;
  onSelectWarehouse: (id: string) => void;
  onOpenUniversalSearch: () => void;
  onLogout?: () => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
  activeTab?: ActiveTab;
  onPrimaryAction?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onSwitchUserRole,
  warehouses,
  activeWarehouseId,
  onSelectWarehouse,
  onOpenUniversalSearch,
  onLogout,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isWarehouseMenuOpen, setIsWarehouseMenuOpen] = useState(false);
  const [isSyncMenuOpen, setIsSyncMenuOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => SyncService.getSyncStatus());
  const [isSyncing, setIsSyncing] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const warehouseMenuRef = useRef<HTMLDivElement>(null);
  const syncMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = SyncService.onSyncStatusChange((st) => {
      setSyncStatus(st);
    });
    return () => unsub();
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await SyncService.forceSyncNow();
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  };

  const activeWarehouse = warehouses.find((w) => w.id === activeWarehouseId) || warehouses[0];

  const roles: UserRole[] = [
    'Super Admin',
    'Admin',
    'Warehouse Manager',
    'Supervisor',
    'Security Officer',
    'RTO Operator',
    'GRN Operator',
    'Auditor',
    'Operator',
    'Read Only',
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setIsRoleMenuOpen(false);
      }
      if (warehouseMenuRef.current && !warehouseMenuRef.current.contains(event.target as Node)) {
        setIsWarehouseMenuOpen(false);
      }
      if (syncMenuRef.current && !syncMenuRef.current.contains(event.target as Node)) {
        setIsSyncMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-card border-b border-theme sticky top-0 z-30 px-4 sm:px-6 lg:pl-[88px] flex items-center justify-between gap-4 select-none w-full transition-colors duration-200">
      {/* Left: Logo + Warehouse Switcher */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black tracking-tight text-white">
            WOP<span className="text-[#8B5CF6]">-Emiza</span>
          </span>
        </div>

        {/* Operating Warehouse Dropdown Pill */}
        <div className="relative" ref={warehouseMenuRef}>
          <button
            type="button"
            onClick={() => setIsWarehouseMenuOpen(!isWarehouseMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-[#152238] border border-slate-200 dark:border-theme text-xs font-semibold text-slate-800 dark:text-white hover:border-slate-400 dark:hover:border-[#8B5CF6]/50 transition-all cursor-pointer shadow-2xs"
          >
            <WarehouseIcon className="w-3.5 h-3.5 text-slate-600 dark:text-[#8B5CF6] shrink-0" />
            <span className="hidden sm:inline truncate max-w-[150px]">
              {activeWarehouse?.name || 'Bhiwandi Central Hub'}
            </span>
            <span className="sm:hidden font-mono text-[11px]">
              {activeWarehouse?.code?.replace('WH-', '') || 'WH'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-500 dark:text-[#64748B] shrink-0" />
          </button>

          {isWarehouseMenuOpen && (
            <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-theme rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in-50 duration-100">
              <div className="px-4 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-theme">
                Select Facility
              </div>
              {warehouses.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    onSelectWarehouse(w.id);
                    setIsWarehouseMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#152238] transition-colors ${
                    w.id === activeWarehouseId
                      ? 'bg-purple-50 dark:bg-[#3B2D54] text-purple-700 dark:text-[#8B5CF6] font-bold'
                      : 'text-slate-800 dark:text-white'
                  }`}
                >
                  <div>
                    <div className="font-semibold">{w.name}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {w.city} • {w.totalDocks} Docks
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1E293B] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-theme">
                    {w.code}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-lg mx-2 hidden md:block">
        <button
          type="button"
          onClick={onOpenUniversalSearch}
          className="w-full flex items-center justify-between px-4 py-2 rounded-full bg-slate-100 dark:bg-[#0F172A] border border-slate-200 dark:border-theme hover:border-[#8B5CF6]/50 text-xs text-slate-600 dark:text-[#64748B] transition-all cursor-pointer shadow-2xs"
        >
          <div className="flex items-center gap-2.5 truncate">
            <Search className="w-4 h-4 text-slate-400 dark:text-[#94A3B8] shrink-0" />
            <span className="truncate">Search AWB, Gate Pass, Vehicle, Batch, Client...</span>
          </div>
          <kbd className="text-[10px] font-mono bg-white dark:bg-card text-slate-600 dark:text-[#64748B] px-2 py-0.5 rounded-full border border-slate-200 dark:border-theme shrink-0 ml-2 shadow-2xs">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: Sync Status, Search, Role Badge, Profile Avatar */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Real-time Multi-Device Sync Indicator */}
        <div className="relative" ref={syncMenuRef}>
          <button
            type="button"
            onClick={() => setIsSyncMenuOpen(!isSyncMenuOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
              syncStatus.status === 'connected'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                : syncStatus.status === 'connecting'
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/50'
            }`}
            title="Real-time Multi-Device Sync Status"
          >
            <span className="relative flex h-2 w-2">
              {syncStatus.status === 'connected' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  syncStatus.status === 'connected'
                    ? 'bg-emerald-500'
                    : syncStatus.status === 'connecting'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              ></span>
            </span>

            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isSyncing || syncStatus.status === 'connecting' ? 'animate-spin' : ''
              }`}
            />

            <span className="hidden sm:inline font-medium">
              {syncStatus.status === 'connected'
                ? 'Synced'
                : syncStatus.status === 'connecting'
                ? 'Syncing'
                : 'Offline'}
            </span>

            {syncStatus.connectedDevicesCount > 1 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300">
                {syncStatus.connectedDevicesCount}
              </span>
            )}
          </button>

          {isSyncMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-theme rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in-50 duration-100">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-theme pb-2 mb-2">
                <div className="flex items-center gap-2">
                  {syncStatus.status === 'connected' ? (
                    <Wifi className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-rose-500" />
                  )}
                  <span className="font-bold text-xs text-slate-800 dark:text-white">
                    Cloud & HHD Sync
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sync Now
                </button>
              </div>

              <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Status:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {syncStatus.status === 'connected' ? 'Live (WS + Auto-Poll)' : 'Connecting...'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Active Devices:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {syncStatus.connectedDevicesCount} Connected
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Last Synced:</span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {syncStatus.lastSyncedAt
                      ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString()
                      : 'Just now'}
                  </span>
                </div>
              </div>

              {syncStatus.connectedDevices.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-theme">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Live Connected Fleet
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {syncStatus.connectedDevices.map((dev) => (
                      <div
                        key={dev.id}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-[#152238] border border-slate-100 dark:border-theme text-[10px]"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {dev.deviceType === 'Mobile / Scanner' ? (
                            <Smartphone className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                          ) : (
                            <Laptop className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          )}
                          <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                            {dev.deviceName}
                          </span>
                        </div>
                        <span className="font-mono text-[9px] text-emerald-500 font-semibold px-1 rounded bg-emerald-500/10">
                          {dev.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-theme text-[10px] text-slate-400 leading-tight">
                Tip: Scans on handheld guns reflect on the laptop dashboard within milliseconds. Both devices must open the same URL.
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenUniversalSearch}
          className="md:hidden w-9 h-9 rounded-full bg-[#0F172A] text-[#94A3B8] flex items-center justify-center border border-theme cursor-pointer"
          title="Search (Ctrl+K)"
        >
          <Search className="w-4 h-4" />
        </button>

        {currentUser?.role === 'Super Admin' ? (
          <div className="relative hidden sm:block" ref={roleMenuRef}>
            <button
              type="button"
              onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 dark:bg-[#3B2D54] border border-purple-200 dark:border-[#8B5CF6]/30 text-purple-700 dark:text-[#A78BFA] text-xs font-semibold hover:opacity-90 transition-all cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-[#8B5CF6] shrink-0" />
              <span>{currentUser?.role || 'Guest'}</span>
              <ChevronDown className="w-3 h-3 text-purple-600 dark:text-[#8B5CF6] shrink-0" />
            </button>

            {isRoleMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-theme rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in-50 duration-100">
                <div className="px-4 py-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-100 dark:border-theme">
                  Switch Role Persona
                </div>
                {roles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      onSwitchUserRole(r);
                      setIsRoleMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#152238] transition-colors ${
                      r === currentUser?.role
                        ? 'bg-purple-50 dark:bg-[#3B2D54] text-purple-700 dark:text-[#8B5CF6] font-bold'
                        : 'text-slate-800 dark:text-white'
                    }`}
                  >
                    <span>{r}</span>
                    {r === currentUser?.role && <CheckCircle2 className="w-3.5 h-3.5 text-[#8B5CF6]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 dark:bg-[#3B2D54] border border-purple-200 dark:border-[#8B5CF6]/30 text-purple-700 dark:text-[#A78BFA] text-xs font-semibold">
            <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-[#8B5CF6] shrink-0" />
            <span>{currentUser?.role || 'Staff'}</span>
          </div>
        )}

        {/* Profile Avatar & Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#8B5CF6] to-[#EC4899] text-white font-bold text-xs flex items-center justify-center shadow-sm cursor-pointer hover:scale-105 transition-transform"
            title={`${currentUser?.name || 'User'} (${currentUser?.role || 'Staff'})`}
          >
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1E293B] border border-theme rounded-2xl shadow-2xl py-3 z-50 animate-in fade-in-50 duration-100">
              <div className="px-4 py-2 border-b border-theme">
                <div className="font-bold text-black dark:text-white text-sm truncate">{currentUser?.name || 'Warehouse User'}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 truncate">{currentUser?.email || ''}</div>
                <div className="text-[11px] text-[#8B5CF6] font-semibold mt-1">
                  Role: {currentUser?.role || 'Staff'}
                </div>
              </div>

              <div className="pt-2 px-2">
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 font-semibold rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
