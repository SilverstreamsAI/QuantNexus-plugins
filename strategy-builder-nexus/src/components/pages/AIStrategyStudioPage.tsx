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
import { cn } from '../../lib/utils';
import {
  conversationService,
  ConversationRecord,
  MessageRecord,
} from '../../services/conversation-service';

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

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const AIStrategyStudioPage: React.FC<AIStrategyStudioPageProps> = ({
  pageTitle = 'AI Strategy Studio',
  strategyName: initialStrategyName = '',
  strategyId = '',
  onStrategyNameChange,
  className,
}) => {
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
        label: 'Generate Code',
        loading: actionStates.generate_code,
      },
      {
        id: 'save_strategy',
        label: 'Save Strategy',
        loading: actionStates.save_strategy,
        disabled: strategyRules.length === 0,
      },
      {
        id: 'run_backtest',
        label: 'Run Backtest',
        loading: actionStates.run_backtest,
        disabled: strategyRules.length === 0,
      },
    ];
  }, [messages.length, strategyRules.length, actionStates]);

  // -------------------------------------------------------------------------
  // Load User & Conversations on Mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    const loadUserAndConversations = async () => {
      try {
        // Get user ID from auth state
        const authResult = await window.electronAPI.auth?.getUser();
        const currentUserId = authResult?.data?.id || 'anonymous';
        setUserId(currentUserId);

        // Load conversations from SQLite
        const result = await conversationService.listConversations(currentUserId);
        if (result.success && result.data) {
          setConversations(result.data.map(toConversation));
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
      // Create conversation in SQLite
      const result = await conversationService.createConversation({
        userId,
        title: 'New Strategy',
        preview: 'Start describing your strategy...',
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
  }, [userId]);

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

      // Simulate AI response (TODO: Replace with actual API call)
      setTimeout(async () => {
        const assistantContent = `I understand you want to create a strategy. Based on your description:\n\n"${content}"\n\nI'll help you define the entry and exit rules. Would you like me to:\n\n1. **Generate entry rules** based on technical indicators\n2. **Add risk management** conditions\n3. **Create exit rules** for profit taking and stop loss\n\nPlease let me know which aspect you'd like to focus on first.`;
        const assistantTokens = estimateTokens(assistantContent);

        try {
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
        } catch (error) {
          console.error('[AIStrategyStudio] Failed to save assistant message:', error);
        } finally {
          setIsLoading(false);
        }
      }, 1500);
    } catch (error) {
      console.error('[AIStrategyStudio] Failed to send message:', error);
      setIsLoading(false);
    }
  }, [inputValue, isLoading, activeDbId, activeConversationId]);

  // -------------------------------------------------------------------------
  // Action Handlers
  // -------------------------------------------------------------------------
  const handleAction = useCallback(async (actionId: ActionId) => {
    if (!activeDbId) return;

    setActionStates((prev) => ({ ...prev, [actionId]: true }));

    // Simulate action
    setTimeout(async () => {
      setActionStates((prev) => ({ ...prev, [actionId]: false }));

      const actionLabels: Record<ActionId, string> = {
        generate_code: 'Code generation completed',
        save_strategy: 'Strategy saved successfully',
        run_backtest: 'Backtest started',
      };

      try {
        // Add system message to SQLite
        const result = await conversationService.addMessage({
          conversationId: activeDbId,
          type: 'system',
          content: actionLabels[actionId],
          tokenCount: 0,
        });

        if (result.success && result.data) {
          const systemMessage: Message = {
            id: String(result.data.messageId),
            type: 'system',
            content: actionLabels[actionId],
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, systemMessage]);
        }
      } catch (error) {
        console.error('[AIStrategyStudio] Failed to save system message:', error);
      }
    }, 2000);
  }, [activeDbId]);

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
      condition: `New ${type} rule condition`,
      description: `Add your ${type} condition here`,
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
        'flex h-full w-full overflow-hidden',
        'bg-color-terminal-bg',
        className
      )}
    >
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
          welcomeTitle="AI Strategy Studio"
          welcomeSubtitle="Describe your trading strategy in natural language. I'll help you build entry rules, exit conditions, and risk management."
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
          placeholder={activeDbId ? 'Describe your trading strategy...' : 'Create a new chat to start...'}
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
  );
};

export default AIStrategyStudioPage;
