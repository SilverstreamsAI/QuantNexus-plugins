/**
 * CodeDisplay Component
 *
 * Displays server-generated code with syntax highlighting, line numbers,
 * and copy functionality. Supports Python and JSON languages.
 *
 * @see TICKET_077 - Silverstream UI Component Library (component5)
 * @see TICKET_063 - Silverstream UI Spec
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, AlertCircle, Code } from 'lucide-react';
import { cn } from '../../lib/utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type CodeDisplayState = 'idle' | 'loading' | 'success' | 'error';

export interface CodeDisplayProps {
  /** Title displayed in header */
  title?: string;
  /** Code content to display */
  code: string;
  /** Language for syntax highlighting */
  language?: 'python' | 'json';
  /** Current display state */
  state?: CodeDisplayState;
  /** Error message when state is 'error' */
  errorMessage?: string;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Max height with scroll */
  maxHeight?: string;
  /** Additional class names */
  className?: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_MAX_HEIGHT = '400px';
const COPY_FEEDBACK_DURATION = 2000;
const SKELETON_LINES = 8;

// -----------------------------------------------------------------------------
// Syntax Highlighting Utilities (following web-side highlight-utils.js pattern)
// -----------------------------------------------------------------------------

/**
 * Highlight Python code with syntax highlighting
 * Uses placeholder technique from web-side to avoid double-highlighting
 *
 * @see /var/www/html/wp-content/themes/nonassa/js/utils/highlight-utils.js
 */
function highlightPythonCode(code: string): string {
  if (!code) return '';

  // Step 1: Escape HTML characters
  let highlightedCode = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Use placeholder array to avoid double-highlighting
  const replacements: string[] = [];
  const addReplacement = (match: string, className: string): string => {
    const replacementHtml = `<span class="token ${className}">${match}</span>`;
    replacements.push(replacementHtml);
    return `__REPLACE_${replacements.length - 1}__`;
  };

  // Step 2: Process comments and strings first (they may contain other keywords)
  // Comments
  highlightedCode = highlightedCode.replace(/(#.*)/g, (match) =>
    addReplacement(match, 'comment')
  );

  // Multi-line strings (docstrings)
  highlightedCode = highlightedCode.replace(
    /("""[\s\S]*?"""|'''[\s\S]*?''')/g,
    (match) => addReplacement(match, 'triple-quoted-string')
  );

  // Regular strings
  highlightedCode = highlightedCode.replace(
    /(["'])(?:(?!\1)[^\\\r\n]|\\.)*\1/g,
    (match) => addReplacement(match, 'string')
  );

  // Step 3: Process function/class definitions
  highlightedCode = highlightedCode.replace(
    /\b(def|class)\s+([a-zA-Z_]\w*)/g,
    (match, keyword, name) => {
      const nameClass = keyword === 'def' ? 'function' : 'class-name';
      const replacementHtml = `<span class="token keyword">${keyword}</span> <span class="token ${nameClass}">${name}</span>`;
      replacements.push(replacementHtml);
      return `__REPLACE_${replacements.length - 1}__`;
    }
  );

  // Step 4: Process keywords
  const keywords = [
    'import', 'from', 'return', 'if', 'else', 'elif', 'for', 'while',
    'in', 'is', 'not', 'and', 'or', 'with', 'as', 'try', 'except',
    'finally', 'raise', 'assert', 'break', 'continue', 'pass', 'yield',
    'lambda', 'global', 'nonlocal', 'async', 'await', 'True', 'False', 'None',
  ];
  keywords.forEach((keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    highlightedCode = highlightedCode.replace(regex, (match) =>
      addReplacement(match, 'keyword')
    );
  });

  // Step 5: Process built-in functions
  const builtins = [
    'print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict',
    'set', 'tuple', 'bool', 'type', 'isinstance', 'hasattr', 'getattr',
    'setattr', 'open', 'enumerate', 'zip', 'map', 'filter', 'sorted',
    'min', 'max', 'sum', 'any', 'all', 'super', 'self',
  ];
  builtins.forEach((builtin) => {
    const regex = new RegExp(`\\b${builtin}\\b`, 'g');
    highlightedCode = highlightedCode.replace(regex, (match) =>
      addReplacement(match, 'builtin')
    );
  });

  // Step 6: Process numbers
  highlightedCode = highlightedCode.replace(
    /\b(\d+\.?\d*|\.\d+)\b/g,
    (match) => addReplacement(match, 'number')
  );

  // Step 7: Process decorators
  highlightedCode = highlightedCode.replace(
    /(@[a-zA-Z_]\w*\.?\w*)/g,
    (match) => addReplacement(match, 'decorator')
  );

  // Step 8: Replace all placeholders with their HTML
  for (let i = 0; i < replacements.length; i++) {
    highlightedCode = highlightedCode.replace(`__REPLACE_${i}__`, replacements[i]);
  }

  return highlightedCode;
}

/**
 * Highlight JSON code with syntax highlighting
 */
function highlightJsonCode(code: string): string {
  if (!code) return '';

  let result = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const replacements: string[] = [];
  const addReplacement = (match: string, className: string): string => {
    const html = `<span class="token ${className}">${match}</span>`;
    replacements.push(html);
    return `__REPLACE_${replacements.length - 1}__`;
  };

  // Property names
  result = result.replace(/("(?:[^"\\]|\\.)*")\s*:/g, (match, key) => {
    return addReplacement(key, 'property') + ':';
  });

  // String values
  result = result.replace(/:\s*("(?:[^"\\]|\\.)*")/g, (match, value) => {
    return ': ' + addReplacement(value, 'string');
  });

  // Numbers
  result = result.replace(/:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, (match, num) => {
    return ': ' + addReplacement(num, 'number');
  });

  // Keywords (true, false, null)
  ['true', 'false', 'null'].forEach((keyword) => {
    const regex = new RegExp(`:\\s*(${keyword})\\b`, 'g');
    result = result.replace(regex, (match, kw) => {
      return ': ' + addReplacement(kw, 'keyword');
    });
  });

  // Replace placeholders
  for (let i = 0; i < replacements.length; i++) {
    result = result.replace(`__REPLACE_${i}__`, replacements[i]);
  }

  return result;
}

