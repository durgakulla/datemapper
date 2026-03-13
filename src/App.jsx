import { useEffect, useState, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, deleteDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import Login from './components/Login';
import DateRangePicker from './components/DateRangePicker';
import LabelPanel from './components/LabelPanel';
import CalendarMonth from './components/CalendarMonth';
import CalendarPicker from './components/CalendarPicker';
import { downloadCalendar } from './utils/downloadCalendar';
import './App.css';

const DEFAULT_LABELS = [
  { id: 'label-1', name: 'Work', color: '#6aaee8' },
  { id: 'label-2', name: 'Personal', color: '#5cc98a' },
  { id: 'label-3', name: 'Travel', color: '#e8c05a' },
  { id: 'label-4', name: 'Holiday', color: '#e87878' },
];

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

const TODAY = new Date();
const DEFAULT_START = `${String(TODAY.getMonth() + 1).padStart(2, '0')}/01/${TODAY.getFullYear()}`;
const DEFAULT_END = `${String(TODAY.getMonth() + 1).padStart(2, '0')}/${new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0).getDate()}/${TODAY.getFullYear()}`;

function calendarDefaults(name = 'My Calendar') {
  return { name, startDate: DEFAULT_START, endDate: DEFAULT_END, labels: DEFAULT_LABELS, dateMappings: {} };
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [calendars, setCalendars] = useState([]);       // [{ id, name }]
  const [activeCalendarId, setActiveCalendarId] = useState(null);
  const [startDate, setStartDate] = useState(DEFAULT_START);
  const [endDate, setEndDate] = useState(DEFAULT_END);
  const [labels, setLabels] = useState(DEFAULT_LABELS);
  const [dateMappings, setDateMappings] = useState({});
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dragState, setDragState] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u ?? null);
      if (!u) setLoading(false);
    });
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Force re-render on window resize
  const [, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load user data on login
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const calCol = collection(db, 'users', user.uid, 'calendars');

      // Migration: old flat structure
      if (userSnap.exists() && !userSnap.data().activeCalendarId && userSnap.data().startDate) {
        const oldData = userSnap.data();
        const newCal = await addDoc(calCol, { ...oldData, name: 'My Calendar', createdAt: serverTimestamp() });
        await setDoc(userRef, { activeCalendarId: newCal.id });
        setCalendars([{ id: newCal.id, name: 'My Calendar' }]);
        setActiveCalendarId(newCal.id);
        hydrateCalendar(oldData);
        setLoading(false);
        return;
      }

      // Load calendars list
      const calSnap = await getDocs(calCol);
      let calList = calSnap.docs.map(d => ({ id: d.id, name: d.data().name }));

      if (calList.length === 0) {
        // Brand new user — create first calendar
        const defaults = calendarDefaults();
        const newCal = await addDoc(calCol, { ...defaults, createdAt: serverTimestamp() });
        await setDoc(userRef, { activeCalendarId: newCal.id });
        calList = [{ id: newCal.id, name: defaults.name }];
        setCalendars(calList);
        setActiveCalendarId(newCal.id);
        hydrateCalendar(defaults);
        setLoading(false);
        return;
      }

      setCalendars(calList);

      // Determine active calendar
      const activeId = userSnap.exists() ? userSnap.data().activeCalendarId : null;
      const resolvedId = calList.find(c => c.id === activeId) ? activeId : calList[0].id;
      setActiveCalendarId(resolvedId);
      await loadCalendar(resolvedId, user.uid);
      setLoading(false);
      } catch (err) {
        console.error('Failed to load data:', err);
        setLoading(false);
      }
    };
    load();
  }, [user]);

  function hydrateCalendar(data) {
    if (data.startDate) setStartDate(data.startDate);
    if (data.endDate) setEndDate(data.endDate);
    if (data.labels) setLabels(data.labels);
    setDateMappings(data.dateMappings ?? {});
  }

  async function loadCalendar(calId, uid) {
    const snap = await getDoc(doc(db, 'users', uid, 'calendars', calId));
    if (snap.exists()) hydrateCalendar(snap.data());
  }

  const saveToCalendar = (calId, updates) => {
    if (!user || !calId) return;
    updateDoc(doc(db, 'users', user.uid, 'calendars', calId), updates);
  };

  const save = (updates) => saveToCalendar(activeCalendarId, updates);

  // Calendar management
  const handleSwitchCalendar = async (id) => {
    if (id === activeCalendarId) return;
    setSelectedLabel(null);
    setActiveCalendarId(id);
    setDoc(doc(db, 'users', user.uid), { activeCalendarId: id }, { merge: true });
    await loadCalendar(id, user.uid);
  };

  const handleCreateCalendar = async () => {
    const name = 'New Calendar';
    const defaults = calendarDefaults(name);
    const newCal = await addDoc(collection(db, 'users', user.uid, 'calendars'), {
      ...defaults, createdAt: serverTimestamp(),
    });
    const newEntry = { id: newCal.id, name };
    setCalendars(prev => [...prev, newEntry]);
    setDoc(doc(db, 'users', user.uid), { activeCalendarId: newCal.id }, { merge: true });
    setActiveCalendarId(newCal.id);
    setSelectedLabel(null);
    hydrateCalendar(defaults);
  };

  const handleRenameCalendar = (id, name) => {
    setCalendars(prev => prev.map(c => c.id === id ? { ...c, name } : c));
    saveToCalendar(id, { name });
  };

  const handleDeleteCalendar = async (id) => {
    await deleteDoc(doc(db, 'users', user.uid, 'calendars', id));
    const remaining = calendars.filter(c => c.id !== id);
    setCalendars(remaining);
    if (id === activeCalendarId) {
      const next = remaining[0];
      setActiveCalendarId(next.id);
      setDoc(doc(db, 'users', user.uid), { activeCalendarId: next.id }, { merge: true });
      await loadCalendar(next.id, user.uid);
    }
  };

  // Data handlers
  const handleApplyRange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
    if (parseDate(end) > parseDate(start)) save({ startDate: start, endDate: end });
  };

  const handleUpdateLabel = (id, changes) => {
    const updated = labels.map(l => l.id === id ? { ...l, ...changes } : l);
    setLabels(updated);
    save({ labels: updated });
    if (selectedLabel?.id === id) setSelectedLabel(prev => ({ ...prev, ...changes }));
  };

  const handleDeleteLabel = (id) => {
    const updatedLabels = labels.filter(l => l.id !== id);
    const updatedMappings = Object.fromEntries(
      Object.entries(dateMappings).filter(([, labelId]) => labelId !== id)
    );
    setLabels(updatedLabels);
    setDateMappings(updatedMappings);
    if (selectedLabel?.id === id) setSelectedLabel(null);
    save({ labels: updatedLabels, dateMappings: updatedMappings });
  };

  const handleMoveLabel = (id, dir) => {
    const idx = labels.findIndex(l => l.id === id);
    const next = idx + dir;
    if (next < 0 || next >= labels.length) return;
    const updated = [...labels];
    [updated[idx], updated[next]] = [updated[next], updated[idx]];
    setLabels(updated);
    save({ labels: updated });
  };

  const handleAddLabel = () => {
    const id = `label-${Date.now()}`;
    const colors = ['#6aaee8', '#e87878', '#5cc98a', '#e8c05a', '#a57ee0', '#e8954a', '#4abcd4', '#e8709c'];
    const color = colors[labels.length % colors.length];
    const newLabel = { id, name: 'New Label', color };
    const updated = [...labels, newLabel];
    setLabels(updated);
    save({ labels: updated });
  };

  const handleClearAll = () => {
    if (!confirm('Clear all date highlights?')) return;
    setDateMappings({});
    save({ dateMappings: {} });
  };

  const pendingMappingsRef = useRef(dateMappings);
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });
  const isDraggingRef = useRef(false);

  const handleDayMouseDown = (key) => {
    const cellLabel = dateMappings[key];
    // With a selected label: toggle off if same label, otherwise replace/add
    // Without a selected label: delete any highlight
    let mode;
    if (selectedLabel) {
      mode = cellLabel === selectedLabel.id ? 'delete' : 'add';
    } else {
      if (!cellLabel) return;
      mode = 'delete';
    }
    const pending = { ...dateMappings };
    if (mode === 'add') { pending[key] = selectedLabel.id; } else { delete pending[key]; }
    setDateMappings(pending);
    pendingMappingsRef.current = pending;
    setDragState({ mode, pending });
    isDraggingRef.current = true;
  };

  const handleDayMouseEnter = (key) => {
    if (!dragState) return;
    const pending = { ...dragState.pending };
    if (dragState.mode === 'add' && selectedLabel) {
      pending[key] = selectedLabel.id;
    } else if (dragState.mode === 'delete' && pending[key]) {
      delete pending[key];
    }
    setDateMappings(pending);
    pendingMappingsRef.current = pending;
    setDragState({ ...dragState, pending });
  };

  useEffect(() => {
    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        saveRef.current({ dateMappings: pendingMappingsRef.current });
        setDragState(null);
        isDraggingRef.current = false;
      }
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  if (loading) return <div className="app-loading">Loading...</div>;
  if (!user) return <Login />;

  const rangeStart = parseDate(startDate);
  const rangeEnd = parseDate(endDate);
  const validRange = rangeEnd > rangeStart;
  const months = validRange ? getMonthsBetween(rangeStart, rangeEnd) : [];

  const labelCounts = {};
  labels.forEach(l => { labelCounts[l.id] = 0; });
  Object.entries(dateMappings).forEach(([key, labelId]) => {
    const d = parseDate(key);
    if (d >= rangeStart && d <= rangeEnd && labelCounts[labelId] !== undefined) {
      labelCounts[labelId]++;
    }
  });

  return (
    <div className="app">
      <div className="sticky-top">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-spacer" />
          <div className="header-left">
            <h1 className="app-title">DateMapper</h1>
            <CalendarPicker
              calendars={calendars}
              activeCalendarId={activeCalendarId}
              onSwitch={handleSwitchCalendar}
              onCreate={handleCreateCalendar}
              onRename={handleRenameCalendar}
              onDelete={handleDeleteCalendar}
            />
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onApply={handleApplyRange}
            />
          </div>
          <div className="header-right" ref={userMenuRef}>
            <button
              className="download-btn"
              title="Download calendar as PNG"
              onClick={() => {
                const name = calendars.find(c => c.id === activeCalendarId)?.name ?? 'Calendar';
                downloadCalendar({ calendarName: name, startDate, endDate, labels, dateMappings, darkMode });
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 10v1.5A1.5 1.5 0 0 0 3.5 13h7A1.5 1.5 0 0 0 12 11.5V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              Export
            </button>
            <button className="theme-toggle" onClick={() => setDarkMode(d => !d)} title="Toggle dark mode">
              {darkMode ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
            <img
              src={user.photoURL}
              alt={user.displayName}
              className="avatar"
              referrerPolicy="no-referrer"
              onClick={() => setUserMenuOpen(o => !o)}
            />
            {userMenuOpen && (
              <div className="user-menu">
                <div className="user-menu-name">{user.displayName}</div>
                <button className="user-menu-signout" onClick={() => signOut(auth)}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>
        <div className="sidebar">
          <LabelPanel
            labels={labels}
            labelCounts={labelCounts}
            selectedLabel={selectedLabel}
            onSelectLabel={setSelectedLabel}
            onUpdateLabel={handleUpdateLabel}
            onMoveLabel={handleMoveLabel}
            onAddLabel={handleAddLabel}
            onDeleteLabel={handleDeleteLabel}
            onClearAll={handleClearAll}
          />
        </div>
      </div>

      <main className="app-main">
        <section className="calendar-grid">
          {!validRange && (
            <p className="range-error">End date must be after start date.</p>
          )}
          {months.map(({ year, month }) => (
            <CalendarMonth
              key={`${year}-${month}`}
              year={year}
              month={month}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              dateMappings={dateMappings}
              labels={labels}
              selectedLabel={selectedLabel}
              onDayMouseDown={handleDayMouseDown}
              onDayMouseEnter={handleDayMouseEnter}
            />
          ))}
        </section>
      </main>
    </div>
  );
}
