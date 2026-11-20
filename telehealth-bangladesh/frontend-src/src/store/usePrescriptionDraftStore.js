import { useSyncExternalStore } from 'react';

// In-memory vanilla store compatible with Zustand create API
function createStore(initializer) {
  let state;
  const listeners = new Set();

  const setState = (fn) => {
    const nextState = typeof fn === 'function' ? fn(state) : fn;
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
  return useStore;
}

export const usePrescriptionDraftStore = createStore((set) => ({
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
    set((state) => {
      if (state.medications.length >= 30) {
        return state;
      }
      return {
        medications: [
          ...state.medications,
          {
            route: 'Oral',
            ...item,
            id: `rx_item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          },
        ],
      };
    }),
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

