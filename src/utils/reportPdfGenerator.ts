import { jsPDF } from 'jspdf';
import { Warehouse } from '../types';

export interface ReportPdfColumn {
  header: string;
  width: number; // in mm
  align?: 'left' | 'center' | 'right';
}

export interface ReportPdfConfig {
  title: string;
  subtitle: string;
  filename: string;
  warehouse?: Warehouse;
  summaryStats?: { label: string; value: string | number }[];
  columns: ReportPdfColumn[];
  rows: (string | number)[][];
  orientation?: 'portrait' | 'landscape';
}

export function generateGenericReportPDF(config: ReportPdfConfig) {
  const orientation = config.orientation || 'portrait';
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  const now = new Date();
  const formattedDate =
    now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const drawPageHeader = (isFirstPage: boolean) => {
    // Header Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, isFirstPage ? 24 : 14, 'F');

    // Accent line
    doc.setFillColor(139, 92, 246); // violet-500
    doc.rect(0, isFirstPage ? 24 : 14, pageWidth, 1.2, 'F');

    // Logo / Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFirstPage ? 13 : 10);
    doc.text('EMIZA WAREHOUSE OPERATIONS', margin, isFirstPage ? 10 : 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isFirstPage ? 8.5 : 7.5);
    doc.setTextColor(203, 213, 225); // slate-300
    const subtitle = config.warehouse
      ? `${config.title.toUpperCase()} — ${config.warehouse.name.toUpperCase()} (${config.warehouse.code})`
      : config.title.toUpperCase();
    doc.text(subtitle, margin, isFirstPage ? 17 : 12);

    // Timestamp on right
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${formattedDate}`, pageWidth - margin - (isFirstPage ? 55 : 45), isFirstPage ? 14 : 9);
  };

  drawPageHeader(true);

  let y = 30;

  // Render Summary Stats Cards on First Page if provided
  if (config.summaryStats && config.summaryStats.length > 0) {
    const statBoxWidth = (contentWidth - (config.summaryStats.length - 1) * 3) / config.summaryStats.length;
    const statBoxHeight = 13;

    doc.setFontSize(7.5);
    config.summaryStats.forEach((stat, idx) => {
      const boxX = margin + idx * (statBoxWidth + 3);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(boxX, y, statBoxWidth, statBoxHeight, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(stat.label.toUpperCase(), boxX + 3, y + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9.5);
      doc.text(String(stat.value), boxX + 3, y + 10.5);
    });

    y += statBoxHeight + 5;
  }

  // Calculate total columns width to scale proportionally if needed
  const totalSpecWidth = config.columns.reduce((sum, col) => sum + col.width, 0);
  const scale = contentWidth / totalSpecWidth;
  const colWidths = config.columns.map((c) => c.width * scale);

  const drawTableHeaders = (curY: number) => {
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, curY, contentWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let curX = margin;
    config.columns.forEach((col, idx) => {
      const w = colWidths[idx];
      const align = col.align || 'left';
      let textX = curX + 2;
      if (align === 'right') textX = curX + w - 2;
      else if (align === 'center') textX = curX + w / 2;

      doc.text(col.header, textX, curY + 4.8, { align });
      curX += w;
    });

    return curY + 7;
  };

  y = drawTableHeaders(y);

  // Table Body Rows
  const rowHeight = 6.2;
  config.rows.forEach((row, rowIdx) => {
    // Check if row exceeds printable height
    if (y + rowHeight > pageHeight - 14) {
      doc.addPage();
      drawPageHeader(false);
      y = 19;
      y = drawTableHeaders(y);
    }

    // Zebra striping
    if (rowIdx % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(248, 250, 252);
    }
    doc.rect(margin, y, contentWidth, rowHeight, 'F');

    // Row bottom border
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);

    let curX = margin;
    row.forEach((cellVal, colIdx) => {
      const w = colWidths[colIdx] || 20;
      const align = config.columns[colIdx]?.align || 'left';
      let textX = curX + 2;
      if (align === 'right') textX = curX + w - 2;
      else if (align === 'center') textX = curX + w / 2;

      const textVal = String(cellVal ?? '-');
      // Truncate text if too long
      const maxChars = Math.floor(w * 0.45) + 3;
      const safeText = textVal.length > maxChars ? textVal.substring(0, maxChars - 2) + '..' : textVal;

      doc.text(safeText, textX, y + 4.2, { align });
      curX += w;
    });

    y += rowHeight;
  });

  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);
    doc.text('Emiza Supply Chain Services Pvt Ltd — Warehouse Operations System', margin, pageHeight - 5);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin - 15, pageHeight - 5);
  }

  doc.save(config.filename.endsWith('.pdf') ? config.filename : `${config.filename}.pdf`);
}
