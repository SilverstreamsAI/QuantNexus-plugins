/**
 * Strategy Builder Plugin Hooks
 *
 * @see TICKET_077_D2 - Unified Generate Workflow
 * @see TICKET_190 - LLM Access Check
 */

// LLM Access Hook (TICKET_190)
export { useLLMAccess } from './useLLMAccess';
export type {
  LLMAccessResult,
  UseLLMAccessOptions,
  UseLLMAccessReturn,
} from './useLLMAccess';

// Generate Workflow Hook (TICKET_077_D2)
export { useGenerateWorkflow } from './useGenerateWorkflow';
export type {
  GenerationResult,
  GenerateResultState,
  CodeDisplayState,
  GenerateWorkflowConfig,
  GenerateWorkflowCallbacks,
  GenerateWorkflowState,
  GenerateWorkflowActions,
  GenerateWorkflowLLMAccess,
  UseGenerateWorkflowReturn,
} from './useGenerateWorkflow';
