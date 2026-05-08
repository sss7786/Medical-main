import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Pill, AlertTriangle, Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { MedicationItem } from '@/types/report';
import { toast } from 'sonner';

interface MedicationCardsProps {
  medications?: MedicationItem[];
  allergies?: string[];
  memoryNote?: string;
  onChangeMeds?: (meds: MedicationItem[]) => void;
  onChangeAllergies?: (algs: string[]) => void;
}

export function MedicationCards({
  medications = [],
  allergies = [],
  memoryNote,
  onChangeMeds,
  onChangeAllergies,
}: MedicationCardsProps) {
  const { t } = useTranslation();
  const editable = !!onChangeMeds;

  // ── 用药编辑状态 ──
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [medDraft, setMedDraft] = useState<Partial<MedicationItem>>({});
  const [addingMed, setAddingMed] = useState(false);
  const [newMed, setNewMed] = useState<Partial<MedicationItem>>({ type: 'otc' });

  // ── 过敏编辑状态 ──
  const [editingAlgIdx, setEditingAlgIdx] = useState<number | null>(null);
  const [algDraft, setAlgDraft] = useState('');
  const [addingAlg, setAddingAlg] = useState(false);
  const [newAlg, setNewAlg] = useState('');

  const defaultNote =
    allergies.length > 0
      ? '记忆：已记录的过敏信息与用药条目将随会话持久化保存在后端 data/memory 目录（作业演示用）。'
      : '当您配置 API Key 并完成「刷新报告」后，会从对话中抽取用药与过敏信息并写入会话记忆。';

  // ── 用药操作 ──
  const commitMedEdit = () => {
    if (!editingMedId) return;
    onChangeMeds?.(medications.map((m) => m.id === editingMedId ? { ...m, ...medDraft } as MedicationItem : m));
    setEditingMedId(null);
    toast.success('用药信息已更新');
  };

  const deleteMed = (id: string) => {
    onChangeMeds?.(medications.filter((m) => m.id !== id));
    toast.success('已删除用药条目');
  };

  const addMed = () => {
    if (!newMed.name?.trim()) { toast.warning('请填写药品名称'); return; }
    const med: MedicationItem = {
      id: `m${Date.now()}`,
      name: newMed.name.trim(),
      frequency: newMed.frequency || '待补充',
      duration: newMed.duration || '待补充',
      type: newMed.type as 'prescription' | 'otc' || 'otc',
    };
    onChangeMeds?.([...medications, med]);
    setNewMed({ type: 'otc' });
    setAddingMed(false);
    toast.success('已添加用药条目');
  };

  // ── 过敏操作 ──
  const commitAlgEdit = (idx: number) => {
    if (!algDraft.trim()) return;
    const next = [...allergies];
    next[idx] = algDraft.trim();
    onChangeAllergies?.(next);
    setEditingAlgIdx(null);
    toast.success('过敏记录已更新');
  };

  const deleteAlg = (idx: number) => {
    onChangeAllergies?.(allergies.filter((_, i) => i !== idx));
    toast.success('已删除过敏记录');
  };

  const addAlg = () => {
    if (!newAlg.trim()) { toast.warning('请填写过敏原'); return; }
    onChangeAllergies?.([...allergies, newAlg.trim()]);
    setNewAlg('');
    setAddingAlg(false);
    toast.success('已添加过敏记录');
  };

  return (
    <div className="space-y-5">
      {/* 用药 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Pill className="w-4 h-4 text-primary" />
            {t('medication.currentMedication')}
          </h3>
          {editable && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => setAddingMed(true)}
            >
              <Plus className="w-3 h-3" />添加
            </Button>
          )}
        </div>

        {medications.length === 0 && !addingMed ? (
          <p className="text-sm text-muted-foreground">暂未整理到用药信息，请在左侧补充或通过 PDF 摘录。</p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            <AnimatePresence>
              {medications.map((med, index) => (
                <motion.div
                  key={med.id || med.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                >
                  {editingMedId === med.id ? (
                    <Card className="border-l-4 border-l-primary">
                      <CardContent className="p-3 space-y-2">
                        <Input
                          value={medDraft.name ?? med.name}
                          onChange={(e) => setMedDraft((d) => ({ ...d, name: e.target.value }))}
                          placeholder="药品名称"
                          className="h-7 text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={medDraft.frequency ?? med.frequency}
                            onChange={(e) => setMedDraft((d) => ({ ...d, frequency: e.target.value }))}
                            placeholder="用法用量"
                            className="h-7 text-xs"
                          />
                          <Input
                            value={medDraft.duration ?? med.duration}
                            onChange={(e) => setMedDraft((d) => ({ ...d, duration: e.target.value }))}
                            placeholder="疗程"
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={medDraft.type ?? med.type}
                            onChange={(e) => setMedDraft((d) => ({ ...d, type: e.target.value as 'prescription' | 'otc' }))}
                            className="flex-1 h-7 text-xs border rounded px-2 bg-background"
                          >
                            <option value="prescription">处方药</option>
                            <option value="otc">非处方</option>
                          </select>
                          <button onClick={commitMedEdit} className="p-1 text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingMedId(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="hover:shadow-md transition-all border-l-4 border-l-primary group">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm mb-1 truncate">{med.name}</h4>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>• {med.frequency}</span>
                              <span>• {med.duration}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge variant={med.type === 'prescription' ? 'default' : 'secondary'} className="text-xs">
                              {med.type === 'prescription' ? '处方药' : '非处方'}
                            </Badge>
                            {editable && (
                              <>
                                <button
                                  onClick={() => { setEditingMedId(med.id); setMedDraft({}); }}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-all rounded"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteMed(med.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* 添加新用药 */}
            {addingMed && (
              <Card className="border-l-4 border-l-primary border-dashed">
                <CardContent className="p-3 space-y-2">
                  <Input
                    value={newMed.name || ''}
                    onChange={(e) => setNewMed((d) => ({ ...d, name: e.target.value }))}
                    placeholder="药品名称 *"
                    className="h-7 text-sm"
                    autoFocus
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={newMed.frequency || ''}
                      onChange={(e) => setNewMed((d) => ({ ...d, frequency: e.target.value }))}
                      placeholder="用法用量"
                      className="h-7 text-xs"
                    />
                    <Input
                      value={newMed.duration || ''}
                      onChange={(e) => setNewMed((d) => ({ ...d, duration: e.target.value }))}
                      placeholder="疗程"
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={newMed.type || 'otc'}
                      onChange={(e) => setNewMed((d) => ({ ...d, type: e.target.value as 'prescription' | 'otc' }))}
                      className="flex-1 h-7 text-xs border rounded px-2 bg-background"
                    >
                      <option value="prescription">处方药</option>
                      <option value="otc">非处方</option>
                    </select>
                    <button onClick={addMed} className="p-1 text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
                    <button onClick={() => { setAddingMed(false); setNewMed({ type: 'otc' }); }} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* 过敏史 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            {t('medication.allergies')}
          </h3>
          {editable && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => setAddingAlg(true)}
            >
              <Plus className="w-3 h-3" />添加
            </Button>
          )}
        </div>

        {allergies.length === 0 && !addingAlg ? (
          <p className="text-sm text-muted-foreground">暂无过敏记录（或未在对话中提到）。</p>
        ) : (
          <Card className="border-l-4 border-l-destructive bg-destructive/5">
            <CardContent className="p-3">
              <div className="space-y-2">
                <AnimatePresence>
                  {allergies.map((allergy, index) => (
                    <motion.div
                      key={`${allergy}-${index}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-2 group"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                      {editingAlgIdx === index ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input
                            value={algDraft}
                            onChange={(e) => setAlgDraft(e.target.value)}
                            className="h-6 text-xs flex-1"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') commitAlgEdit(index); if (e.key === 'Escape') setEditingAlgIdx(null); }}
                          />
                          <button onClick={() => commitAlgEdit(index)} className="p-0.5 text-green-600"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingAlgIdx(null)} className="p-0.5 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-destructive flex-1">{allergy}</span>
                          {editable && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingAlgIdx(index); setAlgDraft(allergy); }} className="p-0.5 text-muted-foreground hover:text-foreground">
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button onClick={() => deleteAlg(index)} className="p-0.5 text-muted-foreground hover:text-destructive">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {addingAlg && (
                  <div className="flex items-center gap-1 mt-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                    <Input
                      value={newAlg}
                      onChange={(e) => setNewAlg(e.target.value)}
                      className="h-6 text-xs flex-1"
                      placeholder="输入过敏原"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') addAlg(); if (e.key === 'Escape') { setAddingAlg(false); setNewAlg(''); } }}
                    />
                    <button onClick={addAlg} className="p-0.5 text-green-600"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { setAddingAlg(false); setNewAlg(''); }} className="p-0.5 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 会话记忆提示 */}
      <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
        <div className="flex items-start gap-2">
          <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">会话记忆：</span>
            {memoryNote?.trim() || defaultNote}
          </p>
        </div>
      </div>
    </div>
  );
}
