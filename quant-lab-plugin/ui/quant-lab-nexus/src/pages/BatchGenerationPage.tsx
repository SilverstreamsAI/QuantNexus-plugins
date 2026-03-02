/**
 * BatchGenerationPage Component
 *
 * TICKET_426_1: Independent sub-page for AI batch strategy generation.
 * TICKET_426_2: LLM settings from Zustand store (not props). PersonaSection
 *               is sole owner of preference/persona fields.
 */

import React from 'react';
import { BatchGenerationSection } from '../components/BatchGenerationSection';
import { PersonaSection } from '../components/PersonaSection';
import { FlowDivider } from '../components/FlowDivider';
import { useBatchGenerationStore } from '../stores/useBatchGenerationStore';

export const BatchGenerationPage: React.FC = () => {
  const { persona, setPersona, preference, setPreference } = useBatchGenerationStore();

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <BatchGenerationSection />

        <FlowDivider />

        <PersonaSection
          persona={persona}
          setPersona={setPersona}
          preference={preference}
          setPreference={setPreference}
        />
      </div>
    </div>
  );
};
