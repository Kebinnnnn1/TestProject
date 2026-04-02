import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Modal,
  TextInput, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { workspaceAPI } from '../../services/api';
import { useAuthStore } from '../../store';
import { useTheme, DarkColors as Colors, Spacing, Radius } from '../../constants';

interface WorkspaceItem {
  id: number; content: string; description: string;
  is_done: boolean; status: string; priority: string;
  task_type: string; due_date: string | null;
  progress: number; color: string; order: number;
}
interface WorkspaceDoc {
  id: number; type: string; title: string; color: string;
  updated_at: string; item_count: number; items?: WorkspaceItem[];
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const DOC_TYPES: { key: string; label: string; icon: IoniconsName; color: string }[] = [
  { key: 'todo',    label: 'To-Do List',      icon: 'checkbox-outline',        color: '#4ade80' },
  { key: 'project', label: 'Project Tracker', icon: 'folder-open-outline',     color: '#60a5fa' },
  { key: 'goal',    label: 'Goal Tracker',    icon: 'radio-button-on-outline', color: '#f59e42' },
  { key: 'note',    label: 'Notes',           icon: 'document-text-outline',   color: '#a78bfa' },
];

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES   = ['todo', 'in_progress', 'done', 'blocked'];

const STATUS_COLORS: Record<string,string> = {
  todo: '#888899', in_progress: '#3b82f6', done: '#22c55e', blocked: '#ef4444',
};
const PRIORITY_COLORS: Record<string,string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#ef4444',
};

