/**
 * Master Data Import & Export Utilities
 * Provides CSV/TSV parsing, sample template generation, single-category export,
 * and multi-master full backup download.
 */

import { downloadCSV } from './csvExport';

export interface MasterColumnDef {
  key: string;
  label: string;
  required?: boolean;
  aliases?: string[];
  example: string | number | boolean;
  description: string;
}

export interface MasterCategoryConfig {
  id: string;
  label: string;
  singular: string;
  columns: MasterColumnDef[];
}

export const MASTER_CONFIGS: Record<string, MasterCategoryConfig> = {
  clients: {
    id: 'clients',
    label: 'Client / Brand Master',
    singular: 'Client',
    columns: [
      { key: 'code', label: 'Client Code', required: true, aliases: ['client_code', 'code', 'brand_code', 'client code'], example: 'CLI-BLV', description: 'Unique Client / Brand Identifier' },
      { key: 'name', label: 'Client / Brand Name', required: true, aliases: ['client_name', 'name', 'brand', 'brand_name', 'client name'], example: 'Bella Vita Organic', description: 'Brand or Client company name' },
      { key: 'category', label: 'Category', aliases: ['category', 'vertical', 'segment'], example: 'Personal Care', description: 'Product segment or retail vertical' },
      { key: 'email', label: 'Contact Email', aliases: ['email', 'email_address', 'contact_email'], example: 'ops@bellavita.in', description: 'Support or operations email' },
      { key: 'phone', label: 'Contact Phone', aliases: ['phone', 'contact', 'mobile', 'telephone'], example: '+91 98765 43210', description: 'Escalation phone number' },
      { key: 'status', label: 'Status', aliases: ['status', 'state'], example: 'Active', description: 'Active | On Hold | Inactive' },
    ],
  },
  couriers: {
    id: 'couriers',
    label: 'Courier Master',
    singular: 'Courier',
    columns: [
      { key: 'code', label: 'Courier Code', required: true, aliases: ['courier_code', 'code', 'courier code'], example: 'DELHIVERY', description: 'Unique carrier code' },
      { key: 'name', label: 'Courier Partner Name', required: true, aliases: ['courier_name', 'name', 'courier name'], example: 'Delhivery Surface Express', description: 'Full logistics partner name' },
      { key: 'trackingFormatPattern', label: 'Tracking Format Pattern', aliases: ['pattern', 'tracking_format', 'awb_format', 'format'], example: 'AWB 10-14 DIGITS', description: 'Expected AWB regex or pattern' },
      { key: 'contactNumber', label: 'Helpline / Contact', aliases: ['contact', 'phone', 'helpline', 'contact_number'], example: '+91 124 6719500', description: 'Logistics partner helpline' },
      { key: 'apiSupported', label: 'API Supported (True/False)', aliases: ['api_supported', 'api', 'is_api'], example: 'TRUE', description: 'Whether live webhook/API tracking is enabled' },
      { key: 'status', label: 'Status', aliases: ['status'], example: 'Active', description: 'Active | On Hold | Inactive' },
    ],
  },
  skus: {
    id: 'skus',
    label: 'SKU / Item Master',
    singular: 'SKU Item',
    columns: [
      { key: 'skuCode', label: 'SKU Code', required: true, aliases: ['sku_code', 'sku', 'sku code', 'item_code'], example: 'BLV-PERF-100ML', description: 'Unique product stock keeping unit' },
      { key: 'name', label: 'Product Name', required: true, aliases: ['product_name', 'name', 'item_name', 'title'], example: 'Bella Vita CEO Man Perfume 100ml', description: 'Full descriptive title' },
      { key: 'eanBarcode', label: 'Barcode / EAN', aliases: ['ean_barcode', 'ean', 'barcode', 'upc'], example: '8906105610012', description: 'EAN-13 or 1D barcode' },
      { key: 'clientCode', label: 'Client / Brand Code', aliases: ['client_code', 'client code', 'brand_code'], example: 'CLI-BLV', description: 'Associated brand client code' },
      { key: 'category', label: 'Category', aliases: ['category', 'sub_category'], example: 'Fragrances', description: 'Product category' },
      { key: 'unitPrice', label: 'Unit Price (INR)', aliases: ['unit_price', 'price', 'mrp', 'rate'], example: 699, description: 'Product selling price or MRP' },
      { key: 'weightGrams', label: 'Weight (Grams)', aliases: ['weight', 'weight_grams', 'weight_g'], example: 250, description: 'Gross product package weight in grams' },
      { key: 'status', label: 'Status', aliases: ['status'], example: 'Active', description: 'Active | On Hold | Inactive' },
    ],
  },
  warehouses: {
    id: 'warehouses',
    label: 'Warehouse Facility Master',
    singular: 'Warehouse Facility',
    columns: [
      { key: 'code', label: 'Warehouse Code', required: true, aliases: ['wh_code', 'code', 'facility_code'], example: 'WH-DEL-01', description: 'Facility unique code' },
      { key: 'name', label: 'Warehouse Name', required: true, aliases: ['wh_name', 'name', 'warehouse_name'], example: 'Delhi NCR Central Fulfilment Centre', description: 'Full facility name' },
      { key: 'city', label: 'City', required: true, aliases: ['city', 'location'], example: 'Gurugram', description: 'City location' },
      { key: 'address', label: 'Full Address', aliases: ['address', 'street'], example: 'Plot 45, Sector 8, IMT Manesar', description: 'Physical address' },
      { key: 'totalDocks', label: 'Total Inbound Docks', aliases: ['docks', 'total_docks', 'inbound_docks'], example: 12, description: 'Number of active docking bays' },
      { key: 'status', label: 'Status', aliases: ['status'], example: 'Active', description: 'Active | On Hold | Inactive' },
    ],
  },
  drivers: {
    id: 'drivers',
    label: 'Driver Master',
    singular: 'Driver',
    columns: [
      { key: 'name', label: 'Driver Full Name', required: true, aliases: ['driver_name', 'name'], example: 'Ramesh Singh', description: 'Commercial vehicle driver name' },
      { key: 'mobile', label: 'Mobile Number', required: true, aliases: ['mobile', 'phone', 'contact'], example: '+91 98111 22334', description: '10-digit mobile number' },
      { key: 'licenseNumber', label: 'Driving License No.', aliases: ['license', 'license_number', 'dl_number'], example: 'DL-0420180099887', description: 'RTO issued commercial driving license' },
      { key: 'transporterName', label: 'Transporter / Courier', aliases: ['transporter', 'transporter_name', 'agency'], example: 'Delhivery Surface Express', description: 'Transport logistics company' },
      { key: 'status', label: 'Status', aliases: ['status'], example: 'Active', description: 'Active | Inactive' },
    ],
  },
  vehicle_types: {
    id: 'vehicle_types',
    label: 'Vehicle Types Master',
    singular: 'Vehicle Type',
    columns: [
      { key: 'typeName', label: 'Vehicle Type Name', required: true, aliases: ['type_name', 'name', 'vehicle_type'], example: 'Tata 407 (14 Ft Closed Container)', description: 'Vehicle classification' },
      { key: 'capacityTons', label: 'Payload Capacity (Tons)', aliases: ['capacity', 'capacity_tons', 'payload'], example: 3.5, description: 'Weight capacity rating in metric tons' },
      { key: 'status', label: 'Status', aliases: ['status'], example: 'Active', description: 'Active | Inactive' },
    ],
  },
  return_reasons: {
    id: 'return_reasons',
    label: 'Return Conditions (7 Parameters)',
    singular: 'Return Reason',
    columns: [
      { key: 'code', label: 'Condition Code', required: true, aliases: ['reason_code', 'code'], example: 'REASON-DAMAGED', description: 'Unique condition code' },
      { key: 'label', label: 'Condition Label', required: true, aliases: ['label', 'name', 'condition_name'], example: 'Damaged Outer Box', description: 'QC inspection verdict label' },
      { key: 'category', label: 'Return Scope (RTO/B2B/Both)', aliases: ['scope', 'category'], example: 'Both', description: 'RTO | B2B | Both' },
      { key: 'requirePhoto', label: 'Require Photo Proof (True/False)', aliases: ['require_photo', 'photo_mandatory'], example: 'TRUE', description: 'Whether inspector must capture camera photo' },
      { key: 'status', label: 'Status', aliases: ['status'], example: 'Active', description: 'Active | Inactive' },
    ],
  },
  companies: {
    id: 'companies',
    label: 'Company Master',
    singular: 'Company',
    columns: [
      { key: 'code', label: 'Company Code', required: true, aliases: ['company_code', 'code'], example: 'COMP-EMZ', description: 'Corporate entity code' },
      { key: 'name', label: 'Company Legal Name', required: true, aliases: ['company_name', 'name'], example: 'Emiza Supply Chain Services Pvt Ltd', description: 'Registered business name' },
      { key: 'gstNumber', label: 'GSTIN Number', aliases: ['gst', 'gst_number', 'gstin'], example: '27AABCE1234F1Z5', description: '15-digit GST registration' },
      { key: 'pan', label: 'PAN Card Number', aliases: ['pan', 'pan_number'], example: 'AABCE1234F', description: '10-character PAN' },
      { key: 'address', label: 'Registered Address', aliases: ['address'], example: 'Andheri East, Mumbai, Maharashtra', description: 'Headquarters corporate address' },
      { key: 'status', label: 'Status', aliases: ['status'], example: 'Active', description: 'Active | Inactive' },
    ],
  },
  users: {
    id: 'users',
    label: 'User Master & Access Control',
    singular: 'User Account',
    columns: [
      { key: 'empId', label: 'Employee ID', required: true, aliases: ['emp_id', 'employee_id', 'id'], example: 'EMP-1045', description: 'Unique staff corporate ID' },
      { key: 'name', label: 'Full Name', required: true, aliases: ['name', 'full_name'], example: 'Amit Kumar Sharma', description: 'Employee name' },
      { key: 'email', label: 'Work Email', required: true, aliases: ['email', 'work_email'], example: 'amit.sharma@emizainc.com', description: 'Corporate login email' },
      { key: 'phone', label: 'Phone Number', aliases: ['phone', 'mobile'], example: '+91 98200 11223', description: 'Mobile contact' },
      { key: 'role', label: 'System Role', aliases: ['role', 'user_role'], example: 'Supervisor', description: 'Super Admin | Warehouse Manager | Supervisor | Security | Inventory Executive' },
      { key: 'department', label: 'Department', aliases: ['department', 'dept'], example: 'Returns & QC Operations', description: 'Operational unit' },
      { key: 'status', label: 'Status', aliases: ['status'], example: 'Active', description: 'Active | Inactive' },
    ],
  },
};