/**
 * Apply syntax highlighting based on language
 */
function highlightCode(code: string, language: 'python' | 'json'): string {
  if (!code) return '';
  return language === 'json' ? highlightJsonCode(code) : highlightPythonCode(code);
}

/**
 * Get plain code text (for copy and line counting)
 * Since server now returns plain text, this is mostly a pass-through
 */
function getPlainCode(code: string): string {
  if (!code) return '';
  return code;
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

interface CopyButtonProps {
  onCopy: () => void;
  copied: boolean;
  copyLabel: string;
  copiedLabel: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ onCopy, copied, copyLabel, copiedLabel }) => (
  <button
    onClick={onCopy}
    className={cn(
      'flex items-center gap-1.5 px-3 py-1.5',
      'text-[10px] font-bold uppercase tracking-wider',
      'border rounded transition-all duration-200',
      copied
        ? 'border-green-500 text-green-500'
        : 'border-color-terminal-border text-color-terminal-text-secondary hover:border-color-terminal-accent-teal hover:text-color-terminal-accent-teal'
    )}
  >
    {copied ? (
      <>
        <Check className="w-3 h-3" />
        {copiedLabel}
      </>
    ) : (
      <>
        <Copy className="w-3 h-3" />
        {copyLabel}
      </>
    )}
  </button>
);