// ── Pill selector ──────────────────────────────────────────────────────────
function PillRow({ options, value, onChange, colorMap }: { options: string[]; value: string; onChange: (v: string) => void; colorMap?: Record<string,string> }) {
  const Colors = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
      {options.map(o => {
        const active = value === o;
        const col = colorMap?.[o] || Colors.primary;
        return (
          <TouchableOpacity key={o}
            style={[{ paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border }, active && { backgroundColor: col + '33', borderColor: col }]}
            onPress={() => onChange(o)}
          >
            <Text style={{ color: active ? col : Colors.textMuted, fontSize: 12, textTransform: 'capitalize' }}>{o.replace('_', ' ')}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Item card ──────────────────────────────────────────────────────────────
function ItemCard({ item, docType, onUpdate, onDelete }: {
  item: WorkspaceItem; docType: string;
  onUpdate: (id: number, data: Partial<WorkspaceItem>) => void;
  onDelete: (id: number) => void;
}) {
  const Colors = useTheme();
  const [open, setOpen] = useState(false);
  const [ec, setEc] = useState(item.content);
  const [ed, setEd] = useState(item.description || '');
  const [es, setEs] = useState(item.status);
  const [ep, setEp] = useState(item.priority);
  const [edu, setEdu] = useState(item.due_date || '');
  const [eprog, setEprog] = useState(String(item.progress ?? 0));
  const [saving, setSaving] = useState(false);

  const openEdit = () => { setEc(item.content); setEd(item.description||''); setEs(item.status); setEp(item.priority); setEdu(item.due_date||''); setEprog(String(item.progress??0)); setOpen(true); };
  const save = async () => {
    if (!ec.trim()) return;
    setSaving(true);
    onUpdate(item.id, { content: ec.trim(), description: ed.trim(), status: es, priority: ep, due_date: edu||null, progress: Math.min(100, Math.max(0, parseInt(eprog)||0)) });
    setOpen(false); setSaving(false);
  };

  const sc = STATUS_COLORS[item.status] || Colors.textMuted;
  const pc = PRIORITY_COLORS[item.priority] || Colors.textMuted;

  return (
    <>
      <TouchableOpacity style={{ backgroundColor: Colors.bgCard, margin: Spacing.sm, marginBottom: 0, borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, borderLeftColor: item.color || Colors.primary }} onPress={openEdit} activeOpacity={0.78}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {docType === 'todo' && (
            <TouchableOpacity onPress={() => onUpdate(item.id, { is_done: !item.is_done })}
              style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: item.is_done ? Colors.success : Colors.border, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm, marginTop: 2, flexShrink: 0, backgroundColor: item.is_done ? Colors.success : 'transparent' }}>
              {item.is_done && <Ionicons name="checkmark" size={13} color="#fff" />}
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: item.is_done ? Colors.textMuted : Colors.textPrimary, fontSize: 14, fontWeight: '600', textDecorationLine: item.is_done ? 'line-through' : 'none' }}>{item.content}</Text>
            {item.description ? <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 3 }} numberOfLines={2}>{item.description}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
              <View style={{ borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: sc + '22', borderColor: sc + '55' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: sc, textTransform: 'capitalize' }}>{item.status.replace('_', ' ')}</Text>
              </View>
              <View style={{ borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: pc + '22', borderColor: pc + '55' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: pc, textTransform: 'capitalize' }}>{item.priority}</Text>
              </View>
              {item.due_date && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="calendar-outline" size={11} color={Colors.textMuted} />
                  <Text style={{ color: Colors.textMuted, fontSize: 11 }}>{item.due_date}</Text>
                </View>
              )}
            </View>
            {docType === 'project' && (
              <View style={{ height: 3, backgroundColor: Colors.border, borderRadius: 2, marginTop: 7, overflow: 'hidden' }}>
                <View style={{ height: 3, backgroundColor: Colors.primary, borderRadius: 2, width: `${item.progress}%` as any }} />
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => onDelete(item.id)} hitSlop={8} style={{ marginLeft: 8, marginTop: 2 }}>
            <Ionicons name="close" size={15} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' }}>
          <ScrollView style={{ backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, maxHeight: '88%', borderTopWidth: 1, borderTopColor: Colors.border }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
              <Text style={{ color: Colors.textPrimary, fontSize: 18, fontWeight: '700' }}>Edit Item</Text>
              <TouchableOpacity onPress={() => setOpen(false)}><Ionicons name="close" size={22} color={Colors.textMuted} /></TouchableOpacity>
            </View>
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12 }}>Content</Text>
            <TextInput style={{ backgroundColor: Colors.bg, color: Colors.textPrimary, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 4 }} value={ec} onChangeText={setEc} placeholderTextColor={Colors.textMuted} />
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12 }}>Description</Text>
            <TextInput style={{ backgroundColor: Colors.bg, color: Colors.textPrimary, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 4, minHeight: 64 }} value={ed} onChangeText={setEd} multiline placeholder="Optional..." placeholderTextColor={Colors.textMuted} />
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12 }}>Status</Text>
            <PillRow options={STATUSES} value={es} onChange={setEs} colorMap={STATUS_COLORS} />
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12 }}>Priority</Text>
            <PillRow options={PRIORITIES} value={ep} onChange={setEp} colorMap={PRIORITY_COLORS} />
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12 }}>Due Date (YYYY-MM-DD)</Text>
            <TextInput style={{ backgroundColor: Colors.bg, color: Colors.textPrimary, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 4 }} value={edu} onChangeText={setEdu} placeholder="e.g. 2025-12-31" placeholderTextColor={Colors.textMuted} />
            {docType === 'project' && <>
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12 }}>Progress (0–100)</Text>
              <TextInput style={{ backgroundColor: Colors.bg, color: Colors.textPrimary, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 4 }} value={eprog} onChangeText={setEprog} keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
            </>}
            {docType === 'todo' && (
              <TouchableOpacity style={{ paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm }}
                onPress={() => onUpdate(item.id, { is_done: !item.is_done })}>
                <Ionicons name={item.is_done ? 'arrow-undo-outline' : 'checkmark-circle-outline'} size={14} color={Colors.textSecondary} />
                <Text style={{ color: Colors.textMuted, fontSize: 12, textTransform: 'capitalize' }}>{item.is_done ? 'Mark as Not Done' : 'Mark as Done'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={{ backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm, flexDirection: 'row', justifyContent: 'center' }} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save Changes</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={{ backgroundColor: Colors.error + 'dd', borderRadius: Radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: 8, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              onPress={() => { setOpen(false); onDelete(item.id); }}>
              <Ionicons name="trash-outline" size={15} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Delete Item</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function WorkspaceScreen() {
  const Colors = useTheme();
  const [docs, setDocs] = useState<WorkspaceDoc[]>([]);
  const [selected, setSelected] = useState<WorkspaceDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [docLoading, setDocLoading] = useState(false);

  const [createDocOpen, setCreateDocOpen] = useState(false);
  const [newType, setNewType] = useState('todo');
  const [newTitle, setNewTitle] = useState('');
  const [creatingDoc, setCreatingDoc] = useState(false);

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [niContent, setNiContent] = useState('');
  const [niDesc, setNiDesc] = useState('');
  const [niPriority, setNiPriority] = useState('medium');
  const [niStatus, setNiStatus] = useState('todo');
  const [niDue, setNiDue] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  const insets = useSafeAreaInsets();

  useEffect(() => { loadDocs(); }, []);

  const loadDocs = async () => {
    try { const r = await workspaceAPI.getDocs(); setDocs(r.data.docs); }
    catch { Alert.alert('Error', 'Could not load workspace.'); }
    setLoading(false);
  };

  const openDoc = async (doc: WorkspaceDoc) => {
    setDocLoading(true);
    try { const r = await workspaceAPI.getDoc(doc.id); setSelected(r.data); }
    catch { Alert.alert('Error', 'Could not load document.'); }
    setDocLoading(false);
  };

  const createDoc = async () => {
    if (!newTitle.trim()) { Alert.alert('Error', 'Please enter a title.'); return; }
    setCreatingDoc(true);
    try {
      const t = DOC_TYPES.find(d => d.key === newType)!;
      const r = await workspaceAPI.createDoc({ type: newType, title: newTitle.trim(), color: t.color });
      setDocs(p => [r.data, ...p]);
      setCreateDocOpen(false); setNewTitle('');
    } catch { Alert.alert('Error', 'Could not create document.'); }
    setCreatingDoc(false);
  };

  const deleteDoc = (id: number) => {
    Alert.alert('Delete Document', 'This will delete the document and all items.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await workspaceAPI.deleteDoc(id); setDocs(p => p.filter(d => d.id !== id)); setSelected(null); }
        catch { Alert.alert('Error', 'Could not delete.'); }
      }},
    ]);
  };

  const addItem = async () => {
    if (!selected || !niContent.trim()) return;
    setAddingItem(true);
    try {
      const r = await workspaceAPI.createItem(selected.id, { content: niContent.trim(), description: niDesc.trim(), priority: niPriority, status: niStatus, due_date: niDue || null });
      setSelected(p => p ? { ...p, items: [...(p.items || []), r.data], item_count: p.item_count + 1 } : p);
      setAddItemOpen(false); setNiContent(''); setNiDesc(''); setNiDue('');
    } catch { Alert.alert('Error', 'Could not add item.'); }
    setAddingItem(false);
  };

  const updateItem = async (id: number, data: Partial<WorkspaceItem>) => {
    try {
      await workspaceAPI.updateItem(id, data);
      setSelected(p => p ? { ...p, items: p.items?.map(i => i.id === id ? { ...i, ...data } : i) } : p);
    } catch {}
  };

  const deleteItem = (id: number) => {
    Alert.alert('Delete Item', 'Remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await workspaceAPI.deleteItem(id);
          setSelected(p => p ? { ...p, items: p.items?.filter(i => i.id !== id), item_count: p.item_count - 1 } : p);
        } catch {}
      }},
    ]);
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={Colors.primary} size="large" /></View>;

  const typeOf = (key: string) => DOC_TYPES.find(t => t.key === key);
  const docsByType: Record<string, WorkspaceDoc[]> = {};
  docs.forEach(d => { if (!docsByType[d.type]) docsByType[d.type] = []; docsByType[d.type].push(d); });

  // ── Selected doc view ─────────────────────────────────────────────────────
  if (selected) {
    const ti = typeOf(selected.type);
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: 12, backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10, paddingTop: insets.top + 12 }}>
          <TouchableOpacity onPress={() => setSelected(null)} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <View style={{ width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: (ti?.color || Colors.primary) + '22', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={ti?.icon || 'document-outline'} size={18} color={ti?.color || Colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: Colors.textPrimary, fontWeight: '700', fontSize: 16 }} numberOfLines={1}>{selected.title}</Text>
            <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{ti?.label}</Text>
          </View>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.primary + '66', borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 6 }} onPress={() => setAddItemOpen(true)}>
            <Ionicons name="add" size={15} color={Colors.primary} />
            <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: 13 }}>Add Item</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteDoc(selected.id)} hitSlop={8} style={{ marginLeft: 10 }}>
            <Ionicons name="trash-outline" size={19} color={Colors.error} />
          </TouchableOpacity>
        </View>

        {docLoading ? (
          <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={Colors.primary} /></View>
        ) : (
          <FlatList
            key="detail"
            data={selected.items || []}
            keyExtractor={i => i.id.toString()}
            style={{ backgroundColor: Colors.bg }}
            renderItem={({ item }) => (
              <ItemCard item={item} docType={selected.type} onUpdate={updateItem} onDelete={deleteItem} />
            )}
            contentContainerStyle={{ paddingVertical: Spacing.sm, paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
                <Ionicons name="list-outline" size={44} color={Colors.textMuted} />
                <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '700' }}>No items yet</Text>
                <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Tap "Add Item" to get started</Text>
              </View>
            }
          />
        )}

        <Modal visible={addItemOpen} animationType="slide" transparent>
          <View style={{ flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' }}>
            <ScrollView style={{ backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, maxHeight: '88%', borderTopWidth: 1, borderTopColor: Colors.border }} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
                <Text style={{ color: Colors.textPrimary, fontSize: 18, fontWeight: '700' }}>Add Item</Text>
                <TouchableOpacity onPress={() => setAddItemOpen(false)}><Ionicons name="close" size={22} color={Colors.textMuted} /></TouchableOpacity>
              </View>
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12 }}>Content *</Text>
              <TextInput style={{ backgroundColor: Colors.bg, color: Colors.textPrimary, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 4 }} placeholder="What needs to be done?" placeholderTextColor={Colors.textMuted} value={niContent} onChangeText={setNiContent} />
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12 }}>Description</Text>
              <TextInput style={{ backgroundColor: Colors.bg, color: Colors.textPrimary, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 4, minHeight: 60 }} placeholder="Optional details..." placeholderTextColor={Colors.textMuted} value={niDesc} onChangeText={setNiDesc} multiline />
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12 }}>Status</Text>
              <PillRow options={STATUSES} value={niStatus} onChange={setNiStatus} colorMap={STATUS_COLORS} />
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12 }}>Priority</Text>
              <PillRow options={PRIORITIES} value={niPriority} onChange={setNiPriority} colorMap={PRIORITY_COLORS} />
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12 }}>Due Date (YYYY-MM-DD)</Text>
              <TextInput style={{ backgroundColor: Colors.bg, color: Colors.textPrimary, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 4 }} placeholder="e.g. 2025-12-31" placeholderTextColor={Colors.textMuted} value={niDue} onChangeText={setNiDue} />
              <TouchableOpacity style={{ backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm, flexDirection: 'row', justifyContent: 'center' }} onPress={addItem} disabled={addingItem}>
                {addingItem ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Add Item</Text>}
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </Modal>
      </View>
    );
  }

  // ── Doc list / welcome ────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: 12, backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10, paddingTop: insets.top + 12 }}>
        <Text style={{ flex: 1, color: Colors.textPrimary, fontSize: 20, fontWeight: '800' }}>Workspace</Text>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8 }} onPress={() => setCreateDocOpen(true)}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>New</Text>
        </TouchableOpacity>
      </View>

      {docs.length === 0 ? (
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: Spacing.lg, paddingBottom: 40 }}>
          <Ionicons name="albums-outline" size={52} color={Colors.primary} style={{ marginBottom: Spacing.md }} />
          <Text style={{ color: Colors.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>Your Personal Workspace</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl }}>Organize tasks, projects, goals and notes{'\n'}— all in one place.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center', paddingHorizontal: Spacing.md, marginTop: Spacing.sm }}>
            {DOC_TYPES.map(t => (
              <TouchableOpacity key={t.key}
                style={{ width: '45%', backgroundColor: Colors.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: t.color + '44', padding: Spacing.md, alignItems: 'center' }}
                onPress={() => { setNewType(t.key); setCreateDocOpen(true); }}
              >
                <View style={{ borderRadius: Radius.sm, padding: 12, marginBottom: 10, backgroundColor: t.color + '1a' }}>
                  <Ionicons name={t.icon} size={24} color={t.color} />
                </View>
                <Text style={{ color: Colors.textPrimary, fontWeight: '600', fontSize: 13, textAlign: 'center' }}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} style={{ backgroundColor: Colors.bg }}>
          {DOC_TYPES.filter(t => docsByType[t.key]?.length).map(t => (
            <View key={t.key}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 4 }}>
                <Ionicons name={t.icon} size={13} color={t.color} />
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: t.color }}>{t.label.toUpperCase()}</Text>
              </View>
              {docsByType[t.key].map(doc => (
                <TouchableOpacity key={doc.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border, borderLeftWidth: 3, borderLeftColor: doc.color || t.color, backgroundColor: Colors.bgCard }} onPress={() => openDoc(doc)}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.textPrimary, fontWeight: '600', fontSize: 15 }}>{doc.title}</Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>{doc.item_count} items</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          ))}

          <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.lg, paddingBottom: 4 }}>CREATE NEW</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center', paddingHorizontal: Spacing.md, marginTop: Spacing.sm }}>
            {DOC_TYPES.map(t => (
              <TouchableOpacity key={t.key}
                style={{ width: '45%', backgroundColor: Colors.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: t.color + '44', padding: Spacing.md, alignItems: 'center' }}
                onPress={() => { setNewType(t.key); setCreateDocOpen(true); }}
              >
                <View style={{ borderRadius: Radius.sm, padding: 12, marginBottom: 10, backgroundColor: t.color + '1a' }}>
                  <Ionicons name={t.icon} size={22} color={t.color} />
                </View>
                <Text style={{ color: Colors.textPrimary, fontWeight: '600', fontSize: 13, textAlign: 'center' }}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      <Modal visible={createDocOpen} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: 40, borderTopWidth: 1, borderTopColor: Colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
              <Text style={{ color: Colors.textPrimary, fontSize: 18, fontWeight: '700' }}>New Document</Text>
              <TouchableOpacity onPress={() => setCreateDocOpen(false)}><Ionicons name="close" size={22} color={Colors.textMuted} /></TouchableOpacity>
            </View>
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12 }}>Type</Text>
            {DOC_TYPES.map(t => (
              <TouchableOpacity key={t.key}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, borderRadius: Radius.xs, backgroundColor: newType === t.key ? Colors.primary + '11' : 'transparent' }}
                onPress={() => setNewType(t.key)}
              >
                <Ionicons name={t.icon} size={17} color={newType === t.key ? Colors.primary : Colors.textSecondary} style={{ marginRight: 10 }} />
                <Text style={{ color: newType === t.key ? Colors.primary : Colors.textPrimary, fontSize: 15 }}>{t.label}</Text>
                {newType === t.key && <Ionicons name="checkmark" size={16} color={Colors.primary} style={{ marginLeft: 'auto' as any }} />}
              </TouchableOpacity>
            ))}
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: 12 }}>Title</Text>
            <TextInput style={{ backgroundColor: Colors.bg, color: Colors.textPrimary, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 4 }} placeholder="Document title..." placeholderTextColor={Colors.textMuted} value={newTitle} onChangeText={setNewTitle} />
            <TouchableOpacity style={{ backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm, flexDirection: 'row', justifyContent: 'center' }} onPress={createDoc} disabled={creatingDoc}>
              {creatingDoc ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Create Document</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}


// No static StyleSheet — all styles are inline and driven by useTheme() per render
