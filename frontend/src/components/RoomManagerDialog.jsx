import { useState } from "react";
import { useDomus } from "@/context/DomusContext";
import { useEscape } from "@/hooks/useEscape";
import { X, Plus, Trash2, Save, Edit3 } from "lucide-react";
import { toast } from "sonner";

const PRESET_COLORS = ["#f59e0b", "#ef4444", "#22c55e", "#06b6d4", "#8b5cf6", "#ec4899", "#64748b", "#f97316"];

export default function RoomManagerDialog({ open, onOpenChange }) {
  const { rooms, entities, createRoom, updateRoom, deleteRoom } = useDomus();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#f59e0b");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#f59e0b");
  useEscape(open, () => onOpenChange(false));

  if (!open) return null;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createRoom({ name: newName.trim(), color: newColor });
    setNewName("");
    setNewColor("#f59e0b");
    toast.success("Stanza creata");
  };

  const startEdit = (r) => { setEditingId(r.id); setEditName(r.name); setEditColor(r.color); };
  const saveEdit = async () => {
    await updateRoom(editingId, { name: editName, color: editColor });
    setEditingId(null);
    toast.success("Stanza aggiornata");
  };
  const handleDelete = async (r) => {
    const count = entities.filter((e) => e.room_id === r.id).length;
    if (!window.confirm(`Eliminare "${r.name}"? ${count} dispositivi diventeranno non assegnati.`)) return;
    await deleteRoom(r.id);
    toast.success("Stanza eliminata");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="room-manager-dialog">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative glass-strong rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/40 dark:border-white/10">
          <h3 className="font-display text-xl font-bold">Gestione stanze e zone</h3>
          <button data-testid="close-room-manager" onClick={() => onOpenChange(false)} className="w-9 h-9 rounded-full hover:bg-white/60 dark:hover:bg-slate-700/60 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* New room */}
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Nuova stanza</div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                data-testid="new-room-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Es. Studio, Balcone…"
                className="flex-1 min-w-[200px] px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-slate-800/60 border border-white/40 dark:border-white/10 outline-none focus:ring-2 focus:ring-amber-400 text-slate-900 dark:text-slate-50"
              />
              <ColorPicker value={newColor} onChange={setNewColor} testid="new-room-color" />
              <button
                data-testid="create-room-btn"
                onClick={handleCreate}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:shadow-lg transition flex items-center gap-1"
              >
                <Plus size={16} /> Crea
              </button>
            </div>
          </div>

          {/* Existing rooms */}
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Stanze esistenti</div>
            <div className="space-y-2">
              {rooms.map((r) => {
                const count = entities.filter((e) => e.room_id === r.id).length;
                const isEditing = editingId === r.id;
                return (
                  <div key={r.id} className="glass rounded-2xl p-3 flex items-center gap-3" data-testid={`room-row-${r.id}`}>
                    <span className="w-4 h-4 rounded-full shrink-0" style={{ background: isEditing ? editColor : r.color }} />
                    {isEditing ? (
                      <>
                        <input
                          data-testid={`edit-room-name-${r.id}`}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-xl bg-white/70 dark:bg-slate-800/60 border border-white/40 dark:border-white/10 outline-none focus:ring-2 focus:ring-amber-400 text-slate-900 dark:text-slate-50"
                        />
                        <ColorPicker value={editColor} onChange={setEditColor} testid={`edit-color-${r.id}`} />
                        <button data-testid={`save-room-${r.id}`} onClick={saveEdit} className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white flex items-center gap-1 text-sm">
                          <Save size={14} /> Salva
                        </button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-sm">
                          Annulla
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate text-slate-900 dark:text-slate-50">{r.name}</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">{count} dispositivi</div>
                        </div>
                        <button data-testid={`edit-room-${r.id}`} onClick={() => startEdit(r)} className="w-8 h-8 rounded-full hover:bg-white/60 dark:hover:bg-slate-700/60 flex items-center justify-center text-slate-500">
                          <Edit3 size={15} />
                        </button>
                        <button data-testid={`delete-room-${r.id}`} onClick={() => handleDelete(r)} className="w-8 h-8 rounded-full hover:bg-rose-500/10 flex items-center justify-center text-rose-500">
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
              {rooms.length === 0 && (
                <div className="text-sm text-slate-500 text-center py-6">Nessuna stanza. Aggiungine una qui sopra.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorPicker({ value, onChange, testid }) {
  return (
    <div className="flex items-center gap-1" data-testid={testid}>
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-label={c}
          className={`w-6 h-6 rounded-full border-2 transition-transform ${value === c ? "scale-125 border-slate-900 dark:border-white" : "border-transparent"}`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}
