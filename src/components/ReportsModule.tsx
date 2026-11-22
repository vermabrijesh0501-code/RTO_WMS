import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  Eye,
  X,
  PieChart as PieChartIcon,
  RotateCcw,
  CheckCircle2,
  Package,
  Layers,
  Truck,
  Building2,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  FileText,
  UserCheck,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  InwardGateEntry,
  ReturnBatch,
  ScannedReturnItem,
  Warehouse,
  Client,
  Courier,
  User,
  ActivityLog,
  ActiveDeviceSession,
  Company,
} from '../types';
import { downloadCSV } from '../utils/csvExporter';
import { generateBatchPDF } from '../utils/pdfGenerator';
import { generateGenericReportPDF, ReportPdfColumn } from '../utils/reportPdfGenerator';
import { ActiveTab } from './Sidebar';

const PIE_COLORS = [
  '#8B5CF6', // Purple - Primary
  '#EF4444', // Red - Damage
  '#F59E0B', // Amber - Seal Broken
  '#3B82F6', // Blue - Wrong Item
  '#10B981', // Emerald - Good / Restock
  '#EC4899', // Pink - Customer Refusal
  '#06B6D4', // Cyan - Address Issue
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
];

export type TableViewType = 'manifests' | 'return_reasons' | 'gate_register' | 'client_courier';

