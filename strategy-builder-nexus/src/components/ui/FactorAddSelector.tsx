/**
 * FactorAddSelector Component (component6)
 *
 * Factor selector with modal dialog for Zone C variable content area.
 * Displays an "Add Strategy" button that opens a modal with search,
 * category filtering, and multi-select table for factor selection.
 *
 * @see TICKET_077 - Silverstream UI Component Library
 * @see TICKET_078 - Input Theming and Portal Patterns
 */

import React, { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Trash2, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface FactorDefinition {
  name: string;
  category: string;
  ic?: number | null;
  icir?: number | null;
}

export interface FactorBlock {
  id: string;
  factorName: string;
  category: string;
  paramValues: Record<string, number | string>;
}

export interface FactorAddSelectorProps {
  /** Component title */
  title?: string;
  /** Available factor definitions */
  factors: FactorDefinition[];
  /** Current factor blocks */
  blocks: FactorBlock[];
  /** Callback when blocks change */
  onChange: (blocks: FactorBlock[]) => void;
  /** Add button label */
  addButtonLabel?: string;
  /** Maximum recommended selections */
  maxRecommended?: number;
  /** Additional class names */
  className?: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_TITLE = 'FACTOR CONFIGURATION';
const DEFAULT_ADD_BUTTON_LABEL = '+ Add Strategy';
const DEFAULT_MAX_RECOMMENDED = 3;

const CATEGORIES = ['All', 'momentum', 'technical', 'volatility', 'volume'] as const;

// -----------------------------------------------------------------------------
// FactorBlock Card Component
// -----------------------------------------------------------------------------

interface FactorBlockCardProps {
  block: FactorBlock;
  onDelete: (id: string) => void;
}

const FactorBlockCard: React.FC<FactorBlockCardProps> = ({ block, onDelete }) => {
  return (
    <div className="border border-color-terminal-border rounded-lg bg-color-terminal-surface/30">
      {/* Card Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-color-terminal-surface/50 border-b border-color-terminal-border">
        <span className="text-sm font-bold text-color-terminal-text">
          {block.factorName}
        </span>
        <button
          onClick={() => onDelete(block.id)}
          className="p-1 text-color-terminal-text-muted hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Card Content */}
      <div className="p-4">
        <div className="text-xs text-color-terminal-text-secondary">
          <span className="text-color-terminal-accent-teal font-bold">Category:</span>
          <span className="ml-2">{block.category}</span>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Factor Selection Modal Component
// -----------------------------------------------------------------------------

interface FactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  factors: FactorDefinition[];
  existingFactorNames: Set<string>;
  maxRecommended: number;
  onAdd: (selectedFactors: FactorDefinition[]) => void;
}

const FactorModal: React.FC<FactorModalProps> = ({
  isOpen,
  onClose,
  factors,
  existingFactorNames,
  maxRecommended,
  onAdd,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedFactors, setSelectedFactors] = useState<Set<string>>(new Set());

  // Filter factors based on search and category
  const filteredFactors = useMemo(() => {
    return factors.filter((factor) => {
      // Exclude already added factors
      if (existingFactorNames.has(factor.name)) return false;

      // Search filter
      const matchesSearch = factor.name.toLowerCase().includes(searchQuery.toLowerCase());

      // Category filter
      const matchesCategory = selectedCategory === 'All' || factor.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [factors, existingFactorNames, searchQuery, selectedCategory]);

  // Toggle factor selection
  const toggleFactor = useCallback((factorName: string) => {
    setSelectedFactors((prev) => {
      const next = new Set(prev);
      if (next.has(factorName)) {
        next.delete(factorName);
      } else {
        next.add(factorName);
      }
      return next;
    });
  }, []);

  // Handle add button click
  const handleAdd = useCallback(() => {
    const selected = factors.filter((f) => selectedFactors.has(f.name));
    onAdd(selected);
    setSelectedFactors(new Set());
    setSearchQuery('');
    setSelectedCategory('All');
    onClose();
  }, [factors, selectedFactors, onAdd, onClose]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setSelectedFactors(new Set());
    setSearchQuery('');
    setSelectedCategory('All');
    onClose();
  }, [onClose]);

  // Format value for display
  const formatValue = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(4);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={handleCancel}
    >
      <div
        className="flex flex-col w-[90%] max-w-[700px] max-h-[80vh] rounded-lg border"
        style={{
          backgroundColor: '#112240',
          borderColor: '#233554',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: '#233554' }}
        >
          <h2 className="text-base font-bold" style={{ color: '#e6f1ff' }}>
            Select Factors
          </h2>
          <button
            onClick={handleCancel}
            className="p-1 transition-colors hover:opacity-70"
            style={{ color: '#8892b0' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-4">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: '#8892b0' }}
            />
            <input
              type="text"
              placeholder="Search factors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-sm rounded border focus:outline-none"
              style={{
                backgroundColor: '#0a192f',
                borderColor: '#233554',
                color: '#e6f1ff',
              }}
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 px-5 pb-4">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={cn(
                'px-4 py-1.5 rounded-full text-xs font-medium border transition-all',
                selectedCategory === category
                  ? 'border-transparent'
                  : 'border-[#233554] hover:border-[#64ffda] hover:text-[#64ffda]'
              )}
              style={{
                backgroundColor: selectedCategory === category ? '#64ffda' : 'transparent',
                color: selectedCategory === category ? '#0a192f' : '#8892b0',
              }}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Table */}
        <div
          className="flex-1 overflow-y-auto mx-5 border rounded"
          style={{ borderColor: '#233554' }}
        >
          {/* Table Header */}
          <div
            className="grid sticky top-0 px-4 py-3 text-[11px] font-bold uppercase tracking-wide border-b"
            style={{
              gridTemplateColumns: '40px 1fr 120px 80px 80px',
              backgroundColor: '#1d3557',
              borderColor: '#233554',
              color: '#8892b0',
            }}
          >
            <div></div>
            <div>Factor Name</div>
            <div>Category</div>
            <div>IC</div>
            <div>ICIR</div>
          </div>

          {/* Table Rows */}
          {filteredFactors.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: '#8892b0' }}>
              No factors found
            </div>
          ) : (
            filteredFactors.map((factor) => (
              <div
                key={factor.name}
                onClick={() => toggleFactor(factor.name)}
                className="grid px-4 py-3 text-[13px] border-b cursor-pointer transition-colors hover:bg-[#64ffda]/5"
                style={{
                  gridTemplateColumns: '40px 1fr 120px 80px 80px',
                  borderColor: '#233554',
                  color: '#e6f1ff',
                }}
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedFactors.has(factor.name)}
                    onChange={() => toggleFactor(factor.name)}
                    className="w-4 h-4 rounded border cursor-pointer accent-[#64ffda]"
                    style={{ borderColor: '#233554' }}
                  />
                </div>
                <div className="font-medium">{factor.name}</div>
                <div style={{ color: '#8892b0' }}>{factor.category}</div>
                <div style={{ color: '#8892b0' }}>{formatValue(factor.ic)}</div>
                <div style={{ color: '#8892b0' }}>{formatValue(factor.icir)}</div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-4 border-t"
          style={{ borderColor: '#233554' }}
        >
          <div className="text-[13px]" style={{ color: '#8892b0' }}>
            <span style={{ color: '#64ffda', fontWeight: 'bold' }}>{selectedFactors.size}</span>
            {' '}selected ({maxRecommended} max recommended)
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="px-6 py-2.5 rounded text-[13px] font-medium border transition-colors hover:border-[#e6f1ff] hover:text-[#e6f1ff]"
              style={{
                backgroundColor: 'transparent',
                borderColor: '#233554',
                color: '#8892b0',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={selectedFactors.size === 0}
              className="px-6 py-2.5 rounded text-[13px] font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: '#64ffda',
                borderColor: '#64ffda',
                color: '#0a192f',
              }}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// -----------------------------------------------------------------------------
// FactorAddSelector Component
// -----------------------------------------------------------------------------

export const FactorAddSelector: React.FC<FactorAddSelectorProps> = ({
  title = DEFAULT_TITLE,
  factors,
  blocks,
  onChange,
  addButtonLabel = DEFAULT_ADD_BUTTON_LABEL,
  maxRecommended = DEFAULT_MAX_RECOMMENDED,
  className,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get set of existing factor names for filtering
  const existingFactorNames = useMemo(() => {
    return new Set(blocks.map((b) => b.factorName));
  }, [blocks]);

  // Handle adding selected factors
  const handleAddFactors = useCallback(
    (selectedFactors: FactorDefinition[]) => {
      const newBlocks: FactorBlock[] = selectedFactors.map((factor) => ({
        id: `factor-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        factorName: factor.name,
        category: factor.category,
        paramValues: {},
      }));
      onChange([...blocks, ...newBlocks]);
    },
    [blocks, onChange]
  );

  // Handle deleting a block
  const handleDeleteBlock = useCallback(
    (id: string) => {
      onChange(blocks.filter((b) => b.id !== id));
    },
    [blocks, onChange]
  );

  return (
    <div className={cn('factor-add-selector', className)}>
      {/* Title - follows Unified Component Title Format */}
      <h2 className="text-sm font-bold terminal-mono uppercase tracking-widest text-color-terminal-accent-gold mb-4">
        {title}
      </h2>

      {/* Factor Blocks */}
      {blocks.length > 0 && (
        <div className="space-y-4 mb-4">
          {blocks.map((block) => (
            <FactorBlockCard key={block.id} block={block} onDelete={handleDeleteBlock} />
          ))}
        </div>
      )}

      {/* Add Strategy Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className={cn(
          'w-full flex items-center justify-center gap-2',
          'px-4 py-3 text-xs font-bold uppercase tracking-wider',
          'border border-dashed border-color-terminal-border rounded-lg',
          'text-color-terminal-text-secondary',
          'hover:border-color-terminal-accent-teal/50 hover:text-color-terminal-accent-teal',
          'transition-all duration-200'
        )}
      >
        <Plus className="w-4 h-4" />
        {addButtonLabel}
      </button>

      {/* Factor Selection Modal */}
      <FactorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        factors={factors}
        existingFactorNames={existingFactorNames}
        maxRecommended={maxRecommended}
        onAdd={handleAddFactors}
      />
    </div>
  );
};

export default FactorAddSelector;
