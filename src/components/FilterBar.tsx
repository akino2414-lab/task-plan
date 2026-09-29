import React from 'react';
import { Search, Tag, Filter, X } from 'lucide-react';
import { TaskPriority, Category, PRIORITY_CONFIG } from '../types';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  selectedPriority: TaskPriority | 'all';
  onPriorityChange: (p: TaskPriority | 'all') => void;
  selectedTag: string;
  onTagChange: (tag: string) => void;
  sortBy: 'priority' | 'dueDate' | 'order' | 'title';
  onSortByChange: (sort: 'priority' | 'dueDate' | 'order' | 'title') => void;
  categories: Category[];
  availableTags: string[];
  totalTasksCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedPriority,
  onPriorityChange,
  selectedTag,
  onTagChange,
  sortBy,
  onSortByChange,
  categories,
  availableTags,
  totalTasksCount,
}) => {
  const hasActiveFilters =
    searchQuery !== '' ||
    selectedCategory !== 'all' ||
    selectedPriority !== 'all' ||
    selectedTag !== 'all';

  const clearAllFilters = () => {
    onSearchChange('');
    onCategoryChange('all');
    onPriorityChange('all');
    onTagChange('all');
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 mb-5 shadow-sm space-y-3 transition-colors">
      {/* Top row: Search input & Sorting */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="タスク名、詳細、タグで検索..."
            className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort and Count */}
        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="text-slate-400">並び順:</span>
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="order">ドラッグ順 (カスタム)</option>
              <option value="priority">優先順位の高い順</option>
              <option value="dueDate">期限の近い順</option>
              <option value="title">タスク名順</option>
            </select>
          </div>

          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {totalTasksCount}件
          </span>
        </div>
      </div>

      {/* Filter Row: Category & Priority & Tags */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-slate-400 font-medium flex items-center gap-1 mr-1">
          <Filter className="w-3.5 h-3.5" /> 絞り込み:
        </span>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => onCategoryChange('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            全カテゴリー
          </button>
          {categories.map((c) => {
            const isSelected = selectedCategory === c.id;
            return (
              <button
                key={c.id}
                onClick={() => onCategoryChange(c.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>

        {/* Priority Filter separator */}
        <span className="text-slate-300 dark:text-slate-700 mx-1">|</span>

        {/* Priority Pills */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => onPriorityChange('all')}
            className={`px-2 py-1 rounded-lg text-xs transition-colors ${
              selectedPriority === 'all'
                ? 'font-bold text-slate-900 dark:text-white underline decoration-indigo-500 decoration-2'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            全優先度
          </button>
          {(['urgent', 'high', 'medium', 'low'] as TaskPriority[]).map((p) => {
            const isSelected = selectedPriority === p;
            const pConf = PRIORITY_CONFIG[p];
            return (
              <button
                key={p}
                onClick={() => onPriorityChange(p)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? `${pConf.badgeBg} ring-1 ring-current shadow-xs`
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${pConf.dotColor}`} />
                <span>{pConf.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Tags selector if any available */}
        {availableTags.length > 0 && (
          <>
            <span className="text-slate-300 dark:text-slate-700 mx-1">|</span>
            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              <Tag className="w-3 h-3 text-slate-400" />
              <button
                onClick={() => onTagChange('all')}
                className={`px-1.5 py-0.5 rounded text-[11px] ${
                  selectedTag === 'all' ? 'font-bold underline text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                }`}
              >
                全タグ
              </button>
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => onTagChange(tag)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    selectedTag === tag
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 text-indigo-600 dark:text-indigo-300 font-bold'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Clear filter button */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="ml-auto text-xs text-rose-500 hover:underline flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            <span>解除</span>
          </button>
        )}
      </div>
    </div>
  );
};
