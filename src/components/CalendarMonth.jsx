import './CalendarMonth.css';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function toKey(year, month, day) {
  return `${String(month + 1).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
}

export default function CalendarMonth({ year, month, rangeStart, rangeEnd, dateMappings, labels, selectedLabel, onDayMouseDown, onDayMouseEnter }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const labelMap = {};
  labels.forEach(l => { labelMap[l.id] = l; });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="calendar-month">
      <div className="month-header">{MONTH_NAMES[month]} {year}</div>
      <div className="day-names">
        {DAYS.map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="day-grid">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="day-cell-wrap"><div className="day-cell empty" /></div>;

          const key = toKey(year, month, day);
          const date = new Date(year, month, day);
          const inRange = date >= rangeStart && date <= rangeEnd;
          const labelId = dateMappings[key];
          const label = inRange && labelId ? labelMap[labelId] : null;

          return (
            <div key={key} className="day-cell-wrap">
              <button
                className={`day-cell ${inRange ? 'in-range' : 'out-range'} ${selectedLabel && inRange ? 'clickable' : ''}`}
                style={label ? { background: label.color, color: '#fff' } : {}}
                onMouseDown={() => inRange && selectedLabel && onDayMouseDown(key)}
                onMouseEnter={() => inRange && selectedLabel && onDayMouseEnter(key)}
                title={label ? label.name : ''}
                disabled={!inRange || !selectedLabel}
              >
                {day}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