const LoadingSkeleton: React.FC = () => (
  <div className="p-4 space-y-2">
    {Array.from({ length: SKELETON_LINES }).map((_, i) => (
      <div
        key={i}
        className="h-3 rounded skeleton-line"
        style={{
          width: `${Math.random() * 40 + 40}%`,
        }}
      />
    ))}
    <style>{`
      .skeleton-line {
        background: linear-gradient(
          90deg,
          var(--color-terminal-border, #233554) 25%,
          var(--color-terminal-surface, #112240) 50%,
          var(--color-terminal-border, #233554) 75%
        );
        background-size: 200% 100%;
        animation: skeleton-loading 1.5s infinite;
      }
      @keyframes skeleton-loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  </div>
);

interface ErrorDisplayProps {
  message: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
    <AlertCircle className="w-8 h-8 text-red-500 mb-3" />
    <p className="text-xs text-red-500">{message}</p>
  </div>
);

const EmptyDisplay: React.FC<{ noCodeLabel: string }> = ({ noCodeLabel }) => (
  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
    <Code className="w-8 h-8 text-color-terminal-text-muted mb-3" />
    <p className="text-xs text-color-terminal-text-muted">{noCodeLabel}</p>
  </div>
);

interface LineNumbersProps {
  count: number;
}

const LineNumbers: React.FC<LineNumbersProps> = ({ count }) => (
  <div
    className="py-4 px-3 text-right select-none border-r terminal-mono text-color-terminal-text-muted bg-black/20 border-color-terminal-border"
    style={{
      fontSize: '12px',
      lineHeight: '1.6',
    }}
  >
    {Array.from({ length: count }).map((_, i) => (
      <div key={i}>{i + 1}</div>
    ))}
  </div>
);

// -----------------------------------------------------------------------------
// CodeDisplay Component
// -----------------------------------------------------------------------------

export const CodeDisplay: React.FC<CodeDisplayProps> = ({
  title,
  code,
  language = 'python',
  state = 'idle',
  errorMessage,
  showLineNumbers = true,
  maxHeight = DEFAULT_MAX_HEIGHT,
  className,
}) => {
  const { t } = useTranslation('strategy-builder');
  
  const displayTitle = title ?? t('ui.codeDisplayLabels.title');
  const displayErrorMessage = errorMessage ?? t('ui.codeDisplayLabels.errorDefault');
  const copyLabel = t('ui.codeDisplayLabels.copy');
  const copiedLabel = t('ui.codeDisplayLabels.copied');
  const noCodeLabel = t('ui.codeDisplayLabels.noCode');
  
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);

  // Reset copied state after duration
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  // Handle copy to clipboard (copy plain text, not HTML tags)
  const handleCopy = useCallback(async () => {
    if (!code) return;

    try {
      const textToCopy = getPlainCode(code);
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }, [code]);

  // Memoize highlighted code
  const highlightedCode = useMemo(() => {
    if (!code || state === 'loading' || state === 'error') return '';
    return highlightCode(code, language);
  }, [code, language, state]);

  // Count lines for line numbers (use plain text)
  const lineCount = useMemo(() => {
    if (!code) return 0;
    const plainCode = getPlainCode(code);
    return plainCode.split('\n').length;
  }, [code]);

  // Determine what content to render
  const renderContent = () => {
    if (state === 'loading') {
      return <LoadingSkeleton />;
    }

    if (state === 'error') {
      return <ErrorDisplay message={displayErrorMessage} />;
    }

    if (!code || !code.trim()) {
      return <EmptyDisplay noCodeLabel={noCodeLabel} />;
    }

    return (
      <div className="flex" style={{ maxHeight }}>
        {showLineNumbers && <LineNumbers count={lineCount} />}
        <div
          ref={codeRef}
          className="flex-1 p-4 overflow-auto terminal-mono"
          style={{
            fontSize: '12px',
            lineHeight: '1.6',
            whiteSpace: 'pre',
          }}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </div>
    );
  };

  return (
    <div
      className={cn(
        'code-display rounded-lg overflow-hidden border border-color-terminal-border bg-color-terminal-bg',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-color-terminal-border bg-color-terminal-surface/50">
        <h3
          className="terminal-mono font-bold uppercase tracking-widest text-color-terminal-accent-gold"
          style={{
            fontSize: '14px',
            letterSpacing: '0.1em',
          }}
        >
          {displayTitle}
        </h3>
        {code && state !== 'loading' && state !== 'error' && (
          <CopyButton onCopy={handleCopy} copied={copied} copyLabel={copyLabel} copiedLabel={copiedLabel} />
        )}
      </div>

      {/* Content */}
      <div className="overflow-hidden">
        {renderContent()}
      </div>

      {/* Token styles using CSS variables from TICKET_078 theme system */}
      <style>{`
        .code-display .token-keyword {
          color: var(--color-terminal-accent-teal, #64ffda);
        }
        .code-display .token-string {
          color: var(--color-terminal-accent-green, #98c379);
        }
        .code-display .token-comment {
          color: var(--color-terminal-text-muted, #5c6773);
          font-style: italic;
        }
        .code-display .token-number {
          color: var(--color-terminal-accent-orange, #d19a66);
        }
        .code-display .token-function,
        .code-display .token-class-name {
          color: var(--color-terminal-accent-gold, #D4AF37);
        }
        .code-display .token-decorator {
          color: var(--color-terminal-accent-teal, #64ffda);
        }
        .code-display .token-builtin {
          color: var(--color-terminal-accent-yellow, #e5c07b);
        }
        .code-display .token-property {
          color: var(--color-terminal-accent-blue, #61afef);
        }
        .code-display .token-triple-quoted-string {
          color: var(--color-terminal-accent-green, #98c379);
        }
      `}</style>
    </div>
  );
};

export default CodeDisplay;
