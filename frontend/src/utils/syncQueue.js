import { authFetch } from '../services/api';
import { toast } from 'react-toastify';

/**
 * HMS SyncQueue — Enterprise Optimistic UI Background Sync
 *
 * Architecture:
 *   User Action → Instant cache update (<50ms) → enqueue()
 *   enqueue()   → authFetch in background
 *   onSuccess   → replace tempId with real _id in cache (merge, NOT invalidate)
 *   onError     → mark item _syncStatus:'failed', keep visible, show Retry
 *
 * Key principle: NEVER call invalidateQueries for create mutations.
 * invalidateQueries triggers a refetch which races the backend write
 * and overwrites the optimistic item before the server includes it.
 */
class SyncQueue {
  constructor() {
    this.queue       = [];       // Persisted to localStorage
    this.callbacks   = new Map(); // id → { onSuccess, onError } — in-memory only
    this.retryMap    = new Map(); // tempId → queueId — for retry support
    this.isProcessing = false;
    this.listeners   = new Set();

    // Restore persisted queue (for offline→online scenarios)
    try {
      const stored = localStorage.getItem('hms_sync_queue');
      if (stored) this.queue = JSON.parse(stored);
    } catch (e) {
      console.error('[SyncQueue] Failed to parse stored queue', e);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.processQueue());
    }
  }

  // ─── Pub/Sub ─────────────────────────────────────────────────────────────
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach(l => l(state));
  }

  getState() {
    return {
      pendingCount: this.queue.length,
      isProcessing: this.isProcessing,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    };
  }

  saveQueue() {
    try {
      localStorage.setItem('hms_sync_queue', JSON.stringify(this.queue));
      this.notify();
    } catch (e) {
      console.error('[SyncQueue] Failed to save queue', e);
    }
  }

  // ─── Internal: patch _syncStatus on a cached item ────────────────────────
  _setStatus(queryClient, queryKey, tempId, status, extra = {}) {
    if (!queryClient || !queryKey || !tempId) return;
    queryClient.setQueryData(queryKey, (old = []) =>
      Array.isArray(old)
        ? old.map(item =>
            item._id === tempId ? { ...item, _syncStatus: status, ...extra } : item
          )
        : old
    );
  }

  /**
   * Enqueue a mutation for background sync.
   *
   * @param {Object}  item
   * @param {string}  item.path                 API path, e.g. '/api/wards'
   * @param {string}  item.method               HTTP method: POST | PUT | PATCH | DELETE
   * @param {Object}  [item.body]               Request body (will be JSON-stringified)
   * @param {string}  [item.tempId]             The optimistic _id in the cache (CREATE only)
   * @param {Array}   [item.queryKey]           TanStack query key, e.g. ['wards']
   * @param {Array}   [item.rollbackQueryKeys]  Keys to restore on error (UPDATE/DELETE)
   * @param {Array}   [item.previousData]       Snapshots for rollback
   *
   * @param {Object}  queryClient               TanStack QueryClient instance
   *
   * @param {Object}  [callbacks]
   * @param {Function} [callbacks.onSuccess]    (serverData, queryClient) → void
   *                                            Use this to replace tempId with real _id.
   * @param {Function} [callbacks.onError]      (error, queryClient) → void
   *                                            Use this to mark item as failed/show Retry.
   */
  enqueue(item, queryClient, callbacks = {}) {
    const id = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const queueItem = {
      id,
      path:              item.path,
      method:            item.method || 'POST',
      body:              item.body   || null,
      tempId:            item.tempId || null,
      queryKey:          item.queryKey || null,
      rollbackQueryKeys: item.rollbackQueryKeys || [],
      previousData:      item.previousData      || null,
    };

    // Callbacks stay in-memory (closures can't be serialised to localStorage)
    if (callbacks.onSuccess || callbacks.onError) {
      this.callbacks.set(id, {
        onSuccess: callbacks.onSuccess || null,
        onError:   callbacks.onError   || null,
      });
    }

    if (queueItem.tempId) {
      this.retryMap.set(queueItem.tempId, id);
    }

    // Mark optimistic item as 'syncing'
    if (queueItem.tempId && queueItem.queryKey) {
      this._setStatus(queryClient, queueItem.queryKey, queueItem.tempId, 'syncing');
    }

    this.queue.push(queueItem);
    this.saveQueue();

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.processQueue(queryClient);
    } else {
      if (queueItem.tempId && queueItem.queryKey) {
        this._setStatus(queryClient, queueItem.queryKey, queueItem.tempId, 'queued');
      }
      toast.info('Offline — change saved locally and will sync when you reconnect.');
    }

    return id;
  }

  // ─── Retry a failed item by tempId ───────────────────────────────────────
  retry(tempId, queryClient) {
    const qId = this.retryMap.get(tempId);
    const item = this.queue.find(i => i.id === qId || i.tempId === tempId);
    if (!item) return;
    if (item.queryKey && item.tempId) {
      this._setStatus(queryClient, item.queryKey, item.tempId, 'syncing');
    }
    this.processQueue(queryClient);
  }

  // ─── Main processing loop ─────────────────────────────────────────────────
  async processQueue(queryClient) {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.isProcessing = true;
    this.notify();

    while (this.queue.length > 0) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) break;

      const item = this.queue[0];
      const cbs  = this.callbacks.get(item.id) || {};

      try {
        // ── Fire the API request ──────────────────────────────────────────
        const serverData = await authFetch(item.path, {
          method: item.method,
          body:   item.body ? JSON.stringify(item.body) : undefined,
        });

        // ── Remove from queue ─────────────────────────────────────────────
        this.queue.shift();
        this.callbacks.delete(item.id);
        if (item.tempId) this.retryMap.delete(item.tempId);

        // Chain replacement: replace all occurrences of tempId with serverData._id or serverData.id
        const serverId = serverData?._id || serverData?.id;
        if (serverId && item.tempId) {
          const tempIdStr = String(item.tempId);
          const realIdStr = String(serverId);
          this.queue.forEach(qItem => {
            if (qItem.tempId === item.tempId) {
              qItem.tempId = serverId;
            }
            if (qItem.path && qItem.path.includes(tempIdStr)) {
              qItem.path = qItem.path.split(tempIdStr).join(realIdStr);
            }
            if (qItem.body) {
              let bodyStr = JSON.stringify(qItem.body);
              if (bodyStr.includes(tempIdStr)) {
                bodyStr = bodyStr.split(tempIdStr).join(realIdStr);
                try {
                  qItem.body = JSON.parse(bodyStr);
                } catch (e) {
                  console.error('[SyncQueue] Failed to parse updated body JSON', e);
                }
              }
            }
          });
        }

        this.saveQueue();

        // ── SUCCESS: merge server data into cache ─────────────────────────
        if (cbs.onSuccess) {
          // Caller provides the exact merge logic (tempId → real _id)
          cbs.onSuccess(serverData, queryClient);
        } else if (queryClient && item.queryKey && item.tempId && serverData?._id) {
          // Default: replace temp item with server item
          queryClient.setQueryData(item.queryKey, (old = []) =>
            Array.isArray(old)
              ? old.map(i =>
                  i._id === item.tempId
                    ? { ...serverData, _syncStatus: 'synced' }
                    : i
                )
              : old
          );
          // Fade out the status badge after 2s
          setTimeout(() => {
            queryClient.setQueryData(item.queryKey, (old = []) =>
              Array.isArray(old)
                ? old.map(i =>
                    i._id === serverData._id
                      ? { ...i, _syncStatus: undefined }
                      : i
                  )
                : old
            );
          }, 2000);
        }

      } catch (error) {
        console.error('[SyncQueue] Task failed', { path: item.path, method: item.method, error });

        const isNetworkError = !error.status || error.status >= 502;

        if (isNetworkError) {
          // Keep in queue — will retry when online
          if (item.tempId && item.queryKey) {
            this._setStatus(queryClient, item.queryKey, item.tempId, 'queued');
          }
          toast.warning('Network lost. Changes queued and will sync when back online.');
          break;
        } else {
          // Server validation error (4xx) — remove from queue
          this.queue.shift();
          this.callbacks.delete(item.id);
          if (item.tempId) this.retryMap.delete(item.tempId);
          this.saveQueue();

          if (cbs.onError) {
            // Caller controls failure UX (mark failed, show Retry)
            cbs.onError(error, queryClient);
          } else if (item.rollbackQueryKeys?.length && item.previousData && queryClient) {
            // Default for UPDATE/DELETE: restore previous snapshot
            for (let i = 0; i < item.rollbackQueryKeys.length; i++) {
              const key  = item.rollbackQueryKeys[i];
              const prev = item.previousData[i];
              if (prev !== undefined) queryClient.setQueryData(key, prev);
            }
            toast.error(`Sync failed: ${error.message || 'Server error'}. Changes reverted.`);
          } else if (item.tempId && item.queryKey) {
            // CREATE failed without a custom handler: mark as failed (keep visible)
            this._setStatus(queryClient, item.queryKey, item.tempId, 'failed', {
              _syncError: error.message || 'Server rejected the request',
            });
            toast.error(`Failed to save record. Click Retry to try again.`);
          }
        }
      }
    }

    this.isProcessing = false;
    this.notify();
  }
}

export const syncQueue = new SyncQueue();
export default syncQueue;