/**
 * Generate CSV template for a given master category with sample data
 */
export function generateMasterSampleCSV(category: string): string {
  const config = MASTER_CONFIGS[category];
  if (!config) return '';

  const headers = config.columns.map(c => `"${c.label}"`).join(',');
  const sampleRow1 = config.columns.map(c => {
    const val = c.example;
    return typeof val === 'string' ? `"${val}"` : val;
  }).join(',');

  return `${headers}\r\n${sampleRow1}\r\n`;
}

/**
 * Trigger download of a sample CSV template for master import
 */
export function downloadMasterTemplate(category: string) {
  const config = MASTER_CONFIGS[category];
  if (!config) return;

  const content = generateMasterSampleCSV(category);
  const filename = `Sample_${config.singular.replace(/\s+/g, '_')}_Import_Template.csv`;
  downloadCSV(filename, content);
}

/**
 * Export all rows of a Master category to CSV
 */
export function exportMasterToCSV(category: string, data: any[]) {
  const config = MASTER_CONFIGS[category];
  if (!config || !Array.isArray(data)) return;

  const headers = config.columns.map(c => `"${c.label}"`).join(',');

  const rows = data.map(item => {
    return config.columns.map(col => {
      let val = item[col.key];

      // Special resolution for SKUs client code
      if (col.key === 'clientCode' && !val && item.clientName) {
        val = item.clientName;
      }
      if (val === undefined || val === null) {
        val = '';
      }
      if (typeof val === 'boolean') {
        val = val ? 'TRUE' : 'FALSE';
      }
      const strVal = String(val).replace(/"/g, '""');
      return `"${strVal}"`;
    }).join(',');
  });

  const csvContent = [headers, ...rows].join('\r\n');
  const filename = `${config.singular.replace(/\s+/g, '_')}_Master_Export_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCSV(filename, csvContent);
}

/**
 * Export full Master Database as JSON for total backup
 */
export function exportAllMastersJSON(allMasters: Record<string, any[]>) {
  const backup = {
    exportedAt: new Date().toISOString(),
    version: '2.0',
    platform: 'WOP-Emiza Master Operations',
    categories: allMasters,
  };
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `WOP_Full_Masters_Backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Robust CSV/TSV parser supporting quoted multi-line fields
 */
export function parseDelimitedText(text: string): string[][] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!clean.trim()) return [];

  // Detect delimiter: tab or comma
  const firstLine = clean.split('\n')[0] || '';
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export interface ParseResult {
  records: any[];
  errors: string[];
  warnings: string[];
  totalRows: number;
}

/**
 * Parse raw CSV/TSV text into validated Master records
 */
export function parseMasterCSV(
  category: string,
  rawText: string,
  context?: { clients?: any[]; couriers?: any[]; companies?: any[]; warehouses?: any[] }
): ParseResult {
  const config = MASTER_CONFIGS[category];
  const errors: string[] = [];
  const warnings: string[] = [];
  const records: any[] = [];

  if (!config) {
    return { records: [], errors: [`Unknown master category: "${category}"`], warnings: [], totalRows: 0 };
  }

  const rawRows = parseDelimitedText(rawText);
  if (rawRows.length < 2) {
    return {
      records: [],
      errors: ['File is empty or contains only a single row. At least one header row and one data row are required.'],
      warnings: [],
      totalRows: 0,
    };
  }

  const headerRow = rawRows[0].map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

  // Map header column indices to MasterColumnDef keys
  const colIndexToKey: Record<number, string> = {};
  config.columns.forEach(col => {
    const aliases = [
      col.key.toLowerCase(),
      col.label.toLowerCase().replace(/[^a-z0-9]/g, ''),
      ...(col.aliases || []).map(a => a.toLowerCase().replace(/[^a-z0-9]/g, '')),
    ];

    const foundIdx = headerRow.findIndex(h => aliases.includes(h));
    if (foundIdx !== -1) {
      colIndexToKey[foundIdx] = col.key;
    }
  });

  // Verify all required columns are mapped
  const mappedKeys = new Set(Object.values(colIndexToKey));
  const missingRequired = config.columns.filter(c => c.required && !mappedKeys.has(c.key));

  if (missingRequired.length > 0) {
    return {
      records: [],
      errors: [
        `Missing required column(s): ${missingRequired.map(c => `"${c.label}"`).join(', ')}. Please use the template or ensure headers match.`,
      ],
      warnings: [],
      totalRows: rawRows.length - 1,
    };
  }

  const dataRows = rawRows.slice(1);
  const now = Date.now();

  dataRows.forEach((row, rowIdx) => {
    const rowNum = rowIdx + 2; // 1-based index including header
    if (!row.some(cell => cell.trim().length > 0)) {
      return; // skip empty lines
    }

    const item: Record<string, any> = {
      id: `${category.slice(0, 3)}-imp-${now}-${rowIdx}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    row.forEach((cell, idx) => {
      const key = colIndexToKey[idx];
      if (key) {
        item[key] = cell;
      }
    });

    // Validations & Conversions
    if (config.id === 'clients') {
      if (!item.name || !item.code) {
        warnings.push(`Row ${rowNum}: Skipped — Client Name and Code are mandatory.`);
        return;
      }
      item.code = String(item.code).toUpperCase().trim();
      item.category = item.category || 'General';
      item.email = item.email || `ops@${item.code.toLowerCase().replace(/[^a-z0-9]/g, '')}.in`;
      item.phone = item.phone || '+91 22 4000 0000';
      item.companyId = context?.companies?.[0]?.id || 'comp-1';
    } else if (config.id === 'couriers') {
      if (!item.name || !item.code) {
        warnings.push(`Row ${rowNum}: Skipped — Courier Partner Name and Code are mandatory.`);
        return;
      }
      item.code = String(item.code).toUpperCase().trim();
      item.trackingFormatPattern = item.trackingFormatPattern || 'AWB 10-14 DIGITS';
      item.contactNumber = item.contactNumber || '+91 1800 000 000';
      item.apiSupported = String(item.apiSupported).toUpperCase() !== 'FALSE';
    } else if (config.id === 'skus') {
      if (!item.skuCode || !item.name) {
        warnings.push(`Row ${rowNum}: Skipped — SKU Code and Product Name are mandatory.`);
        return;
      }
      item.skuCode = String(item.skuCode).toUpperCase().trim();
      item.unitPrice = Number(item.unitPrice) || 499;
      item.weightGrams = Number(item.weightGrams) || 100;
      item.category = item.category || 'General Merchandise';

      // Match client if provided
      if (item.clientCode && context?.clients) {
        const found = context.clients.find(
          c => c.code.toLowerCase() === String(item.clientCode).toLowerCase() ||
               c.name.toLowerCase() === String(item.clientCode).toLowerCase()
        );
        if (found) {
          item.clientId = found.id;
          item.clientName = found.name;
        }
      }
      if (!item.clientId && context?.clients?.[0]) {
        item.clientId = context.clients[0].id;
        item.clientName = context.clients[0].name;
      }
    } else if (config.id === 'warehouses') {
      if (!item.code || !item.name) {
        warnings.push(`Row ${rowNum}: Skipped — Warehouse Code and Name are mandatory.`);
        return;
      }
      item.code = String(item.code).toUpperCase().trim();
      item.city = item.city || 'Metro';
      item.totalDocks = Number(item.totalDocks) || 8;
      item.companyId = context?.companies?.[0]?.id || 'comp-1';
    } else if (config.id === 'drivers') {
      if (!item.name || !item.mobile) {
        warnings.push(`Row ${rowNum}: Skipped — Driver Name and Mobile Number are required.`);
        return;
      }
      item.transporterName = item.transporterName || context?.couriers?.[0]?.name || 'Logistics Fleet';
    } else if (config.id === 'vehicle_types') {
      if (!item.typeName) {
        warnings.push(`Row ${rowNum}: Skipped — Vehicle Type Name is required.`);
        return;
      }
      item.capacityTons = Number(item.capacityTons) || 3.5;
    } else if (config.id === 'return_reasons') {
      if (!item.code || !item.label) {
        warnings.push(`Row ${rowNum}: Skipped — Reason Code and Label are required.`);
        return;
      }
      item.code = String(item.code).toUpperCase().trim();
      item.category = item.category || 'Both';
      item.requirePhoto = String(item.requirePhoto).toUpperCase() === 'TRUE';
    } else if (config.id === 'companies') {
      if (!item.code || !item.name) {
        warnings.push(`Row ${rowNum}: Skipped — Company Code and Legal Name are required.`);
        return;
      }
      item.code = String(item.code).toUpperCase().trim();
    } else if (config.id === 'users') {
      if (!item.empId || !item.name || !item.email) {
        warnings.push(`Row ${rowNum}: Skipped — Employee ID, Name, and Email are required.`);
        return;
      }
      item.role = item.role || 'Supervisor';
      item.department = item.department || 'Operations Management';
      item.password = item.password || 'password123';
      item.companyId = context?.companies?.[0]?.id || 'comp-1';
      item.assignedWarehouseIds = [context?.warehouses?.[0]?.id || 'wh-main'];
      item.assignedClientIds = (context?.clients || []).map(c => c.id);
    }

    records.push(item);
  });

  return {
    records,
    errors,
    warnings,
    totalRows: dataRows.length,
  };
}
