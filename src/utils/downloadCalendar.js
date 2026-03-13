const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const THEMES = {
  light: {
    bg:           '#ffffff',
    dotGrid:      'rgba(100,100,120,0.05)',
    titleText:    '#1e1e48',
    subtitleText: '#7a85a8',
    legendText:   '#2a2a54',
    cardBg:       '#f7f8f9',
    cardBorder:   'rgba(120,120,200,0.12)',
    cardShadow:   'rgba(60,60,120,0.10)',
    headingBg:    '#eeeff0',
    headingText:  '#1e1e48',
    dayName:      '#8890b0',
    day:          '#2a2a54',
    dayOut:       '#c8cad8',
    cellText:     '#fff',
    watermark:    'rgba(130,140,180,0.40)',
  },
  dark: {
    bg:           '#1a1a1a',
    dotGrid:      'rgba(255,255,255,0.03)',
    titleText:    '#ede8e0',
    subtitleText: '#7a756e',
    legendText:   '#d4cfc8',
    cardBg:       '#242424',
    cardBorder:   'rgba(255,255,255,0.06)',
    cardShadow:   'rgba(0,0,0,0.40)',
    headingBg:    '#2e2e2e',
    headingText:  '#ede8e0',
    dayName:      '#6e6860',
    day:          '#d4cfc8',
    dayOut:       '#3a3a3a',
    cellText:     '#fff',
    watermark:    'rgba(180,170,160,0.30)',
  },
};

function parseDate(str) {
  const [m, d, y] = str.split('/').map(Number);
  return new Date(y, m - 1, d);
}

