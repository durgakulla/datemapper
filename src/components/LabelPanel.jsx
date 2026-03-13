import { useState } from 'react';
import './LabelPanel.css';

const PRESET_COLORS = [
  '#6aaee8', '#e87878', '#5cc98a', '#e8c05a',
  '#a57ee0', '#e8954a', '#4abcd4', '#e8709c',
  '#7ec468', '#d4c84a', '#7098d4', '#d47098',
];

export default function LabelPanel({ labels, labelCounts = {}, selectedLabel, onSelectLabel, onUpdateLabel, onAddLabel, onDeleteLabel, onClearAll }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const startEdit = (label) => {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
  };

  const saveEdit = () => {
    if (!editName.trim()) return;
    onUpdateLabel(editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const totalHighlighted = Object.values(labelCounts).reduce((s, n) => s + n, 0);

  return (
    <div className="label-panel">
      <h3>Labels</h3>
      <p className="label-hint">Select a label, then click dates to apply it.</p>
      <ul className="label-list">
        {labels.map(label => (
          <li
            key={label.id}
            className={`label-item ${selectedLabel?.id === label.id ? 'selected' : ''}`}
          >
            <div
              className="label-row"
              onClick={() => onSelectLabel(selectedLabel?.id === label.id ? null : label)}
              onDoubleClick={e => { e.stopPropagation(); startEdit(label); }}
              title="Double-click to edit"
            >
              <span className="label-dot" style={{ background: label.color }} />
              <span className="label-name">
                {label.name}
                <span className="label-count">({labelCounts[label.id] ?? 0})</span>
              </span>
            </div>
            {editingId === label.id && (
              <div className="label-edit-form">
                <input
                  className="label-name-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  autoFocus
                />
                <div className="color-swatches">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      className={`swatch ${editColor === c ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => setEditColor(c)}
                      title={c}
                    />
                  ))}
                  <input
                    type="color"
                    value={editColor}
                    onChange={e => setEditColor(e.target.value)}
                    title="Custom color"
                    className="color-picker"
                  />
                </div>
                <div className="edit-actions">
                  <button className="save-btn" onClick={saveEdit}>Save</button>
                  <button className="cancel-btn" onClick={cancelEdit}>Cancel</button>
                  <button
                    className="delete-btn"
                    onClick={() => {
                      if (confirm(`Delete "${editName}" and remove all its date highlights?`)) {
                        onDeleteLabel(editingId);
                        setEditingId(null);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <button className="add-label-btn" onClick={onAddLabel} title="Add label">+</button>
      <button className="clear-all-btn" onClick={onClearAll}>Clear all</button>
      <span className="total-count">{totalHighlighted} day{totalHighlighted !== 1 ? 's' : ''} highlighted</span>
    </div>
  );
}
