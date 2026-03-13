import { useState, useEffect } from 'react';
import './DateRangePicker.css';

function toInputValue(mmddyyyy) {
  const [m, d, y] = mmddyyyy.split('/');
  return `${y}-${m}-${d}`;
}

function fromInputValue(yyyymmdd) {
  const [y, m, d] = yyyymmdd.split('-');
  return `${m}/${d}/${y}`;
}

export default function DateRangePicker({ startDate, endDate, onApply }) {
  const [start, setStart] = useState(toInputValue(startDate));
  const [end, setEnd] = useState(toInputValue(endDate));

  useEffect(() => { setStart(toInputValue(startDate)); }, [startDate]);
  useEffect(() => { setEnd(toInputValue(endDate)); }, [endDate]);

  const handleStart = (val) => { setStart(val); onApply(fromInputValue(val), fromInputValue(end)); };
  const handleEnd = (val) => { setEnd(val); onApply(fromInputValue(start), fromInputValue(val)); };

  return (
    <div className="date-range-picker">
      <input type="date" value={start} onChange={e => handleStart(e.target.value)} />
      <span className="separator">→</span>
      <input type="date" value={end} onChange={e => handleEnd(e.target.value)} />
    </div>
  );
}