interface ReportsModuleProps {
  activeWarehouse: Warehouse;
  gateEntries: InwardGateEntry[];
  batches: ReturnBatch[];
  scannedItems: ScannedReturnItem[];
  clients: Client[];
  couriers: Courier[];
  users: User[];
  allWarehouses?: Warehouse[];
  companies?: Company[];
  activeDevices?: ActiveDeviceSession[];
  logs?: ActivityLog[];
  currentUser?: User;
  onNavigateTab?: (tab: ActiveTab) => void;
  onOpenNewGateEntryModal?: () => void;
  onOpenNewBatchModal?: () => void;
  initialSubTab?: string;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({
  activeWarehouse,
  gateEntries = [],
  batches = [],
  scannedItems = [],
  clients = [],
  couriers = [],
  users = [],
  activeDevices = [],
  onOpenNewGateEntryModal,
  onOpenNewBatchModal,
}) => {
  // Consolidated Table View Selection
  const [activeTableView, setActiveTableView] = useState<TableViewType>('manifests');

  // Secondary Chart Toggle (Client vs Courier vs Channel)
  const [secondaryChartType, setSecondaryChartType] = useState<'channel' | 'client' | 'courier'>('channel');

  // Table Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientFilter, setSelectedClientFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'Open' | 'Closed'>('ALL');
  const [selectedReasonFilter, setSelectedReasonFilter] = useState<string>('ALL');

  // Batch Preview Modal
  const [previewBatch, setPreviewBatch] = useState<ReturnBatch | null>(null);

  // Warehouse-filtered datasets
  const whGateEntries = useMemo(
    () => gateEntries.filter(g => g.warehouseId === activeWarehouse.id),
    [gateEntries, activeWarehouse.id]
  );
  const whBatches = useMemo(
    () => batches.filter(b => b.warehouseId === activeWarehouse.id),
    [batches, activeWarehouse.id]
  );
  const whScannedItems = useMemo(() => {
    const whBatchIds = new Set(whBatches.map(b => b.id));
    return scannedItems.filter(item => whBatchIds.has(item.batchId));
  }, [scannedItems, whBatches]);

  // Aggregate Metrics
  const totalScannedCount = useMemo(
    () => whBatches.reduce((acc, b) => acc + (b.totalScanned || 0), 0),
    [whBatches]
  );
  const openBatchesCount = useMemo(
    () => whBatches.filter(b => b.status === 'Open').length,
    [whBatches]
  );
  const closedBatchesCount = useMemo(
    () => whBatches.filter(b => b.status === 'Closed').length,
    [whBatches]
  );
  const completedGateEntriesCount = useMemo(
    () => whGateEntries.filter(g => g.status === 'Completed' || g.status === 'Handover Completed' || g.status === 'Verified').length,
    [whGateEntries]
  );
  const pendingGateEntriesCount = useMemo(
    () => whGateEntries.filter(g => g.status !== 'Completed' && g.status !== 'Handover Completed' && g.status !== 'Verified').length,
    [whGateEntries]
  );

  // Return Reasons Breakdown Calculation
  const returnReasonsData = useMemo(() => {
    const counts: Record<string, number> = {
      'Customer Refusal / RTO': 0,
      'Damaged / Defective': 0,
      'Seal Broken / Open Box': 0,
      'Wrong Product / Item': 0,
      'Good / Restockable': 0,
      'Empty / Tampered Box': 0,
      'Short Quantity / Missing': 0,
      'Other Dispositions': 0,
    };

    // Calculate from scanned items remarks
    whScannedItems.forEach(item => {
      const rem = (item.remark || '').trim();
      if (!rem || rem === 'Good' || rem.toLowerCase() === 'good condition') {
        counts['Good / Restockable']++;
      } else if (rem.toLowerCase().includes('damag')) {
        counts['Damaged / Defective']++;
      } else if (rem.toLowerCase().includes('seal') || rem.toLowerCase().includes('open')) {
        counts['Seal Broken / Open Box']++;
      } else if (rem.toLowerCase().includes('wrong')) {
        counts['Wrong Product / Item']++;
      } else if (rem.toLowerCase().includes('tamper') || rem.toLowerCase().includes('empty')) {
        counts['Empty / Tampered Box']++;
      } else if (rem.toLowerCase().includes('short') || rem.toLowerCase().includes('miss')) {
        counts['Short Quantity / Missing']++;
      } else if (rem.toLowerCase().includes('refus') || rem.toLowerCase().includes('rto')) {
        counts['Customer Refusal / RTO']++;
      } else {
        counts['Customer Refusal / RTO']++;
      }
    });

    // Also account for batch remarks breakdown if items array is partially loaded
    if (whScannedItems.length === 0 && whBatches.length > 0) {
      whBatches.forEach(b => {
        const bd = (b.remarksBreakdown || {}) as Record<string, number>;
        const goodVal = bd['Good'] ?? bd['good'] ?? 0;
        const dmgVal = bd['Damage'] ?? bd['damaged'] ?? 0;
        const openVal = bd['Open Box'] ?? bd['sealBroken'] ?? 0;
        const wrongVal = bd['Wrong Product'] ?? bd['wrongItem'] ?? 0;
        const shortVal = (bd['Short Qty'] || 0) + (bd['Missing Product'] || 0);
        const otherVal = bd['Others'] ?? bd['other'] ?? 0;
        counts['Good / Restockable'] += goodVal;
        counts['Damaged / Defective'] += dmgVal;
        counts['Seal Broken / Open Box'] += openVal;
        counts['Wrong Product / Item'] += wrongVal;
        counts['Short Quantity / Missing'] += shortVal;
        counts['Other Dispositions'] += otherVal || Math.max(0, (b.totalScanned || 0) - goodVal - dmgVal - openVal - wrongVal - shortVal);
      });
    }

    const total = Object.values(counts).reduce((sum, v) => sum + v, 0) || 1;
    return Object.entries(counts)
      .map(([reason, count]) => ({
        name: reason,
        value: count,
        percent: ((count / total) * 100).toFixed(1),
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [whScannedItems, whBatches]);

  // Top Return Reason & Quality Ratio
  const topReason = returnReasonsData[0] || { name: 'Customer Refusal / RTO', value: 0, percent: '0' };
  const goodUnitsCount = returnReasonsData.find(r => r.name.includes('Good'))?.value || 0;
  const defectiveUnitsCount = returnReasonsData.filter(r => !r.name.includes('Good')).reduce((sum, r) => sum + r.value, 0);
  const acceptanceRate = totalScannedCount > 0 ? ((goodUnitsCount / totalScannedCount) * 100).toFixed(1) : '100.0';

  // Return Channels Pie Data
  const returnChannelsData = useMemo(() => {
    const counts: Record<string, number> = {};
    whBatches.forEach(b => {
      const ch = b.channel || (b.batchType === 'B2B Return' ? 'B2B Return' : 'B2C Return');
      counts[ch] = (counts[ch] || 0) + (b.totalScanned || 1);
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0);
  }, [whBatches]);

  // Client Volume Data
  const clientVolumeData = useMemo(() => {
    return clients
      .map(cli => {
        const cliBatches = whBatches.filter(b => b.clientId === cli.id);
        const scanned = cliBatches.reduce((acc, b) => acc + (b.totalScanned || 0), 0);
        return { name: cli.name, code: cli.code, value: scanned };
      })
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [clients, whBatches]);

  // Courier Volume Data
  const courierVolumeData = useMemo(() => {
    return couriers
      .map(cr => {
        const crBatches = whBatches.filter(b => b.courierId === cr.id);
        const scanned = crBatches.reduce((acc, b) => acc + (b.totalScanned || 0), 0);
        return { name: cr.name, code: cr.code, value: scanned };
      })
      .filter(cr => cr.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [couriers, whBatches]);

  // Filtered Batches for Table View
  const filteredBatches = useMemo(() => {
    return whBatches.filter(b => {
      if (selectedStatusFilter !== 'ALL' && b.status !== selectedStatusFilter) return false;
      if (selectedClientFilter !== 'ALL' && b.clientId !== selectedClientFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const clientName = clients.find(c => c.id === b.clientId)?.name?.toLowerCase() || '';
        const courierName = couriers.find(cr => cr.id === b.courierId)?.name?.toLowerCase() || '';
        const batchNum = b.batchNumber.toLowerCase();
        const dockNum = (b.dockNumber || '').toLowerCase();
        return batchNum.includes(q) || clientName.includes(q) || courierName.includes(q) || dockNum.includes(q);
      }
      return true;
    });
  }, [whBatches, selectedStatusFilter, selectedClientFilter, searchQuery, clients, couriers]);

  // Filtered Scanned Items for Reason/QC Table View
  const filteredItems = useMemo(() => {
    return whScannedItems.filter(item => {
      if (selectedReasonFilter !== 'ALL') {
        const r = (item.remark || '').toLowerCase();
        if (selectedReasonFilter === 'Good' && !r.includes('good') && r !== '') return false;
        if (selectedReasonFilter === 'Damaged' && !r.includes('damag')) return false;
        if (selectedReasonFilter === 'Seal Broken' && !r.includes('seal') && !r.includes('open')) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const tracking = item.trackingNumber.toLowerCase();
        const remark = (item.remark || '').toLowerCase();
        return tracking.includes(q) || remark.includes(q);
      }
      return true;
    });
  }, [whScannedItems, selectedReasonFilter, searchQuery]);

  // Filtered Gate Entries
  const filteredGateEntries = useMemo(() => {
    return whGateEntries.filter(g => {
      if (selectedClientFilter !== 'ALL' && g.clientId !== selectedClientFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const pass = g.gatePassNumber.toLowerCase();
        const veh = g.vehicleNumber.toLowerCase();
        const drv = g.driverName.toLowerCase();
        return pass.includes(q) || veh.includes(q) || drv.includes(q);
      }
      return true;
    });
  }, [whGateEntries, selectedClientFilter, searchQuery]);

  // ===================== EXPORT HANDLERS (CSV & PDF) =====================

  const handleDownloadSingleBatchPDF = (batch: ReturnBatch) => {
    const items = scannedItems.filter(i => i.batchId === batch.id);
    const client = clients.find(c => c.id === batch.clientId);
    const courier = couriers.find(cr => cr.id === batch.courierId);
    generateBatchPDF(batch, items, activeWarehouse, client, courier);
  };

  const handleDownloadSingleBatchCSV = (batch: ReturnBatch) => {
    const items = scannedItems.filter(i => i.batchId === batch.id);
    const client = clients.find(c => c.id === batch.clientId);
    const courier = couriers.find(cr => cr.id === batch.courierId);

    const headers = [
      '#',
      'Batch Number',
      'Client / Brand',
      'Courier Partner',
      'Dock Number',
      'AWB / Tracking Number',
      'Return Reason / QC Condition',
      'Scan Timestamp',
      'Scanned By',
    ];

    const rows = items.map((item, idx) => [
      idx + 1,
      batch.batchNumber,
      client?.name || batch.clientId,
      courier?.name || batch.courierId,
      batch.dockNumber || 'N/A',
      item.trackingNumber,
      item.remark || 'Customer Refusal / RTO',
      new Date(item.scannedAt).toLocaleString(),
      item.scannedByName || item.scannedBy,
    ]);

    downloadCSV(`Batch_Manifest_${batch.batchNumber}_${client?.code || 'EMIZA'}.csv`, headers, rows);
  };

  const handleExportConsolidatedReport = (format: 'csv' | 'pdf') => {
    if (activeTableView === 'manifests') {
      const summaryStats = [
        { label: 'Total Batches', value: whBatches.length },
        { label: 'Open Batches', value: openBatchesCount },
        { label: 'Closed Batches', value: closedBatchesCount },
        { label: 'Scanned Units', value: totalScannedCount },
      ];

      const columns: ReportPdfColumn[] = [
        { header: 'Batch #', width: 32 },
        { header: 'Client / Brand', width: 44 },
        { header: 'Courier Partner', width: 40 },
        { header: 'Dock #', width: 20 },
        { header: 'Scanned Units', width: 24, align: 'right' },
        { header: 'Status', width: 22, align: 'center' },
        { header: 'Created Date', width: 38 },
      ];

      const rows = filteredBatches.map(b => [
        b.batchNumber,
        clients.find(c => c.id === b.clientId)?.name || b.clientId,
        couriers.find(cr => cr.id === b.courierId)?.name || b.courierId,
        b.dockNumber || 'Dock 01',
        b.totalScanned || 0,
        b.status,
        new Date(b.createdAt).toLocaleDateString('en-GB'),
      ]);

      if (format === 'csv') {
        const headers = ['Batch Number', 'Client Brand', 'Courier Partner', 'Dock Number', 'Total Scanned', 'Status', 'Created Date'];
        downloadCSV(`EMIZA_Return_Batches_Manifest_${activeWarehouse.code}.csv`, headers, rows);
      } else {
        generateGenericReportPDF({
          title: 'Return Batches & Manifests Report',
          subtitle: `Consolidated return batch handover register for ${activeWarehouse.name}`,
          filename: `EMIZA_Return_Manifests_${activeWarehouse.code}.pdf`,
          warehouse: activeWarehouse,
          summaryStats,
          columns,
          rows,
        });
      }
    } else if (activeTableView === 'return_reasons') {
      const summaryStats = [
        { label: 'Total Scanned Items', value: totalScannedCount },
        { label: 'Top Return Reason', value: topReason.name },
        { label: 'Good / Restockable', value: goodUnitsCount },
        { label: 'Defective / Damaged', value: defectiveUnitsCount },
      ];

      const columns: ReportPdfColumn[] = [
        { header: 'Return Reason / QC Condition', width: 65 },
        { header: 'Disposition Category', width: 45 },
        { header: 'Returned Units', width: 35, align: 'right' },
        { header: '% Share', width: 30, align: 'right' },
      ];

      const rows = returnReasonsData.map(r => [
        r.name,
        r.name.includes('Good') ? 'Restock to Inventory' : r.name.includes('Damage') ? 'Quarantine / Claim' : 'Audit / Courier RTO',
        r.value,
        `${r.percent}%`,
      ]);

      if (format === 'csv') {
        const headers = ['Return Reason', 'Disposition Category', 'Units', '% Share'];
        downloadCSV(`EMIZA_Return_Reasons_Summary_${activeWarehouse.code}.csv`, headers, rows);
      } else {
        generateGenericReportPDF({
          title: 'Return Reasons & QC Dispositions Report',
          subtitle: `Analysis of customer returns, defects, and RTO dispositions for ${activeWarehouse.name}`,
          filename: `EMIZA_Return_Reasons_${activeWarehouse.code}.pdf`,
          warehouse: activeWarehouse,
          summaryStats,
          columns,
          rows,
        });
      }
    } else if (activeTableView === 'gate_register') {
      const summaryStats = [
        { label: 'Total Vehicles', value: whGateEntries.length },
        { label: 'In Offloading', value: pendingGateEntriesCount },
        { label: 'Completed', value: completedGateEntriesCount },
        { label: 'Total Cartons', value: whGateEntries.reduce((s, g) => s + (g.expectedBoxCount || 0), 0) },
      ];

      const columns: ReportPdfColumn[] = [
        { header: 'Gate Pass #', width: 28 },
        { header: 'Vehicle #', width: 28 },
        { header: 'Driver Name', width: 34 },
        { header: 'Client Brand', width: 38 },
        { header: 'Courier', width: 32 },
        { header: 'Boxes', width: 18, align: 'right' },
        { header: 'Status', width: 22, align: 'center' },
      ];

      const rows = filteredGateEntries.map(g => [
        g.gatePassNumber,
        g.vehicleNumber,
        g.driverName,
        clients.find(c => c.id === g.clientId)?.name || g.clientId,
        couriers.find(cr => cr.id === g.courierId)?.name || g.courierId,
        g.expectedBoxCount || 0,
        g.status,
      ]);

      if (format === 'csv') {
        const headers = ['Gate Pass #', 'Vehicle #', 'Driver', 'Client', 'Courier', 'Cartons', 'Status'];
        downloadCSV(`EMIZA_Inward_Gate_Register_${activeWarehouse.code}.csv`, headers, rows);
      } else {
        generateGenericReportPDF({
          title: 'Inward Vehicle Gate Register Report',
          subtitle: `Dock turnaround & vehicle inward arrivals for ${activeWarehouse.name}`,
          filename: `EMIZA_Inward_Gate_Register_${activeWarehouse.code}.pdf`,
          warehouse: activeWarehouse,
          summaryStats,
          columns,
          rows,
        });
      }
    } else if (activeTableView === 'client_courier') {
      const summaryStats = [
        { label: 'Active Clients', value: clients.length },
        { label: 'Courier Partners', value: couriers.length },
        { label: 'Total Units Scanned', value: totalScannedCount },
        { label: 'Return Batches', value: whBatches.length },
      ];

      const columns: ReportPdfColumn[] = [
        { header: 'Client / Brand', width: 55 },
        { header: 'Client Code', width: 25 },
        { header: 'Inward Batches', width: 30, align: 'right' },
        { header: 'Scanned Units', width: 35, align: 'right' },
        { header: 'Volume % Share', width: 30, align: 'right' },
      ];

      const rows = clientVolumeData.map(c => [
        c.name,
        c.code,
        whBatches.filter(b => b.clientId === clients.find(cl => cl.name === c.name)?.id).length,
        c.value,
        totalScannedCount > 0 ? `${((c.value / totalScannedCount) * 100).toFixed(1)}%` : '0%',
      ]);

      if (format === 'csv') {
        const headers = ['Brand Name', 'Code', 'Batches', 'Scanned Units', 'Share'];
        downloadCSV(`EMIZA_Client_Courier_Performance_${activeWarehouse.code}.csv`, headers, rows);
      } else {
        generateGenericReportPDF({
          title: 'Client & Courier Logistics Performance Report',
          subtitle: `Brand return distribution & volume throughput for ${activeWarehouse.name}`,
          filename: `EMIZA_Client_Courier_Performance_${activeWarehouse.code}.pdf`,
          warehouse: activeWarehouse,
          summaryStats,
          columns,
          rows,
        });
      }
    }
  };

  const previewItems = previewBatch ? scannedItems.filter(i => i.batchId === previewBatch.id) : [];
  const previewClient = previewBatch ? clients.find(c => c.id === previewBatch.clientId) : null;
  const previewCourier = previewBatch ? couriers.find(cr => cr.id === previewBatch.courierId) : null;

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-6">
      {/* ======================= TOP HEADER & INSTANT EXPORT BUTTONS ======================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#8B5CF6]/10 text-[#8B5CF6]">
              <PieChartIcon className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-primary">
                  Warehouse Operations & Return Reports
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-surface border border-theme text-[11px] font-mono font-bold text-secondary">
                  {activeWarehouse.code}
                </span>
              </div>
              <p className="text-xs text-secondary mt-0.5">
                Unified operations view: executive KPI summary, interactive return reasons charts, and live manifests table.
              </p>
            </div>
          </div>
        </div>

        {/* Global Instant Export Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => handleExportConsolidatedReport('csv')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
            title="Download CSV report for current table view"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download CSV</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportConsolidatedReport('pdf')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-xs shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
            title="Download official PDF report for current table view"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* ======================= 1. TOP SECTION: CONSOLIDATED KPI CARDS ======================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Scanned Barcodes */}
        <div className="p-4 rounded-2xl bg-surface border border-theme shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-secondary text-xs font-medium">
              <span>Total Units Scanned</span>
              <Package className="w-4 h-4 text-[#8B5CF6]" />
            </div>
            <div className="text-2xl font-black text-primary mt-1.5">{totalScannedCount}</div>
          </div>
          <div className="text-[11px] text-muted mt-2 pt-2 border-t border-theme/60 flex items-center justify-between">
            <span>Good: <strong className="text-emerald-500 font-semibold">{goodUnitsCount}</strong></span>
            <span>QC Defect: <strong className="text-rose-500 font-semibold">{defectiveUnitsCount}</strong></span>
          </div>
        </div>

        {/* Active Return Batches */}
        <div className="p-4 rounded-2xl bg-surface border border-theme shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-secondary text-xs font-medium">
              <span>Active Return Batches</span>
              <RotateCcw className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-black text-[#8B5CF6] mt-1.5">{openBatchesCount}</div>
          </div>
          <div className="text-[11px] text-muted mt-2 pt-2 border-t border-theme/60">
            {closedBatchesCount} sealed & ready for handover
          </div>
        </div>

        {/* Inward Vehicles & Gate */}
        <div className="p-4 rounded-2xl bg-surface border border-theme shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-secondary text-xs font-medium">
              <span>Inward Vehicles Logged</span>
              <Truck className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-blue-500 mt-1.5">{whGateEntries.length}</div>
          </div>
          <div className="text-[11px] text-muted mt-2 pt-2 border-t border-theme/60">
            {pendingGateEntriesCount} offloading • {completedGateEntriesCount} cleared
          </div>
        </div>

        {/* Top Return Reason */}
        <div className="p-4 rounded-2xl bg-surface border border-theme shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-secondary text-xs font-medium">
              <span>Top Return Reason</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-sm font-black text-primary mt-1.5 truncate" title={topReason.name}>
              {topReason.name}
            </div>
          </div>
          <div className="text-[11px] text-muted mt-2 pt-2 border-t border-theme/60 flex items-center justify-between">
            <span className="font-bold text-amber-500">{topReason.value} units</span>
            <span className="font-semibold text-secondary">{topReason.percent}% of total</span>
          </div>
        </div>

        {/* Restock Acceptance Rate */}
        <div className="p-4 rounded-2xl bg-surface border border-theme shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div>
            <div className="flex items-center justify-between text-secondary text-xs font-medium">
              <span>Restock Acceptance</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-500 mt-1.5">{acceptanceRate}%</div>
          </div>
          <div className="text-[11px] text-muted mt-2 pt-2 border-t border-theme/60">
            {goodUnitsCount} units good condition
          </div>
        </div>
      </div>

      {/* ======================= 2. MIDDLE SECTION: INTERACTIVE PIE CHARTS ======================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* PRIMARY PIE CHART: RETURN REASONS (Occupies 7 columns on desktop) */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-surface border border-theme shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-theme pb-3 mb-3">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-[#8B5CF6]" />
              <h2 className="text-xs font-extrabold text-primary uppercase tracking-wide">
                Interactive Return Reasons Breakdown (%)
              </h2>
            </div>
            <span className="text-[11px] font-bold text-secondary">
              {totalScannedCount} Inspected Returns
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center flex-1">
            {/* Pie Canvas */}
            <div className="sm:col-span-7 h-64 w-full">
              {returnReasonsData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted">
                  No return reasons scanned yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={returnReasonsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                    >
                      {returnReasonsData.map((entry, index) => {
                        let fill = PIE_COLORS[index % PIE_COLORS.length];
                        if (entry.name.includes('Good')) fill = '#10B981';
                        if (entry.name.includes('Damag')) fill = '#EF4444';
                        if (entry.name.includes('Seal') || entry.name.includes('Open')) fill = '#F59E0B';
                        return <Cell key={`cell-reason-${index}`} fill={fill} />;
                      })}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E293B',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Reason Legend List */}
            <div className="sm:col-span-5 space-y-1.5 max-h-60 overflow-y-auto pr-1 text-[11px] scrollbar-thin">
              {returnReasonsData.map((item, idx) => {
                let fill = PIE_COLORS[idx % PIE_COLORS.length];
                if (item.name.includes('Good')) fill = '#10B981';
                if (item.name.includes('Damag')) fill = '#EF4444';
                if (item.name.includes('Seal') || item.name.includes('Open')) fill = '#F59E0B';

                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between p-1.5 rounded-xl bg-elevated/70 border border-theme/40 hover:bg-elevated transition-colors"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: fill }} />
                      <span className="truncate text-secondary font-medium" title={item.name}>
                        {item.name}
                      </span>
                    </div>
                    <span className="font-bold text-primary ml-1 shrink-0">
                      {item.value} <span className="text-[10px] text-muted">({item.percent}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECONDARY PIE CHART: CHANNELS / CLIENT / COURIER (Occupies 5 columns on desktop) */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-surface border border-theme shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-theme pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              <h2 className="text-xs font-extrabold text-primary uppercase tracking-wide">
                {secondaryChartType === 'channel'
                  ? 'Return Channels Share'
                  : secondaryChartType === 'client'
                  ? 'Client Brand Distribution'
                  : 'Courier Partner Distribution'}
              </h2>
            </div>

            {/* Quick Chart Switcher */}
            <div className="flex items-center bg-elevated rounded-xl p-0.5 border border-theme text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setSecondaryChartType('channel')}
                className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                  secondaryChartType === 'channel' ? 'bg-[#8B5CF6] text-white shadow-xs' : 'text-secondary hover:text-primary'
                }`}
              >
                Channel
              </button>
              <button
                type="button"
                onClick={() => setSecondaryChartType('client')}
                className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                  secondaryChartType === 'client' ? 'bg-[#8B5CF6] text-white shadow-xs' : 'text-secondary hover:text-primary'
                }`}
              >
                Brand
              </button>
              <button
                type="button"
                onClick={() => setSecondaryChartType('courier')}
                className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                  secondaryChartType === 'courier' ? 'bg-[#8B5CF6] text-white shadow-xs' : 'text-secondary hover:text-primary'
                }`}
              >
                Courier
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            {secondaryChartType === 'channel' ? (
              returnChannelsData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted">No channel data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={returnChannelsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                    >
                      {returnChannelsData.map((_, index) => (
                        <Cell key={`cell-ch-${index}`} fill={PIE_COLORS[(index + 3) % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E293B',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                    />
                    <Legend verticalAlign="bottom" height={32} wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )
            ) : secondaryChartType === 'client' ? (
              clientVolumeData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted">No client data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={clientVolumeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    >
                      {clientVolumeData.map((_, index) => (
                        <Cell key={`cell-cli-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E293B',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                    />
                    <Legend verticalAlign="bottom" height={32} wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )
            ) : courierVolumeData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted">No courier data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={courierVolumeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {courierVolumeData.map((_, index) => (
                      <Cell key={`cell-cr-${index}`} fill={PIE_COLORS[(index + 2) % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                  />
                  <Legend verticalAlign="bottom" height={32} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ======================= 3. BOTTOM SECTION: CONSOLIDATED DATA TABLES ======================= */}
      <div className="bg-surface border border-theme rounded-2xl overflow-hidden shadow-xs space-y-0">
        {/* Table View Tabs & Search Bar */}
        <div className="p-4 border-b border-theme flex flex-col md:flex-row md:items-center justify-between gap-3 bg-elevated/40">
          {/* Table Switcher Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
            {[
              { id: 'manifests' as TableViewType, label: 'Batch Manifests & Handover', icon: FileText, count: filteredBatches.length },
              { id: 'return_reasons' as TableViewType, label: 'Return Reasons Summary', icon: AlertTriangle, count: returnReasonsData.length },
              { id: 'gate_register' as TableViewType, label: 'Inward Gate Register', icon: Truck, count: filteredGateEntries.length },
              { id: 'client_courier' as TableViewType, label: 'Brand & Courier Share', icon: Building2, count: clientVolumeData.length },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTableView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTableView(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#123B5D] dark:bg-indigo-600 text-white shadow-xs'
                      : 'bg-surface text-secondary hover:text-primary border border-theme'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-elevated text-secondary'}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-surface border border-theme rounded-xl px-2.5 py-1 text-xs min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-secondary shrink-0" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent text-primary text-xs placeholder:text-muted focus:outline-none w-full"
              />
            </div>

            {/* Client Filter */}
            {activeTableView !== 'return_reasons' && (
              <select
                value={selectedClientFilter}
                onChange={e => setSelectedClientFilter(e.target.value)}
                className="bg-surface text-primary border border-theme rounded-xl px-2.5 py-1 font-medium cursor-pointer text-xs focus:outline-none"
              >
                <option value="ALL">All Clients ({clients.length})</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter for Batches */}
            {activeTableView === 'manifests' && (
              <div className="flex items-center bg-surface rounded-xl p-0.5 border border-theme">
                {(['ALL', 'Open', 'Closed'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setSelectedStatusFilter(st)}
                    className={`px-2 py-0.5 rounded-lg font-bold text-[10px] transition-all cursor-pointer ${
                      selectedStatusFilter === st
                        ? 'bg-[#8B5CF6] text-white shadow-xs'
                        : 'text-secondary hover:text-primary'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 1. TABLE: BATCH MANIFESTS & HANDOVER */}
        {activeTableView === 'manifests' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-3">Batch Number</th>
                  <th className="px-4 py-3">Client / Brand</th>
                  <th className="px-4 py-3">Courier Partner</th>
                  <th className="px-4 py-3">Dock No</th>
                  <th className="px-4 py-3">Total Scanned</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created Date</th>
                  <th className="px-4 py-3 text-right">Individual Manifest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-primary">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-secondary">
                      No return batches match the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((batch, idx) => {
                    const client = clients.find(c => c.id === batch.clientId);
                    const courier = couriers.find(cr => cr.id === batch.courierId);
                    const isClosed = batch.status === 'Closed';

                    return (
                      <tr key={`batch-${batch.id}-${idx}`} className="hover:bg-elevated/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-mono font-bold text-[#8B5CF6]">{batch.batchNumber}</div>
                          <div className="text-[10px] text-muted">{batch.channel || (batch.batchType === 'B2B Return' ? 'B2B Return' : 'B2C Return')}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold">{client?.name || batch.clientId}</td>
                        <td className="px-4 py-3 text-secondary">{courier?.name || batch.courierId}</td>
                        <td className="px-4 py-3 font-mono font-bold text-amber-500">{batch.dockNumber || 'Dock 01'}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-primary">{batch.totalScanned || 0}</span>
                          <span className="text-[10px] text-muted ml-1">units</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                              isClosed
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isClosed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {batch.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-secondary">
                          {new Date(batch.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPreviewBatch(batch)}
                              className="p-1.5 rounded-lg bg-elevated hover:bg-surface text-secondary hover:text-primary border border-theme cursor-pointer"
                              title="Preview barcodes in this batch"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadSingleBatchCSV(batch)}
                              className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                              title="Download CSV for this batch"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadSingleBatchPDF(batch)}
                              className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 cursor-pointer"
                              title="Download PDF Handover Sheet"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. TABLE: RETURN REASONS SUMMARY */}
        {activeTableView === 'return_reasons' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-3">Return Reason / Disposition</th>
                  <th className="px-4 py-3">Recommended Action</th>
                  <th className="px-4 py-3 text-right">Total Returned Units</th>
                  <th className="px-4 py-3 text-right">% Share of Returns</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-primary">
                {returnReasonsData.map((item, idx) => (
                  <tr key={`reason-row-${idx}`} className="hover:bg-elevated/60 transition-colors">
                    <td className="px-4 py-3 font-semibold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                      <span>{item.name}</span>
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {item.name.includes('Good')
                        ? 'Restock into active inventory'
                        : item.name.includes('Damag')
                        ? 'Quarantine area / Courier claim processing'
                        : 'Audit investigation / Handover to courier rep'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-primary">{item.value}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-[#8B5CF6]">{item.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. TABLE: INWARD GATE REGISTER */}
        {activeTableView === 'gate_register' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-3">Gate Pass #</th>
                  <th className="px-4 py-3">Vehicle #</th>
                  <th className="px-4 py-3">Driver Name</th>
                  <th className="px-4 py-3">Client / Brand</th>
                  <th className="px-4 py-3">Courier</th>
                  <th className="px-4 py-3 text-right">Cartons</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Entry Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-primary">
                {filteredGateEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-secondary">
                      No inward vehicle gate passes found.
                    </td>
                  </tr>
                ) : (
                  filteredGateEntries.map(g => (
                    <tr key={g.id} className="hover:bg-elevated/60 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-500">{g.gatePassNumber}</td>
                      <td className="px-4 py-3 font-mono font-semibold">{g.vehicleNumber}</td>
                      <td className="px-4 py-3 text-secondary">{g.driverName}</td>
                      <td className="px-4 py-3 font-semibold">{clients.find(c => c.id === g.clientId)?.name || g.clientId}</td>
                      <td className="px-4 py-3 text-secondary">
                        {g.courierPartner || g.phase1?.courierName || couriers.find(c => c.id === g.courierId)?.name || g.courierId || '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-primary">{g.expectedBoxCount || 0}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            g.status === 'Completed' || g.status === 'Handover Completed' || g.status === 'Verified'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : g.status === 'Unloading' || g.status === 'Dock QC' || g.status === 'In Progress' || g.status === 'QC Completed' || g.status === 'Handover Pending'
                              ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          }`}
                        >
                          {g.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-secondary">
                        {new Date(g.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. TABLE: CLIENT & COURIER SHARE */}
        {activeTableView === 'client_courier' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-3">Brand / Client</th>
                  <th className="px-4 py-3">Client Code</th>
                  <th className="px-4 py-3 text-right">Inward Batches</th>
                  <th className="px-4 py-3 text-right">Total Scanned Units</th>
                  <th className="px-4 py-3 text-right">% Volume Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-primary">
                {clientVolumeData.map(c => {
                  const batchesCount = whBatches.filter(b => b.clientId === clients.find(cl => cl.name === c.name)?.id).length;
                  const share = totalScannedCount > 0 ? ((c.value / totalScannedCount) * 100).toFixed(1) : '0';
                  return (
                    <tr key={c.name} className="hover:bg-elevated/60 transition-colors">
                      <td className="px-4 py-3 font-semibold">{c.name}</td>
                      <td className="px-4 py-3 font-mono text-secondary">{c.code}</td>
                      <td className="px-4 py-3 text-right font-mono">{batchesCount}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#8B5CF6]">{c.value}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-500">{share}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================= BATCH PREVIEW MODAL ======================= */}
      {previewBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface border border-theme rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-theme flex items-center justify-between bg-elevated">
              <div>
                <h3 className="font-bold text-sm text-primary flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#8B5CF6]" />
                  <span>Batch Preview: {previewBatch.batchNumber}</span>
                </h3>
                <div className="text-[11px] text-secondary mt-0.5">
                  {previewClient?.name || previewBatch.clientId} • {previewCourier?.name || previewBatch.courierId} • {previewBatch.dockNumber || 'Dock 01'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewBatch(null)}
                className="p-1 rounded-lg bg-surface text-secondary hover:text-primary border border-theme"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              <div className="flex items-center justify-between text-secondary text-[11px]">
                <span>Total Scanned Barcodes: <strong>{previewItems.length}</strong></span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadSingleBatchCSV(previewBatch)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3 h-3" /> CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingleBatchPDF(previewBatch)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#8B5CF6] text-white font-bold text-[11px] cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> PDF
                  </button>
                </div>
              </div>

              <div className="border border-theme rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-elevated text-secondary font-bold text-[10px] border-b border-theme">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Tracking / AWB</th>
                      <th className="px-3 py-2">Return Reason / QC</th>
                      <th className="px-3 py-2">Scanned Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-primary">
                    {previewItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-muted">
                          No items scanned in this batch yet.
                        </td>
                      </tr>
                    ) : (
                      previewItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-elevated/50">
                          <td className="px-3 py-2 text-muted">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono font-bold text-[#8B5CF6]">{item.trackingNumber}</td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-elevated border border-theme">
                              {item.remark || 'Customer Refusal / RTO'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-secondary text-[11px]">
                            {new Date(item.scannedAt).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3 border-t border-theme bg-elevated flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewBatch(null)}
                className="px-4 py-1.5 rounded-xl bg-surface border border-theme text-primary text-xs font-semibold hover:bg-page cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
