import { getDB, getLastSyncTime, getAllUnsyncedRecords, setLastSyncTime } from './db';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const HEALTH_CHECK_TIMEOUT_MS = 3000;
const listeners = new Set();

let syncInterval = null;
let activeSyncPromise = null;
let syncEventsBound = false;

let syncState = {
    networkOnline: navigator.onLine,
    serverReachable: null,
    isSyncing: false,
    lastSyncAt: null,
    lastError: null
};

function emitSyncState() {
    for (const listener of listeners) {
        listener(syncState);
    }
}

function setSyncState(patch) {
    syncState = { ...syncState, ...patch };
    emitSyncState();
}

function handleBrowserOnline() {
    setSyncState({
        networkOnline: true,
        serverReachable: null,
        isSyncing: false,
        lastError: null
    });
    syncWithServer();
}

function handleBrowserOffline() {
    setSyncState({
        networkOnline: false,
        serverReachable: false,
        isSyncing: false,
        lastError: 'Browser is offline'
    });
}

export function getSyncState() {
    return syncState;
}

export function subscribeToSyncState(listener) {
    listeners.add(listener);
    listener(syncState);

    return () => {
        listeners.delete(listener);
    };
}

async function checkServerHealth() {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    try {
        const response = await fetch(`${API_URL}/health`, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error('Server health check failed');
        }

        return true;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Server health check timed out');
        }

        throw error;
    } finally {
        window.clearTimeout(timeoutId);
    }
}

export async function syncWithServer() {
    if (!navigator.onLine) {
        handleBrowserOffline();
        return false;
    }

    if (activeSyncPromise) {
        return activeSyncPromise;
    }

    activeSyncPromise = (async () => {
        try {
            setSyncState({
                networkOnline: true,
                isSyncing: false,
                lastError: null
            });

            await checkServerHealth();

            setSyncState({
                networkOnline: true,
                serverReachable: true,
                isSyncing: true,
                lastError: null
            });

            const lastSync = await getLastSyncTime();
            const unsyncedRecords = await getAllUnsyncedRecords(lastSync);

            const response = await fetch(`${API_URL}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lastSync,
                    changes: unsyncedRecords
                })
            });

            if (!response.ok) {
                throw new Error('Sync response not ok');
            }

            const { timestamp, changes: serverChanges } = await response.json();

            const db = await getDB();
            const tx = db.transaction('sync_records', 'readwrite');

            for (const serverRecord of serverChanges) {
                const localRecord = await tx.store.get(serverRecord.id);

                // Last-Write-Wins logic based on updatedAt timestamp
                if (!localRecord || serverRecord.updatedAt > localRecord.updatedAt) {
                    tx.store.put(serverRecord);
                }
            }

            await tx.done;

            // Update last sync time
            await setLastSyncTime(timestamp);

            setSyncState({
                networkOnline: true,
                serverReachable: true,
                isSyncing: false,
                lastSyncAt: timestamp,
                lastError: null
            });

            return true;
        } catch (error) {
            console.error('Sync failed:', error);
            setSyncState({
                networkOnline: navigator.onLine,
                serverReachable: false,
                isSyncing: false,
                lastError: error instanceof Error ? error.message : 'Sync failed'
            });
            return false;
        } finally {
            activeSyncPromise = null;
        }
    })();

    return activeSyncPromise;
}

// Auto-sync polling every 10 seconds when online
export function startSync() {
    if (!syncEventsBound) {
        window.addEventListener('online', handleBrowserOnline);
        window.addEventListener('offline', handleBrowserOffline);
        syncEventsBound = true;
    }

    if (!syncInterval) {
        syncInterval = setInterval(() => {
            if (navigator.onLine) {
                syncWithServer();
            }
        }, 10000);

        // Also try immediately
        if (navigator.onLine) {
            syncWithServer();
        } else {
            handleBrowserOffline();
        }
    }
}

export function stopSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }

    if (syncEventsBound) {
        window.removeEventListener('online', handleBrowserOnline);
        window.removeEventListener('offline', handleBrowserOffline);
        syncEventsBound = false;
    }
}
