// CSV & PDF export utilities (no external deps)

export function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

export function downloadPDF(filename: string, title: string, headers: string[], rows: string[][]) {
  // Build a printable HTML table and use print-to-PDF
  const thStyle = "border:1px solid #ddd;padding:8px 12px;background:#f4f4f4;text-align:left;font-size:12px;font-weight:600;";
  const tdStyle = "border:1px solid #ddd;padding:6px 12px;font-size:11px;";

  const headerRow = headers.map(h => `<th style="${thStyle}">${h}</th>`).join("");
  const bodyRows = rows.map((row, i) => {
    const bg = i % 2 === 0 ? "" : "background:#fafafa;";
    return `<tr style="${bg}">${row.map(c => `<td style="${tdStyle}">${c}</td>`).join("")}</tr>`;
  }).join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @media print { body { margin: 0; } @page { margin: 1cm; } }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
        h1 { font-size: 18px; color: #1a365d; margin-bottom: 4px; }
        .meta { font-size: 11px; color: #718096; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; }
        .footer { margin-top: 20px; font-size: 10px; color: #a0aec0; text-align: center; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p class="meta">Generated on ${new Date().toLocaleString("en-IN")} · ${rows.length} records</p>
      <table>
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <p class="footer">CivicAI — Government Civic Management Platform</p>
      <script>window.onload = () => { window.print(); }</script>
    </body>
    </html>
  `;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
