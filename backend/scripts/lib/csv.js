const fs = require('fs');

/**
 * Parser CSV tối giản theo RFC 4180 (hỗ trợ dấu " bao quanh, dấu phẩy và xuống dòng
 * bên trong ô). Đủ dùng cho 6 file trong data2/ mà không cần thêm dependency.
 */
const parseCsv = (text) => {
  // Bỏ BOM nếu có (các file trong data2/ đều là utf-8-sig)
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
};

/** Đọc file CSV -> mảng object, key lấy từ dòng header. */
const readCsv = (filePath) => {
  const rows = parseCsv(fs.readFileSync(filePath, 'utf8')).filter(
    (r) => r.length > 1 || (r.length === 1 && r[0].trim() !== '')
  );
  const header = rows.shift().map((h) => h.trim());
  return rows.map((r) => {
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = (r[i] ?? '').trim();
    });
    return obj;
  });
};

const escapeCell = (value) => {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Ghi mảng object ra file CSV. */
const writeCsv = (filePath, header, rows) => {
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(header.map((h) => escapeCell(row[h])).join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
};

module.exports = { readCsv, writeCsv };
