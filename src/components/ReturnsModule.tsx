import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  RotateCcw,
  QrCode,
  Plus,
  Search,
  CheckCircle2,
  X,
  Lock,
  Unlock,
  ShieldAlert,
  Printer,
  Zap,
  List,
  Edit2,
  Trash2,
  Check,
  PenTool,
  Save,
  Undo2,
  ArrowLeft,
  FileText,
  Eye,
  Download,
  Truck,
  TrendingUp,
  LayoutDashboard,
  Boxes,
  Calendar,
  AlertCircle,
  PackageCheck,
  Building2,
  Clock,
  ChevronDown,
  PieChart as PieChartIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ReturnBatch,
  ScannedReturnItem,
  ReturnRemarkType,
  Warehouse,
  Client,
  Courier,
  User,
  InwardGateEntry,
  WAREHOUSE_DOCKS,
} from '../types';
import { generateBatchPDF, generateWarehouseBatchesSummaryPDF } from '../utils/pdfGenerator';
import {
  exportBatchItemsToCSV,
  exportDateWiseReportToCSV,
  exportAccountWiseReportToCSV,
  exportAllBatchesToCSV,
  exportQCBreakdownToCSV,
  exportCourierWiseReportToCSV,
} from '../utils/csvExport';
import { generateGenericReportPDF } from '../utils/reportPdfGenerator';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { HandheldScannerView } from './HandheldScannerView';
import { ReturnsSummaryView } from './ReturnsSummaryView';
import { playScanSuccessBeep, playScanErrorBeep } from '../utils/soundEffects';

interface ReturnsModuleProps {
  currentUser: User;
  activeWarehouse: Warehouse;
  batches: ReturnBatch[];
  scannedItems: ScannedReturnItem[];
  clients: Client[];
  couriers: Courier[];
  gateEntries?: InwardGateEntry[];
  onAddBatch: (batch: Omit<ReturnBatch, 'id' | 'batchNumber' | 'totalScanned' | 'remarksBreakdown' | 'createdAt'>) => ReturnBatch;
  onUpdateBatch?: (batchId: string, updates: Partial<ReturnBatch>) => void;
  onDeleteBatch?: (batchId: string) => void;
  onScanItem: (batchId: string, trackingNumber: string, remark: ReturnRemarkType, photoUrl?: string) => { success: boolean; message: string; item?: ScannedReturnItem };
  onUpdateItem?: (itemId: string, updates: { trackingNumber?: string; remark?: ReturnRemarkType }) => void;
  onDeleteItem?: (itemId: string) => void;
  onCloseBatch: (
    batchId: string,
    signData: {
      driverName: string;
      driverMobile: string;
      driverSignature: string;
      supervisorSigner: string;
      notes?: string;
    }
  ) => void;
  isOpenCreateModal: boolean;
  onCloseCreateModal: () => void;
  onNavigateTab?: (tab: any) => void;
}

