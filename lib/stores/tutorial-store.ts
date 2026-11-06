import { create } from 'zustand';

interface TutorialState {
  isOpen: boolean;
  currentStep: number;
  openTutorial: (step?: number) => void;
  closeTutorial: () => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
}

export const useTutorialStore = create<TutorialState>((set) => ({
  isOpen: false,
  currentStep: 0,
  openTutorial: (step = 0) => set({ isOpen: true, currentStep: step }),
  closeTutorial: () => set({ isOpen: false }),
  setStep: (step) => set({ currentStep: step }),
  nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 5) })),
  prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 0) })),
}));

