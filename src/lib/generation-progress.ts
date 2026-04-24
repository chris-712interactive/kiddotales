type GenerationStatus = "running" | "completed" | "failed";

export type GenerationProgressPayload = {
  completedSteps: number;
  totalSteps: number;
  status: GenerationStatus;
  error?: string;
  updatedAt: number;
};

type ProgressStore = Map<string, GenerationProgressPayload>;
type Listener = (payload: GenerationProgressPayload) => void;
type ListenerStore = Map<string, Set<Listener>>;

declare global {
  // eslint-disable-next-line no-var
  var __kiddotalesProgressStore: ProgressStore | undefined;
  // eslint-disable-next-line no-var
  var __kiddotalesProgressListeners: ListenerStore | undefined;
}

const progressStore: ProgressStore =
  globalThis.__kiddotalesProgressStore ?? new Map<string, GenerationProgressPayload>();
const listenerStore: ListenerStore =
  globalThis.__kiddotalesProgressListeners ?? new Map<string, Set<Listener>>();

globalThis.__kiddotalesProgressStore = progressStore;
globalThis.__kiddotalesProgressListeners = listenerStore;

function emit(bookId: string, payload: GenerationProgressPayload) {
  progressStore.set(bookId, payload);
  const listeners = listenerStore.get(bookId);
  if (!listeners?.size) return;
  for (const listener of listeners) listener(payload);
}

export function getGenerationProgress(bookId: string): GenerationProgressPayload | null {
  return progressStore.get(bookId) ?? null;
}

export function setGenerationProgress(
  bookId: string,
  completedSteps: number,
  totalSteps = 10
): GenerationProgressPayload {
  const payload: GenerationProgressPayload = {
    completedSteps: Math.max(0, Math.min(totalSteps, completedSteps)),
    totalSteps,
    status: "running",
    updatedAt: Date.now(),
  };
  emit(bookId, payload);
  return payload;
}

export function completeGenerationProgress(bookId: string, totalSteps = 10) {
  const prev = progressStore.get(bookId);
  emit(bookId, {
    completedSteps: totalSteps,
    totalSteps,
    status: "completed",
    updatedAt: Date.now(),
    error: prev?.error,
  });
}

export function failGenerationProgress(bookId: string, error?: string) {
  const prev = progressStore.get(bookId);
  emit(bookId, {
    completedSteps: prev?.completedSteps ?? 0,
    totalSteps: prev?.totalSteps ?? 10,
    status: "failed",
    updatedAt: Date.now(),
    error,
  });
}

export function subscribeGenerationProgress(
  bookId: string,
  listener: Listener
): () => void {
  const listeners = listenerStore.get(bookId) ?? new Set<Listener>();
  listeners.add(listener);
  listenerStore.set(bookId, listeners);
  return () => {
    const current = listenerStore.get(bookId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listenerStore.delete(bookId);
  };
}
