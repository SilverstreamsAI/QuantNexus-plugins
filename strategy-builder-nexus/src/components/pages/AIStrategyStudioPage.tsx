/**
 * AIStrategyStudioPage (page38)
 *
 * AI Strategy Studio workspace page for comprehensive AI-powered strategy creation.
 * Combines chat interface with strategy rules management.
 * Persists conversations and messages to SQLite via IPC.
 *
 * @see TICKET_077_19_AI_STRATEGY_STUDIO_COMPONENTS.md - Component specifications
 * @see TICKET_077_1_PAGE_HIERARCHY.md - Page definition (page38)
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  conversationService,
  ConversationRecord,
  MessageRecord,
} from '../../services/conversation-service';
import {
  executeVibingChat,
  executeVibingChatAction,
  getVibingChatErrorMessage,
  VibingChatRequest,
  VibingChatResponse,
  StrategyRulesResponse,
} from '../../services';
import { getCurrentUserIdAsString } from '../../utils/auth-utils';

// AI Studio Components (component19)
import {
  ConversationSidebar,
  Conversation,
  SessionInfoPanel,
  MessagesContainer,
  Message,
  ChatInputArea,
  ActionButtons,
  ActionButton,
  ActionId,
  StrategyRulesPanel,
  StrategyRule,
  RuleType,
} from '../ai-studio';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AIStrategyStudioPageProps {
  /** Page title */
  pageTitle?: string;
  /** Initial strategy name */
  strategyName?: string;
  /** Strategy ID */
  strategyId?: string;
  /** On strategy name change */
  onStrategyNameChange?: (name: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** LLM provider setting from plugin config */
  llmProvider?: string;
  /** LLM model setting from plugin config */
  llmModel?: string;
  /** Settings click handler */
  onSettingsClick?: () => void;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Generate unique ID for local state
 */
function generateLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert DB record to UI Conversation
 */
function toConversation(record: ConversationRecord): Conversation {
  return {
    id: String(record.id),
    title: record.title,
    preview: record.preview || '',
    timestamp: new Date(record.updated_at),
    messageCount: record.message_count,
  };
}

/**
 * Convert DB record to UI Message
 */
function toMessage(record: MessageRecord): Message {
  return {
    id: String(record.id),
    type: record.type,
    content: record.content,
    timestamp: new Date(record.created_at),
  };
}

/**
 * Estimate token count (simple approximation)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Delete all empty conversations (message_count === 0)
 * Called before creating a new conversation to prevent accumulation
 * TICKET_243: AI Strategy Studio Empty Conversation Cleanup
 */
async function cleanupEmptyConversations(
  conversations: Conversation[]
): Promise<string[]> {
  const emptyConversations = conversations.filter((c) => c.messageCount === 0);
  const deletedIds: string[] = [];

  for (const conv of emptyConversations) {
    const dbId = parseInt(conv.id, 10);
    if (!isNaN(dbId)) {
      const result = await conversationService.deleteConversation(dbId);
      if (result.success) {
        deletedIds.push(conv.id);
      }
    }
  }

  return deletedIds;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const AIStrategyStudioPage: React.FC<AIStrategyStudioPageProps> = ({
  pageTitle = 'AI Strategy Studio',
  strategyName: initialStrategyName = '',
  strategyId = '',
  onStrategyNameChange,
  className,
  llmProvider = 'NONA',
  llmModel = 'nona-fast',
  onSettingsClick,
}) => {
  const { t } = useTranslation('strategy-builder');
  // -------------------------------------------------------------------------
  // User State
  // -------------------------------------------------------------------------
  const [userId, setUserId] = useState<string>('');

  // -------------------------------------------------------------------------
  // Conversation State
  // -------------------------------------------------------------------------
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeDbId, setActiveDbId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);

  // -------------------------------------------------------------------------
  // Session State
  // -------------------------------------------------------------------------
  const [tokenUsage, setTokenUsage] = useState({ current: 0, limit: 128000 });

  // -------------------------------------------------------------------------
  // Strategy Rules State
  // -------------------------------------------------------------------------
  const [strategyRules, setStrategyRules] = useState<StrategyRule[]>([]);

  // -------------------------------------------------------------------------
  // Action Buttons
  // -------------------------------------------------------------------------
  const [actionStates, setActionStates] = useState<Record<ActionId, boolean>>({
    generate_code: false,
    save_strategy: false,
    run_backtest: false,
  });

  const availableActions = useMemo<ActionButton[]>(() => {
    if (messages.length === 0 && strategyRules.length === 0) {
      return [];
    }

    return [
      {
        id: 'generate_code',
        label: t('pages.aiStrategyStudio.actions.generateCode'),
        loading: actionStates.generate_code,
      },
      {
        id: 'save_strategy',
        label: t('pages.aiStrategyStudio.actions.saveStrategy'),
        loading: actionStates.save_strategy,
        disabled: strategyRules.length === 0,
      },
      {
        id: 'run_backtest',
        label: t('pages.aiStrategyStudio.actions.runBacktest'),
        loading: actionStates.run_backtest,
        disabled: strategyRules.length === 0,
      },
    ];
  }, [messages.length, strategyRules.length, actionStates]);

  // -------------------------------------------------------------------------
  // Load User & Conversations on Mount
  // TICKET_235: Always create a new chat on page load
  // -------------------------------------------------------------------------
  useEffect(() => {
    const loadUserAndConversations = async () => {
      try {
        // Get user ID from centralized auth utils
        const currentUserId = await getCurrentUserIdAsString();
        setUserId(currentUserId);

        // Load existing conversations from SQLite
        const result = await conversationService.listConversations(currentUserId);
        const loadedConversations = result.success && result.data
          ? result.data.map(toConversation)
          : [];

        // TICKET_243: Cleanup empty conversations before creating new one
        const deletedIds = await cleanupEmptyConversations(loadedConversations);
        const cleanedConversations = deletedIds.length > 0
          ? loadedConversations.filter((c) => !deletedIds.includes(c.id))
          : loadedConversations;

        // TICKET_235: Always create a new chat on page load
        const createResult = await conversationService.createConversation({
          userId: currentUserId,
          title: t('pages.aiStrategyStudio.newStrategyTitle'),
          preview: t('pages.aiStrategyStudio.newStrategyPreview'),
        });

        if (createResult.success && createResult.data) {
          const newConversation = toConversation(createResult.data);
          setConversations([newConversation, ...cleanedConversations]);
          setActiveConversationId(newConversation.id);
          setActiveDbId(createResult.data.id);
          setTokenUsage({ current: 0, limit: createResult.data.token_limit });
        } else {
          // Fallback: just load existing conversations
          setConversations(cleanedConversations);
        }
      } catch (error) {
        console.error('[AIStrategyStudio] Failed to load conversations:', error);
      } finally {
        setIsLoadingConversations(false);
      }
    };

    loadUserAndConversations();
  }, []);

  // -------------------------------------------------------------------------
  // Conversation Handlers
  // -------------------------------------------------------------------------
  const handleNewChat = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      // TICKET_243: Cleanup empty conversations before creating new one
      const deletedIds = await cleanupEmptyConversations(conversations);
      if (deletedIds.length > 0) {
        setConversations((prev) => prev.filter((c) => !deletedIds.includes(c.id)));
      }

      // Create conversation in SQLite
      const result = await conversationService.createConversation({
        userId,
        title: t('pages.aiStrategyStudio.newStrategyTitle'),
        preview: t('pages.aiStrategyStudio.newStrategyPreview'),
      });

      if (result.success && result.data) {
        const newConversation = toConversation(result.data);
        setConversations((prev) => [newConversation, ...prev]);
        setActiveConversationId(newConversation.id);
        setActiveDbId(result.data.id);
        setMessages([]);
        setStrategyRules([]);
        setTokenUsage({ current: 0, limit: result.data.token_limit });
      }
    } catch (error) {
      console.error('[AIStrategyStudio] Failed to create conversation:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, conversations]);

  const handleSelectConversation = useCallback(async (id: string) => {
    const dbId = parseInt(id, 10);
    if (isNaN(dbId)) return;

    setActiveConversationId(id);
    setActiveDbId(dbId);
    setIsLoading(true);

    try {
      // Load messages from SQLite
      const messagesResult = await conversationService.listMessages(dbId);
      if (messagesResult.success && messagesResult.data) {
        setMessages(messagesResult.data.map(toMessage));
      }

      // Load conversation details for token usage and rules
      const convResult = await conversationService.getConversation(dbId);
      if (convResult.success && convResult.data) {
        setTokenUsage({
          current: convResult.data.token_usage,
          limit: convResult.data.token_limit,
        });

        // Parse strategy rules if stored
        if (convResult.data.strategy_rules) {
          try {
            const rules = JSON.parse(convResult.data.strategy_rules);
            setStrategyRules(rules);
          } catch {
            setStrategyRules([]);
          }
        } else {
          setStrategyRules([]);
        }
      }
    } catch (error) {
      console.error('[AIStrategyStudio] Failed to load conversation:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDeleteConversation = useCallback(async (id: string) => {
    const dbId = parseInt(id, 10);
    if (isNaN(dbId)) return;

    try {
      // Delete from SQLite
      const result = await conversationService.deleteConversation(dbId);
      if (result.success) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          setActiveConversationId(null);
          setActiveDbId(null);
          setMessages([]);
          setStrategyRules([]);
        }
      }
    } catch (error) {
      console.error('[AIStrategyStudio] Failed to delete conversation:', error);
    }
  }, [activeConversationId]);

  // -------------------------------------------------------------------------
  // Message Handlers
  // -------------------------------------------------------------------------
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading || !activeDbId) return;

    const content = inputValue.trim();
    const tokenCount = estimateTokens(content);

    setInputValue('');
    setIsLoading(true);

    try {
      // Add user message to SQLite
      const userResult = await conversationService.addMessage({
        conversationId: activeDbId,
        type: 'user',
        content,
        tokenCount,
      });

      if (userResult.success && userResult.data) {
        // Update local state with user message
        const userMessage: Message = {
          id: String(userResult.data.messageId),
          type: 'user',
          content,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);

        // Update conversation preview
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId
              ? {
                  ...c,
                  preview: content.slice(0, 50),
                  timestamp: new Date(),
                  messageCount: userResult.data!.conversation.message_count,
                }
              : c
          )
        );

        // Update token usage
        setTokenUsage({
          current: userResult.data.conversation.token_usage,
          limit: userResult.data.conversation.token_limit,
        });
      }

      // Call vibing_chat API
      try {
        // Build session ID in expected format
        const sessionId = `strategy-${activeDbId}-session`;

        // Collect current strategy rules for context
        const currentRules: Partial<StrategyRulesResponse> | undefined = strategyRules.length > 0
          ? {
              entry_conditions: strategyRules
                .filter((r) => r.type === 'entry')
                .map((r) => ({ type: 'LONG', condition: r.condition })),
              exit_conditions: strategyRules
                .filter((r) => r.type === 'exit')
                .map((r) => ({ type: 'TAKE_PROFIT', condition: r.condition })),
              filters: strategyRules
                .filter((r) => r.type === 'filter')
                .map((r) => r.condition),
            }
          : undefined;

        const response: VibingChatResponse = await executeVibingChat({
          session_id: sessionId,
          message: content,
          strategy_name: initialStrategyName || t('pages.aiStrategyStudio.newStrategyTitle'),
          strategy_id: strategyId,
          current_strategy_rules: currentRules,
          output_format: 'v3',
          storage_mode: 'local',
          model: llmProvider as VibingChatRequest['model'],
          llm_model: llmModel,
          metadata: {
            mode: 'generator',
          },
        });

        if (response.success && response.result) {
          const assistantContent = response.result.content || response.result.explanation || '';
          const assistantTokens = estimateTokens(assistantContent);

          // Save assistant message to SQLite
          const assistantResult = await conversationService.addMessage({
            conversationId: activeDbId,
            type: 'assistant',
            content: assistantContent,
            tokenCount: assistantTokens,
          });

          if (assistantResult.success && assistantResult.data) {
            const assistantMessage: Message = {
              id: String(assistantResult.data.messageId),
              type: 'assistant',
              content: assistantContent,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMessage]);

            // Update token usage
            setTokenUsage({
              current: assistantResult.data.conversation.token_usage,
              limit: assistantResult.data.conversation.token_limit,
            });

            // Update conversation message count
            setConversations((prev) =>
              prev.map((c) =>
                c.id === activeConversationId
                  ? { ...c, messageCount: assistantResult.data!.conversation.message_count }
                  : c
              )
            );
          }

          // Sync strategy_rules from response to StrategyRulesPanel
          if (response.result.strategy_rules) {
            const serverRules = response.result.strategy_rules;
            const newRules: StrategyRule[] = [];

            // Convert entry conditions
            serverRules.entry_conditions?.forEach((ec) => {
              newRules.push({
                id: generateLocalId(),
                type: 'entry',
                condition: ec.condition,
                description: ec.action || `Entry: ${ec.type}`,
                enabled: true,
              });
            });

            // Convert exit conditions
            serverRules.exit_conditions?.forEach((ec) => {
              newRules.push({
                id: generateLocalId(),
                type: 'exit',
                condition: ec.condition,
                description: `Exit: ${ec.type}`,
                enabled: true,
              });
            });

            // Convert indicators as filter rules
            serverRules.indicators?.forEach((ind) => {
              newRules.push({
                id: generateLocalId(),
                type: 'filter',
                condition: `${ind.name}(${ind.params})`,
                description: ind.description || ind.name,
                enabled: true,
              });
            });

            if (newRules.length > 0) {
              setStrategyRules(newRules);
              // Save rules to DB
              conversationService.updateConversation(activeDbId, {
                strategyRules: JSON.stringify(newRules),
              }).catch((err) => console.error('[AIStrategyStudio] Failed to save rules:', err));
            }
          }
        } else {
          // Handle error response
          const errorMessage = getVibingChatErrorMessage(response);
          const errorResult = await conversationService.addMessage({
            conversationId: activeDbId,
            type: 'system',
            content: t('pages.aiStrategyStudio.errorPrefix', { message: errorMessage }),
            tokenCount: 0,
          });

          if (errorResult.success && errorResult.data) {
            const systemMessage: Message = {
              id: String(errorResult.data.messageId),
              type: 'system',
              content: t('pages.aiStrategyStudio.errorPrefix', { message: errorMessage }),
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, systemMessage]);
          }
        }
      } catch (error) {
        console.error('[AIStrategyStudio] API call failed:', error);

        // Handle network/auth errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        try {
          const errorResult = await conversationService.addMessage({
            conversationId: activeDbId,
            type: 'system',
            content: t('pages.aiStrategyStudio.errorPrefix', { message: errorMessage }),
            tokenCount: 0,
          });

          if (errorResult.success && errorResult.data) {
            const systemMessage: Message = {
              id: String(errorResult.data.messageId),
              type: 'system',
              content: t('pages.aiStrategyStudio.errorPrefix', { message: errorMessage }),
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, systemMessage]);
          }
        } catch (saveError) {
          console.error('[AIStrategyStudio] Failed to save error message:', saveError);
        }
      } finally {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('[AIStrategyStudio] Failed to send message:', error);
      setIsLoading(false);
    }
  }, [inputValue, isLoading, activeDbId, activeConversationId, strategyRules, initialStrategyName, strategyId, userId, llmProvider, llmModel]);

  // -------------------------------------------------------------------------
  // Action Handlers
  // -------------------------------------------------------------------------
  const handleAction = useCallback(async (actionId: ActionId) => {
    if (!activeDbId) return;

    setActionStates((prev) => ({ ...prev, [actionId]: true }));

    try {
      const sessionId = `strategy-${activeDbId}-session`;

      // Collect current strategy rules for context
      const currentRules: Partial<StrategyRulesResponse> | undefined = strategyRules.length > 0
        ? {
            entry_conditions: strategyRules
              .filter((r) => r.type === 'entry')
              .map((r) => ({ type: 'LONG', condition: r.condition })),
            exit_conditions: strategyRules
              .filter((r) => r.type === 'exit')
              .map((r) => ({ type: 'TAKE_PROFIT', condition: r.condition })),
            filters: strategyRules
              .filter((r) => r.type === 'filter')
              .map((r) => r.condition),
          }
        : undefined;

      const response = await executeVibingChatAction(
        sessionId,
        actionId,
        currentRules,
        llmProvider as VibingChatRequest['model'],
        llmModel
      );

      if (response.success && response.result) {
        const actionLabels: Record<ActionId, string> = {
          generate_code: t('pages.aiStrategyStudio.actionResults.codeGenerated'),
          save_strategy: t('pages.aiStrategyStudio.actionResults.strategySaved'),
          run_backtest: t('pages.aiStrategyStudio.actionResults.backtestStarted'),
        };

        // If action returned content, show it as assistant message
        if (response.result.content) {
          const assistantTokens = estimateTokens(response.result.content);
          const assistantResult = await conversationService.addMessage({
            conversationId: activeDbId,
            type: 'assistant',
            content: response.result.content,
            tokenCount: assistantTokens,
          });

          if (assistantResult.success && assistantResult.data) {
            const assistantMessage: Message = {
              id: String(assistantResult.data.messageId),
              type: 'assistant',
              content: response.result.content,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
          }
        }

        // Add system message for action completion
        const systemResult = await conversationService.addMessage({
          conversationId: activeDbId,
          type: 'system',
          content: actionLabels[actionId],
          tokenCount: 0,
        });

        if (systemResult.success && systemResult.data) {
          const systemMessage: Message = {
            id: String(systemResult.data.messageId),
            type: 'system',
            content: actionLabels[actionId],
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, systemMessage]);
        }
      } else {
        // Handle error
        const errorMessage = getVibingChatErrorMessage(response);
        const errorResult = await conversationService.addMessage({
          conversationId: activeDbId,
          type: 'system',
          content: t('pages.aiStrategyStudio.actionFailedPrefix', { message: errorMessage }),
          tokenCount: 0,
        });

        if (errorResult.success && errorResult.data) {
          const systemMessage: Message = {
            id: String(errorResult.data.messageId),
            type: 'system',
            content: t('pages.aiStrategyStudio.actionFailedPrefix', { message: errorMessage }),
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, systemMessage]);
        }
      }
    } catch (error) {
      console.error('[AIStrategyStudio] Action failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      try {
        const errorResult = await conversationService.addMessage({
          conversationId: activeDbId,
          type: 'system',
          content: t('pages.aiStrategyStudio.actionFailedPrefix', { message: errorMessage }),
          tokenCount: 0,
        });

        if (errorResult.success && errorResult.data) {
          const systemMessage: Message = {
            id: String(errorResult.data.messageId),
            type: 'system',
            content: t('pages.aiStrategyStudio.actionFailedPrefix', { message: errorMessage }),
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, systemMessage]);
        }
      } catch (saveError) {
        console.error('[AIStrategyStudio] Failed to save error message:', saveError);
      }
    } finally {
      setActionStates((prev) => ({ ...prev, [actionId]: false }));
    }
  }, [activeDbId, strategyRules, llmProvider, llmModel]);

  // -------------------------------------------------------------------------
  // Strategy Rules Handlers
  // -------------------------------------------------------------------------
  const saveRulesToDb = useCallback(async (rules: StrategyRule[]) => {
    if (!activeDbId) return;

    try {
      await conversationService.updateConversation(activeDbId, {
        strategyRules: JSON.stringify(rules),
      });
    } catch (error) {
      console.error('[AIStrategyStudio] Failed to save rules:', error);
    }
  }, [activeDbId]);

  const handleAddRule = useCallback((type: RuleType) => {
    const newRule: StrategyRule = {
      id: generateLocalId(),
      type,
      condition: t('pages.aiStrategyStudio.newRuleCondition', { type }),
      description: t('pages.aiStrategyStudio.newRuleDescription', { type }),
      enabled: true,
    };

    setStrategyRules((prev) => {
      const updated = [...prev, newRule];
      saveRulesToDb(updated);
      return updated;
    });
  }, [saveRulesToDb]);

  const handleEditRule = useCallback((id: string, updates: Partial<StrategyRule>) => {
    setStrategyRules((prev) => {
      const updated = prev.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule));
      saveRulesToDb(updated);
      return updated;
    });
  }, [saveRulesToDb]);

  const handleDeleteRule = useCallback((id: string) => {
    setStrategyRules((prev) => {
      const updated = prev.filter((rule) => rule.id !== id);
      saveRulesToDb(updated);
      return updated;
    });
  }, [saveRulesToDb]);

  const handleToggleRule = useCallback((id: string) => {
    setStrategyRules((prev) => {
      const updated = prev.map((rule) =>
        rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
      );
      saveRulesToDb(updated);
      return updated;
    });
  }, [saveRulesToDb]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      className={cn(
        'flex flex-col h-full w-full overflow-hidden',
        'bg-color-terminal-bg',
        className
      )}
    >
      {/* ================================================================== */}
      {/* Zone A: Page Header                                                */}
      {/* ================================================================== */}
      <div className="flex-shrink-0 h-12 px-6 flex items-center justify-between border-b border-color-terminal-border bg-color-terminal-surface">
        <h1 className="text-sm font-bold terminal-mono uppercase tracking-wider text-color-terminal-accent-gold">
          {pageTitle}
        </h1>
        <button
          onClick={onSettingsClick}
          className="p-2 text-color-terminal-text-muted hover:text-color-terminal-text hover:bg-white/5 rounded transition-all"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Conversation History */}
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          isLoading={isLoadingConversations}
          width={280}
        />

        {/* Main Area - Chat Interface */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Session Info Panel */}
          <SessionInfoPanel
            sessionId={activeConversationId || ''}
            messageCount={messages.length}
            tokenUsage={tokenUsage}
            showCompressionWarning={tokenUsage.current / tokenUsage.limit > 0.85}
            visible={messages.length > 0}
          />

          {/* Messages Container */}
          <MessagesContainer
            messages={messages}
            isLoading={isLoading}
            welcomeTitle={t('pages.aiStrategyStudio.welcomeTitle')}
            welcomeSubtitle={t('pages.aiStrategyStudio.welcomeSubtitle')}
          />

          {/* Action Buttons */}
          {availableActions.length > 0 && (
            <div className="px-4">
              <ActionButtons
                actions={availableActions}
                onAction={handleAction}
                disabled={isLoading}
              />
            </div>
          )}

          {/* Chat Input Area */}
          <ChatInputArea
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSendMessage}
            disabled={isLoading || !activeDbId}
            placeholder={activeDbId ? t('pages.aiStrategyStudio.chatPlaceholder') : t('pages.aiStrategyStudio.chatPlaceholderDisabled')}
          />
        </main>

        {/* Right Sidebar - Strategy Rules */}
        <StrategyRulesPanel
          rules={strategyRules}
          onAddRule={handleAddRule}
          onEditRule={handleEditRule}
          onDeleteRule={handleDeleteRule}
          onToggleRule={handleToggleRule}
          width={360}
        />
      </div>
    </div>
  );
};

export default AIStrategyStudioPage;
