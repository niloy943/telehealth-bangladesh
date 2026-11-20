import { useSyncExternalStore } from 'react';

export interface MedicationItem {
  id: string;
  name: string;
  dosage: string;
  timing: string;
  duration: string;
  instructions: string;
}

export interface PrescriptionDraftState {
  sessionId: string | null;
  chiefComplaints: string;
  clinicalDiagnosis: string;
  medications: MedicationItem[];
  doctorAdvice: string;
  setField: (field: 'chiefComplaints' | 'clinicalDiagnosis' | 'doctorAdvice', value: string) => void;
  addMedication: (item: Omit<MedicationItem, 'id'>) => void;
  removeMedication: (id: string) => void;
  purgeDraftFromMemory: () => void;
}

// In-memory vanilla store implementation compatible with Zustand create API
function createStore<T>(initializer: (set: (fn: (state: T) => Partial<T> | T) => void, get: () => T) => T) {
  let state: T;
  const listeners = new Set<() => void>();

  const setState = (fn: (state: T) => Partial<T> | T) => {
    const nextState = typeof fn === 'function' ? (fn as (s: T) => Partial<T>)(state) : fn;
    state = Object.assign({}, state, nextState);
    listeners.forEach((listener) => listener());
  };

  const getState = () => state;

  state = initializer(setState, getState);

  const useStore = () => {
    return useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => state,
      () => state
    );
  };

  Object.assign(useStore, { getState, setState });
  return useStore as (() => T) & { getState: () => T; setState: typeof setState };
}

export const usePrescriptionDraftStore = createStore<PrescriptionDraftState>((set) => ({
  sessionId: 'session_19',
  chiefComplaints: 'Dry cough for 3 days, mild sore throat',
  clinicalDiagnosis: 'Acid Peptic Disorder / GERD',
  medications: [
    {
      id: 'rx_item_1',
      name: 'Napa Extend',
      dosage: '665mg',
      timing: '1+0+1 (After meal)',
      duration: '5 Days',
      instructions: 'Take after meal with warm water',
    },
  ],
  doctorAdvice: 'Drink plenty of warm water. Avoid dust exposure. Follow up in 7 days if symptoms persist.',
  setField: (field, value) => set((state) => ({ ...state, [field]: value })),
  addMedication: (item) =>
    set((state) => ({
      medications: [
        ...state.medications,
        { ...item, id: `rx_item_${Date.now()}` },
      ],
    })),
  removeMedication: (id) =>
    set((state) => ({
      medications: state.medications.filter((m) => m.id !== id),
    })),
  purgeDraftFromMemory: () =>
    set(() => ({
      sessionId: null,
      chiefComplaints: '',
      clinicalDiagnosis: '',
      medications: [],
      doctorAdvice: '',
    })),
}));

