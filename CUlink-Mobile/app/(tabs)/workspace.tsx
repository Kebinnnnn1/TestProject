import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal,
  TextInput, FlatList,
} from 'react-native';
import { workspaceAPI } from '../../services/api';
import { useAuthStore } from '../../store';
import { Colors, Spacing, Radius } from '../../constants';

// ── Types ──────────────────────────────────────────────────────────────────

interface WorkspaceItem {
  id: number;
  content: string;
  description: string;
  is_done: boolean;
  status: string;
  priority: string;
  task_type: string;
  due_date: string | null;
  progress: number;
  color: string;
  order: number;
}

interface WorkspaceDoc {
  id: number;
  type: string;
  title: string;
  color: string;
  updated_at: string;
  item_count: number;
  items?: WorkspaceItem[];
}

const DOC_TYPES = [
  { key: 'todo', label: '✅ To-Do List', color: '#4ade80' },
  { key: 'project', label: '🗂️ Project Tracker', color: '#60a5fa' },
  { key: 'goal', label: '🎯 Goal Tracker', color: '#f59e42' },
  { key: 'note', label: '📝 Notes', color: '#a78bfa' },
];

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['todo', 'in_progress', 'done', 'blocked'];

// ── Item Card ──────────────────────────────────────────────────────────────