export const ReturnsModule: React.FC<ReturnsModuleProps> = ({
  currentUser,
  activeWarehouse,
  batches,
  scannedItems,
  clients,
  couriers,
  gateEntries = [],
  onAddBatch,
  onUpdateBatch,
  onDeleteBatch,
  onScanItem,
  onUpdateItem,
  onDeleteItem,
  onCloseBatch,
  isOpenCreateModal,
  onCloseCreateModal,
  onNavigateTab,
}) => {
  // TABS: 'open_batch' | 'closed_batch' | 'summary' | 'reports'
  const [activeMainTab, setActiveMainTab] = useState<'open_batch' | 'closed_batch' | 'summary' | 'reports'>('open_batch');

  // Sub-view in Open Batch: 'list' (default to see all open batches) | 'scan' | 'create' | 'close'
  const [openBatchView, setOpenBatchView] = useState<'list' | 'scan' | 'create' | 'close'>('list');

  // Active batch selected for scanning station
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  // Search in Open Batches
  const [openBatchSearch, setOpenBatchSearch] = useState('');

  // Search in Closed Batches List
  const [batchSearchQuery, setBatchSearchQuery] = useState('');

  // Device / Handheld Terminal (HHT / PDA / Phone) Fullscreen Mode
  const [isDeviceMode, setIsDeviceMode] = useState(false);

  // Live Date/Time
  const [liveDateTime, setLiveDateTime] = useState<string>(new Date().toLocaleString());

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveDateTime(new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // NEW BATCH FORM STATE
  const [newBatchClient, setNewBatchClient] = useState(clients[0]?.id || '');
  const [newBatchCourier, setNewBatchCourier] = useState(couriers[0]?.id || '');
  const [newBatchChannel, setNewBatchChannel] = useState<'D2C Return' | 'B2C Return' | 'Marketplace Return' | 'Customer RTO'>('B2C Return');
  const [newBatchDock, setNewBatchDock] = useState<string>('Dock 01');
  const [newBatchNotes, setNewBatchNotes] = useState('');
  const [newBatchExpectedQty, setNewBatchExpectedQty] = useState<number>(100);

  // Keep form selections valid when master lists change
  useEffect(() => {
    if (couriers.length > 0 && !couriers.some(c => c.id === newBatchCourier)) {
      setNewBatchCourier(couriers[0].id);
    }
  }, [couriers, newBatchCourier]);
  useEffect(() => {
    if (clients.length > 0 && !clients.some(c => c.id === newBatchClient)) {
      setNewBatchClient(clients[0].id);
    }
  }, [clients, newBatchClient]);

  // SCANNER GUN & AWB SCAN STATE
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedRemark, setSelectedRemark] = useState<ReturnRemarkType>('Good');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScanResult, setLastScanResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Item Edit & Delete Modal States
  const [editingItem, setEditingItem] = useState<ScannedReturnItem | null>(null);
  const [editAwbValue, setEditAwbValue] = useState('');
  const [editRemarkValue, setEditRemarkValue] = useState<ReturnRemarkType>('Good');
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Batch Edit & Delete Modal States
  const [editingBatch, setEditingBatch] = useState<ReturnBatch | null>(null);
  const [editClientId, setEditClientId] = useState('');
  const [editCourierId, setEditCourierId] = useState('');
  const [editChannel, setEditChannel] = useState<'D2C Return' | 'B2C Return' | 'Marketplace Return' | 'Customer RTO'>('B2C Return');
  const [editDock, setEditDock] = useState('Dock 01');
  const [editExpectedQty, setEditExpectedQty] = useState<number>(100);
  const [editNotes, setEditNotes] = useState('');
  const [batchToDelete, setBatchToDelete] = useState<ReturnBatch | null>(null);

  // CLOSED BATCH DETAIL INSPECTION MODAL STATE
  const [selectedClosedBatch, setSelectedClosedBatch] = useState<ReturnBatch | null>(null);
  const [closedBatchItemSearch, setClosedBatchItemSearch] = useState('');

  // CLOSE BATCH SIGN-OFF STATE
  const [driverName, setDriverName] = useState('');
  const [driverMobile, setDriverMobile] = useState('');
  const [supervisorSigner, setSupervisorSigner] = useState(currentUser?.name || 'Supervisor');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [handoverSignatureStatus, setHandoverSignatureStatus] = useState<'Pending' | 'Signed'>('Pending');
  const [isDrawingSig, setIsDrawingSig] = useState(false);
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [closeFormError, setCloseFormError] = useState<string | null>(null);

  // REFS
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);

  // ALL OPEN AND CLOSED BATCHES (Including old batches and cross-device sync)
  // We do not drop batches if warehouseId is missing or different, so no data ever disappears!
  const openBatches = useMemo(() => {
    return batches.filter(b => b.status !== 'Closed');
  }, [batches]);

  const closedBatches = useMemo(() => {
    return batches.filter(b => b.status === 'Closed');
  }, [batches]);

  // Active batch object
  const activeBatch = useMemo(() => {
    if (!activeBatchId) return openBatches[0] || null;
    return batches.find(b => b.id === activeBatchId) || openBatches[0] || null;
  }, [batches, openBatches, activeBatchId]);

  const activeBatchItems = useMemo(() => {
    return activeBatch ? scannedItems.filter(i => i.batchId === activeBatch.id) : [];
  }, [scannedItems, activeBatch]);

  // Trigger Create Modal if requested from top header
  useEffect(() => {
    if (isOpenCreateModal) {
      setActiveMainTab('open_batch');
      setOpenBatchView('create');
      onCloseCreateModal();
    }
  }, [isOpenCreateModal, onCloseCreateModal]);

  // Auto-focus barcode scanner when in scan view
  useEffect(() => {
    if (openBatchView === 'scan' && activeBatchId && !isDeviceMode && !editingItem && !deletingItemId) {
      barcodeInputRef.current?.focus();
    }
  }, [openBatchView, activeBatchId, isDeviceMode, editingItem, deletingItemId]);

  // Sound feedback (Crisp barcode gun / HHD beep)
  const playBeep = (isSuccess: boolean) => {
    if (!soundEnabled) return;
    if (isSuccess) {
      playScanSuccessBeep();
    } else {
      playScanErrorBeep();
    }
  };

  // Reopen and start scanning a batch
  const handleOpenBatchForScanning = (batchId: string) => {
    setActiveBatchId(batchId);
    setOpenBatchView('scan');
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  };

  // Scan submit
  const handleScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawVal = barcodeInput.trim();
    if (!rawVal) return;
    if (!activeBatch) {
      setLastScanResult({ success: false, msg: 'Please select an open batch first.' });
      return;
    }

    const res = onScanItem(activeBatch.id, rawVal, selectedRemark);
    playBeep(res.success);
    setLastScanResult({ success: res.success, msg: res.message });
    setBarcodeInput('');
    barcodeInputRef.current?.focus();
  };

  // Handle Edit Scan
  const handleEditScan = (item: ScannedReturnItem) => {
    setEditingItem(item);
    setEditAwbValue(item.trackingNumber);
    setEditRemarkValue(item.remark);
  };

  const handleSaveEdit = () => {
    if (!editingItem || !onUpdateItem) return;
    const trimmed = editAwbValue.trim();
    if (!trimmed) return;
    onUpdateItem(editingItem.id, {
      trackingNumber: trimmed,
      remark: editRemarkValue,
    });
    setEditingItem(null);
  };

  // Handle Delete Scan
  const handleDeleteScan = (itemId: string) => {
    setDeletingItemId(itemId);
  };

  const confirmDeleteScan = () => {
    if (deletingItemId && onDeleteItem) {
      onDeleteItem(deletingItemId);
      setDeletingItemId(null);
    }
  };

  // Handle Open Batch Edit
  const handleStartEditBatch = (b: ReturnBatch, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingBatch(b);
    setEditClientId(b.clientId);
    setEditCourierId(b.courierId);
    setEditChannel((b.channel as any) || 'B2C Return');
    setEditDock(b.dockNumber || 'Dock 01');
    setEditExpectedQty(b.expectedCount || 0);
    setEditNotes(b.notes || '');
  };

  const handleSaveBatchEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;

    const client = clients.find(c => c.id === editClientId);
    const courier = couriers.find(cr => cr.id === editCourierId);

    const updates: Partial<ReturnBatch> = {
      clientId: editClientId,
      clientName: client?.name || editingBatch.clientName,
      courierId: editCourierId,
      courierName: courier?.name || editingBatch.courierName,
      channel: editChannel,
      dockNumber: editDock,
      expectedCount: Number(editExpectedQty) || 0,
      notes: editNotes.trim(),
    };

    if (onUpdateBatch) {
      onUpdateBatch(editingBatch.id, updates);
    }
    setEditingBatch(null);
  };

  const handleConfirmDeleteBatch = () => {
    if (!batchToDelete) return;
    if (onDeleteBatch) {
      onDeleteBatch(batchToDelete.id);
    }
    if (activeBatchId === batchToDelete.id) {
      setActiveBatchId(null);
      setOpenBatchView('list');
    }
    setBatchToDelete(null);
  };

  // Digital Signature Canvas
  const handleStartDraw = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawingSig(true);
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
  };

  const handleDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingSig) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
    setHandoverSignatureStatus('Signed');
  };

  const handleStopDraw = () => {
    setIsDrawingSig(false);
  };

  const handleClearSig = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHandoverSignatureStatus('Pending');
  };

  // Close Batch Submit
  const handleCloseBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBatch) return;
    if (!driverName.trim()) {
      setCloseFormError('Please provide courier driver / representative name.');
      return;
    }
    setCloseFormError(null);

    const sigDataUrl =
      handoverSignatureStatus === 'Signed' && sigCanvasRef.current
        ? sigCanvasRef.current.toDataURL('image/png')
        : 'Pending';

    const signData = {
      driverName: driverName.trim(),
      driverMobile: driverMobile.trim(),
      driverSignature: sigDataUrl,
      supervisorSigner: supervisorSigner.trim() || currentUser?.name || 'Supervisor',
      notes: handoverNotes.trim() || undefined,
    };

    onCloseBatch(activeBatch.id, signData);

    // Generate & download manifest PDF with updated closed handover details
    const closedSnapshot: ReturnBatch = {
      ...activeBatch,
      status: 'Closed',
      closedAt: new Date().toISOString(),
      ...signData,
    };
    const client = clients.find(c => c.id === activeBatch.clientId);
    const courier = couriers.find(cr => cr.id === activeBatch.courierId);
    generateBatchPDF(closedSnapshot, activeBatchItems, activeWarehouse, client, courier);

    // Reset close form
    setDriverName('');
    setDriverMobile('');
    setHandoverNotes('');
    handleClearSig();
    setOpenBatchView('list');
    setActiveMainTab('closed_batch');
  };

  // Download PDF for Closed Batch
  const handleDownloadBatchPDF = (batch: ReturnBatch) => {
    const batchItems = scannedItems.filter(i => i.batchId === batch.id);
    const client = clients.find(c => c.id === batch.clientId);
    const courier = couriers.find(cr => cr.id === batch.courierId);
    generateBatchPDF(batch, batchItems, activeWarehouse, client, courier);
  };

  // Filtered open batches for list view
  const filteredOpenBatches = useMemo(() => {
    if (!openBatchSearch.trim()) return openBatches;
    const q = openBatchSearch.toLowerCase();
    return openBatches.filter(b => {
      const client = clients.find(c => c.id === b.clientId);
      const courier = couriers.find(cr => cr.id === b.courierId);
      const cName = (client?.name || b.clientName || '').toLowerCase();
      const crName = (courier?.name || b.courierName || '').toLowerCase();
      return (
        b.batchNumber.toLowerCase().includes(q) ||
        cName.includes(q) ||
        crName.includes(q) ||
        (b.dockNumber || '').toLowerCase().includes(q)
      );
    });
  }, [openBatches, openBatchSearch, clients, couriers]);

  // Compute QC condition breakdown across all scanned items
  const qcBreakdown = useMemo(() => {
    const conditions: ReturnRemarkType[] = [
      'Good',
      'Damage',
      'Open Box',
      'Wrong Product',
      'Short Qty',
      'Missing Product',
      'Others',
    ];
    const counts: Record<ReturnRemarkType, number> = {
      'Good': 0,
      'Damage': 0,
      'Open Box': 0,
      'Wrong Product': 0,
      'Short Qty': 0,
      'Missing Product': 0,
      'Others': 0,
    };
    scannedItems.forEach(item => {
      if (counts[item.remark] !== undefined) {
        counts[item.remark]++;
      } else {
        counts['Others']++;
      }
    });
    const total = scannedItems.length || 1;
    return conditions.map(cond => ({
      condition: cond,
      count: counts[cond] || 0,
      percent: Math.round(((counts[cond] || 0) / total) * 100),
    }));
  }, [scannedItems]);

  // Date-wise Report Data
  const dateWiseReport = useMemo(() => {
    const map = new Map<string, {
      date: string;
      totalBatches: number;
      openBatches: number;
      closedBatches: number;
      totalScanned: number;
      goodCount: number;
      damageCount: number;
      otherCount: number;
    }>();

    batches.forEach(b => {
      const dateKey = b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-CA') : 'Unknown';
      if (!map.has(dateKey)) {
        map.set(dateKey, {
          date: dateKey,
          totalBatches: 0,
          openBatches: 0,
          closedBatches: 0,
          totalScanned: 0,
          goodCount: 0,
          damageCount: 0,
          otherCount: 0,
        });
      }
      const entry = map.get(dateKey)!;
      entry.totalBatches++;
      if (b.status === 'Closed') entry.closedBatches++;
      else entry.openBatches++;
      entry.totalScanned += (b.totalScanned || 0);
    });

    scannedItems.forEach(item => {
      const dateKey = item.scannedAt ? new Date(item.scannedAt).toLocaleDateString('en-CA') : 'Unknown';
      if (map.has(dateKey)) {
        const entry = map.get(dateKey)!;
        if (item.remark === 'Good') entry.goodCount++;
        else if (item.remark === 'Damage' || item.remark === 'Missing Product') entry.damageCount++;
        else entry.otherCount++;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [batches, scannedItems]);

  // Account-wise Report Data
  const accountWiseReport = useMemo(() => {
    return clients.map(c => {
      const accBatches = batches.filter(b => b.clientId === c.id || b.clientName === c.name);
      const batchIds = new Set(accBatches.map(b => b.id));
      const accItems = scannedItems.filter(i => batchIds.has(i.batchId));
      const goodCount = accItems.filter(i => i.remark === 'Good').length;
      const damageCount = accItems.filter(i => i.remark === 'Damage' || i.remark === 'Missing Product').length;
      const totalExpected = accBatches.reduce((acc, b) => acc + (b.expectedCount || 0), 0);
      const totalScanned = accItems.length;
      const pendingCount = Math.max(0, totalExpected - totalScanned);

      return {
        accountName: c.name,
        accountCode: c.code,
        totalBatches: accBatches.length,
        totalScanned,
        goodCount,
        damageCount,
        pendingCount,
      };
    }).filter(a => a.totalBatches > 0 || a.totalScanned > 0);
  }, [clients, batches, scannedItems]);

  // Courier-wise Report Data
  const courierWiseReport = useMemo(() => {
    return couriers.map(cr => {
      const crBatches = batches.filter(b => b.courierId === cr.id || b.courierName === cr.name);
      const batchIds = new Set(crBatches.map(b => b.id));
      const crItems = scannedItems.filter(i => batchIds.has(i.batchId));
      return {
        courierName: cr.name,
        courierCode: cr.code,
        totalBatches: crBatches.length,
        totalScanned: crItems.length,
      };
    }).filter(c => c.totalBatches > 0 || c.totalScanned > 0);
  }, [couriers, batches, scannedItems]);

  // PDF Export Helpers for Reports
  const handleDownloadQCPdf = () => {
    generateGenericReportPDF({
      title: 'Returns QC Condition & Reason Breakdown',
      subtitle: '7-Parameter Quality Control Analysis',
      filename: `Returns_QC_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
      warehouse: activeWarehouse,
      summaryStats: [
        { label: 'Total Evaluated', value: scannedItems.length },
        {
          label: 'Good Pass Rate',
          value: `${scannedItems.length > 0 ? Math.round((scannedItems.filter(i => i.remark === 'Good').length / scannedItems.length) * 100) : 100}%`,
        },
        { label: 'Damage/Flagged', value: scannedItems.filter(i => i.remark !== 'Good').length },
      ],
      columns: [
        { header: 'QC Condition / Return Reason', width: 80, align: 'left' },
        { header: 'Parcel Count', width: 45, align: 'center' },
        { header: 'Share (%)', width: 45, align: 'center' },
      ],
      rows: qcBreakdown.map(qc => [qc.condition, qc.count, `${qc.percent}%`]),
    });
  };

  const handleDownloadAccountPdf = () => {
    generateGenericReportPDF({
      title: 'Client Account Returns Performance Report',
      subtitle: 'Brand Portfolio Volume & Quality Inspection Metrics',
      filename: `Returns_AccountWise_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
      warehouse: activeWarehouse,
      summaryStats: [
        { label: 'Active Portfolios', value: accountWiseReport.length },
        { label: 'Total Units Scanned', value: accountWiseReport.reduce((sum, a) => sum + a.totalScanned, 0) },
        { label: 'Pending Verification', value: accountWiseReport.reduce((sum, a) => sum + a.pendingCount, 0) },
      ],
      columns: [
        { header: 'Account / Brand Name', width: 55, align: 'left' },
        { header: 'Code', width: 25, align: 'left' },
        { header: 'Batches', width: 22, align: 'center' },
        { header: 'Scanned', width: 26, align: 'center' },
        { header: 'Good', width: 26, align: 'center' },
        { header: 'Damaged', width: 26, align: 'center' },
        { header: 'Pending', width: 26, align: 'center' },
      ],
      rows: accountWiseReport.map(a => [
        a.accountName,
        a.accountCode,
        a.totalBatches,
        a.totalScanned,
        a.goodCount,
        a.damageCount,
        a.pendingCount,
      ]),
    });
  };

  const handleDownloadCourierPdf = () => {
    const totalCourierScans = courierWiseReport.reduce((sum, c) => sum + c.totalScanned, 0) || 1;
    generateGenericReportPDF({
      title: 'Courier Partner Returns Distribution Report',
      subtitle: 'Logistics Handover & Return Shipments Throughput',
      filename: `Returns_CourierWise_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
      warehouse: activeWarehouse,
      summaryStats: [
        { label: 'Active Couriers', value: courierWiseReport.length },
        { label: 'Total Batches', value: courierWiseReport.reduce((sum, c) => sum + c.totalBatches, 0) },
        { label: 'Total Units', value: totalCourierScans },
      ],
      columns: [
        { header: 'Courier Partner', width: 70, align: 'left' },
        { header: 'Code', width: 30, align: 'left' },
        { header: 'Total Batches', width: 30, align: 'center' },
        { header: 'Scanned Units', width: 35, align: 'center' },
        { header: 'Share (%)', width: 30, align: 'center' },
      ],
      rows: courierWiseReport.map(c => [
        c.courierName,
        c.courierCode,
        c.totalBatches,
        c.totalScanned,
        `${Math.round((c.totalScanned / totalCourierScans) * 100)}%`,
      ]),
    });
  };

  const handleDownloadDatePdf = () => {
    generateGenericReportPDF({
      title: 'Date-wise Returns Throughput Report',
      subtitle: 'Daily Inbound Return Processing & QC Verdicts',
      filename: `Returns_DateWise_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
      warehouse: activeWarehouse,
      summaryStats: [
        { label: 'Operating Days', value: dateWiseReport.length },
        { label: 'Total Batches', value: dateWiseReport.reduce((sum, d) => sum + d.totalBatches, 0) },
        { label: 'Total Units Scanned', value: dateWiseReport.reduce((sum, d) => sum + d.totalScanned, 0) },
      ],
      columns: [
        { header: 'Date', width: 35, align: 'left' },
        { header: 'Total Batches', width: 28, align: 'center' },
        { header: 'Open', width: 22, align: 'center' },
        { header: 'Closed', width: 22, align: 'center' },
        { header: 'Total Scanned', width: 30, align: 'center' },
        { header: 'Good QC', width: 28, align: 'center' },
        { header: 'Damaged / Missing', width: 35, align: 'center' },
      ],
      rows: dateWiseReport.map(d => [
        d.date,
        d.totalBatches,
        d.openBatches,
        d.closedBatches,
        d.totalScanned,
        d.goodCount,
        d.damageCount,
      ]),
    });
  };

  // If mobile handheld mode is requested
  if (isDeviceMode && activeBatch) {
    return (
      <HandheldScannerView
        currentUser={currentUser}
        activeWarehouse={activeWarehouse}
        activeBatch={activeBatch}
        batches={batches}
        scannedItems={scannedItems}
        clients={clients}
        couriers={couriers}
        onScanItem={onScanItem}
        onSelectBatch={(batchId) => {
          setActiveBatchId(batchId);
        }}
        onCloseBatchRequest={(batch) => {
          setActiveBatchId(batch.id);
          setIsDeviceMode(false);
          setOpenBatchView('close');
        }}
        onExitDeviceMode={() => setIsDeviceMode(false)}
      />
    );
  }

  return (
    <div className="space-y-4 pb-12">
      {/* MODULE TOP BAR */}
      <div className="flex items-center justify-between gap-2 border-b border-theme pb-2.5">
        <div className="min-w-0">
          <h1 className="text-sm sm:text-xl font-extrabold text-primary flex items-center gap-2 truncate">
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-[#123B5D] dark:text-indigo-400 shrink-0" />
            <span className="truncate">RTO / Returns Station</span>
          </h1>
          <p className="text-[11px] text-secondary hidden sm:block">
            High-speed barcode scanner gun intake, batch inspection, manifest generation, and reports.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-create-batch-top"
            onClick={() => {
              setActiveMainTab('open_batch');
              setOpenBatchView('create');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#123B5D] hover:bg-[#184C77] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Batch</span>
          </button>
        </div>
      </div>

      {/* 4 TABS: Open Batch | Closed Batch | Monthly Summary | Report & Manifest */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-elevated p-1 rounded-xl border border-theme">
        {/* TAB 1: Open Batch */}
        <button
          id="tab-open-batch"
          onClick={() => {
            setActiveMainTab('open_batch');
            setOpenBatchView('list');
          }}
          className={`px-3 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeMainTab === 'open_batch'
              ? 'bg-[#123B5D] dark:bg-indigo-600 text-white shadow-xs'
              : 'text-secondary hover:text-primary hover:bg-surface'
          }`}
        >
          <Unlock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="truncate">Open Batch ({openBatches.length})</span>
          {openBatches.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
          )}
        </button>

        {/* TAB 2: Closed Batch */}
        <button
          id="tab-closed-batch"
          onClick={() => setActiveMainTab('closed_batch')}
          className={`px-3 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeMainTab === 'closed_batch'
              ? 'bg-[#123B5D] dark:bg-indigo-600 text-white shadow-xs'
              : 'text-secondary hover:text-primary hover:bg-surface'
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="truncate">Closed Batch ({closedBatches.length})</span>
        </button>

        {/* TAB 3: Monthly Summary (Recharts Good vs Damage vs Missing) */}
        <button
          id="tab-monthly-summary"
          onClick={() => setActiveMainTab('summary')}
          className={`px-3 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeMainTab === 'summary'
              ? 'bg-[#123B5D] dark:bg-indigo-600 text-white shadow-xs'
              : 'text-secondary hover:text-primary hover:bg-surface'
          }`}
        >
          <PieChartIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="truncate">Monthly Summary</span>
        </button>

        {/* TAB 4: Report & Manifest */}
        <button
          id="tab-report-manifest"
          onClick={() => setActiveMainTab('reports')}
          className={`px-3 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeMainTab === 'reports'
              ? 'bg-[#123B5D] dark:bg-indigo-600 text-white shadow-xs'
              : 'text-secondary hover:text-primary hover:bg-surface'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="truncate">Report & Manifest</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: OPEN BATCH                                        */}
      {/* ======================================================== */}
      {activeMainTab === 'open_batch' && (
        <div className="space-y-4">
          {/* SUB-VIEW 1: ALL OPEN BATCHES TABLE (DEFAULT LIST VIEW) */}
          {openBatchView === 'list' && (
            <div className="bg-surface border border-theme rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme pb-3">
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-primary flex items-center gap-2">
                    <Unlock className="w-4 h-4 text-emerald-500" />
                    <span>All Open Batches ({openBatches.length})</span>
                  </h2>
                  <p className="text-xs text-secondary mt-0.5">
                    Showing all created and open batches (including old batches). Click any batch to reopen and continue scanning.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search batch, account, courier..."
                      value={openBatchSearch}
                      onChange={e => setOpenBatchSearch(e.target.value)}
                      className="w-full bg-elevated text-xs text-primary pl-8 pr-3 py-1.5 rounded-lg border border-theme focus:outline-none focus:border-[#123B5D] dark:focus:border-indigo-500 placeholder:text-muted"
                    />
                  </div>
                  <button
                    onClick={() => setOpenBatchView('create')}
                    className="px-3 py-1.5 rounded-lg bg-[#123B5D] hover:bg-[#184C77] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Batch</span>
                  </button>
                </div>
              </div>

              {/* TABLE OF ALL OPEN BATCHES */}
              <div className="overflow-x-auto rounded-xl border border-theme">
                <table className="w-full text-left text-xs">
                  <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                    <tr>
                      <th className="px-3.5 py-3">Batch Number</th>
                      <th className="px-3.5 py-3">Account Name</th>
                      <th className="px-3.5 py-3">Courier</th>
                      <th className="px-3.5 py-3 text-center">Qty</th>
                      <th className="px-3.5 py-3 text-center">Scanned Count</th>
                      <th className="px-3.5 py-3 text-center">Pending</th>
                      <th className="px-3.5 py-3">Date / Time</th>
                      <th className="px-3.5 py-3 text-center">Status</th>
                      <th className="px-3.5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme text-primary">
                    {filteredOpenBatches.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-secondary">
                          <p className="text-sm font-semibold">No open batches found.</p>
                          <p className="text-xs text-muted mt-1">Create a new batch to begin scanning returns.</p>
                          <button
                            onClick={() => setOpenBatchView('create')}
                            className="mt-3 px-4 py-2 rounded-xl bg-[#123B5D] dark:bg-indigo-600 text-white text-xs font-bold shadow-sm"
                          >
                            + Create First Return Batch
                          </button>
                        </td>
                      </tr>
                    ) : (
                      filteredOpenBatches.map(b => {
                        const client = clients.find(c => c.id === b.clientId);
                        const courier = couriers.find(cr => cr.id === b.courierId);
                        const accountName = client?.name || b.clientName || '—';
                        const courierName = courier?.name || b.courierName || '—';
                        const expectedQty = b.expectedCount || 0;
                        const scannedCount = b.totalScanned || 0;
                        const pendingQty = Math.max(0, expectedQty - scannedCount);
                        const formattedDateTime = b.createdAt ? new Date(b.createdAt).toLocaleString() : '—';

                        return (
                          <tr
                            key={b.id}
                            onClick={() => handleOpenBatchForScanning(b.id)}
                            className="hover:bg-elevated cursor-pointer transition-colors group"
                          >
                            <td className="px-3.5 py-3 font-mono font-bold text-[#123B5D] dark:text-indigo-400 group-hover:underline">
                              <div className="flex items-center gap-1.5">
                                <Unlock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span>{b.batchNumber}</span>
                              </div>
                              <div className="text-[10px] text-secondary font-sans font-medium mt-0.5">
                                {b.dockNumber || 'Dock 01'}
                              </div>
                            </td>
                            <td className="px-3.5 py-3 font-bold text-primary">{accountName}</td>
                            <td className="px-3.5 py-3 text-secondary">{courierName}</td>
                            <td className="px-3.5 py-3 text-center font-mono font-semibold text-primary">{expectedQty}</td>
                            <td className="px-3.5 py-3 text-center font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                              {scannedCount}
                            </td>
                            <td className="px-3.5 py-3 text-center font-mono font-semibold text-amber-600 dark:text-amber-400">
                              {pendingQty}
                            </td>
                            <td className="px-3.5 py-3 text-secondary font-mono text-[11px]">{formattedDateTime}</td>
                            <td className="px-3.5 py-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span>Open</span>
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-right" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenBatchForScanning(b.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#123B5D] hover:bg-[#184C77] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center gap-1 shadow-xs cursor-pointer transition-all shrink-0"
                                  title="Reopen and continue scanning"
                                >
                                  <Zap className="w-3 h-3" />
                                  <span>Scan</span>
                                </button>
                                <button
                                  onClick={e => handleStartEditBatch(b, e)}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30 font-bold text-xs inline-flex items-center gap-1 shadow-xs cursor-pointer transition-all shrink-0"
                                  title="Edit Open Batch"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setBatchToDelete(b);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30 font-bold text-xs inline-flex items-center gap-1 shadow-xs cursor-pointer transition-all shrink-0"
                                  title="Delete Batch"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
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
            </div>
          )}

          {/* SUB-VIEW 2: ACTIVE SCANNING WORKBENCH */}
          {openBatchView === 'scan' && (
            <div className="space-y-4">
              {activeBatch ? (
                <div className="space-y-4">
                  {/* BATCH HEADER WITH BACK TO LIST & BATCH SWITCHER */}
                  <div className="bg-surface border border-theme rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setOpenBatchView('list')}
                        className="p-2 rounded-xl bg-elevated hover:bg-surface text-secondary hover:text-primary font-bold text-xs border border-theme shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
                        title="View All Open Batches"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">All Open Batches</span>
                      </button>

                      <div className="border-l border-theme pl-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base sm:text-lg font-black font-mono text-primary">
                            {activeBatch.batchNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                            Active Open
                          </span>
                        </div>
                        <div className="text-xs text-secondary flex items-center gap-2 mt-0.5">
                          <span className="font-bold text-primary">
                            {clients.find(c => c.id === activeBatch.clientId)?.name || activeBatch.clientName || '—'}
                          </span>
                          <span>•</span>
                          <span>
                            {couriers.find(cr => cr.id === activeBatch.courierId)?.name || activeBatch.courierName || '—'}
                          </span>
                          <span>•</span>
                          <span>{activeBatch.dockNumber || 'Dock 01'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      {/* BATCH SWITCHER DROPDOWN */}
                      {openBatches.length > 1 && (
                        <select
                          value={activeBatch.id}
                          onChange={e => setActiveBatchId(e.target.value)}
                          className="bg-elevated text-xs font-bold text-primary px-3 py-2 rounded-xl border border-theme focus:outline-none"
                        >
                          {openBatches.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.batchNumber} - {clients.find(c => c.id === b.clientId)?.name || b.clientName} ({b.totalScanned})
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        onClick={() => handleStartEditBatch(activeBatch)}
                        className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30 font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                        title="Edit Batch Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Edit Batch</span>
                      </button>

                      <button
                        onClick={() => setBatchToDelete(activeBatch)}
                        className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30 font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                        title="Delete Batch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>

                      <button
                        onClick={() => setIsDeviceMode(true)}
                        className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                        title="Open Handheld Terminal PDA Mode"
                      >
                        <QrCode className="w-4 h-4" />
                        <span className="hidden sm:inline">HHT Gun Mode</span>
                      </button>

                      <button
                        onClick={() => setOpenBatchView('close')}
                        className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Close Batch</span>
                      </button>
                    </div>
                  </div>

                  {/* BARCODE SCANNER INPUT WORKBENCH */}
                  <div className="bg-surface border border-theme rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                    <form onSubmit={handleScanSubmit} className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          <span>Laser Gun Barcode Intake (Auto-Enter Ready)</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const next = !soundEnabled;
                              setSoundEnabled(next);
                              if (next) playScanSuccessBeep();
                            }}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                              soundEnabled
                                ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                                : 'bg-secondary/10 text-secondary border-theme'
                            }`}
                            title={soundEnabled ? 'Beep sound enabled (click to mute)' : 'Beep sound muted (click to enable)'}
                          >
                            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{soundEnabled ? 'Beep ON' : 'Beep OFF'}</span>
                          </button>
                          <div className="text-xs font-bold text-primary font-mono">
                            Batch Units: <strong className="text-emerald-500 text-sm">{activeBatchItems.length}</strong> / {activeBatch.expectedCount || '—'}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <QrCode className="w-5 h-5 text-muted absolute left-3.5 top-3" />
                          <input
                            ref={barcodeInputRef}
                            type="text"
                            placeholder="Scan or type AWB Tracking Number..."
                            value={barcodeInput}
                            onChange={e => setBarcodeInput(e.target.value)}
                            className="w-full bg-elevated text-primary font-mono text-sm sm:text-base font-bold pl-11 pr-4 py-2.5 rounded-xl border border-theme focus:outline-none focus:border-[#123B5D] dark:focus:border-indigo-500 placeholder:text-muted shadow-inner"
                          />
                        </div>

                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                        >
                          <Check className="w-4 h-4" />
                          <span>Scan</span>
                        </button>
                      </div>

                      {/* LAST SCAN FEEDBACK */}
                      {lastScanResult && (
                        <div
                          className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-100 ${
                            lastScanResult.success
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                              : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                          }`}
                        >
                          {lastScanResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                          <span>{lastScanResult.msg}</span>
                        </div>
                      )}
                    </form>

                    {/* 7 QC CONDITIONS SELECTOR */}
                    <div className="space-y-1.5 pt-2 border-t border-theme">
                      <div className="text-[11px] font-bold text-secondary uppercase tracking-wider">
                        Select QC Condition for next scan:
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
                        {(['Good', 'Damage', 'Open Box', 'Wrong Product', 'Short Qty', 'Missing Product', 'Others'] as ReturnRemarkType[]).map(cond => (
                          <button
                            key={cond}
                            type="button"
                            onClick={() => {
                              setSelectedRemark(cond);
                              barcodeInputRef.current?.focus();
                            }}
                            className={`p-2 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                              selectedRemark === cond
                                ? cond === 'Good'
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                  : cond === 'Damage' || cond === 'Missing Product'
                                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                  : 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                : 'bg-elevated hover:bg-surface text-secondary hover:text-primary border-theme'
                            }`}
                          >
                            {cond}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* SCANNED ITEMS IN THIS BATCH TABLE */}
                  <div className="bg-surface border border-theme rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold text-primary flex items-center gap-2">
                        <List className="w-4 h-4 text-[#123B5D] dark:text-indigo-400" />
                        <span>Scanned Parcels in Batch ({activeBatchItems.length})</span>
                      </h3>
                      <button
                        onClick={() => {
                          const client = clients.find(c => c.id === activeBatch.clientId);
                          const courier = couriers.find(cr => cr.id === activeBatch.courierId);
                          exportBatchItemsToCSV(activeBatch, activeBatchItems, client?.name, courier?.name);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-surface text-secondary hover:text-primary font-bold text-xs flex items-center gap-1.5 border border-theme shadow-xs cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Export Batch CSV</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-theme max-h-80">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] sticky top-0 border-b border-theme">
                          <tr>
                            <th className="px-3 py-2 w-12 text-center">#</th>
                            <th className="px-3 py-2">AWB Tracking Number</th>
                            <th className="px-3 py-2">QC Condition</th>
                            <th className="px-3 py-2">Time</th>
                            <th className="px-3 py-2">Operator</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-theme text-primary">
                          {activeBatchItems.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-muted">
                                No items scanned yet in this batch. Use laser gun or enter AWB above.
                              </td>
                            </tr>
                          ) : (
                            activeBatchItems.map((item, idx) => (
                              <tr key={item.id || idx} className="hover:bg-elevated">
                                <td className="px-3 py-2 text-center font-mono text-secondary text-[11px]">{idx + 1}</td>
                                <td className="px-3 py-2 font-mono font-bold text-primary text-xs">{item.trackingNumber}</td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      item.remark === 'Good'
                                        ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                                        : item.remark === 'Damage' || item.remark === 'Missing Product'
                                        ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                                        : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                                    }`}
                                  >
                                    {item.remark}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-secondary font-mono text-[11px]">
                                  {new Date(item.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </td>
                                <td className="px-3 py-2 text-secondary text-[11px]">{item.scannedByName || 'Staff'}</td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => handleEditScan(item)}
                                      className="p-1 rounded bg-elevated hover:bg-surface text-[#123B5D] dark:text-indigo-300 hover:text-primary transition-colors cursor-pointer border border-theme"
                                      title="Edit AWB"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteScan(item.id)}
                                      className="p-1 rounded bg-elevated hover:bg-rose-50 dark:hover:bg-rose-900/40 text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 transition-colors cursor-pointer border border-theme"
                                      title="Delete AWB"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-surface border border-theme rounded-2xl p-8 text-center text-secondary space-y-3 shadow-sm">
                  <p className="text-sm font-semibold">No open batch selected.</p>
                  <button
                    onClick={() => setOpenBatchView('create')}
                    className="px-4 py-2 rounded-xl bg-[#123B5D] dark:bg-indigo-600 text-white font-bold text-xs"
                  >
                    + Create New Batch
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SUB-VIEW 3: CREATE NEW BATCH FORM */}
          {openBatchView === 'create' && (
            <div className="bg-surface border border-theme rounded-2xl p-5 sm:p-6 shadow-sm max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-between border-b border-theme pb-3">
                <h3 className="text-sm sm:text-base font-extrabold text-primary flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#123B5D] dark:text-indigo-400" />
                  <span>Create New Return Batch</span>
                </h3>
                <button
                  onClick={() => setOpenBatchView('list')}
                  className="p-1.5 rounded-lg bg-elevated hover:bg-surface text-secondary hover:text-primary border border-theme"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (!newBatchClient || !newBatchCourier) {
                    setCreateFormError('Please select both Account / Client and Courier Partner.');
                    return;
                  }
                  setCreateFormError(null);
                  const selectedClient = clients.find(c => c.id === newBatchClient);
                  const selectedCourier = couriers.find(cr => cr.id === newBatchCourier);
                  const created = onAddBatch({
                    batchType: 'RTO/B2C',
                    warehouseId: activeWarehouse.id,
                    clientId: newBatchClient,
                    courierId: newBatchCourier,
                    clientName: selectedClient?.name,
                    courierName: selectedCourier?.name,
                    channel: newBatchChannel,
                    dockNumber: newBatchDock,
                    notes: newBatchNotes.trim(),
                    status: 'Open',
                    expectedCount: Number(newBatchExpectedQty) || 0,
                    createdBy: currentUser.id,
                    createdByName: currentUser.name,
                  });
                  setNewBatchNotes('');
                  setActiveBatchId(created.id);
                  setOpenBatchView('scan');
                }}
                className="space-y-4 text-xs"
              >
                {createFormError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{createFormError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-primary font-bold mb-1">Account / Client Name *</label>
                    <select
                      value={newBatchClient}
                      onChange={e => setNewBatchClient(e.target.value)}
                      className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:outline-none focus:border-[#123B5D] dark:focus:border-indigo-500 font-semibold"
                    >
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-primary font-bold mb-1">Courier Partner *</label>
                    <select
                      value={newBatchCourier}
                      onChange={e => setNewBatchCourier(e.target.value)}
                      className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:outline-none focus:border-[#123B5D] dark:focus:border-indigo-500 font-semibold"
                    >
                      {couriers.map(cr => (
                        <option key={cr.id} value={cr.id}>
                          {cr.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-primary font-bold mb-1">Return Channel</label>
                    <select
                      value={newBatchChannel}
                      onChange={e => setNewBatchChannel(e.target.value as any)}
                      className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:outline-none focus:border-[#123B5D] dark:focus:border-indigo-500 font-medium"
                    >
                      <option value="B2C Return">B2C Return</option>
                      <option value="D2C Return">D2C Return</option>
                      <option value="Marketplace Return">Marketplace Return</option>
                      <option value="Customer RTO">Customer RTO</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-primary font-bold mb-1">Dock Number</label>
                    <select
                      value={newBatchDock}
                      onChange={e => setNewBatchDock(e.target.value)}
                      className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:outline-none focus:border-[#123B5D] dark:focus:border-indigo-500 font-bold text-amber-600 dark:text-amber-400 [&>option]:bg-[#1E293B] [&>option]:text-[#F8FAFC]"
                    >
                      {WAREHOUSE_DOCKS.map(dock => (
                        <option key={dock} value={dock} className="bg-[#1E293B] text-[#F8FAFC]">
                          {dock}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-primary font-bold mb-1">Expected Qty (Units)</label>
                    <input
                      type="number"
                      min={0}
                      value={newBatchExpectedQty}
                      onChange={e => setNewBatchExpectedQty(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:outline-none font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-primary font-bold mb-1">Warehouse Hub</label>
                    <input
                      type="text"
                      disabled
                      value={`${activeWarehouse.name} (${activeWarehouse.code})`}
                      className="w-full bg-elevated/50 text-secondary p-2.5 rounded-xl border border-theme font-medium cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-primary font-bold mb-1">Notes / Description (Optional)</label>
                  <textarea
                    rows={2}
                    value={newBatchNotes}
                    onChange={e => setNewBatchNotes(e.target.value)}
                    placeholder="Vehicle number, bag seal number, or supervisor notes..."
                    className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:outline-none placeholder:text-muted"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme">
                  <button
                    type="button"
                    onClick={() => setOpenBatchView('list')}
                    className="px-4 py-2 rounded-xl bg-elevated hover:bg-surface text-secondary hover:text-primary font-bold border border-theme"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#123B5D] hover:bg-[#184C77] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold shadow-sm"
                  >
                    Create & Open Station
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SUB-VIEW 4: CLOSE BATCH HANDOVER FORM */}
          {openBatchView === 'close' && activeBatch && (
            <div className="bg-surface border border-theme rounded-2xl p-5 sm:p-6 shadow-sm max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-between border-b border-theme pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-primary flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-500" />
                    <span>Close Batch & Sign Handover</span>
                  </h3>
                  <p className="text-xs text-secondary mt-0.5">
                    Batch: <strong className="font-mono text-primary">{activeBatch.batchNumber}</strong> ({activeBatchItems.length} scanned units)
                  </p>
                </div>
                <button
                  onClick={() => setOpenBatchView('scan')}
                  className="p-1.5 rounded-lg bg-elevated hover:bg-surface text-secondary hover:text-primary border border-theme"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCloseBatchSubmit} className="space-y-4 text-xs">
                {closeFormError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{closeFormError}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-primary font-bold mb-1">Courier Driver / Representative Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={driverName}
                      onChange={e => setDriverName(e.target.value)}
                      className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:outline-none focus:border-emerald-500 font-medium placeholder:text-muted"
                    />
                  </div>

                  <div>
                    <label className="block text-primary font-bold mb-1">Courier Driver Mobile *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9876543210"
                      value={driverMobile}
                      onChange={e => setDriverMobile(e.target.value)}
                      className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme font-mono focus:outline-none focus:border-emerald-500 placeholder:text-muted"
                    />
                  </div>

                  <div>
                    <label className="block text-primary font-bold mb-1">Supervisor Signer</label>
                    <input
                      type="text"
                      required
                      value={supervisorSigner}
                      onChange={e => setSupervisorSigner(e.target.value)}
                      className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme font-medium focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-primary font-bold mb-1">Handover Remarks</label>
                    <input
                      type="text"
                      placeholder="Bag seals, discrepancy notes..."
                      value={handoverNotes}
                      onChange={e => setHandoverNotes(e.target.value)}
                      className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:outline-none placeholder:text-muted"
                    />
                  </div>
                </div>

                {/* DIGITAL SIGNATURE CANVAS */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-primary font-bold flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Driver Digital Signature</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleClearSig}
                      className="text-[11px] text-secondary hover:text-primary flex items-center gap-1 cursor-pointer"
                    >
                      <Undo2 className="w-3 h-3" /> Clear
                    </button>
                  </div>
                  <div className="bg-elevated border border-theme rounded-xl p-1 flex items-center justify-center">
                    <canvas
                      ref={sigCanvasRef}
                      width={500}
                      height={100}
                      onMouseDown={handleStartDraw}
                      onMouseMove={handleDraw}
                      onMouseUp={handleStopDraw}
                      onMouseLeave={handleStopDraw}
                      onTouchStart={handleStartDraw}
                      onTouchMove={handleDraw}
                      onTouchEnd={handleStopDraw}
                      className="w-full h-[100px] bg-surface cursor-crosshair rounded-lg touch-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-theme">
                  <button
                    type="button"
                    onClick={() => setOpenBatchView('scan')}
                    className="px-4 py-2 rounded-xl bg-elevated text-secondary hover:text-primary font-bold border border-theme"
                  >
                    Back to Scanning
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    <span>Complete Sign-off & Download PDF</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CLOSED BATCH                                      */}
      {/* ======================================================== */}
      {activeMainTab === 'closed_batch' && (
        <div className="bg-surface border border-theme rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme pb-3">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-primary flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500" />
                <span>All Closed Batches ({closedBatches.length})</span>
              </h2>
              <p className="text-xs text-secondary mt-0.5">
                All closed and scanned batches. Print PDF manifest or export CSV items for each batch.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by batch, account, courier..."
                  value={batchSearchQuery}
                  onChange={e => setBatchSearchQuery(e.target.value)}
                  className="w-full bg-elevated text-xs text-primary pl-8 pr-3 py-1.5 rounded-lg border border-theme focus:outline-none focus:border-[#123B5D] dark:focus:border-indigo-500 placeholder:text-muted"
                />
              </div>

              <button
                onClick={() => exportAllBatchesToCSV(closedBatches, clients, couriers)}
                className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-surface text-secondary hover:text-primary font-bold text-xs flex items-center gap-1.5 border border-theme shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Export All</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-theme">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-3.5 py-3">Batch Number</th>
                  <th className="px-3.5 py-3">Account Name</th>
                  <th className="px-3.5 py-3">Courier</th>
                  <th className="px-3.5 py-3 text-center">Scanned Units</th>
                  <th className="px-3.5 py-3">Driver Sign-off</th>
                  <th className="px-3.5 py-3">Closed Date / Time</th>
                  <th className="px-3.5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme text-primary">
                {closedBatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted">
                      No closed batches yet. Complete and close an open batch to see it here.
                    </td>
                  </tr>
                ) : (
                  closedBatches
                    .filter(b => {
                      if (!batchSearchQuery) return true;
                      const q = batchSearchQuery.toLowerCase();
                      const client = clients.find(c => c.id === b.clientId);
                      const courier = couriers.find(cr => cr.id === b.courierId);
                      return (
                        b.batchNumber.toLowerCase().includes(q) ||
                        (client?.name || b.clientName || '').toLowerCase().includes(q) ||
                        (courier?.name || b.courierName || '').toLowerCase().includes(q) ||
                        (b.driverName || '').toLowerCase().includes(q)
                      );
                    })
                    .map(b => {
                      const client = clients.find(c => c.id === b.clientId);
                      const courier = couriers.find(cr => cr.id === b.courierId);
                      const courierLabel = courier?.name || b.courierName || '—';
                      const clientLabel = client?.name || b.clientName || '—';

                      return (
                        <tr
                          key={b.id}
                          onClick={() => {
                            setSelectedClosedBatch(b);
                            setClosedBatchItemSearch('');
                          }}
                          className="hover:bg-elevated cursor-pointer transition-colors group"
                        >
                          <td className="px-3.5 py-3 font-mono font-bold text-[#123B5D] dark:text-indigo-400 group-hover:underline flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>{b.batchNumber}</span>
                          </td>
                          <td className="px-3.5 py-3 font-bold text-primary">{clientLabel}</td>
                          <td className="px-3.5 py-3 text-secondary">{courierLabel}</td>
                          <td className="px-3.5 py-3 text-center font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                            {b.totalScanned || 0}
                          </td>
                          <td className="px-3.5 py-3 text-secondary">
                            {b.driverName ? `${b.driverName} (${b.driverMobile || 'Signed'})` : 'Supervisor Verified'}
                          </td>
                          <td className="px-3.5 py-3 text-secondary font-mono text-[11px]">
                            {b.closedAt ? new Date(b.closedAt).toLocaleString() : (b.createdAt ? new Date(b.createdAt).toLocaleString() : '—')}
                          </td>
                          <td className="px-3.5 py-3 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {/* VIEW */}
                              <button
                                onClick={() => {
                                  setSelectedClosedBatch(b);
                                  setClosedBatchItemSearch('');
                                }}
                                className="px-2.5 py-1 rounded bg-elevated hover:bg-surface text-secondary hover:text-primary font-bold text-[11px] flex items-center gap-1 border border-theme shadow-xs cursor-pointer"
                                title="View Batch Items"
                              >
                                <Eye className="w-3 h-3 text-[#123B5D] dark:text-indigo-400" />
                                <span>View</span>
                              </button>

                              {/* PRINT PDF */}
                              <button
                                onClick={() => handleDownloadBatchPDF(b)}
                                className="px-2.5 py-1 rounded bg-[#123B5D] hover:bg-[#184C77] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs cursor-pointer"
                                title="Print PDF Manifest"
                              >
                                <Printer className="w-3 h-3" />
                                <span>PDF</span>
                              </button>

                              {/* EXPORT CSV */}
                              <button
                                onClick={() => {
                                  const batchItems = scannedItems.filter(i => i.batchId === b.id);
                                  exportBatchItemsToCSV(b, batchItems, clientLabel, courierLabel);
                                }}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs cursor-pointer"
                                title="Export Batch CSV"
                              >
                                <Download className="w-3 h-3" />
                                <span>Export</span>
                              </button>

                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setBatchToDelete(b);
                                }}
                                className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30 font-bold text-[11px] flex items-center gap-1 shadow-xs cursor-pointer"
                                title="Delete Closed Batch"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
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
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: REPORT & MANIFEST (Redesigned with Pie Charts)    */}
      {/* ======================================================== */}
      {activeMainTab === 'reports' && (
        <div className="space-y-6">
          {/* TOP METRIC CARDS & GLOBAL ACTIONS */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border border-theme p-4 rounded-2xl shadow-xs">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
              {/* Total Accounts */}
              <div className="p-3.5 rounded-xl bg-elevated border border-theme">
                <div className="flex items-center justify-between text-secondary mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Total Accounts</span>
                  <Building2 className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-xl font-black font-mono text-primary">{clients.length}</div>
                <div className="text-[10px] text-secondary mt-0.5">Active Portfolios</div>
              </div>

              {/* Total Scan Count */}
              <div className="p-3.5 rounded-xl bg-elevated border border-theme">
                <div className="flex items-center justify-between text-secondary mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Total Scanned</span>
                  <QrCode className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {scannedItems.length}
                </div>
                <div className="text-[10px] text-secondary mt-0.5">Evaluated Returns</div>
              </div>

              {/* Total Batches */}
              <div className="p-3.5 rounded-xl bg-elevated border border-theme">
                <div className="flex items-center justify-between text-secondary mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Total Batches</span>
                  <Boxes className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-xl font-black font-mono text-primary">{batches.length}</div>
                <div className="text-[10px] text-secondary mt-0.5 font-medium">
                  {openBatches.length} Open • {closedBatches.length} Closed
                </div>
              </div>

              {/* QC Pass Rate */}
              <div className="p-3.5 rounded-xl bg-elevated border border-theme">
                <div className="flex items-center justify-between text-secondary mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider">QC Pass Rate</span>
                  <PackageCheck className="w-4 h-4 text-cyan-500" />
                </div>
                <div className="text-xl font-black font-mono text-cyan-600 dark:text-cyan-400">
                  {scannedItems.length > 0
                    ? Math.round((scannedItems.filter(i => i.remark === 'Good').length / scannedItems.length) * 100)
                    : 100}
                  %
                </div>
                <div className="text-[10px] text-secondary mt-0.5">Good Condition</div>
              </div>
            </div>

            {/* Global Actions */}
            <div className="flex flex-wrap sm:flex-nowrap md:flex-col gap-2 shrink-0 justify-center">
              <button
                onClick={() => exportAllBatchesToCSV(batches, clients, couriers)}
                className="px-3 py-2 rounded-xl bg-elevated hover:bg-surface text-secondary hover:text-primary font-bold text-xs flex items-center gap-1.5 border border-theme shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500" />
                <span>Download All Batches CSV</span>
              </button>
              <button
                onClick={() => generateWarehouseBatchesSummaryPDF(batches, activeWarehouse, clients, couriers)}
                className="px-3 py-2 rounded-xl bg-[#123B5D] hover:bg-[#184C77] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Warehouse Batches PDF</span>
              </button>
            </div>
          </div>

          {/* ======================================================== */}
          {/* REPORT 1: QC CONDITION & RETURN REASON BREAKDOWN        */}
          {/* ======================================================== */}
          <div className="bg-surface border border-theme rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-primary flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span>QC Condition & Return Reason Breakdown</span>
                </h3>
                <p className="text-xs text-secondary mt-0.5">
                  Visual quality control verdict distribution across all 7 evaluation parameters.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportQCBreakdownToCSV(qcBreakdown)}
                  className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-surface text-secondary hover:text-primary font-bold text-xs flex items-center gap-1.5 border border-theme transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={handleDownloadQCPdf}
                  className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-surface text-secondary hover:text-primary font-bold text-xs flex items-center gap-1.5 border border-theme transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-500" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Pie Chart */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 bg-elevated/40 rounded-2xl border border-theme min-h-[260px]">
                {scannedItems.length === 0 ? (
                  <div className="text-center py-10 text-muted text-xs">No scanned parcels to plot.</div>
                ) : (
                  <div className="w-full h-64 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={qcBreakdown
                            .filter(q => q.count > 0)
                            .map(q => {
                              let fill = '#64748b';
                              if (q.condition === 'Good') fill = '#10B981';
                              else if (q.condition === 'Damage') fill = '#EF4444';
                              else if (q.condition === 'Open Box') fill = '#F59E0B';
                              else if (q.condition === 'Wrong Product') fill = '#8B5CF6';
                              else if (q.condition === 'Short Qty') fill = '#F97316';
                              else if (q.condition === 'Missing Product') fill = '#DC2626';
                              return {
                                name: q.condition,
                                value: q.count,
                                percent: q.percent,
                                fill,
                              };
                            })}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                        >
                          {qcBreakdown.map((q, idx) => {
                            let fill = '#64748b';
                            if (q.condition === 'Good') fill = '#10B981';
                            else if (q.condition === 'Damage') fill = '#EF4444';
                            else if (q.condition === 'Open Box') fill = '#F59E0B';
                            else if (q.condition === 'Wrong Product') fill = '#8B5CF6';
                            else if (q.condition === 'Short Qty') fill = '#F97316';
                            else if (q.condition === 'Missing Product') fill = '#DC2626';
                            return <Cell key={`qc-cell-${idx}`} fill={fill} />;
                          })}
                        </Pie>
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0];
                              return (
                                <div className="bg-slate-900 text-white text-xs px-3 py-2 rounded-xl border border-slate-700 shadow-xl">
                                  <div className="font-bold flex items-center gap-1.5">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full inline-block"
                                      style={{ backgroundColor: d.payload.fill }}
                                    ></span>
                                    {d.name}
                                  </div>
                                  <div className="text-slate-300 mt-1 font-mono">
                                    {d.value} Parcels ({d.payload.percent}%)
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center pointer-events-none">
                      <span className="text-xl font-black font-mono text-primary">{scannedItems.length}</span>
                      <span className="text-[10px] text-secondary uppercase font-bold tracking-wider">Total</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Breakdown Grid / Status Cards */}
              <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {qcBreakdown.map(qc => {
                  let accentColor = 'bg-slate-500';
                  let textColor = 'text-slate-500';
                  if (qc.condition === 'Good') {
                    accentColor = 'bg-emerald-500';
                    textColor = 'text-emerald-600 dark:text-emerald-400';
                  } else if (qc.condition === 'Damage' || qc.condition === 'Missing Product') {
                    accentColor = 'bg-rose-500';
                    textColor = 'text-rose-600 dark:text-rose-400';
                  } else if (qc.condition === 'Open Box' || qc.condition === 'Short Qty') {
                    accentColor = 'bg-amber-500';
                    textColor = 'text-amber-600 dark:text-amber-400';
                  } else if (qc.condition === 'Wrong Product') {
                    accentColor = 'bg-purple-500';
                    textColor = 'text-purple-600 dark:text-purple-400';
                  }

                  return (
                    <div key={qc.condition} className="p-3 bg-elevated border border-theme rounded-xl flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-secondary uppercase truncate">{qc.condition}</span>
                        <span className={`w-2 h-2 rounded-full ${accentColor}`}></span>
                      </div>
                      <div className={`text-lg font-black font-mono my-1 ${textColor}`}>{qc.count}</div>
                      <div>
                        <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${accentColor}`} style={{ width: `${qc.percent}%` }}></div>
                        </div>
                        <div className="text-[10px] text-secondary mt-1 font-mono flex justify-between">
                          <span>Share</span>
                          <span className="font-bold">{qc.percent}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* REPORT 2: ACCOUNT-WISE PERFORMANCE                      */}
          {/* ======================================================== */}
          <div className="bg-surface border border-theme rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-primary flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-500" />
                  <span>Account-wise Report & Volume Share</span>
                </h3>
                <p className="text-xs text-secondary mt-0.5">
                  Returns throughput, quality rate, and volume distribution by client account.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportAccountWiseReportToCSV(accountWiseReport)}
                  className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-surface text-secondary hover:text-primary font-bold text-xs flex items-center gap-1.5 border border-theme transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={handleDownloadAccountPdf}
                  className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-surface text-secondary hover:text-primary font-bold text-xs flex items-center gap-1.5 border border-theme transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-500" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Account Share Pie Chart */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center p-3 bg-elevated/40 rounded-2xl border border-theme min-h-[260px]">
                {accountWiseReport.length === 0 ? (
                  <div className="text-center py-10 text-muted text-xs">No client account data to plot.</div>
                ) : (
                  <div className="w-full h-64 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={accountWiseReport
                            .filter(a => a.totalScanned > 0)
                            .map((a, idx) => {
                              const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#6366F1'];
                              const totalScans = accountWiseReport.reduce((sum, item) => sum + item.totalScanned, 0) || 1;
                              return {
                                name: a.accountName,
                                code: a.accountCode,
                                value: a.totalScanned,
                                percent: Math.round((a.totalScanned / totalScans) * 100),
                                fill: colors[idx % colors.length],
                              };
                            })}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                        >
                          {accountWiseReport.map((_, idx) => {
                            const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#6366F1'];
                            return <Cell key={`acc-cell-${idx}`} fill={colors[idx % colors.length]} />;
                          })}
                        </Pie>
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0];
                              return (
                                <div className="bg-slate-900 text-white text-xs px-3 py-2 rounded-xl border border-slate-700 shadow-xl">
                                  <div className="font-bold flex items-center gap-1.5">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full inline-block"
                                      style={{ backgroundColor: d.payload.fill }}
                                    ></span>
                                    {d.name}
                                  </div>
                                  <div className="text-slate-300 mt-1 font-mono">
                                    {d.value} Scanned Units ({d.payload.percent}%)
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center pointer-events-none">
                      <span className="text-xl font-black font-mono text-primary">
                        {accountWiseReport.reduce((sum, a) => sum + a.totalScanned, 0)}
                      </span>
                      <span className="text-[10px] text-secondary uppercase font-bold tracking-wider">Units</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Account Data Table */}
              <div className="lg:col-span-8 overflow-x-auto rounded-xl border border-theme">
                <table className="w-full text-left text-xs">
                  <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                    <tr>
                      <th className="px-3 py-2.5">Account</th>
                      <th className="px-3 py-2.5 text-center">Batches</th>
                      <th className="px-3 py-2.5 text-center">Scanned</th>
                      <th className="px-3 py-2.5 text-center">Good</th>
                      <th className="px-3 py-2.5 text-center">Damaged</th>
                      <th className="px-3 py-2.5 text-center">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme text-primary">
                    {accountWiseReport.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted">
                          No client account returns recorded yet.
                        </td>
                      </tr>
                    ) : (
                      accountWiseReport.map((a, idx) => {
                        const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#6366F1'];
                        const totalScans = accountWiseReport.reduce((sum, item) => sum + item.totalScanned, 0) || 1;
                        const pct = Math.round((a.totalScanned / totalScans) * 100);
                        return (
                          <tr key={a.accountCode} className="hover:bg-elevated/60">
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: colors[idx % colors.length] }}
                                ></span>
                                <div>
                                  <div className="font-bold text-primary">{a.accountName}</div>
                                  <div className="text-[10px] text-secondary font-mono">{a.accountCode}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono">{a.totalBatches}</td>
                            <td className="px-3 py-2.5 text-center font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                              {a.totalScanned}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono text-emerald-600 dark:text-emerald-400">
                              {a.goodCount}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono text-rose-600 dark:text-rose-400">
                              {a.damageCount}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono font-bold text-primary">{pct}%</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* REPORT 3: COURIER PARTNER DISTRIBUTION                  */}
          {/* ======================================================== */}
          <div className="bg-surface border border-theme rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-primary flex items-center gap-2">
                  <Truck className="w-4 h-4 text-cyan-500" />
                  <span>Courier Partner Distribution</span>
                </h3>
                <p className="text-xs text-secondary mt-0.5">
                  Handover volume and parcel throughput aggregated by logistics courier.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportCourierWiseReportToCSV(courierWiseReport)}
                  className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-surface text-secondary hover:text-primary font-bold text-xs flex items-center gap-1.5 border border-theme transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={handleDownloadCourierPdf}
                  className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-surface text-secondary hover:text-primary font-bold text-xs flex items-center gap-1.5 border border-theme transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-500" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Courier Share Pie Chart */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center p-3 bg-elevated/40 rounded-2xl border border-theme min-h-[260px]">
                {courierWiseReport.length === 0 ? (
                  <div className="text-center py-10 text-muted text-xs">No courier returns data to plot.</div>
                ) : (
                  <div className="w-full h-64 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={courierWiseReport
                            .filter(c => c.totalScanned > 0)
                            .map((c, idx) => {
                              const colors = ['#0EA5E9', '#F97316', '#8B5CF6', '#10B981', '#E11D48', '#D97706', '#64748B'];
                              const totalScans = courierWiseReport.reduce((sum, item) => sum + item.totalScanned, 0) || 1;
                              return {
                                name: c.courierName,
                                code: c.courierCode,
                                value: c.totalScanned,
                                percent: Math.round((c.totalScanned / totalScans) * 100),
                                fill: colors[idx % colors.length],
                              };
                            })}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                        >
                          {courierWiseReport.map((_, idx) => {
                            const colors = ['#0EA5E9', '#F97316', '#8B5CF6', '#10B981', '#E11D48', '#D97706', '#64748B'];
                            return <Cell key={`cr-cell-${idx}`} fill={colors[idx % colors.length]} />;
                          })}
                        </Pie>
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0];
                              return (
                                <div className="bg-slate-900 text-white text-xs px-3 py-2 rounded-xl border border-slate-700 shadow-xl">
                                  <div className="font-bold flex items-center gap-1.5">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full inline-block"
                                      style={{ backgroundColor: d.payload.fill }}
                                    ></span>
                                    {d.name}
                                  </div>
                                  <div className="text-slate-300 mt-1 font-mono">
                                    {d.value} Parcels ({d.payload.percent}%)
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center pointer-events-none">
                      <span className="text-xl font-black font-mono text-primary">
                        {courierWiseReport.reduce((sum, c) => sum + c.totalScanned, 0)}
                      </span>
                      <span className="text-[10px] text-secondary uppercase font-bold tracking-wider">Returns</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Courier Data Table */}
              <div className="lg:col-span-8 overflow-x-auto rounded-xl border border-theme">
                <table className="w-full text-left text-xs">
                  <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                    <tr>
                      <th className="px-3 py-2.5">Courier Partner</th>
                      <th className="px-3 py-2.5">Code</th>
                      <th className="px-3 py-2.5 text-center">Total Batches</th>
                      <th className="px-3 py-2.5 text-center">Scanned Parcels</th>
                      <th className="px-3 py-2.5 text-center">Volume Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme text-primary">
                    {courierWiseReport.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted">
                          No courier return records available.
                        </td>
                      </tr>
                    ) : (
                      courierWiseReport.map((c, idx) => {
                        const colors = ['#0EA5E9', '#F97316', '#8B5CF6', '#10B981', '#E11D48', '#D97706', '#64748B'];
                        const totalScans = courierWiseReport.reduce((sum, item) => sum + item.totalScanned, 0) || 1;
                        const pct = Math.round((c.totalScanned / totalScans) * 100);
                        return (
                          <tr key={c.courierCode} className="hover:bg-elevated/60">
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: colors[idx % colors.length] }}
                                ></span>
                                <span className="font-bold text-primary">{c.courierName}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-secondary">{c.courierCode}</td>
                            <td className="px-3 py-2.5 text-center font-mono">{c.totalBatches}</td>
                            <td className="px-3 py-2.5 text-center font-mono font-extrabold text-cyan-600 dark:text-cyan-400">
                              {c.totalScanned}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono font-bold text-primary">{pct}%</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* REPORT 4: DATE-WISE REPORT & THROUGHPUT                  */}
          {/* ======================================================== */}
          <div className="bg-surface border border-theme rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-primary flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span>Date-wise Report & Operational Throughput</span>
                </h3>
                <p className="text-xs text-secondary mt-0.5">
                  Returns volume and batch status throughput aggregated by operational date.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportDateWiseReportToCSV(dateWiseReport)}
                  className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-surface text-secondary hover:text-primary font-bold text-xs flex items-center gap-1.5 border border-theme transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={handleDownloadDatePdf}
                  className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-surface text-secondary hover:text-primary font-bold text-xs flex items-center gap-1.5 border border-theme transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-500" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Batch Completion Pie Chart */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center p-3 bg-elevated/40 rounded-2xl border border-theme min-h-[260px]">
                {batches.length === 0 ? (
                  <div className="text-center py-10 text-muted text-xs">No batches recorded to plot.</div>
                ) : (
                  <div className="w-full h-64 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            {
                              name: 'Open Batches',
                              value: openBatches.length,
                              percent: Math.round((openBatches.length / batches.length) * 100),
                              fill: '#10B981',
                            },
                            {
                              name: 'Closed Batches',
                              value: closedBatches.length,
                              percent: Math.round((closedBatches.length / batches.length) * 100),
                              fill: '#F59E0B',
                            },
                          ].filter(b => b.value > 0)}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                        >
                          <Cell fill="#10B981" />
                          <Cell fill="#F59E0B" />
                        </Pie>
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0];
                              return (
                                <div className="bg-slate-900 text-white text-xs px-3 py-2 rounded-xl border border-slate-700 shadow-xl">
                                  <div className="font-bold flex items-center gap-1.5">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full inline-block"
                                      style={{ backgroundColor: d.payload.fill }}
                                    ></span>
                                    {d.name}
                                  </div>
                                  <div className="text-slate-300 mt-1 font-mono">
                                    {d.value} Batches ({d.payload.percent}%)
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center pointer-events-none">
                      <span className="text-xl font-black font-mono text-primary">{batches.length}</span>
                      <span className="text-[10px] text-secondary uppercase font-bold tracking-wider">Batches</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Date-Wise Table */}
              <div className="lg:col-span-8 overflow-x-auto rounded-xl border border-theme">
                <table className="w-full text-left text-xs">
                  <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                    <tr>
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5 text-center">Total Batches</th>
                      <th className="px-3.5 py-2.5 text-center">Open</th>
                      <th className="px-3.5 py-2.5 text-center">Closed</th>
                      <th className="px-3.5 py-2.5 text-center">Scanned</th>
                      <th className="px-3.5 py-2.5 text-center">Good QC</th>
                      <th className="px-3.5 py-2.5 text-center">Damaged</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme text-primary">
                    {dateWiseReport.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-muted">
                          No returns throughput data recorded yet.
                        </td>
                      </tr>
                    ) : (
                      dateWiseReport.map(d => (
                        <tr key={d.date} className="hover:bg-elevated/60">
                          <td className="px-3.5 py-2.5 font-mono font-bold text-primary">{d.date}</td>
                          <td className="px-3.5 py-2.5 text-center font-mono">{d.totalBatches}</td>
                          <td className="px-3.5 py-2.5 text-center font-mono text-emerald-600 dark:text-emerald-400">
                            {d.openBatches}
                          </td>
                          <td className="px-3.5 py-2.5 text-center font-mono text-amber-600 dark:text-amber-400">
                            {d.closedBatches}
                          </td>
                          <td className="px-3.5 py-2.5 text-center font-mono font-extrabold text-primary">
                            {d.totalScanned}
                          </td>
                          <td className="px-3.5 py-2.5 text-center font-mono text-emerald-600 dark:text-emerald-400">
                            {d.goodCount}
                          </td>
                          <td className="px-3.5 py-2.5 text-center font-mono text-rose-600 dark:text-rose-400">
                            {d.damageCount}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: MONTHLY SUMMARY (Recharts Good vs Damage vs Missing) */}
      {/* ======================================================== */}
      {activeMainTab === 'summary' && (
        <ReturnsSummaryView
          batches={batches}
          scannedItems={scannedItems}
          clients={clients}
          couriers={couriers}
          onSelectBatch={(batchId) => {
            setActiveBatchId(batchId);
            setActiveMainTab('open_batch');
            setOpenBatchView('scan');
          }}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL 1: EDIT AWB ITEM MODAL                             */}
      {/* ======================================================== */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-surface border border-theme rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-theme pb-3">
              <h3 className="text-sm font-extrabold text-primary flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#123B5D] dark:text-indigo-400" /> Edit Scanned AWB
              </h3>
              <button onClick={() => setEditingItem(null)} className="text-secondary hover:text-primary font-bold cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-primary font-bold mb-1">AWB Tracking Number</label>
                <input
                  type="text"
                  value={editAwbValue}
                  onChange={e => setEditAwbValue(e.target.value)}
                  className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme font-mono font-bold focus:outline-none focus:border-[#123B5D]"
                />
              </div>

              <div>
                <label className="block text-primary font-bold mb-1">QC Condition</label>
                <select
                  value={editRemarkValue}
                  onChange={e => setEditRemarkValue(e.target.value as ReturnRemarkType)}
                  className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme font-bold focus:outline-none"
                >
                  <option value="Good">Good</option>
                  <option value="Damage">Damage</option>
                  <option value="Open Box">Open Box</option>
                  <option value="Wrong Product">Wrong Product</option>
                  <option value="Short Qty">Short Qty</option>
                  <option value="Missing Product">Missing Product</option>
                  <option value="Others">Others</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-theme">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl bg-elevated text-secondary font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-xl bg-[#123B5D] text-white font-bold text-xs shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: DELETE CONFIRMATION MODAL                       */}
      {/* ======================================================== */}
      {deletingItemId && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-surface border border-theme rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-extrabold text-primary flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-500" /> Delete Scanned Parcel
            </h3>
            <p className="text-xs text-secondary">
              Are you sure you want to remove this scanned AWB from the batch? This action will adjust the batch count immediately.
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-theme">
              <button
                type="button"
                onClick={() => setDeletingItemId(null)}
                className="px-4 py-2 rounded-xl bg-elevated text-secondary font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteScan}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: CLOSED BATCH DETAIL INSPECTION MODAL             */}
      {/* ======================================================== */}
      {selectedClosedBatch && (() => {
        const batchItems = scannedItems.filter(i => i.batchId === selectedClosedBatch.id);
        const filteredItems = batchItems.filter(i => {
          if (!closedBatchItemSearch) return true;
          return i.trackingNumber.toLowerCase().includes(closedBatchItemSearch.toLowerCase()) ||
                 i.remark.toLowerCase().includes(closedBatchItemSearch.toLowerCase());
        });
        const client = clients.find(c => c.id === selectedClosedBatch.clientId);
        const courier = couriers.find(cr => cr.id === selectedClosedBatch.courierId);

        return (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 z-50 overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-surface border border-theme rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
              <div className="p-4 sm:p-5 border-b border-theme flex items-center justify-between bg-elevated">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 text-[#123B5D] dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30">
                    <Lock className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black font-mono text-primary">
                        {selectedClosedBatch.batchNumber}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                        Closed
                      </span>
                    </div>
                    <div className="text-xs text-secondary flex items-center gap-2 mt-0.5">
                      <span className="text-primary font-bold">{client?.name || selectedClosedBatch.clientName || '—'}</span>
                      <span>•</span>
                      <span className="text-secondary">{courier?.name || selectedClosedBatch.courierName || '—'}</span>
                      <span>•</span>
                      <span className="text-secondary">{selectedClosedBatch.dockNumber || 'Dock 01'}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedClosedBatch(null)}
                  className="p-2 rounded-xl bg-elevated hover:bg-surface text-secondary hover:text-primary border border-theme"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-elevated border border-theme rounded-xl">
                    <div className="text-[10px] text-secondary uppercase font-bold">Total Scanned</div>
                    <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {selectedClosedBatch.totalScanned} <span className="text-xs font-normal text-secondary">Items</span>
                    </div>
                  </div>

                  <div className="p-3 bg-elevated border border-theme rounded-xl">
                    <div className="text-[10px] text-secondary uppercase font-bold">Closed Timestamp</div>
                    <div className="text-xs font-bold text-primary mt-1">
                      {selectedClosedBatch.closedAt ? new Date(selectedClosedBatch.closedAt).toLocaleString() : 'N/A'}
                    </div>
                  </div>

                  <div className="p-3 bg-elevated border border-theme rounded-xl">
                    <div className="text-[10px] text-secondary uppercase font-bold">Driver / Rep</div>
                    <div className="text-xs font-bold text-primary mt-1 truncate">
                      {selectedClosedBatch.driverName || 'Supervisor Verified'}
                    </div>
                    {selectedClosedBatch.driverMobile && (
                      <div className="text-[10px] text-secondary font-mono">{selectedClosedBatch.driverMobile}</div>
                    )}
                  </div>

                  <div className="p-3 bg-elevated border border-theme rounded-xl">
                    <div className="text-[10px] text-secondary uppercase font-bold">Supervisor Signoff</div>
                    <div className="text-xs font-bold text-primary mt-1 truncate">
                      {selectedClosedBatch.supervisorSigner || 'Verified'}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-extrabold text-primary flex items-center gap-1.5">
                      <List className="w-3.5 h-3.5 text-[#123B5D] dark:text-indigo-400" />
                      Scanned Parcels in Batch ({batchItems.length})
                    </h4>
                    <input
                      type="text"
                      placeholder="Filter AWBs..."
                      value={closedBatchItemSearch}
                      onChange={e => setClosedBatchItemSearch(e.target.value)}
                      className="bg-elevated text-primary px-3 py-1.5 rounded-lg border border-theme text-xs w-48 focus:outline-none"
                    />
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-theme max-h-64">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] sticky top-0 border-b border-theme">
                        <tr>
                          <th className="px-3 py-2 w-12 text-center">#</th>
                          <th className="px-3 py-2">AWB Tracking Number</th>
                          <th className="px-3 py-2">QC Condition</th>
                          <th className="px-3 py-2">Scanned At</th>
                          <th className="px-3 py-2">Operator</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme text-primary">
                        {filteredItems.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-elevated">
                            <td className="px-3 py-2 text-center text-secondary font-mono text-[10px]">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono font-bold text-primary">{item.trackingNumber}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.remark === 'Good'
                                    ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
                                }`}
                              >
                                {item.remark}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-secondary font-mono text-[11px]">
                              {new Date(item.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-3 py-2 text-secondary">{item.scannedByName || 'Staff'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-theme bg-elevated flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => generateBatchPDF(selectedClosedBatch, batchItems, activeWarehouse, client, courier)}
                    className="px-4 py-2 rounded-xl bg-[#123B5D] hover:bg-[#184C77] dark:bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print PDF Manifest</span>
                  </button>
                  <button
                    onClick={() => exportBatchItemsToCSV(selectedClosedBatch, batchItems, client?.name, courier?.name)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedClosedBatch(null)}
                  className="px-4 py-2 rounded-xl bg-elevated hover:bg-surface text-secondary hover:text-primary font-bold text-xs border border-theme"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EDIT OPEN BATCH MODAL */}
      {editingBatch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-theme rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-theme flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-primary">Edit Batch Details</h3>
                  <p className="text-xs text-secondary font-mono font-bold mt-0.5">
                    {editingBatch.batchNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingBatch(null)}
                className="p-1.5 rounded-lg bg-elevated hover:bg-surface text-secondary hover:text-primary border border-theme"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBatchEdit} className="p-4 sm:p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-primary mb-1">Account / Client *</label>
                  <select
                    value={editClientId}
                    onChange={e => setEditClientId(e.target.value)}
                    className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:outline-none focus:border-[#123B5D] dark:focus:border-indigo-500 font-semibold"
                  >
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-primary mb-1">Courier Partner *</label>
                  <select
                    value={editCourierId}
                    onChange={e => setEditCourierId(e.target.value)}
                    className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:outline-none focus:border-[#123B5D] dark:focus:border-indigo-500 font-semibold"
                  >
                    {couriers.map(cr => (
                      <option key={cr.id} value={cr.id}>
                        {cr.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-primary mb-1">Dock Number (Dock 01 - 12)</label>
                  <select
                    value={editDock}
                    onChange={e => setEditDock(e.target.value)}
                    className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:outline-none focus:border-[#123B5D] dark:focus:border-indigo-500 font-bold text-amber-600 dark:text-amber-400 [&>option]:bg-[#1E293B] [&>option]:text-[#F8FAFC]"
                  >
                    {WAREHOUSE_DOCKS.map(dock => (
                      <option key={dock} value={dock} className="bg-[#1E293B] text-[#F8FAFC]">
                        {dock}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-primary mb-1">Expected Qty (Units)</label>
                  <input
                    type="number"
                    min={0}
                    value={editExpectedQty}
                    onChange={e => setEditExpectedQty(Number(e.target.value))}
                    className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:outline-none font-mono font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-primary mb-1">Return Channel</label>
                  <select
                    value={editChannel}
                    onChange={e => setEditChannel(e.target.value as any)}
                    className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:outline-none focus:border-[#123B5D] dark:focus:border-indigo-500 font-medium"
                  >
                    <option value="B2C Return">B2C Return</option>
                    <option value="D2C Return">D2C Return</option>
                    <option value="Marketplace Return">Marketplace Return</option>
                    <option value="Customer RTO">Customer RTO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-primary mb-1">Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Vehicle number, bay info, seal number, or supervisor notes..."
                  className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:outline-none placeholder:text-muted"
                />
              </div>

              <div className="pt-3 border-t border-theme flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBatch(null)}
                  className="px-4 py-2 rounded-xl bg-elevated hover:bg-surface text-secondary hover:text-primary font-bold border border-theme"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#123B5D] hover:bg-[#184C77] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE BATCH CONFIRMATION MODAL */}
      {batchToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-rose-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-theme bg-rose-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-primary">Delete Batch</h3>
                  <p className="text-xs text-secondary font-mono font-bold">
                    {batchToDelete.batchNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBatchToDelete(null)}
                className="p-1.5 rounded-lg bg-elevated hover:bg-surface text-secondary hover:text-primary border border-theme"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs">
              <p className="text-secondary leading-relaxed">
                Are you sure you want to permanently delete batch{' '}
                <strong className="text-primary font-mono">{batchToDelete.batchNumber}</strong>?
              </p>

              <div className="p-3 rounded-xl bg-elevated border border-theme space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-secondary">Account:</span>
                  <span className="font-bold text-primary">
                    {clients.find(c => c.id === batchToDelete.clientId)?.name || batchToDelete.clientName || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Courier:</span>
                  <span className="font-bold text-primary">
                    {couriers.find(cr => cr.id === batchToDelete.courierId)?.name || batchToDelete.courierName || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Dock:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {batchToDelete.dockNumber || 'Dock 01'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Scanned Items:</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    {batchToDelete.totalScanned || 0} units
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-[11px] leading-relaxed">
                Warning: All {batchToDelete.totalScanned || 0} scanned barcode items associated with this batch will also be permanently deleted and removed from synced devices.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBatchToDelete(null)}
                  className="px-4 py-2 rounded-xl bg-elevated hover:bg-surface text-secondary hover:text-primary font-bold border border-theme"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteBatch}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Batch</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
