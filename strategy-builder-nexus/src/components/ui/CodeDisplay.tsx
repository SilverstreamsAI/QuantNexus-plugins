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

const DEFAULT_TITLE = 'GENERATED STRATEGY CODE';
const DEFAULT_MAX_HEIGHT = '400px';
const COPY_FEEDBACK_DURATION = 2000;
const SKELETON_LINES = 8;

// Python keywords for syntax highlighting
const PYTHON_KEYWORDS = [
  'import', 'from', 'return', 'if', 'else', 'elif', 'for', 'while',
  'try', 'except', 'finally', 'with', 'as', 'in', 'and', 'or', 'not',
  'is', 'def', 'class', 'lambda', 'yield', 'global', 'nonlocal',
  'assert', 'break', 'continue', 'pass', 'raise', 'del',
  'True', 'False', 'None',
];

// Python built-in functions
const PYTHON_BUILTINS = [
  'print', 'len', 'range', 'str', 'int', 'float', 'bool', 'list',
  'dict', 'tuple', 'set', 'type', 'isinstance', 'hasattr', 'getattr',
  'setattr', 'super', 'property', 'staticmethod', 'classmethod',
  'abs', 'all', 'any', 'bin', 'callable', 'chr', 'compile', 'complex',
  'delattr', 'dir', 'divmod', 'enumerate', 'eval', 'exec', 'filter',
  'format', 'frozenset', 'globals', 'hash', 'help', 'hex', 'id',
  'input', 'iter', 'locals', 'map', 'max', 'memoryview', 'min',
  'next', 'object', 'oct', 'open', 'ord', 'pow', 'repr', 'reversed',
  'round', 'slice', 'sorted', 'sum', 'vars', 'zip',
];

// JSON keywords
const JSON_KEYWORDS = ['true', 'false', 'null'];

// -----------------------------------------------------------------------------
// Syntax Highlighting Utilities
// -----------------------------------------------------------------------------

/**
 * Escape HTML characters to prevent XSS
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Wrap text in a span with token class
 */
function wrapToken(text: string, tokenClass: string): string {
  return `<span class="${tokenClass}">${text}</span>`;
}

/**
 * Highlight Python code with syntax highlighting
 */
function highlightPython(code: string): string {
  let result = escapeHtml(code);

  // Comments (single line) - must be done first to avoid highlighting inside comments
  result = result.replace(
    /(#.*)$/gm,
    wrapToken('$1', 'token-comment')
  );

  // Triple-quoted strings (docstrings)
  result = result.replace(
    /("""[\s\S]*?"""|'''[\s\S]*?''')/g,
    wrapToken('$1', 'token-string')
  );

  // Regular strings (double and single quotes)
  result = result.replace(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
    wrapToken('$1', 'token-string')
  );

  // Numbers (integers, floats, scientific notation)
  result = result.replace(
    /\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g,
    wrapToken('$1', 'token-number')
  );

  // Decorators
  result = result.replace(
    /@([a-zA-Z_][a-zA-Z0-9_]*)/g,
    wrapToken('@$1', 'token-decorator')
  );

  // Function definitions
  result = result.replace(
    /\b(def)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
    wrapToken('$1', 'token-keyword') + ' ' + wrapToken('$2', 'token-function')
  );

  // Class definitions
  result = result.replace(
    /\b(class)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
    wrapToken('$1', 'token-keyword') + ' ' + wrapToken('$2', 'token-class-name')
  );

  // Keywords
  PYTHON_KEYWORDS.forEach((keyword) => {
    const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
    result = result.replace(regex, wrapToken('$1', 'token-keyword'));
  });

  // Built-in functions
  PYTHON_BUILTINS.forEach((builtin) => {
    const regex = new RegExp(`\\b(${builtin})\\b(?=\\s*\\()`, 'g');
    result = result.replace(regex, wrapToken('$1', 'token-builtin'));
  });

  return result;
}

/**
 * Highlight JSON code with syntax highlighting
 */
function highlightJson(code: string): string {
  let result = escapeHtml(code);

  // Strings (property names and values)
  result = result.replace(
    /("(?:[^"\\]|\\.)*")\s*:/g,
    wrapToken('$1', 'token-property') + ':'
  );
  result = result.replace(
    /:\s*("(?:[^"\\]|\\.)*")/g,
    ': ' + wrapToken('$1', 'token-string')
  );

  // Numbers
  result = result.replace(
    /:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    ': ' + wrapToken('$1', 'token-number')
  );

  // Keywords (true, false, null)
  JSON_KEYWORDS.forEach((keyword) => {
    const regex = new RegExp(`:\\s*(${keyword})\\b`, 'g');
    result = result.replace(regex, ': ' + wrapToken('$1', 'token-keyword'));
  });

  return result;
}

