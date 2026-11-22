import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Layers,
  Database,
  RefreshCw,
  Eye,
  Info,
} from 'lucide-react';
import {
  MASTER_CONFIGS,
  downloadMasterTemplate,
  exportMasterToCSV,
  exportAllMastersJSON,
  parseMasterCSV,
  ParseResult,
} from '../utils/masterImportExport';
import { Company, Warehouse, Client, Courier, SKU, User, Driver, VehicleType, ReturnReason } from '../types';

interface MasterImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory: string;
  companies: Company[];
  warehouses: Warehouse[];
  clients: Client[];
  couriers: Courier[];
  skus: SKU[];
  users: User[];
  drivers: Driver[];
  vehicleTypes: VehicleType[];
  returnReasons: ReturnReason[];
  onBulkAddMasterRecords: (category: string, records: any[]) => void;
}

export const MasterImportExportModal: React.FC<MasterImportExportModalProps> = ({
  isOpen,
  onClose,
  defaultCategory,
  companies,
  warehouses,
  clients,
  couriers,
  skus,
  users,
  drivers,
  vehicleTypes,
  returnReasons,
  onBulkAddMasterRecords,
}) => {
  const [modalTab, setModalTab] = useState<'import' | 'export'>('import');
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultCategory || 'clients');
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip' | 'update' | 'add_all'>('skip');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const currentConfig = MASTER_CONFIGS[selectedCategory] || MASTER_CONFIGS['clients'];

  // Master records map for counts and exports
  const mastersMap: Record<string, any[]> = {
    clients,
    couriers,
    skus,
    warehouses,
    drivers,
    vehicle_types: vehicleTypes,
    return_reasons: returnReasons,
    companies,
    users,
  };

  const currentExistingList = mastersMap[selectedCategory] || [];

  const handleCategoryChange = (newCategory: string) => {
    setSelectedCategory(newCategory);
    setParseResult(null);
    setSelectedFileName('');
    setPastedText('');
    setImportSuccessMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Process text or file content
  const processRawData = (text: string) => {
    if (!text.trim()) {
      setParseResult(null);
      return;
    }

    const context = {
      clients,
      couriers,
      companies,
      warehouses,
    };

    const result = parseMasterCSV(selectedCategory, text, context);
    setParseResult(result);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setImportSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      processRawData(content || '');
    };
    reader.readAsText(file);
  };

  const handlePasteChange = (val: string) => {
    setPastedText(val);
    setImportSuccessMessage(null);
    processRawData(val);
  };

  // Execute Bulk Import
  const handleExecuteImport = () => {
    if (!parseResult || parseResult.records.length === 0) return;

    setIsProcessing(true);

    try {
      let recordsToInsert = [...parseResult.records];

      // Identify duplicate keys
      const existing = mastersMap[selectedCategory] || [];
      const codeKey = selectedCategory === 'users' ? 'empId' : selectedCategory === 'skus' ? 'skuCode' : selectedCategory === 'vehicle_types' ? 'typeName' : 'code';

      const existingCodes = new Set(
        existing.map(item => String(item[codeKey] || item.name || '').trim().toLowerCase())
      );

      if (duplicatePolicy === 'skip') {
        recordsToInsert = recordsToInsert.filter(rec => {
          const recCode = String(rec[codeKey] || rec.name || '').trim().toLowerCase();
          return !existingCodes.has(recCode);
        });
      }

      if (recordsToInsert.length === 0) {
        setImportSuccessMessage(null);
        setParseResult(prev => prev ? { ...prev, errors: [...prev.errors, 'All records in this import already exist in the master database and were skipped.'] } : null);
        setIsProcessing(false);
        return;
      }

      onBulkAddMasterRecords(selectedCategory, recordsToInsert);

      setImportSuccessMessage(
        `Successfully imported ${recordsToInsert.length} new ${currentConfig.singular} record(s) into ${currentConfig.label}!`
      );
      setParseResult(null);
      setPastedText('');
      setSelectedFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setImportSuccessMessage(null);
      setParseResult(prev => prev ? { ...prev, errors: [...prev.errors, `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`] } : null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131E32]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Master Data Import &amp; Export Center
              </h2>
              <p className="text-xs text-slate-400">
                Bulk upload new masters or export existing master datasets to CSV / Excel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch */}
            <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setModalTab('import');
                  setImportSuccessMessage(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  modalTab === 'import'
                    ? 'bg-[#7C3AED] text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import Data</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalTab('export');
                  setImportSuccessMessage(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  modalTab === 'export'
                    ? 'bg-[#7C3AED] text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Data</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Success Banner */}
          {importSuccessMessage && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span className="font-semibold">{importSuccessMessage}</span>
              </div>
              <button
                onClick={() => setImportSuccessMessage(null)}
                className="text-emerald-400 hover:text-emerald-300 font-bold"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Master Category Selector */}
          <div className="bg-[#162032] p-4 rounded-xl border border-slate-800 space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Select Target Master Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {Object.values(MASTER_CONFIGS).map(cfg => {
                const count = mastersMap[cfg.id]?.length || 0;
                const isSelected = selectedCategory === cfg.id;
                return (
                  <button
                    key={cfg.id}
                    type="button"
                    onClick={() => handleCategoryChange(cfg.id)}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-purple-600/20 border-purple-500/60 text-white shadow-xs'
                        : 'bg-[#0F172A] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold leading-snug truncate">{cfg.label}</span>
                    <span className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>{count} current</span>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-purple-400 shrink-0" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* IMPORT TAB CONTENT */}
          {modalTab === 'import' && (
            <div className="space-y-5">
              {/* Template Download & Instructions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40">
                <div className="flex items-start gap-2.5 text-xs text-purple-200/90">
                  <Info className="w-4 h-4 shrink-0 text-purple-400 mt-0.5" />
                  <div>
                    <span className="font-bold text-purple-300">Need the correct column structure?</span>
                    <p className="text-[11px] text-purple-300/80 mt-0.5">
                      Download the pre-formatted CSV template with sample rows for {currentConfig.label}.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => downloadMasterTemplate(selectedCategory)}
                  className="px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/50 text-purple-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-purple-300" />
                  <span>Download Sample CSV</span>
                </button>
              </div>

              {/* Input Mode Selector: File or Paste */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Provide Master Data
                  </span>
                  <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setInputMode('file')}
                      className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                        inputMode === 'file' ? 'bg-[#7C3AED] text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Upload File (.csv)
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('paste')}
                      className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                        inputMode === 'paste' ? 'bg-[#7C3AED] text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Paste Text / Excel
                    </button>
                  </div>
                </div>

                {inputMode === 'file' ? (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv, .tsv, .txt"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="master-file-upload"
                    />
                    <label
                      htmlFor="master-file-upload"
                      className="border-2 border-dashed border-slate-700 hover:border-purple-500/70 bg-[#0F172A]/80 hover:bg-[#0F172A] rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all group text-center"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-purple-600/10 group-hover:bg-purple-600/20 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3 transition-colors">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-bold text-slate-200 group-hover:text-white">
                        {selectedFileName ? selectedFileName : 'Click to browse or drag & drop CSV / TSV file'}
                      </span>
                      <span className="text-xs text-slate-500 mt-1">
                        Supports CSV exported from Excel, Google Sheets, or ERP systems
                      </span>
                    </label>
                  </div>
                ) : (
                  <div>
                    <textarea
                      rows={5}
                      placeholder={`Paste comma-separated or tab-separated rows copied from Excel or Sheets here...\nExample:\nClient Code,Client / Brand Name,Category,Contact Email,Contact Phone\nCLI-999,Sample Brand,Personal Care,info@brand.com,+91 99999 88888`}
                      value={pastedText}
                      onChange={e => handlePasteChange(e.target.value)}
                      className="w-full bg-[#0F172A] border border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-200 font-mono focus:border-purple-500 focus:outline-none placeholder:text-slate-600"
                    />
                  </div>
                )}
              </div>

              {/* Parsing Results & Preview */}
              {parseResult && (
                <div className="space-y-4 pt-2 border-t border-slate-800">
                  {/* Parsing Errors */}
                  {parseResult.errors.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" /> Import Blocked by Errors:
                      </div>
                      {parseResult.errors.map((err, idx) => (
                        <p key={idx} className="pl-5 text-[11px] leading-relaxed">
                          &bull; {err}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Parsing Warnings */}
                  {parseResult.warnings.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Notice: {parseResult.warnings.length} row(s)
                        skipped or adjusted
                      </div>
                      <div className="max-h-24 overflow-y-auto pl-5 space-y-0.5 text-[11px] text-amber-200/90">
                        {parseResult.warnings.slice(0, 5).map((w, idx) => (
                          <div key={idx}>&bull; {w}</div>
                        ))}
                        {parseResult.warnings.length > 5 && (
                          <div>... and {parseResult.warnings.length - 5} more warnings</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Summary & Deduplication Policy */}
                  {parseResult.records.length > 0 && (
                    <div className="bg-[#131E32] p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Ready to Import: {parseResult.records.length} Valid Record(s)</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Total rows detected in source: {parseResult.totalRows}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 font-medium">Duplicate handling:</span>
                        <select
                          value={duplicatePolicy}
                          onChange={e => setDuplicatePolicy(e.target.value as any)}
                          className="bg-[#0F172A] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                        >
                          <option value="skip">Skip Existing Codes</option>
                          <option value="add_all">Import All (Keep Both)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Preview Table (First 5 records) */}
                  {parseResult.records.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold flex items-center gap-1 text-slate-300">
                          <Eye className="w-3.5 h-3.5 text-purple-400" /> Preview First 5 Parsed Records:
                        </span>
                        <span>Showing max 5 of {parseResult.records.length}</span>
                      </div>

                      <div className="overflow-x-auto border border-slate-800 rounded-xl bg-[#0F172A]">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-[#162032] text-slate-400 uppercase font-semibold border-b border-slate-800">
                            <tr>
                              <th className="px-3 py-2">#</th>
                              {currentConfig.columns.map(col => (
                                <th key={col.key} className="px-3 py-2 whitespace-nowrap">
                                  {col.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 text-slate-300">
                            {parseResult.records.slice(0, 5).map((rec, i) => (
                              <tr key={i} className="hover:bg-slate-800/40">
                                <td className="px-3 py-2 font-mono text-slate-500">{i + 1}</td>
                                {currentConfig.columns.map(col => (
                                  <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                                    {String(rec[col.key] || '—')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* EXPORT TAB CONTENT */}
          {modalTab === 'export' && (
            <div className="space-y-5">
              <div className="bg-[#162032] p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      Export Current Active Master: {currentConfig.label}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Download all {currentExistingList.length} current record(s) formatted with full headers.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => exportMasterToCSV(selectedCategory, currentExistingList)}
                    disabled={currentExistingList.length === 0}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shrink-0 shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download {currentConfig.singular} CSV</span>
                  </button>
                </div>
              </div>

              {/* Full System Masters Backup */}
              <div className="bg-[#162032] p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Database className="w-4 h-4 text-purple-400" />
                      Full System Masters Backup (All Categories)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Download a consolidated JSON backup of all 9 master categories (clients, couriers, SKUs, warehouses, users, drivers, etc.).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => exportAllMastersJSON(mastersMap)}
                    className="px-4 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shrink-0 shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Backup All Masters</span>
                  </button>
                </div>

                {/* Categories Table Quick Download */}
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0F172A]">
                  <div className="px-4 py-2.5 bg-[#131E32] text-xs font-bold text-slate-300 border-b border-slate-800">
                    Direct One-Click Category CSV Downloads:
                  </div>
                  <div className="divide-y divide-slate-800 max-h-60 overflow-y-auto">
                    {Object.values(MASTER_CONFIGS).map(cfg => {
                      const data = mastersMap[cfg.id] || [];
                      return (
                        <div
                          key={cfg.id}
                          className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-800/40 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-200">{cfg.label}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400">
                              {data.length} records
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => exportMasterToCSV(cfg.id, data)}
                            disabled={data.length === 0}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
                          >
                            <Download className="w-3 h-3 text-emerald-400" />
                            <span>Export CSV</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#131E32] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>

          {modalTab === 'import' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isProcessing || !parseResult || parseResult.records.length === 0 || parseResult.errors.length > 0}
                className="px-5 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>
                      Import {parseResult?.records?.length || 0} {currentConfig.singular} Record(s)
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
