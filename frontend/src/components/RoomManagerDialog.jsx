import { useState } from "react";
import { Plus, Trash2, Save, Edit3, Home } from "lucide-react";
import Modal from "@/components/Modal";
import { useDomus } from "@/context/DomusContext";
import { SOFT_COLORS } from "@/lib/icons";
import { toast } from "sonner";

export default function RoomManagerDialog({ open, onOpenChange }) {
  const { rooms, entities, createRoom, updateRoom, deleteRoom } = useDomus();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(SOFT_COLORS[0]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(SOFT_COLORS[0]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createRoom({ name: newName.trim(), color: newColor });
    setNewName(""); toast.success("Stanza creata");
  };
  const startEdit = (r) => { setEditingId(r.id); setEditName(r.name); setEditColor(r.color); };
  const saveEdit = async () => { await updateRoom(editingId, { name: editName, color: editColor }); setEditingId(null); toast.success("Stanza aggiornata"); };
  const handleDelete = async (r) => {
    const count = entities.filter((e) => e.room_id === r.id).length;
    if (!window.confirm(`Eliminare "${r.name}"? ${count} dispositivi diventeranno non assegnati.`)) return;
    await deleteRoom(r.id); toast.success("Stanza eliminata");
  };

  return (
    <Modal open={open} onClose={() => onOpenChange(false)} title="Gestione stanze e zone" subtitle="Crea, rinomina, colora ed elimina le stanze." icon={<Home size={18} />} testid="room-manager-dialog">
      <div className="space-y-6">
        <div>
          <div className="label mb-2">Nuova stanza</div>
          <div className="flex flex-wrap items-center gap-2">
            <input data-testid="new-room-name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="Es. Studio, Balcone…" className="field flex-1 min-w-[200px]" />
            <ColorPicker value={newColor} onChange={setNewColor} testid="new-room-color" />
            <button data-testid="create-room-btn" onClick={handleCreate} className="btn-acc px-4 py-2.5 rounded-2xl font-semibold text-sm flex items-center gap-1"><Plus size={15} /> Crea</button>
          </div>
        </div>

        <div>
          <div className="label mb-2">Stanze esistenti</div>
          <div className="space-y-2">
            {rooms.map((r) => {
              const count = entities.filter((e) => e.room_id === r.id).length;
              const isEditing = editingId === r.id;
              return (
                <div key={r.id} className="glass-inner rounded-2xl p-3 flex items-center gap-3 flex-wrap" data-testid={`room-row-${r.id}`}>
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ background: isEditing ? editColor : r.color }} />
                  {isEditing ? (
                    <>
                      <input data-testid={`edit-room-name-${r.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} className="field flex-1 !py-1.5" />
                      <ColorPicker value={editColor} onChange={setEditColor} testid={`edit-color-${r.id}`} />
                      <button data-testid={`save-room-${r.id}`} onClick={saveEdit} className="btn-acc px-3 py-1.5 rounded-xl flex items-center gap-1 text-sm"><Save size={14} /> Salva</button>
                      <button onClick={() => setEditingId(null)} className="btn-ghost px-3 py-1.5 rounded-xl text-sm">Annulla</button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{r.name}</div>
                        <div className="text-xs text-muted">{count} dispositivi</div>
                      </div>
                      <button data-testid={`edit-room-${r.id}`} onClick={() => startEdit(r)} className="btn-ghost w-8 h-8 rounded-full flex items-center justify-center text-muted" aria-label="Rinomina"><Edit3 size={14} /></button>
                      <button data-testid={`delete-room-${r.id}`} onClick={() => handleDelete(r)} className="btn-danger w-8 h-8 rounded-full flex items-center justify-center" aria-label="Elimina"><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              );
            })}
            {rooms.length === 0 && <div className="text-sm text-muted text-center py-6">Nessuna stanza. Aggiungine una qui sopra.</div>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ColorPicker({ value, onChange, testid }) {
  return (
    <div className="flex items-center gap-1" data-testid={testid}>
      {SOFT_COLORS.slice(0, 8).map((c) => (
        <button key={c} onClick={() => onChange(c)} aria-label={c} className={`w-6 h-6 rounded-full border-2 transition-transform ${value === c ? "scale-125 border-slate-700 dark:border-white" : "border-transparent"}`} style={{ background: c }} />
      ))}
    </div>
  );
}