/**
 * Apply syntax highlighting based on language
 */
function highlightCode(code: string, language: 'python' | 'json'): string {
  if (!code) return '';
  return language === 'json' ? highlightJson(code) : highlightPython(code);
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

interface CopyButtonProps {
  onCopy: () => void;
  copied: boolean;
}

const CopyButton: React.FC<CopyButtonProps> = ({ onCopy, copied }) => (
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
        Copied!
      </>
    ) : (
      <>
        <Copy className="w-3 h-3" />
        Copy
      </>
    )}
  </button>
);

const LoadingSkeleton: React.FC = () => (
  <div className="p-4 space-y-2">
    {Array.from({ length: SKELETON_LINES }).map((_, i) => (
      <div
        key={i}
        className="h-3 rounded animate-pulse"
        style={{
          width: `${Math.random() * 40 + 40}%`,
          background: 'linear-gradient(90deg, #233554 25%, #112240 50%, #233554 75%)',
          backgroundSize: '200% 100%',
          animation: 'skeleton-loading 1.5s infinite',
        }}
      />
    ))}
    <style>{`
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

const EmptyDisplay: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
    <Code className="w-8 h-8 text-color-terminal-text-muted mb-3" />
    <p className="text-xs text-color-terminal-text-muted">No code to display</p>
  </div>
);

interface LineNumbersProps {
  count: number;
}

const LineNumbers: React.FC<LineNumbersProps> = ({ count }) => (
  <div
    className="py-4 px-3 text-right select-none border-r terminal-mono"
    style={{
      fontSize: '12px',
      lineHeight: '1.6',
      color: '#5c6773',
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      borderColor: '#233554',
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
  title = DEFAULT_TITLE,
  code,
  language = 'python',
  state = 'idle',
  errorMessage = 'An error occurred',
  showLineNumbers = true,
  maxHeight = DEFAULT_MAX_HEIGHT,
  className,
}) => {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);

  // Reset copied state after duration
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
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

  // Count lines for line numbers
  const lineCount = useMemo(() => {
    if (!code) return 0;
    return code.split('\n').length;
  }, [code]);

  // Determine what content to render
  const renderContent = () => {
    if (state === 'loading') {
      return <LoadingSkeleton />;
    }

    if (state === 'error') {
      return <ErrorDisplay message={errorMessage} />;
    }

    if (!code || !code.trim()) {
      return <EmptyDisplay />;
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
        'code-display rounded-lg overflow-hidden',
        className
      )}
      style={{
        border: '1px solid #233554',
        backgroundColor: '#0a192f',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderBottom: '1px solid #233554',
          backgroundColor: 'rgba(17, 34, 64, 0.5)',
        }}
      >
        <h3
          className="terminal-mono font-bold uppercase tracking-widest"
          style={{
            fontSize: '14px',
            letterSpacing: '0.1em',
            color: '#D4AF37',
          }}
        >
          {title}
        </h3>
        {code && state !== 'loading' && state !== 'error' && (
          <CopyButton onCopy={handleCopy} copied={copied} />
        )}
      </div>

      {/* Content */}
      <div className="overflow-hidden">
        {renderContent()}
      </div>

      {/* Token styles */}
      <style>{`
        .code-display .token-keyword {
          color: #64ffda;
        }
        .code-display .token-string {
          color: #98c379;
        }
        .code-display .token-comment {
          color: #5c6773;
          font-style: italic;
        }
        .code-display .token-number {
          color: #d19a66;
        }
        .code-display .token-function,
        .code-display .token-class-name {
          color: #D4AF37;
        }
        .code-display .token-decorator {
          color: #64ffda;
        }
        .code-display .token-builtin {
          color: #e5c07b;
        }
        .code-display .token-property {
          color: #61afef;
        }
      `}</style>
    </div>
  );
};

export default CodeDisplay;
