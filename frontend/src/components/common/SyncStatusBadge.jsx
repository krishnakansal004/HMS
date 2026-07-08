import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Wifi } from 'lucide-react';
import syncQueue from '../../utils/syncQueue';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Renders a small inline sync-status badge for optimistic items.
 *
 * Props:
 *   item      — the row/card object (must have _id and optionally _syncStatus, _syncError)
 *   queryKey  — TanStack query key, e.g. ['wards'] — needed for Retry
 *
 * _syncStatus values:
 *   'syncing' → spinning blue dot  "Syncing…"
 *   'queued'  → wifi icon          "Queued"
 *   'synced'  → green tick         "Saved"
 *   'failed'  → red warning + Retry button
 *   undefined → nothing rendered
 */
export default function SyncStatusBadge({ item, queryKey }) {
  const queryClient = useQueryClient();

  if (!item?._syncStatus) return null;

  const { _syncStatus, _syncError, _id } = item;

  if (_syncStatus === 'syncing') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
        <Loader2 size={10} className="animate-spin" />
        Syncing…
      </span>
    );
  }

  if (_syncStatus === 'queued') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
        <Wifi size={10} />
        Queued
      </span>
    );
  }

  if (_syncStatus === 'synced') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
        <CheckCircle2 size={10} />
        Saved
      </span>
    );
  }

  if (_syncStatus === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
        <AlertTriangle size={10} />
        Failed
        {queryKey && (
          <button
            onClick={() => syncQueue.retry(_id, queryClient)}
            className="underline underline-offset-2 hover:text-red-800 cursor-pointer"
            title={_syncError || 'Click to retry'}
          >
            Retry
          </button>
        )}
      </span>
    );
  }

  return null;
}
