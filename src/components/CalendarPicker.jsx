import { useState, useRef, useEffect } from 'react';
import './CalendarPicker.css';

export default function CalendarPicker({ calendars, activeCalendarId, onSwitch, onCreate, onRename, onDelete }) {
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const startRename = (cal, e) => {
    e.stopPropagation();
    setRenamingId(cal.id);
    setRenameValue(cal.name);
  };

  const commitRename = (id) => {
    if (renameValue.trim()) onRename(id, renameValue.trim());
    setRenamingId(null);
  };

  const activeCalendar = calendars.find(c => c.id === activeCalendarId);

  return (
    <div className="calendar-picker" ref={dropdownRef}>
      <button className="calendar-picker-btn" onClick={() => setOpen(o => !o)}>
        <span className="calendar-name">{activeCalendar?.name ?? 'Select calendar'}</span>
        <svg className="calendar-caret" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          {open ? <polygon points="1,7 5,3 9,7"/> : <polygon points="1,3 5,7 9,3"/>}
        </svg>
      </button>

      {open && (
        <div className="calendar-dropdown">
          <ul className="calendar-list">
            {calendars.map(cal => (
              <li key={cal.id} className={`calendar-item ${cal.id === activeCalendarId ? 'active' : ''}`}>
                {renamingId === cal.id ? (
                  <input
                    className="rename-input"
                    value={renameValue}
                    autoFocus
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(cal.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename(cal.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="calendar-item-name"
                    onClick={() => { onSwitch(cal.id); setOpen(false); }}
                  >
                    {cal.name}
                  </span>
                )}
                {renamingId !== cal.id && (
                  <button
                    className="cal-rename-btn"
                    onClick={e => startRename(cal, e)}
                    title="Rename"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                )}
                <button
                  className="cal-delete-btn"
                  disabled={calendars.length === 1}
                  onClick={e => {
                    e.stopPropagation();
                    if (confirm(`Delete "${cal.name}"? This cannot be undone.`)) onDelete(cal.id);
                  }}
                  title="Delete calendar"
                >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
              </li>
            ))}
          </ul>
          <button className="new-calendar-btn" onClick={() => { onCreate(); setOpen(false); }}>
            + New calendar
          </button>
        </div>
      )}
    </div>
  );
}
