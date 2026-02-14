import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji icon
  targetView?: string; // which view this step relates to
  highlightSelector?: string; // optional CSS selector to highlight
  position?: 'center' | 'top' | 'bottom'; // popup position
}

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to RFE Foam Pro!',
    description: 'Let\'s take a quick tour of your workspace so you can hit the ground running. This will only take a minute!',
    icon: '👋',
    position: 'center',
  },
  {
    id: 'dashboard',
    title: 'Your Dashboard',
    description: 'This is your command center. View all your jobs, track revenue, monitor inventory levels, and see financial insights at a glance.',
    icon: '📊',
    targetView: 'dashboard',
    highlightSelector: '[data-walkthrough="dashboard"]',
    position: 'center',
  },
  {
    id: 'create_new',
    title: 'Create New Items',
    description: 'Tap the "+" button to quickly create a New Estimate, add a New Customer, or Generate an Invoice. This is your go-to action hub.',
    icon: '➕',
    targetView: 'dashboard',
    highlightSelector: '[data-walkthrough="create-new"]',
    position: 'center',
  },
  {
    id: 'customers',
    title: 'Customer Management',
    description: 'Manage all your leads and customers here. Add contact info, track job history, and start estimates directly from a customer profile.',
    icon: '👥',
    targetView: 'customers',
    highlightSelector: '[data-walkthrough="customers"]',
    position: 'center',
  },
  {
    id: 'calculator',
    title: 'Estimate Calculator',
    description: 'Build accurate spray foam estimates in seconds. Enter building dimensions, select foam types, add materials — then convert to Work Orders or Invoices.',
    icon: '🧮',
    targetView: 'calculator',
    position: 'center',
  },
  {
    id: 'warehouse',
    title: 'Warehouse & Inventory',
    description: 'Track your open cell and closed cell foam sets, manage supplies, and monitor stock levels. Never show up to a job short on materials.',
    icon: '🏭',
    targetView: 'warehouse',
    highlightSelector: '[data-walkthrough="warehouse"]',
    position: 'center',
  },
  {
    id: 'workflow',
    title: 'Estimate → Work Order → Invoice',
    description: 'Your workflow is simple: Create an Estimate, convert it to a Work Order when sold, track job progress, then generate an Invoice — all in one flow.',
    icon: '🔄',
    position: 'center',
  },
  {
    id: 'settings',
    title: 'Settings & Defaults',
    description: 'Configure your foam yields, material costs, labor rates, and pricing defaults. Set these once and every new estimate will use them automatically.',
    icon: '⚙️',
    targetView: 'settings',
    highlightSelector: '[data-walkthrough="settings"]',
    position: 'center',
  },
  {
    id: 'profile',
    title: 'Company Profile',
    description: 'Add your company name, address, logo, and contact info. This appears on all your estimates, work orders, and invoices.',
    icon: '🏢',
    targetView: 'profile',
    highlightSelector: '[data-walkthrough="profile"]',
    position: 'center',
  },
  {
    id: 'sync',
    title: 'Cloud Sync',
    description: 'Your data syncs automatically to the cloud. Look for the green dot or sync icon in the header — it keeps your data safe and accessible from any device.',
    icon: '☁️',
    position: 'center',
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'You now know the essentials. Start by setting up your Company Profile, then create your first estimate. You can replay this tour anytime from Settings.',
    icon: '🎉',
    position: 'center',
  },
];

interface WalkthroughContextType {
  isActive: boolean;
  currentStepIndex: number;
  currentStep: WalkthroughStep | null;
  totalSteps: number;
  startWalkthrough: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipWalkthrough: () => void;
  completeWalkthrough: () => void;
  hasCompletedWalkthrough: boolean;
}

const WalkthroughContext = createContext<WalkthroughContextType | undefined>(undefined);

const WALKTHROUGH_STORAGE_KEY = 'rfe_walkthrough_completed';

export const WalkthroughProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(() => {
    try {
      return localStorage.getItem(WALKTHROUGH_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const startWalkthrough = useCallback(() => {
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStepIndex < WALKTHROUGH_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Last step — complete
      setIsActive(false);
      setHasCompleted(true);
      try {
        localStorage.setItem(WALKTHROUGH_STORAGE_KEY, 'true');
      } catch {}
    }
  }, [currentStepIndex]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const skipWalkthrough = useCallback(() => {
    setIsActive(false);
    setHasCompleted(true);
    try {
      localStorage.setItem(WALKTHROUGH_STORAGE_KEY, 'true');
    } catch {}
  }, []);

  const completeWalkthrough = useCallback(() => {
    setIsActive(false);
    setHasCompleted(true);
    try {
      localStorage.setItem(WALKTHROUGH_STORAGE_KEY, 'true');
    } catch {}
  }, []);

  const currentStep = isActive ? WALKTHROUGH_STEPS[currentStepIndex] : null;

  return (
    <WalkthroughContext.Provider value={{
      isActive,
      currentStepIndex,
      currentStep,
      totalSteps: WALKTHROUGH_STEPS.length,
      startWalkthrough,
      nextStep,
      prevStep,
      skipWalkthrough,
      completeWalkthrough,
      hasCompletedWalkthrough: hasCompleted,
    }}>
      {children}
    </WalkthroughContext.Provider>
  );
};

export const useWalkthrough = () => {
  const context = useContext(WalkthroughContext);
  if (!context) {
    throw new Error('useWalkthrough must be used within a WalkthroughProvider');
  }
  return context;
};
