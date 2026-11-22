import React, { useState, useMemo } from 'react';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BarChart3,
  PieChart as PieChartIcon,
  Filter,
  TrendingUp,
  Building2,
  Truck,
  RotateCcw,
  Sparkles,
  Info,
  ShieldCheck,
  PackageX,
  PackageCheck,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { ReturnBatch, ScannedReturnItem, Client, Courier } from '../types';

interface ReturnsSummaryViewProps {
  batches: ReturnBatch[];
  scannedItems: ScannedReturnItem[];
  clients: Client[];
  couriers: Courier[];
  onSelectBatch?: (batchId: string) => void;
}

export const ReturnsSummaryView: React.FC<ReturnsSummaryViewProps> = ({
  batches,
  scannedItems,
  clients,
  couriers,
  onSelectBatch,
}) => {
  // Current month determination (YYYY-MM format)
  const currentDate = new Date();
  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [selectedClientId, setSelectedClientId] = useState<string>('ALL');
  const [selectedCourierId, setSelectedCourierId] = useState<string>('ALL');

  // Discover all available months present in the dataset
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    monthsSet.add(currentMonthKey);

    scannedItems.forEach(item => {
      const dt = item.scannedAt || item.updatedAt;
      if (dt) {
        const d = new Date(dt);
        if (!isNaN(d.getTime())) {
          monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
      }
    });

    batches.forEach(batch => {
      const dt = batch.createdAt;
      if (dt) {
        const d = new Date(dt);
        if (!isNaN(d.getTime())) {
          monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
      }
    });

    return Array.from(monthsSet).sort().reverse();
  }, [scannedItems, batches, currentMonthKey]);

  // Format month for display (e.g. "September 2026")
  const formatMonthLabel = (mKey: string) => {
    const [year, month] = mKey.split('-');
    const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Map batch IDs to client and courier for quick lookup
  const batchMetaMap = useMemo(() => {
    const map = new Map<string, { clientId: string; courierId: string; clientName: string; courierName: string; createdAt: string }>();
    batches.forEach(b => {
      map.set(b.id, {
        clientId: b.clientId,
        courierId: b.courierId,
        clientName: b.clientName,
        courierName: b.courierName,
        createdAt: b.createdAt,
      });
    });
    return map;
  }, [batches]);

  // Filter items for the selected month and active filters
  const monthlyItems = useMemo(() => {
    return scannedItems.filter(item => {
      // Date verification
      const dateStr = item.scannedAt || item.updatedAt;
      let itemMonthKey = '';
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          itemMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
      }

      // If item has no timestamp or unparseable, fallback to parent batch timestamp
      if (!itemMonthKey && item.batchId) {
        const bMeta = batchMetaMap.get(item.batchId);
        if (bMeta?.createdAt) {
          const d = new Date(bMeta.createdAt);
          if (!isNaN(d.getTime())) {
            itemMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          }
        }
      }

      // Default to current month if still unknown to prevent data orphan
      if (!itemMonthKey) {
        itemMonthKey = currentMonthKey;
      }

      if (itemMonthKey !== selectedMonth) {
        return false;
      }

      // Client filter
      if (selectedClientId !== 'ALL') {
        const bMeta = batchMetaMap.get(item.batchId);
        if (bMeta && bMeta.clientId !== selectedClientId) {
          return false;
        }
      }

      // Courier filter
      if (selectedCourierId !== 'ALL') {
        const bMeta = batchMetaMap.get(item.batchId);
        if (bMeta && bMeta.courierId !== selectedCourierId) {
          return false;
        }
      }

      return true;
    });
  }, [scannedItems, selectedMonth, selectedClientId, selectedCourierId, batchMetaMap, currentMonthKey]);

  // If monthlyItems is empty, check if batches in this month have breakdown totals
  const monthlyBatches = useMemo(() => {
    return batches.filter(b => {
      const d = new Date(b.createdAt);
      const bMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (bMonth !== selectedMonth) return false;
      if (selectedClientId !== 'ALL' && b.clientId !== selectedClientId) return false;
      if (selectedCourierId !== 'ALL' && b.courierId !== selectedCourierId) return false;
      return true;
    });
  }, [batches, selectedMonth, selectedClientId, selectedCourierId]);

  // Core metrics: Good vs Damage vs Missing
  const summaryMetrics = useMemo(() => {
    let good = 0;
    let damage = 0;
    let missing = 0;
    let openBox = 0;
    let wrongProduct = 0;
    let others = 0;

    if (monthlyItems.length > 0) {
      monthlyItems.forEach(item => {
        const r = item.remark;
        if (r === 'Good') {
          good++;
        } else if (r === 'Damage') {
          damage++;
        } else if (r === 'Missing Product' || r === 'Short Qty') {
          missing++;
        } else if (r === 'Open Box') {
          openBox++;
        } else if (r === 'Wrong Product') {
          wrongProduct++;
        } else {
          others++;
        }
      });
    } else {
      // Fallback to batches breakdown if item records are archived
      monthlyBatches.forEach(b => {
        if (b.remarksBreakdown) {
          good += b.remarksBreakdown['Good'] || 0;
          damage += b.remarksBreakdown['Damage'] || 0;
          missing += (b.remarksBreakdown['Missing Product'] || 0) + (b.remarksBreakdown['Short Qty'] || 0);
          openBox += b.remarksBreakdown['Open Box'] || 0;
          wrongProduct += b.remarksBreakdown['Wrong Product'] || 0;
          others += b.remarksBreakdown['Others'] || 0;
        }
      });
    }

    const otherDefects = openBox + wrongProduct + others;
    const total = good + damage + missing + otherDefects;
    const passRate = total > 0 ? Math.round((good / total) * 100) : 100;
    const damageRate = total > 0 ? ((damage / total) * 100).toFixed(1) : '0.0';
    const missingRate = total > 0 ? ((missing / total) * 100).toFixed(1) : '0.0';
    const goodRate = total > 0 ? ((good / total) * 100).toFixed(1) : '0.0';

    return {
      good,
      damage,
      missing,
      otherDefects,
      total,
      passRate,
      goodRate,
      damageRate,
      missingRate,
    };
  }, [monthlyItems, monthlyBatches]);

  // Donut Chart Data for Good vs Damage vs Missing
  const pieChartData = useMemo(() => {
    const data = [
      {
        name: 'Good Condition',
        shortName: 'Good',
        value: summaryMetrics.good,
        color: '#10B981', // Emerald green
        percentage: summaryMetrics.total > 0 ? Math.round((summaryMetrics.good / summaryMetrics.total) * 100) : 0,
      },
      {
        name: 'Damaged Returns',
        shortName: 'Damage',
        value: summaryMetrics.damage,
        color: '#EF4444', // Bright red
        percentage: summaryMetrics.total > 0 ? Math.round((summaryMetrics.damage / summaryMetrics.total) * 100) : 0,
      },
      {
        name: 'Missing / Short',
        shortName: 'Missing',
        value: summaryMetrics.missing,
        color: '#F59E0B', // Amber
        percentage: summaryMetrics.total > 0 ? Math.round((summaryMetrics.missing / summaryMetrics.total) * 100) : 0,
      },
    ];

    // Include other defects if present to reflect exact 100% total
    if (summaryMetrics.otherDefects > 0) {
      data.push({
        name: 'Other Issues',
        shortName: 'Other',
        value: summaryMetrics.otherDefects,
        color: '#8B5CF6', // Purple
        percentage: summaryMetrics.total > 0 ? Math.round((summaryMetrics.otherDefects / summaryMetrics.total) * 100) : 0,
      });
    }

    return data;
  }, [summaryMetrics]);

  // Daily timeline breakdown across the selected month
  const dailyBreakdownData = useMemo(() => {
    const dayMap = new Map<string, { dateStr: string; dayLabel: string; good: number; damage: number; missing: number; total: number }>();

    monthlyItems.forEach(item => {
      const dt = item.scannedAt || item.updatedAt || new Date().toISOString();
      const d = new Date(dt);
      if (!isNaN(d.getTime())) {
        const key = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
        const dayLabel = `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`;

        if (!dayMap.has(key)) {
          dayMap.set(key, { dateStr: key, dayLabel, good: 0, damage: 0, missing: 0, total: 0 });
        }
        const entry = dayMap.get(key)!;
        entry.total++;
        if (item.remark === 'Good') entry.good++;
        else if (item.remark === 'Damage') entry.damage++;
        else if (item.remark === 'Missing Product' || item.remark === 'Short Qty') entry.missing++;
      }
    });

    const sorted = Array.from(dayMap.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    return sorted.length > 0 ? sorted : [];
  }, [monthlyItems]);

  // Account-level comparison data for current month
  const accountComparisonData = useMemo(() => {
    const accMap = new Map<string, { accountName: string; good: number; damage: number; missing: number; total: number }>();

    monthlyItems.forEach(item => {
      const bMeta = batchMetaMap.get(item.batchId);
      const client = clients.find(c => c.id === bMeta?.clientId);
      const accName = client?.name || bMeta?.clientName || 'General Account';

      if (!accMap.has(accName)) {
        accMap.set(accName, { accountName: accName, good: 0, damage: 0, missing: 0, total: 0 });
      }
      const entry = accMap.get(accName)!;
      entry.total++;
      if (item.remark === 'Good') entry.good++;
      else if (item.remark === 'Damage') entry.damage++;
      else if (item.remark === 'Missing Product' || item.remark === 'Short Qty') entry.missing++;
    });

    return Array.from(accMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5); // Top 5 accounts
  }, [monthlyItems, batchMetaMap, clients]);

  const isCurrentMonth = selectedMonth === currentMonthKey;

  return (
    <div className="space-y-4">
      {/* HEADER & FILTERS BAR */}
      <div className="bg-surface border border-theme rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-theme pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <PieChartIcon className="w-5 h-5" />
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-primary">
                Monthly Returns Summary
              </h2>
              {isCurrentMonth ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Current Month
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary/10 text-secondary border border-theme">
                  Historical View
                </span>
              )}
            </div>
            <p className="text-xs text-secondary mt-1">
              Visualizing QC reason breakdown (Good vs Damage vs Missing) for{' '}
              <span className="font-semibold text-primary">{formatMonthLabel(selectedMonth)}</span>.
            </p>
          </div>

          {/* Month, Account, Courier Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Month Selector */}
            <div className="flex items-center gap-1.5 bg-elevated border border-theme rounded-xl px-2.5 py-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-secondary shrink-0" />
              <select
                id="returns-summary-month-select"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-transparent font-bold text-primary focus:outline-none cursor-pointer pr-1"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m} className="bg-[#1E293B] text-white">
                    {formatMonthLabel(m)} {m === currentMonthKey ? ' (Current)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Account Filter */}
            <div className="flex items-center gap-1.5 bg-elevated border border-theme rounded-xl px-2.5 py-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5 text-secondary shrink-0" />
              <select
                id="returns-summary-account-select"
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                className="bg-transparent font-semibold text-primary focus:outline-none cursor-pointer pr-1"
              >
                <option value="ALL" className="bg-[#1E293B] text-white">All Accounts</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id} className="bg-[#1E293B] text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Courier Filter */}
            <div className="flex items-center gap-1.5 bg-elevated border border-theme rounded-xl px-2.5 py-1.5 text-xs">
              <Truck className="w-3.5 h-3.5 text-secondary shrink-0" />
              <select
                id="returns-summary-courier-select"
                value={selectedCourierId}
                onChange={e => setSelectedCourierId(e.target.value)}
                className="bg-transparent font-semibold text-primary focus:outline-none cursor-pointer pr-1"
              >
                <option value="ALL" className="bg-[#1E293B] text-white">All Couriers</option>
                {couriers.map(cr => (
                  <option key={cr.id} value={cr.id} className="bg-[#1E293B] text-white">
                    {cr.name}
                  </option>
                ))}
              </select>
            </div>

            {!isCurrentMonth && (
              <button
                onClick={() => setSelectedMonth(currentMonthKey)}
                className="px-2.5 py-1.5 rounded-xl bg-[#123B5D] dark:bg-indigo-600 text-white font-bold text-xs shadow-xs hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1"
                title="Jump to Current Month"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Today</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 CORE KPI STAT CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          {/* Total Processed */}
          <div className="p-3.5 rounded-xl bg-elevated border border-theme shadow-xs">
            <div className="flex items-center justify-between text-secondary mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider">Total Returns Scanned</span>
              <RotateCcw className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black font-mono text-primary">
              {summaryMetrics.total.toLocaleString()}
            </div>
            <div className="text-[11px] text-secondary mt-0.5 flex items-center gap-1">
              <span>Pass Rate:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{summaryMetrics.passRate}%</span>
            </div>
          </div>

          {/* Good Units Card */}
          <div className="p-3.5 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 shadow-xs">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider">Good Condition</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {summaryMetrics.good.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold mt-0.5">
              {summaryMetrics.goodRate}% of monthly intake
            </div>
          </div>

          {/* Damaged Units Card */}
          <div className="p-3.5 rounded-xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 shadow-xs">
            <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider">Damaged Returns</span>
              <XCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
              {summaryMetrics.damage.toLocaleString()}
            </div>
            <div className="text-[11px] text-rose-700 dark:text-rose-300 font-semibold mt-0.5">
              {summaryMetrics.damageRate}% damage defect rate
            </div>
          </div>

          {/* Missing / Short Card */}
          <div className="p-3.5 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 shadow-xs">
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider">Missing / Short</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              {summaryMetrics.missing.toLocaleString()}
            </div>
            <div className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold mt-0.5">
              {summaryMetrics.missingRate}% missing variance
            </div>
          </div>
        </div>
      </div>

      {/* RECHARTS VISUALIZATION GRID: DONUT BREAKDOWN & DAILY TIMELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT: DONUT BREAKDOWN (Good vs Damage vs Missing) */}
        <div className="lg:col-span-5 bg-surface border border-theme rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-theme pb-2.5">
              <div>
                <h3 className="text-sm font-extrabold text-primary flex items-center gap-1.5">
                  <PieChartIcon className="w-4 h-4 text-emerald-500" />
                  <span>Return Reasons Breakdown</span>
                </h3>
                <p className="text-[11px] text-secondary">
                  Proportion of Good vs Damage vs Missing for {formatMonthLabel(selectedMonth)}
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-primary bg-elevated px-2 py-0.5 rounded-md border border-theme">
                {summaryMetrics.total} units
              </span>
            </div>

            {/* Recharts Pie / Donut Chart */}
            <div className="relative h-[230px] w-full my-2 flex items-center justify-center">
              {summaryMetrics.total === 0 ? (
                <div className="text-center text-xs text-secondary">
                  <Info className="w-6 h-6 mx-auto text-muted mb-1 opacity-50" />
                  No returns scanned for this month yet.
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius="62%"
                        outerRadius="86%"
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          border: '1px solid #334155',
                          borderRadius: '0.75rem',
                          fontSize: '11px',
                          color: '#F8FAFC',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                        }}
                        formatter={(value: any, name: any) => [`${value} units`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Stat Badge */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] uppercase font-bold text-secondary tracking-wider">Pass Rate</span>
                    <span className="text-xl font-black font-mono text-emerald-500">{summaryMetrics.passRate}%</span>
                    <span className="text-[9px] text-muted">Good Units</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Interactive Legend List */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-theme">
            {pieChartData.map(entry => (
              <div key={entry.name} className="p-2 rounded-xl bg-elevated border border-theme text-center">
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-[11px] font-bold text-primary truncate">{entry.shortName}</span>
                </div>
                <div className="text-xs font-black font-mono text-primary">{entry.value}</div>
                <div className="text-[10px] text-secondary font-mono">{entry.percentage}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: DAILY TIMELINE BAR CHART */}
        <div className="lg:col-span-7 bg-surface border border-theme rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-theme pb-2.5">
              <div>
                <h3 className="text-sm font-extrabold text-primary flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  <span>Daily Returns Timeline</span>
                </h3>
                <p className="text-[11px] text-secondary">
                  Good vs Damage vs Missing intake across days in {formatMonthLabel(selectedMonth)}
                </p>
              </div>

              {/* Legend Badges */}
              <div className="hidden sm:flex items-center gap-3 text-[11px] font-medium">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Good
                </span>
                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span> Damage
                </span>
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> Missing
                </span>
              </div>
            </div>

            {/* Recharts Bar Chart */}
            <div className="h-[250px] w-full pt-3">
              {dailyBreakdownData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-secondary text-xs">
                  <BarChart3 className="w-8 h-8 text-muted mb-1 opacity-50" />
                  <span>No daily scan history logged for {formatMonthLabel(selectedMonth)}.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyBreakdownData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                    <XAxis
                      dataKey="dayLabel"
                      tick={{ fill: '#94A3B8', fontSize: 10 }}
                      stroke="#334155"
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#94A3B8', fontSize: 10 }}
                      stroke="#334155"
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        border: '1px solid #334155',
                        borderRadius: '0.75rem',
                        fontSize: '11px',
                        color: '#F8FAFC',
                      }}
                      formatter={(val: any, name: any) => [
                        `${val} units`,
                        name === 'good' ? 'Good' : name === 'damage' ? 'Damage' : name === 'missing' ? 'Missing' : name,
                      ]}
                    />
                    <Bar dataKey="good" fill="#10B981" radius={[3, 3, 0, 0]} name="good" stackId="a" />
                    <Bar dataKey="damage" fill="#EF4444" radius={[3, 3, 0, 0]} name="damage" stackId="a" />
                    <Bar dataKey="missing" fill="#F59E0B" radius={[3, 3, 0, 0]} name="missing" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="text-[11px] text-secondary flex items-center justify-between pt-2 border-t border-theme">
            <span>Aggregated from {monthlyBatches.length} batches processed in {formatMonthLabel(selectedMonth)}.</span>
            <span className="font-mono text-primary font-bold">{summaryMetrics.total} Total Scans</span>
          </div>
        </div>
      </div>

      {/* ACCOUNT-LEVEL REASON BREAKDOWN */}
      {accountComparisonData.length > 0 && (
        <div className="bg-surface border border-theme rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-theme pb-2.5">
            <div>
              <h3 className="text-sm font-extrabold text-primary flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-purple-500" />
                <span>Account-Wise Breakdown (Top Accounts This Month)</span>
              </h3>
              <p className="text-[11px] text-secondary">
                Comparison of Good, Damage, and Missing units across accounts for {formatMonthLabel(selectedMonth)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-theme">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-2.5">Account</th>
                  <th className="px-4 py-2.5 text-center">Total Returns</th>
                  <th className="px-4 py-2.5 text-center text-emerald-600 dark:text-emerald-400">Good Condition</th>
                  <th className="px-4 py-2.5 text-center text-rose-600 dark:text-rose-400">Damage</th>
                  <th className="px-4 py-2.5 text-center text-amber-600 dark:text-amber-400">Missing / Short</th>
                  <th className="px-4 py-2.5 text-center">Pass Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme text-primary">
                {accountComparisonData.map(acc => {
                  const passRate = acc.total > 0 ? Math.round((acc.good / acc.total) * 100) : 100;
                  return (
                    <tr key={acc.accountName} className="hover:bg-elevated">
                      <td className="px-4 py-2.5 font-bold text-primary flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-secondary" />
                        <span>{acc.accountName}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono font-bold text-primary">
                        {acc.total.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                        {acc.good.toLocaleString()} ({acc.total > 0 ? Math.round((acc.good / acc.total) * 100) : 0}%)
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono font-bold text-rose-600 dark:text-rose-400">
                        {acc.damage.toLocaleString()} ({acc.total > 0 ? Math.round((acc.damage / acc.total) * 100) : 0}%)
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                        {acc.missing.toLocaleString()} ({acc.total > 0 ? Math.round((acc.missing / acc.total) * 100) : 0}%)
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            passRate >= 80
                              ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30'
                              : passRate >= 60
                              ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30'
                              : 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30'
                          }`}
                        >
                          {passRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QC SUMMARY MATRIX & DISPOSITION RECOMMENDATION */}
      <div className="bg-surface border border-theme rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-theme pb-2.5">
          <h3 className="text-sm font-extrabold text-primary flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Monthly Return Reason Breakdown & Dispositions</span>
          </h3>
          <span className="text-[11px] text-secondary font-mono">
            Period: {formatMonthLabel(selectedMonth)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* GOOD CONDITION DISPOSITION */}
          <div className="p-4 rounded-xl bg-elevated border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Good (Intact)</span>
              </span>
              <span className="text-base font-black font-mono text-emerald-500">{summaryMetrics.good}</span>
            </div>
            <p className="text-[11px] text-secondary leading-relaxed">
              Passed initial visual and physical quality checks with packaging and seal fully intact.
            </p>
            <div className="pt-2 border-t border-theme flex items-center justify-between text-[10px] text-muted">
              <span>Next Action:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Putaway to Sellable Stock</span>
            </div>
          </div>

          {/* DAMAGE DISPOSITION */}
          <div className="p-4 rounded-xl bg-elevated border border-rose-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <XCircle className="w-4 h-4" />
                <span>Damage (Broken/Leaking)</span>
              </span>
              <span className="text-base font-black font-mono text-rose-500">{summaryMetrics.damage}</span>
            </div>
            <p className="text-[11px] text-secondary leading-relaxed">
              Box or interior product damaged during transit. Requires courier claim & photo documentation.
            </p>
            <div className="pt-2 border-t border-theme flex items-center justify-between text-[10px] text-muted">
              <span>Next Action:</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">RTV / Insurance Claim</span>
            </div>
          </div>

          {/* MISSING / SHORT DISPOSITION */}
          <div className="p-4 rounded-xl bg-elevated border border-amber-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Missing / Short Qty</span>
              </span>
              <span className="text-base font-black font-mono text-amber-500">{summaryMetrics.missing}</span>
            </div>
            <p className="text-[11px] text-secondary leading-relaxed">
              Expected item not enclosed in return package or partial quantity missing upon inspection.
            </p>
            <div className="pt-2 border-t border-theme flex items-center justify-between text-[10px] text-muted">
              <span>Next Action:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">Courier POD & Weight Audit</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