function ItemCard({ item, docType, onUpdate, onDelete }: {
  item: WorkspaceItem;
  docType: string;
  onUpdate: (id: number, data: Partial<WorkspaceItem>) => void;
  onDelete: (id: number) => void;
}) {
  const statusColors: Record<string, string> = {
    todo: Colors.textMuted,
    in_progress: Colors.info,
    done: Colors.success,
    blocked: Colors.error,
  };
  const priorityColors: Record<string, string> = {
    low: Colors.success,
    medium: Colors.warning,
    high: Colors.error,
  };

  return (
    <View style={[styles.itemCard, { borderLeftColor: item.color || Colors.primary, borderLeftWidth: 3 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {docType === 'todo' && (
          <TouchableOpacity
            onPress={() => onUpdate(item.id, { is_done: !item.is_done })}
            style={[styles.checkbox, item.is_done && styles.checkboxDone]}
          >
            {item.is_done && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemContent, item.is_done && styles.itemDone]}>{item.content}</Text>
          {item.description ? (
            <Text style={styles.itemDesc}>{item.description}</Text>
          ) : null}
          <View style={styles.itemMeta}>
            <View style={[styles.pill, { backgroundColor: statusColors[item.status] + '33' }]}>
              <Text style={[styles.pillText, { color: statusColors[item.status] }]}>
                {item.status.replace('_', ' ')}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: priorityColors[item.priority] + '33' }]}>
              <Text style={[styles.pillText, { color: priorityColors[item.priority] }]}>
                {item.priority}
              </Text>
            </View>
            {item.due_date && (
              <Text style={styles.dueDate}>📅 {item.due_date}</Text>
            )}
          </View>
          {docType === 'project' && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${item.progress}%` as any }]} />
            </View>
          )}
        </View>

        <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteItemBtn}>
          <Text style={styles.deleteItemText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function WorkspaceScreen() {
  const [docs, setDocs] = useState<WorkspaceDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<WorkspaceDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [docLoading, setDocLoading] = useState(false);

  const [createDocVisible, setCreateDocVisible] = useState(false);
  const [newDocType, setNewDocType] = useState('todo');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocColor, setNewDocColor] = useState('#4E7C3F');
  const [creatingDoc, setCreatingDoc] = useState(false);

  const [createItemVisible, setCreateItemVisible] = useState(false);
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemPriority, setNewItemPriority] = useState('medium');
  const [newItemStatus, setNewItemStatus] = useState('todo');
  const [newItemDue, setNewItemDue] = useState('');
  const [creatingItem, setCreatingItem] = useState(false);

  const { user } = useAuthStore();

  useEffect(() => { loadDocs(); }, []);

  const loadDocs = async () => {
    try {
      const res = await workspaceAPI.getDocs();
      setDocs(res.data.docs);
    } catch {
      Alert.alert('Error', 'Could not load workspace.');
    } finally {
      setLoading(false);
    }
  };

  const openDoc = async (doc: WorkspaceDoc) => {
    setDocLoading(true);
    try {
      const res = await workspaceAPI.getDoc(doc.id);
      setSelectedDoc(res.data);
    } catch {
      Alert.alert('Error', 'Could not load document.');
    } finally {
      setDocLoading(false);
    }
  };

  const handleCreateDoc = async () => {
    if (!newDocTitle.trim()) { Alert.alert('Error', 'Please enter a title.'); return; }
    setCreatingDoc(true);
    try {
      const res = await workspaceAPI.createDoc({ type: newDocType, title: newDocTitle.trim(), color: newDocColor });
      setDocs((prev) => [res.data, ...prev]);
      setCreateDocVisible(false);
      setNewDocTitle('');
    } catch {
      Alert.alert('Error', 'Could not create document.');
    } finally {
      setCreatingDoc(false);
    }
  };

  const handleDeleteDoc = (id: number) => {
    Alert.alert('Delete Document', 'This will delete the document and all its items.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await workspaceAPI.deleteDoc(id);
            setDocs((prev) => prev.filter((d) => d.id !== id));
            setSelectedDoc(null);
          } catch {
            Alert.alert('Error', 'Could not delete document.');
          }
        },
      },
    ]);
  };

  const handleCreateItem = async () => {
    if (!selectedDoc || !newItemContent.trim()) return;
    setCreatingItem(true);
    try {
      const res = await workspaceAPI.createItem(selectedDoc.id, {
        content: newItemContent.trim(),
        description: newItemDesc.trim(),
        priority: newItemPriority,
        status: newItemStatus,
        due_date: newItemDue || null,
      });
      setSelectedDoc((prev) =>
        prev ? { ...prev, items: [...(prev.items || []), res.data], item_count: prev.item_count + 1 } : prev
      );
      setCreateItemVisible(false);
      setNewItemContent('');
      setNewItemDesc('');
      setNewItemDue('');
    } catch {
      Alert.alert('Error', 'Could not add item.');
    } finally {
      setCreatingItem(false);
    }
  };

  const handleUpdateItem = async (itemId: number, data: Partial<WorkspaceItem>) => {
    try {
      await workspaceAPI.updateItem(itemId, data);
      setSelectedDoc((prev) =>
        prev ? { ...prev, items: prev.items?.map((i) => i.id === itemId ? { ...i, ...data } : i) } : prev
      );
    } catch {}
  };

  const handleDeleteItem = (itemId: number) => {
    Alert.alert('Delete Item', 'Remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await workspaceAPI.deleteItem(itemId);
            setSelectedDoc((prev) =>
              prev ? { ...prev, items: prev.items?.filter((i) => i.id !== itemId), item_count: prev.item_count - 1 } : prev
            );
          } catch {}
        },
      },
    ]);
  };

  const typeInfo = (type: string) => DOC_TYPES.find((t) => t.key === type);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  // ── Doc detail view ──────────────────────────────────────────────────────
  if (selectedDoc) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedDoc(null)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.docTitle} numberOfLines={1}>{selectedDoc.title}</Text>
            <Text style={styles.docType}>{typeInfo(selectedDoc.type)?.label}</Text>
          </View>
          <TouchableOpacity style={styles.addItemBtn} onPress={() => setCreateItemVisible(true)}>
            <Text style={styles.addItemBtnText}>+ Item</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteDoc(selectedDoc.id)} style={{ marginLeft: 8 }}>
            <Text style={{ color: Colors.error, fontSize: 18 }}>🗑</Text>
          </TouchableOpacity>
        </View>

        {docLoading ? (
          <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
        ) : (
          <FlatList
            data={selectedDoc.items || []}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <ItemCard
                item={item}
                docType={selectedDoc.type}
                onUpdate={handleUpdateItem}
                onDelete={handleDeleteItem}
              />
            )}
            contentContainerStyle={{ padding: Spacing.sm }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyText}>No items yet</Text>
                <Text style={styles.emptySubtext}>Tap "+ Item" to add your first item</Text>
              </View>
            }
          />
        )}

        {/* Create Item Modal */}
        <Modal visible={createItemVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <ScrollView style={styles.modalCard} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Item</Text>
                <TouchableOpacity onPress={() => setCreateItemVisible(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Content *</Text>
              <TextInput
                style={styles.input}
                placeholder="What needs to be done?"
                placeholderTextColor={Colors.textMuted}
                value={newItemContent}
                onChangeText={setNewItemContent}
              />

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={styles.input}
                placeholder="Optional details..."
                placeholderTextColor={Colors.textMuted}
                value={newItemDesc}
                onChangeText={setNewItemDesc}
                multiline
              />

              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.pillRow}>
                {STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.selectPill, newItemStatus === s && styles.selectPillActive]}
                    onPress={() => setNewItemStatus(s)}
                  >
                    <Text style={[styles.selectPillText, newItemStatus === s && styles.selectPillTextActive]}>
                      {s.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Priority</Text>
              <View style={styles.pillRow}>
                {PRIORITIES.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.selectPill, newItemPriority === p && styles.selectPillActive]}
                    onPress={() => setNewItemPriority(p)}
                  >
                    <Text style={[styles.selectPillText, newItemPriority === p && styles.selectPillTextActive]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Due Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2025-12-31"
                placeholderTextColor={Colors.textMuted}
                value={newItemDue}
                onChangeText={setNewItemDue}
              />

              <TouchableOpacity style={styles.createBtn} onPress={handleCreateItem} disabled={creatingItem}>
                {creatingItem ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Add Item</Text>}
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </Modal>
      </View>
    );
  }

  // ── Doc list view ────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Workspace</Text>
        <TouchableOpacity style={styles.newDocBtn} onPress={() => setCreateDocVisible(true)}>
          <Text style={styles.newDocBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={docs}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={{ padding: Spacing.sm }}
        columnWrapperStyle={{ gap: Spacing.sm }}
        renderItem={({ item }) => {
          const info = typeInfo(item.type);
          return (
            <TouchableOpacity
              style={[styles.docCard, { borderTopColor: item.color, borderTopWidth: 3 }]}
              onPress={() => openDoc(item)}
            >
              <Text style={styles.docCardEmoji}>{info?.label.split(' ')[0]}</Text>
              <Text style={styles.docCardTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.docCardType}>{item.type}</Text>
              <Text style={styles.docCardCount}>{item.item_count} items</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyText}>No documents yet</Text>
            <Text style={styles.emptySubtext}>Tap "+ New" to create your first workspace document</Text>
          </View>
        }
      />

      {/* Create Doc Modal */}
      <Modal visible={createDocVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Document</Text>
              <TouchableOpacity onPress={() => setCreateDocVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Type</Text>
            {DOC_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeOption, newDocType === t.key && styles.typeOptionActive]}
                onPress={() => setNewDocType(t.key)}
              >
                <Text style={styles.typeOptionText}>{t.label}</Text>
                {newDocType === t.key && <Text style={{ color: Colors.primary }}>✓</Text>}
              </TouchableOpacity>
            ))}

            <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Document title..."
              placeholderTextColor={Colors.textMuted}
              value={newDocTitle}
              onChangeText={setNewDocTitle}
            />

            <TouchableOpacity style={styles.createBtn} onPress={handleCreateDoc} disabled={creatingDoc}>
              {creatingDoc ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Create Document</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingTop: 56, paddingBottom: Spacing.sm,
    backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  newDocBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
  },
  newDocBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  backBtn: { marginRight: Spacing.sm },
  backBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  docTitle: { color: Colors.textPrimary, fontWeight: '700', fontSize: 16, flex: 1 },
  docType: { color: Colors.textMuted, fontSize: 12 },
  addItemBtn: {
    backgroundColor: Colors.primary + '33', borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  addItemBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },

  docCard: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  docCardEmoji: { fontSize: 28, marginBottom: Spacing.sm },
  docCardTitle: { color: Colors.textPrimary, fontWeight: '700', fontSize: 15, marginBottom: 4 },
  docCardType: { color: Colors.textMuted, fontSize: 12, textTransform: 'capitalize' },
  docCardCount: { color: Colors.textSecondary, fontSize: 12, marginTop: 6 },

  itemCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.sm,
    padding: Spacing.sm, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 4,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.sm, marginTop: 1,
  },
  checkboxDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  itemContent: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  itemDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  itemDesc: { color: Colors.textSecondary, fontSize: 13, marginBottom: Spacing.sm },
  itemMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  dueDate: { color: Colors.textMuted, fontSize: 11 },
  progressBar: {
    height: 4, backgroundColor: Colors.border, borderRadius: 2,
    marginTop: Spacing.sm, overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  deleteItemBtn: { padding: 4, marginLeft: 4 },
  deleteItemText: { color: Colors.textMuted, fontSize: 14 },

  emptyState: { alignItems: 'center', paddingTop: Spacing.xxl },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  emptySubtext: { color: Colors.textMuted, fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: Spacing.xl },

  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.lg, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  modalClose: { color: Colors.textMuted, fontSize: 18 },

  fieldLabel: { color: Colors.textSecondary, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: Colors.bgInput, color: Colors.textPrimary,
    borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: 14, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.sm },
  selectPill: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
  },
  selectPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  selectPillText: { color: Colors.textSecondary, fontSize: 13, textTransform: 'capitalize' },
  selectPillTextActive: { color: '#fff', fontWeight: '700' },

  typeOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  typeOptionActive: { backgroundColor: Colors.primary + '11' },
  typeOptionText: { color: Colors.textPrimary, fontSize: 15 },

  createBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
