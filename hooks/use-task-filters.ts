import type { Task } from '@/lib/indexeddb';
import { useCallback, useMemo, useState } from 'react';

export type FilterType = 'all' | 'read' | 'stocked' | 'unread';

interface UseTaskFiltersReturn {
  filteredTasks: Task[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filter: FilterType;
  setFilter: (filter: FilterType) => void;
  unreadCount: number;
}

export function useTaskFilters(tasks: Task[]): UseTaskFiltersReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('unread');

  const removeDuplicateTasks = useCallback((tasks: Task[]): Task[] => {
    const seen = new Set<string>();
    return tasks.filter((task) => {
      if (seen.has(task.id)) {
        return false;
      }
      seen.add(task.id);
      return true;
    });
  }, []);

  const filteredTasks = useMemo(() => {
    // First, remove duplicates by ID
    const uniqueTasks = removeDuplicateTasks(tasks);

    let filtered = uniqueTasks;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.author?.toLowerCase().includes(query),
      );
    }

    // Apply status filter
    switch (filter) {
      case 'read':
        filtered = filtered.filter((task) => task.read);
        break;
      case 'unread':
        filtered = filtered.filter((task) => !task.read);
        break;
      case 'stocked':
        filtered = filtered.filter((task) => task.stocked);
        break;
      default:
        break;
    }

    return filtered.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [tasks, searchQuery, filter, removeDuplicateTasks]);

  const unreadCount = useMemo(
    () => tasks.filter((task) => !task.read).length,
    [tasks],
  );

  return {
    filteredTasks,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    unreadCount,
  };
}
