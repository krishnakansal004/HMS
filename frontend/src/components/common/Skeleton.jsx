import React from 'react';

/**
 * Pulse skeleton element
 */
export const Pulse = ({ className = '', style = {} }) => (
  <div 
    className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} 
    style={style}
  />
);

/**
 * Renders a placeholder skeleton table
 */
export const TableSkeleton = ({ rows = 5, cols = 4 }) => {
  return (
    <div className="w-full overflow-hidden border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-900/50">
          <tr>
            {Array.from({ length: cols }).map((_, index) => (
              <th key={index} className="px-6 py-3 text-left">
                <Pulse className="h-4 w-24" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-850 bg-white dark:bg-gray-900">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: cols }).map((_, colIndex) => (
                <td key={colIndex} className="px-6 py-4 whitespace-nowrap">
                  <Pulse className="h-4 w-3/4" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Renders placeholders for grid/card layouts
 */
export const CardSkeleton = ({ count = 3, cols = 3 }) => {
  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }[cols] || 'grid-cols-1 md:grid-cols-3';

  return (
    <div className={`grid gap-6 ${gridColsClass}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <Pulse className="h-6 w-1/3" />
            <Pulse className="h-4 w-12 rounded-full" />
          </div>
          <div className="space-y-2">
            <Pulse className="h-4 w-5/6" />
            <Pulse className="h-4 w-2/3" />
          </div>
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between">
            <Pulse className="h-4 w-1/4" />
            <Pulse className="h-4 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Renders a full page or form container skeleton
 */
export const FormSkeleton = () => {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-2">
        <Pulse className="h-8 w-1/3" />
        <Pulse className="h-4 w-2/3" />
      </div>
      <div className="p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Pulse className="h-4 w-20" />
            <Pulse className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Pulse className="h-4 w-20" />
            <Pulse className="h-10 w-full" />
          </div>
        </div>
        <div className="space-y-2">
          <Pulse className="h-4 w-20" />
          <Pulse className="h-24 w-full" />
        </div>
        <div className="flex justify-end space-x-3 pt-4">
          <Pulse className="h-10 w-24" />
          <Pulse className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
};

export default {
  Pulse,
  TableSkeleton,
  CardSkeleton,
  FormSkeleton
};