function getMonthsBetween(start, end) {
  const months = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function toKey(date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function downloadCalendar({ calendarName, startDate, endDate, labels, dateMappings, darkMode }) {
  const C = darkMode ? THEMES.dark : THEMES.light;

  const rangeStart = parseDate(startDate);
  const rangeEnd = parseDate(endDate);
  const months = getMonthsBetween(rangeStart, rangeEnd);
  if (months.length === 0) return;

  const labelMap = Object.fromEntries(labels.map(l => [l.id, l]));
  const usedLabels = labels;

  const labelCounts = {};
  labels.forEach(l => { labelCounts[l.id] = 0; });
  Object.entries(dateMappings).forEach(([key, labelId]) => {
    const d = parseDate(key);
    if (d >= rangeStart && d <= rangeEnd && labelCounts[labelId] !== undefined) {
      labelCounts[labelId]++;
    }
  });

  // ── Layout constants ──────────────────────────────────────────
  const CELL = 34;
  const CELL_STEP = CELL;
  const MONTH_W = CELL_STEP * 7;
  const MONTH_HEADER_H = 44;
  const DAY_HEADER_H = 26;
  const GRID_H = CELL_STEP * 6;
  const MONTH_H = MONTH_HEADER_H + DAY_HEADER_H + GRID_H;
  const CARD_PAD = 14;
  const CARD_W = MONTH_W + CARD_PAD * 2;
  const CARD_H = MONTH_H + CARD_PAD * 2;

  const COLS = Math.min(months.length, 4);
  const ROWS = Math.ceil(months.length / COLS);
  const GAP = 14;
  const OUTER_PAD = 30;
  const TITLE_H = 100;

  const W = COLS * CARD_W + (COLS - 1) * GAP + OUTER_PAD * 2;

  // ── Chip flow layout ──────────────────────────────────────────
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const CHIP_SWATCH = 17;
  const CHIP_SWATCH_GAP = 6;
  const CHIP_ROW_H = 30;
  const CHIP_GAP_X = 22;
  const CHIP_GAP_Y = 6;
  const AVAIL_W = W - OUTER_PAD * 2;

  const tmpCtx = document.createElement('canvas').getContext('2d');
  tmpCtx.font = `15px ${FONT}`;
  const chipLabels = usedLabels.map(l => `${l.name} (${labelCounts[l.id] ?? 0})`);
  const chipWidths = chipLabels.map(text => CHIP_SWATCH + CHIP_SWATCH_GAP + tmpCtx.measureText(text).width);

  const chipPositions = [];
  let curX = 0; let curRow = 0;
  chipWidths.forEach((cw, i) => {
    if (i > 0 && curX + CHIP_GAP_X + cw > AVAIL_W) { curRow++; curX = 0; }
    chipPositions.push({ x: curX, row: curRow });
    curX += cw + CHIP_GAP_X;
  });
  const rowWidths = [];
  chipPositions.forEach(({ x, row }, i) => { rowWidths[row] = x + chipWidths[i]; });
  chipPositions.forEach(p => { p.x += (AVAIL_W - rowWidths[p.row]) / 2; });

  const chipRows = usedLabels.length > 0 ? curRow + 1 : 0;
  const LEGEND_H = chipRows > 0 ? 20 + chipRows * CHIP_ROW_H + (chipRows - 1) * CHIP_GAP_Y + 12 : 0;

  const CALENDARS_Y = TITLE_H + LEGEND_H;
  const H = CALENDARS_Y + ROWS * CARD_H + (ROWS - 1) * GAP + OUTER_PAD * 2;

  // ── Canvas setup ──────────────────────────────────────────────
  const DPR = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  // ── Background ────────────────────────────────────────────────
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = C.dotGrid;
  for (let x = OUTER_PAD; x < W - OUTER_PAD; x += 18) {
    for (let y = OUTER_PAD; y < H - OUTER_PAD; y += 18) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Title ─────────────────────────────────────────────────────
  ctx.textAlign = 'center';
  ctx.fillStyle = C.titleText;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(calendarName, W / 2, OUTER_PAD + 32);

  const totalHighlighted = Object.values(labelCounts).reduce((s, n) => s + n, 0);
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const rangeLabel = `${fmt(rangeStart)} to ${fmt(rangeEnd)}`;
  ctx.fillStyle = C.subtitleText;
  ctx.font = `15px ${FONT}`;
  ctx.fillText(`${rangeLabel}  |  ${totalHighlighted} day${totalHighlighted !== 1 ? 's' : ''} highlighted`, W / 2, OUTER_PAD + 58);

  // ── Legend ────────────────────────────────────────────────────
  if (usedLabels.length > 0) {
    const legendTop = TITLE_H;
    usedLabels.forEach((label, i) => {
      const { x, row } = chipPositions[i];
      const lx = OUTER_PAD + x;
      const ly = legendTop + row * (CHIP_ROW_H + CHIP_GAP_Y);

      ctx.fillStyle = label.color;
      rr(ctx, lx, ly + (CHIP_ROW_H - CHIP_SWATCH) / 2, CHIP_SWATCH, CHIP_SWATCH, 5);
      ctx.fill();

      ctx.fillStyle = C.legendText;
      ctx.font = `15px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(chipLabels[i], lx + CHIP_SWATCH + CHIP_SWATCH_GAP, ly + CHIP_ROW_H / 2 + 5);
    });
  }

  // ── Month cards ───────────────────────────────────────────────
  months.forEach(({ year, month }, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cardX = OUTER_PAD + col * (CARD_W + GAP);
    const cardY = CALENDARS_Y + row * (CARD_H + GAP);

    ctx.shadowColor = C.cardShadow;
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = C.cardBg;
    rr(ctx, cardX, cardY, CARD_W, CARD_H, 12);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = C.cardBorder;
    ctx.lineWidth = 1;
    rr(ctx, cardX, cardY, CARD_W, CARD_H, 12);
    ctx.stroke();

    const gx = cardX + CARD_PAD;
    const gy = cardY + CARD_PAD;

    ctx.fillStyle = C.headingBg;
    rr(ctx, cardX, cardY, CARD_W, MONTH_HEADER_H + CARD_PAD, [12, 12, 0, 0]);
    ctx.fill();

    ctx.fillStyle = C.headingText;
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${MONTH_NAMES[month]} ${year}`, cardX + CARD_W / 2, gy + 28);

    const dayY = gy + MONTH_HEADER_H;
    DAY_NAMES.forEach((d, di) => {
      ctx.fillStyle = C.dayName;
      ctx.font = `600 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(d, gx + di * CELL_STEP + CELL / 2, dayY + 17);
    });

    const cellsOriginY = gy + MONTH_HEADER_H + DAY_HEADER_H;
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const idx = firstDow + d - 1;
      const cr = Math.floor(idx / 7);
      const cc = idx % 7;
      const cx = gx + cc * CELL_STEP;
      const cy = cellsOriginY + cr * CELL_STEP;

      const key = toKey(date);
      const labelId = dateMappings[key];
      const label = labelId ? labelMap[labelId] : null;
      const inRange = date >= rangeStart && date <= rangeEnd;

      if (label && inRange) {
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = label.color;
        ctx.fillRect(cx, cy, CELL, CELL);
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.cellText;
        ctx.font = `700 13px ${FONT}`;
      } else if (inRange) {
        ctx.fillStyle = C.day;
        ctx.font = `500 13px ${FONT}`;
      } else {
        ctx.fillStyle = C.dayOut;
        ctx.font = `400 13px ${FONT}`;
      }

      ctx.textAlign = 'center';
      ctx.fillText(String(d), cx + CELL / 2, cy + CELL / 2 + 4);
    }
  });

  // ── Watermark ─────────────────────────────────────────────────
  ctx.fillStyle = C.watermark;
  ctx.font = `500 11px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('DateMapper', W - OUTER_PAD, H - 12);

  // ── Trigger download ──────────────────────────────────────────
  const link = document.createElement('a');
  link.download = `${calendarName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_calendar.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
