// Lightweight toast hook — adapted from shadcn pattern
import * as React from 'react';
import type { ToastProps } from './toast';

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
};

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 4000;

type State = { toasts: ToasterToast[] };

type Action =
  | { type: 'ADD'; toast: ToasterToast }
  | { type: 'DISMISS'; id?: string }
  | { type: 'REMOVE'; id?: string };

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD':
      return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) };
    case 'DISMISS':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.id || action.id === undefined
            ? { ...t, open: false }
            : t,
        ),
      };
    case 'REMOVE':
      return action.id === undefined
        ? { ...state, toasts: [] }
        : { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
  }
};

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((l) => l(memoryState));
}

type ToastInput = Omit<ToasterToast, 'id'>;

export function toast(props: ToastInput) {
  const id = genId();
  const dismiss = () => dispatch({ type: 'DISMISS', id });

  dispatch({
    type: 'ADD',
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  setTimeout(() => {
    dispatch({ type: 'REMOVE', id });
  }, TOAST_REMOVE_DELAY);

  return { id, dismiss };
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const idx = listeners.indexOf(setState);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (id?: string) => dispatch({ type: 'DISMISS', id }),
  };
}
