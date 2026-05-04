import { Droppable, Draggable } from '@hello-pangea/dnd';
import { PermitCard } from './PermitCard';
import { cn } from '../lib/cn';
import type { KanbanCard, KanbanColumn as KanbanColumnType } from '../lib/types';

interface KanbanColumnProps {
  columnKey: KanbanColumnType;
  label: string;
  accent: string;
  cards: KanbanCard[];
  onCardClick?: (card: KanbanCard) => void;
}

export function KanbanColumn({
  columnKey,
  label,
  accent,
  cards,
  onCardClick,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-72 shrink-0 rounded-2xl bg-bg-card/40 border border-border overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-secondary/40"
        style={{
          borderTop: `2px solid ${accent}`,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: accent }}
          />
          <h3 className="text-sm font-semibold text-white truncate">{label}</h3>
        </div>
        <span className="mono text-xs text-text-muted bg-bg-card rounded-full px-2 py-0.5 border border-border">
          {cards.length}
        </span>
      </div>

      <Droppable droppableId={columnKey}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex-1 min-h-[200px] p-2.5 space-y-2 overflow-y-auto transition-colors',
              snapshot.isDraggingOver && 'bg-gold-400/5',
            )}
            style={{ maxHeight: 'calc(100vh - 320px)' }}
          >
            {cards.map((card, index) => (
              <Draggable key={card.id} draggableId={card.id} index={index}>
                {(p, s) => (
                  <div
                    ref={p.innerRef}
                    {...p.draggableProps}
                    {...p.dragHandleProps}
                    className={cn(
                      'transition-shadow',
                      s.isDragging && 'shadow-2xl rotate-1',
                    )}
                    style={p.draggableProps.style}
                  >
                    {card.permit ? (
                      <PermitCard
                        permit={card.permit}
                        variant="kanban"
                        dragHandle
                        onClick={() => onCardClick?.(card)}
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-border p-3 text-xs text-text-muted">
                        Permit not loaded
                      </div>
                    )}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {cards.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center py-8 text-xs text-text-muted text-center px-4">
                Drop cards here
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
