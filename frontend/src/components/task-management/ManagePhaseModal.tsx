import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Modal, Form, Input, Button, Space, Divider, Typography, Flex, ColorPicker, Tooltip } from '@/shared/antd-imports';
import { PlusOutlined, HolderOutlined, EditOutlined, DeleteOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  addPhaseOption,
  fetchPhasesByProjectId,
  updatePhaseOrder,
  updatePhaseListOrder,
  updateProjectPhaseLabel,
  updatePhaseName,
  deletePhaseOption,
  updatePhaseColor,
} from '@/features/projects/singleProject/phase/phases.slice';
import { updatePhaseLabel } from '@/features/project/project.slice';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { Modal as AntModal } from '@/shared/antd-imports';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { fetchEnhancedKanbanGroups } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { PhaseColorCodes } from '@/shared/constants';
import './ManagePhaseModal.css';

const { Title, Text } = Typography;

interface ManagePhaseModalProps {
  open: boolean;
  onClose: () => void;
  projectId?: string;
}

interface PhaseItemProps {
  phase: ITaskPhase;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  isDarkMode: boolean;
}

// Sortable Phase Item Component (compact with hover actions)
const SortablePhaseItem: React.FC<PhaseItemProps & { id: string }> = ({
  id,
  phase,
  onRename,
  onDelete,
  onColorChange,
  isDarkMode,
}) => {
  const { t } = useTranslation('phases-drawer');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(phase.name || '');
  const [color, setColor] = useState(phase.color_code || PhaseColorCodes[0]);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<any>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = useCallback(() => {
    if (editName.trim() && editName.trim() !== phase.name) {
      onRename(id, editName.trim());
    }
    setIsEditing(false);
  }, [editName, id, onRename, phase.name]);

  const handleCancel = useCallback(() => {
    setEditName(phase.name || '');
    setIsEditing(false);
  }, [phase.name]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  const handleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleColorChangeComplete = useCallback(() => {
    if (color !== phase.color_code) {
      onColorChange(id, color);
    }
  }, [color, id, onColorChange, phase.color_code]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setColor(phase.color_code || PhaseColorCodes[0]);
  }, [phase.color_code]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative py-2.5 px-3 mb-2 rounded-lg border transition-all duration-300 ${
        isDarkMode
          ? 'bg-[#1f1f1f] border-[#303030] hover:bg-[#262626] hover:border-[#404040]'
          : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
      } ${isDragging ? 'shadow-xl z-50 scale-[1.02] border-blue-500/50' : 'hover:shadow-md'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-3">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className={`flex-shrink-0 cursor-grab active:cursor-grabbing p-1.5 rounded-md transition-all duration-200 ${
            isDarkMode 
              ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50' 
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200/50'
          }`}
        >
          <HolderOutlined className="text-sm" />
        </div>

        {/* Phase Color & Name Container */}
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <div className="flex-shrink-0 relative group/color">
            <ColorPicker
              value={color}
              onChange={(value) => setColor(value.toHexString())}
              onChangeComplete={handleColorChangeComplete}
              size="small"
              className="phase-color-picker opacity-0 absolute inset-0 z-10 cursor-pointer"
            />
            <div 
              className="w-4 h-4 rounded-full border-2 shadow-sm transition-transform group-hover/color:scale-110"
              style={{
                backgroundColor: color,
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <Input
                ref={inputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={`font-semibold text-sm border-0 px-0 py-0 shadow-none focus:ring-0 ${
                  isDarkMode 
                    ? 'bg-transparent text-gray-100 placeholder-gray-500' 
                    : 'bg-transparent text-gray-900 placeholder-gray-400'
                }`}
                placeholder={t('enterPhaseName')}
              />
            ) : (
              <Text
                className={`text-sm font-semibold cursor-pointer transition-colors block truncate ${
                  isDarkMode ? 'text-gray-200 hover:text-white' : 'text-gray-800 hover:text-blue-600'
                }`}
                onClick={handleClick}
                title={t('rename')}
              >
                {phase.name}
              </Text>
            )}
          </div>
        </div>

        {/* Hover Actions */}
        <div className={`flex items-center gap-1.5 transition-all duration-300 ${
          isHovered || isEditing ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
        }`}>
          <Tooltip title={t('rename')}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ fontSize: '13px' }} />}
              onClick={() => setIsEditing(true)}
              className={`h-7 w-7 flex items-center justify-center rounded-md transition-all duration-200 ${
                isDarkMode 
                  ? 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/10' 
                  : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
              }`}
            />
          </Tooltip>
          <Tooltip title={t('delete')}>
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined style={{ fontSize: '13px' }} />}
              onClick={() => onDelete(id)}
              className={`h-7 w-7 flex items-center justify-center rounded-md transition-all duration-200 ${
                isDarkMode 
                  ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10' 
                  : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
              }`}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

const ManagePhaseModal: React.FC<ManagePhaseModalProps> = ({
  open,
  onClose,
  projectId,
}) => {
  const { t } = useTranslation('phases-drawer');
  const dispatch = useAppDispatch();
  
  // Redux state
  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');
  const currentProjectId = useAppSelector(state => state.projectReducer.projectId);
  const { project } = useAppSelector(state => state.projectReducer);
  const { phaseList, loadingPhases } = useAppSelector(state => state.phaseReducer);
  
  const [phaseName, setPhaseName] = useState<string>(project?.phase_label || '');
  const [initialPhaseName, setInitialPhaseName] = useState<string>(project?.phase_label || '');
  const [sorting, setSorting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const finalProjectId = projectId || currentProjectId;

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (open && finalProjectId) {
      dispatch(fetchPhasesByProjectId(finalProjectId));
      setPhaseName(project?.phase_label || '');
      setInitialPhaseName(project?.phase_label || '');
    }
  }, [open, finalProjectId, project?.phase_label, dispatch]);

  const refreshTasks = useCallback(async () => {
    if (finalProjectId) {
      await dispatch(fetchTasksV3(finalProjectId));
      await dispatch(fetchEnhancedKanbanGroups(finalProjectId));
    }
  }, [finalProjectId, dispatch]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    if (!finalProjectId) return;
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = phaseList.findIndex(item => item.id === active.id);
      const newIndex = phaseList.findIndex(item => item.id === over.id);

      const newPhaseList = [...phaseList];
      const [movedItem] = newPhaseList.splice(oldIndex, 1);
      newPhaseList.splice(newIndex, 0, movedItem);

      try {
        setSorting(true);
        dispatch(updatePhaseListOrder(newPhaseList));

        const body = {
          from_index: oldIndex,
          to_index: newIndex,
          phases: newPhaseList,
          project_id: finalProjectId,
        };

        await dispatch(updatePhaseOrder({ projectId: finalProjectId, body })).unwrap();
        await refreshTasks();
      } catch (error) {
        dispatch(fetchPhasesByProjectId(finalProjectId));
        console.error('Error updating phase order', error);
      } finally {
        setSorting(false);
      }
    }
  }, [finalProjectId, phaseList, dispatch, refreshTasks]);

  const handleCreatePhase = useCallback(async () => {
    if (!newPhaseName.trim() || !finalProjectId) return;

    try {
      await dispatch(addPhaseOption({ projectId: finalProjectId, name: newPhaseName.trim() }));
      await dispatch(fetchPhasesByProjectId(finalProjectId));
      await refreshTasks();
      setNewPhaseName('');
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding phase:', error);
    }
  }, [finalProjectId, dispatch, refreshTasks, newPhaseName]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreatePhase();
    } else if (e.key === 'Escape') {
      setNewPhaseName('');
      setShowAddForm(false);
    }
  }, [handleCreatePhase]);

  const handleRenamePhase = useCallback(async (id: string, name: string) => {
    if (!finalProjectId) return;
    
    try {
      const phase = phaseList.find(p => p.id === id);
      if (!phase) return;

      const updatedPhase = { ...phase, name: name.trim() };
      const response = await dispatch(
        updatePhaseName({
          phaseId: id,
          phase: updatedPhase,
          projectId: finalProjectId,
        })
      ).unwrap();

      if (response.done) {
        dispatch(fetchPhasesByProjectId(finalProjectId));
        await refreshTasks();
      }
    } catch (error) {
      console.error('Error renaming phase:', error);
    }
  }, [finalProjectId, phaseList, dispatch, refreshTasks]);

  const handleDeletePhase = useCallback(async (id: string) => {
    if (!finalProjectId) return;
    
    AntModal.confirm({
      title: t('deletePhase'),
      content: t('deletePhaseConfirm'),
      okText: t('delete'),
      cancelText: t('cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const response = await dispatch(
            deletePhaseOption({ phaseOptionId: id, projectId: finalProjectId })
          ).unwrap();

          if (response.done) {
            dispatch(fetchPhasesByProjectId(finalProjectId));
            await refreshTasks();
          }
        } catch (error) {
          console.error('Error deleting phase:', error);
        }
      },
    });
  }, [finalProjectId, dispatch, refreshTasks, t]);

  const handleColorChange = useCallback(async (id: string, color: string) => {
    if (!finalProjectId) return;
    
    try {
      const phase = phaseList.find(p => p.id === id);
      if (!phase) return;

      const updatedPhase = { ...phase, color_code: color };
      const response = await dispatch(
        updatePhaseColor({ projectId: finalProjectId, body: updatedPhase })
      ).unwrap();

      if (response.done) {
        dispatch(fetchPhasesByProjectId(finalProjectId));
        await refreshTasks();
      }
    } catch (error) {
      console.error('Error changing phase color:', error);
    }
  }, [finalProjectId, phaseList, dispatch, refreshTasks]);

  const handlePhaseNameBlur = useCallback(async () => {
    if (!finalProjectId || phaseName === initialPhaseName) return;
    
    try {
      setIsSaving(true);
      const res = await dispatch(
        updateProjectPhaseLabel({ projectId: finalProjectId, phaseLabel: phaseName })
      ).unwrap();
      
      if (res.done) {
        dispatch(updatePhaseLabel(phaseName));
        setInitialPhaseName(phaseName);
        await refreshTasks();
      }
    } catch (error) {
      console.error('Error updating phase name:', error);
    } finally {
      setIsSaving(false);
    }
  }, [finalProjectId, phaseName, initialPhaseName, dispatch, refreshTasks]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Modal
      title={
        <Title level={4} className={`m-0 font-semibold ${
          isDarkMode ? 'text-gray-100' : 'text-gray-800'
        }`}>
          {t('configure')} {phaseName || project?.phase_label || t('phasesText')}
        </Title>
      }
      open={open}
      onCancel={handleClose}
      width={720}
      style={{ top: 20 }}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          padding: '16px',
        },
      }}
      footer={
        <div className={`flex justify-end pt-3 ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <Button 
            onClick={handleClose}
            className={`font-medium ${
              isDarkMode 
                ? 'text-gray-300 hover:text-gray-200 border-gray-600' 
                : 'text-gray-600 hover:text-gray-800 border-gray-300'
            }`}
          >
            {t('close')}
          </Button>
        </div>
      }
      className={`${isDarkMode ? 'dark-modal' : ''} phase-manage-modal`}
      loading={loadingPhases || sorting}
    >
      <div className="space-y-6">
        {/* Phase Label Configuration */}
        <div className={`p-4 rounded-xl border transition-all duration-300 ${
          isDarkMode 
            ? 'bg-[#1f1f1f] border-[#303030] shadow-inner' 
            : 'bg-blue-50/50 border-blue-100 shadow-sm'
        }`}>
          <Flex vertical gap={10}>
            <Flex align="center" gap={8}>
              <EditOutlined className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} />
              <Text className={`text-sm font-bold ${
                isDarkMode ? 'text-gray-200' : 'text-blue-800'
              }`}>
                {t('phaseLabel')}
              </Text>
            </Flex>
            <Input
              placeholder={t('enterPhaseName')}
              value={phaseName}
              onChange={e => setPhaseName(e.currentTarget.value)}
              onPressEnter={handlePhaseNameBlur}
              onBlur={handlePhaseNameBlur}
              disabled={isSaving}
              size="large"
              className={`rounded-lg border-2 transition-all ${
                isDarkMode 
                  ? 'bg-[#141414] border-[#333333] text-white focus:border-blue-500' 
                  : 'bg-white border-blue-100 text-gray-900 focus:border-blue-500'
              }`}
            />
          </Flex>
        </div>

        {/* Info Banner - Subtle and Minimal */}
        <div className={`px-4 py-2 rounded-lg border-l-4 transition-all duration-300 ${
          isDarkMode 
            ? 'bg-[#1f1f1f] border-blue-500/50 text-gray-400' 
            : 'bg-blue-50/30 border-blue-500 text-blue-700'
        }`}>
          <Text className="text-[11px] italic opacity-80">
            💡 Drag items to reorder. Click a name to rename. Customize colors by clicking the dot.
          </Text>
        </div>

        {/* Add New Phase Section - Prominent & Stylish */}
        <div className={`p-4 rounded-xl border-2 border-dashed transition-all duration-500 ${
          showAddForm 
            ? (isDarkMode ? 'border-blue-500/50 bg-blue-500/5' : 'border-blue-400 bg-blue-50/50')
            : (isDarkMode ? 'border-[#303030] bg-transparent' : 'border-gray-200 bg-gray-50/30')
        }`}>
          {!showAddForm ? (
            <Flex align="center" justify="space-between">
              <Text className={`text-sm font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {(phaseName || project?.phase_label || t('phasesText'))} Options
              </Text>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => setShowAddForm(true)}
                disabled={loadingPhases}
                className="rounded-lg h-9 font-bold shadow-lg shadow-blue-500/20"
              >
                Add Option
              </Button>
            </Flex>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <Input
                placeholder="Enter new option name..."
                value={newPhaseName}
                onChange={(e) => setNewPhaseName(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`h-10 text-sm rounded-lg ${
                  isDarkMode 
                    ? 'bg-[#141414] border-[#404040] text-white' 
                    : 'bg-white border-gray-300'
                }`}
                autoFocus
              />
              <Flex gap={10} justify="end">
                <Button
                  onClick={() => {
                    setNewPhaseName('');
                    setShowAddForm(false);
                  }}
                  className={`rounded-lg ${isDarkMode ? 'text-gray-400 border-[#404040]' : ''}`}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  onClick={handleCreatePhase}
                  disabled={!newPhaseName.trim()}
                  className="rounded-lg font-bold"
                >
                  Create Option
                </Button>
              </Flex>
            </div>
          )}
        </div>

        {/* Phase List with Drag & Drop */}
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext
            items={phaseList.map(phase => phase.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {phaseList.map((phase) => (
                <SortablePhaseItem
                  key={phase.id}
                  id={phase.id}
                  phase={phase}
                  onRename={handleRenamePhase}
                  onDelete={handleDeletePhase}
                  onColorChange={handleColorChange}
                  isDarkMode={isDarkMode}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {phaseList.length === 0 && (
          <div className={`text-center py-8 transition-colors ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <Text className="text-sm font-medium">
              {t('no')} {(phaseName || project?.phase_label || t('phasesText')).toLowerCase()} {t('found')}
            </Text>
            <br />
            <Button
              type="link"
              size="small"
              onClick={() => setShowAddForm(true)}
              className={`text-xs mt-1 font-medium ${
                isDarkMode 
                  ? 'text-blue-400 hover:text-blue-300' 
                  : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              {t('addOption')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ManagePhaseModal; 