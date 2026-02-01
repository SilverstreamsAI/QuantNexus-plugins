/**
 * MessageBubble Component (component19G)
 *
 * Individual message bubble with different styles for user, assistant, and system messages.
 *
 * @see TICKET_077_19_AI_STRATEGY_STUDIO_COMPONENTS.md - Component specification
 * @see TICKET_077 - Silverstream UI Component Library
 */

import React, { useMemo } from 'react';
import { User, Bot, Info, Copy, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type MessageType = 'user' | 'assistant' | 'system';

export interface Message {
  /** Unique identifier */
  id: string;
  /** Message type */
  type: MessageType;
  /** Message content (supports markdown) */
  content: string;
  /** Message timestamp */
  timestamp?: Date;
  /** Is message still streaming */
  isStreaming?: boolean;
}

export interface MessageBubbleProps {
  /** Message data */
  message: Message;
  /** Show avatar */
  showAvatar?: boolean;
  /** Show timestamp */
  showTimestamp?: boolean;
  /** Show copy button */
  showCopyButton?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const MESSAGE_CONFIG: Record<MessageType, {
  icon: React.FC<{ className?: string }>;
  role: string;
  avatarClass: string;
  contentClass: string;
  alignClass: string;
  animationClass: string;
}> = {
  user: {
    icon: User,
    role: 'You',
    avatarClass: 'bg-gradient-to-br from-color-terminal-accent-primary to-color-terminal-accent-primary/80 text-color-terminal-bg',
    contentClass: 'bg-color-terminal-accent-primary text-color-terminal-bg rounded-br-sm',
    alignClass: 'flex-row-reverse',
    animationClass: 'animate-in slide-in-from-right-5',
  },
  assistant: {
    icon: Bot,
    role: 'AI Assistant',
    avatarClass: 'bg-gradient-to-br from-purple-500 to-purple-600 text-white',
    contentClass: 'bg-color-terminal-surface border border-color-terminal-border text-color-terminal-text rounded-bl-sm',
    alignClass: 'flex-row',
    animationClass: 'animate-in slide-in-from-left-5',
  },
  system: {
    icon: Info,
    role: 'System',
    avatarClass: 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white',
    contentClass: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-none shadow-lg shadow-indigo-500/30',
    alignClass: 'justify-center',
    animationClass: 'animate-in fade-in zoom-in-95',
  },
};

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Format timestamp for display
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

interface LoadingDotsProps {
  className?: string;
}

const LoadingDots: React.FC<LoadingDotsProps> = ({ className }) => (
  <div className={cn('flex items-center gap-1.5 py-1', className)}>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className={cn(
          'w-2 h-2 rounded-full',
          'bg-color-terminal-text-muted',
          'animate-pulse'
        )}
        style={{ animationDelay: `${i * 0.15}s` }}
      />
    ))}
  </div>
);

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  showAvatar = true,
  showTimestamp = true,
  showCopyButton = true,
  className,
}) => {
  const [copied, setCopied] = React.useState(false);

  const config = MESSAGE_CONFIG[message.type];
  const Icon = config.icon;

  // Handle copy to clipboard
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [message.content]);

  // Render content with basic markdown support
  const renderedContent = useMemo(() => {
    if (message.isStreaming && !message.content) {
      return <LoadingDots />;
    }

    // Basic markdown: **bold**, *italic*, `code`, ```code blocks```
    let content = message.content;

    // Code blocks
    content = content.replace(
      /```(\w*)\n?([\s\S]*?)```/g,
      '<pre class="bg-black/20 rounded p-3 my-2 overflow-x-auto"><code class="text-sm font-mono">$2</code></pre>'
    );

    // Inline code
    content = content.replace(
      /`([^`]+)`/g,
      '<code class="bg-black/10 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>'
    );

    // Bold
    content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Line breaks
    content = content.replace(/\n/g, '<br/>');

    return (
      <div
        className="whitespace-pre-wrap break-words"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }, [message.content, message.isStreaming]);

  return (
    <div
      className={cn(
        'flex gap-3 mb-4',
        'duration-300',
        config.alignClass,
        config.animationClass,
        className
      )}
    >
      {/* Avatar */}
      {showAvatar && message.type !== 'system' && (
        <div
          className={cn(
            'w-9 h-9 rounded-full flex-shrink-0',
            'flex items-center justify-center',
            'shadow-md',
            config.avatarClass
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
      )}

      {/* Content Wrapper */}
      <div
        className={cn(
          'flex flex-col gap-1',
          message.type === 'system' ? 'items-center' : 'max-w-[75%]',
          message.type === 'user' && 'items-end'
        )}
      >
        {/* Header (Role + Timestamp) */}
        {message.type !== 'system' && (showTimestamp || showAvatar) && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-semibold text-color-terminal-text-secondary">
              {config.role}
            </span>
            {showTimestamp && message.timestamp && (
              <span className="text-[10px] text-color-terminal-text-muted">
                {formatTime(message.timestamp)}
              </span>
            )}
          </div>
        )}

        {/* Message Content */}
        <div
          className={cn(
            'relative group',
            'px-4 py-3 rounded-lg',
            'text-sm leading-relaxed',
            config.contentClass
          )}
        >
          {renderedContent}

          {/* Copy Button */}
          {showCopyButton && message.type === 'assistant' && !message.isStreaming && (
            <button
              type="button"
              onClick={handleCopy}
              className={cn(
                'absolute -right-2 -top-2',
                'p-1.5 rounded-md',
                'bg-color-terminal-surface border border-color-terminal-border',
                'text-color-terminal-text-muted',
                'opacity-0 group-hover:opacity-100',
                'transition-all duration-200',
                'hover:bg-color-terminal-surface-hover',
                'hover:text-color-terminal-text',
                'shadow-sm'
              )}
              aria-label={copied ? 'Copied!' : 'Copy message'}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Streaming indicator */}
          {message.isStreaming && message.content && (
            <span className="inline-block w-1.5 h-4 ml-1 bg-current animate-pulse rounded-sm" />
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
