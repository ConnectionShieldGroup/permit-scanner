import { useState } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCardDialog } from './KanbanCardDialog';
import type {
  KanbanBoard as KanbanBoardType,
  KanbanCard,
  KanbanColumn as KanbanColumnType,
} from '../lib/types';

interface ColumnDef {
  key: KanbanColumnType;
  label: string;
  accent: string;
}

interface KanbanBoardProps {
  columns: ColumnDef[];
  cards: KanbanCard[];
  onMove: (cardId: string, newColumn: KanbanColumnType) => void;
  onUpdateNotes?: (cardId: string, notes: string) => void;
  onRemove?: (cardId: string) => void;
  board: KanbanBoardType;
}

export function KanbanBoard({
  columns,
  cards,
  onMove,
  onUpdateNotes,
  onRemove,
}: KanbanBoardProps) {
  const [openCard, setOpenCard] = useState<KanbanCard | null>(null);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )
      return;
    onMove(draggableId, destination.droppableId as KanbanColumnType);
  };

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
          {columns.map((col) => (
            <KanbanColumn
              key={col.key}
              columnKey={col.key}
              label={col.label}
              accent={col.accent}
              cards={cards.filter((c) => c.column_status === col.key)}
              onCardClick={setOpenCard}
            />
          ))}
        </div>
      </DragDropContext>

      <KanbanCardDialog
        card={openCard}
        onClose={() => setOpenCard(null)}
        onSaveNotes={(notes) => {
          if (openCard && onUpdateNotes) {
            onUpdateNotes(openCard.id, notes);
          }
        }}
        onMove={onMove}
        onRemove={onRemove}
      />
    </>
  );
}
