import { openDB } from 'idb';

const DB_NAME = 'reading-manager-db';
const DB_VERSION = 1;

export async function getDB() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('sync_records')) {
                const store = db.createObjectStore('sync_records', { keyPath: 'id' });
                store.createIndex('type', 'type');
                store.createIndex('updatedAt', 'updatedAt');
            }
            if (!db.objectStoreNames.contains('sync_state')) {
                db.createObjectStore('sync_state', { keyPath: 'id' });
            }
        },
    });
}

// Helpers for data access
export async function getRecordsByType(type, bookId = null) {
    const db = await getDB();
    const records = await db.getAllFromIndex('sync_records', 'type', type);
    return records
        .filter(r => !r.deleted)
        .filter(r => bookId ? r.data.bookId === bookId : true)
        .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getRecord(id) {
    const db = await getDB();
    return db.get('sync_records', id);
}

export async function saveRecord(record) {
    const db = await getDB();
    record.updatedAt = Date.now();
    await db.put('sync_records', record);
    return record;
}

export async function deleteRecord(id) {
    const db = await getDB();
    const record = await db.get('sync_records', id);
    if (record) {
        record.deleted = true;
        record.updatedAt = Date.now();
        await db.put('sync_records', record);
    }
}

// Store last sync timestamp
export async function getLastSyncTime() {
    const db = await getDB();
    const state = await db.get('sync_state', 'lastSync');
    return state ? state.value : 0;
}

export async function setLastSyncTime(timestamp) {
    const db = await getDB();
    await db.put('sync_state', { id: 'lastSync', value: timestamp });
}

export async function getAllUnsyncedRecords(lastSyncTime) {
    const db = await getDB();
    const tx = db.transaction('sync_records', 'readonly');
    const index = tx.store.index('updatedAt');
    const range = IDBKeyRange.lowerBound(lastSyncTime, true);
    return index.getAll(range);
}
