const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // mind maps can be large

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) {
                reject(err);
                return;
            }

            resolve(this);
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(rows);
        });
    });
}

function normalizeWhitespace(value) {
    return String(value ?? '').replace(/\r\n/g, '\n');
}

function normalizeComparableText(value) {
    return normalizeWhitespace(value).replace(/\s+/g, ' ').trim();
}

function normalizeComparisonKey(value) {
    return normalizeComparableText(value).toLowerCase();
}

function levenshteinDistance(a, b) {
    if (a === b) {
        return 0;
    }

    if (!a.length) {
        return b.length;
    }

    if (!b.length) {
        return a.length;
    }

    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    const current = new Array(b.length + 1);

    for (let i = 1; i <= a.length; i += 1) {
        current[0] = i;

        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(
                current[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + cost
            );
        }

        for (let j = 0; j <= b.length; j += 1) {
            previous[j] = current[j];
        }
    }

    return previous[b.length];
}

function similarityScore(a, b) {
    const normalizedA = normalizeComparisonKey(a);
    const normalizedB = normalizeComparisonKey(b);

    if (!normalizedA && !normalizedB) {
        return 1;
    }

    if (!normalizedA || !normalizedB) {
        return 0;
    }

    const longestLength = Math.max(normalizedA.length, normalizedB.length);
    return 1 - (levenshteinDistance(normalizedA, normalizedB) / longestLength);
}

function tokenizeText(text) {
    return normalizeWhitespace(text).match(/\s+|[^\s]+/g) || [];
}

function buildLcsPairs(existingTokens, incomingTokens) {
    const rowCount = existingTokens.length + 1;
    const columnCount = incomingTokens.length + 1;
    const matrix = Array.from({ length: rowCount }, () => Array(columnCount).fill(0));

    for (let i = existingTokens.length - 1; i >= 0; i -= 1) {
        for (let j = incomingTokens.length - 1; j >= 0; j -= 1) {
            if (existingTokens[i] === incomingTokens[j]) {
                matrix[i][j] = matrix[i + 1][j + 1] + 1;
            } else {
                matrix[i][j] = Math.max(matrix[i + 1][j], matrix[i][j + 1]);
            }
        }
    }

    const pairs = [];
    let existingIndex = 0;
    let incomingIndex = 0;

    while (existingIndex < existingTokens.length && incomingIndex < incomingTokens.length) {
        if (existingTokens[existingIndex] === incomingTokens[incomingIndex]) {
            pairs.push([existingIndex, incomingIndex]);
            existingIndex += 1;
            incomingIndex += 1;
            continue;
        }

        if (matrix[existingIndex + 1][incomingIndex] >= matrix[existingIndex][incomingIndex + 1]) {
            existingIndex += 1;
        } else {
            incomingIndex += 1;
        }
    }

    return pairs;
}

function joinDistinctSegments(first, second) {
    if (!first) {
        return second;
    }

    if (!second) {
        return first;
    }

    const needsSpace = /\S$/.test(first) && /^\S/.test(second);
    return `${first}${needsSpace ? ' ' : ''}${second}`;
}

function segmentsRepresentRevision(existingSegment, incomingSegment) {
    const existingComparable = normalizeComparableText(existingSegment);
    const incomingComparable = normalizeComparableText(incomingSegment);

    if (!existingComparable || !incomingComparable) {
        return false;
    }

    if (existingComparable.includes(incomingComparable) || incomingComparable.includes(existingComparable)) {
        return true;
    }

    return similarityScore(existingSegment, incomingSegment) >= 0.58;
}

function resolveTokenConflict(existingSegment, incomingSegment, preferIncoming) {
    const existingComparable = normalizeComparableText(existingSegment);
    const incomingComparable = normalizeComparableText(incomingSegment);

    if (!existingComparable) {
        return incomingSegment;
    }

    if (!incomingComparable) {
        return existingSegment;
    }

    if (normalizeComparisonKey(existingSegment) === normalizeComparisonKey(incomingSegment)) {
        return preferIncoming ? incomingSegment : existingSegment;
    }

    if (incomingComparable.includes(existingComparable)) {
        return incomingSegment;
    }

    if (existingComparable.includes(incomingComparable)) {
        return existingSegment;
    }

    if (segmentsRepresentRevision(existingSegment, incomingSegment)) {
        return preferIncoming ? incomingSegment : existingSegment;
    }

    return preferIncoming
        ? joinDistinctSegments(existingSegment, incomingSegment)
        : joinDistinctSegments(incomingSegment, existingSegment);
}

function mergeLongText(existingText, incomingText, preferIncoming) {
    const normalizedExisting = normalizeWhitespace(existingText);
    const normalizedIncoming = normalizeWhitespace(incomingText);

    if (!normalizeComparableText(normalizedExisting)) {
        return normalizedIncoming;
    }

    if (!normalizeComparableText(normalizedIncoming)) {
        return normalizedExisting;
    }

    if (normalizeComparisonKey(normalizedExisting) === normalizeComparisonKey(normalizedIncoming)) {
        return preferIncoming ? normalizedIncoming : normalizedExisting;
    }

    const existingTokens = tokenizeText(normalizedExisting);
    const incomingTokens = tokenizeText(normalizedIncoming);

    if ((existingTokens.length * incomingTokens.length) > 160000) {
        return resolveTokenConflict(normalizedExisting, normalizedIncoming, preferIncoming);
    }

    const lcsPairs = buildLcsPairs(existingTokens, incomingTokens);
    const merged = [];
    let previousExistingIndex = 0;
    let previousIncomingIndex = 0;

    for (const [existingIndex, incomingIndex] of lcsPairs) {
        const existingSegment = existingTokens.slice(previousExistingIndex, existingIndex).join('');
        const incomingSegment = incomingTokens.slice(previousIncomingIndex, incomingIndex).join('');

        merged.push(resolveTokenConflict(existingSegment, incomingSegment, preferIncoming));
        merged.push(existingTokens[existingIndex]);

        previousExistingIndex = existingIndex + 1;
        previousIncomingIndex = incomingIndex + 1;
    }

    const trailingExistingSegment = existingTokens.slice(previousExistingIndex).join('');
    const trailingIncomingSegment = incomingTokens.slice(previousIncomingIndex).join('');
    merged.push(resolveTokenConflict(trailingExistingSegment, trailingIncomingSegment, preferIncoming));

    return merged.join('');
}

function mergeShortText(existingText, incomingText, preferIncoming) {
    const normalizedExisting = normalizeComparableText(existingText);
    const normalizedIncoming = normalizeComparableText(incomingText);

    if (!normalizedExisting) {
        return String(incomingText ?? '');
    }

    if (!normalizedIncoming) {
        return String(existingText ?? '');
    }

    if (normalizeComparisonKey(existingText) === normalizeComparisonKey(incomingText)) {
        return preferIncoming ? String(incomingText) : String(existingText);
    }

    if (normalizedIncoming.includes(normalizedExisting)) {
        return String(incomingText);
    }

    if (normalizedExisting.includes(normalizedIncoming)) {
        return String(existingText);
    }

    return preferIncoming ? String(incomingText) : String(existingText);
}

function parseRow(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        type: row.type,
        data: JSON.parse(row.data),
        updatedAt: row.updatedAt,
        deleted: Boolean(row.deleted)
    };
}

function serializeRecord(record) {
    return [
        record.id,
        record.type,
        JSON.stringify(record.data),
        record.updatedAt,
        record.deleted ? 1 : 0
    ];
}

function shouldMergeNoteConflict(existingRecord, incomingRecord, lastSync) {
    return existingRecord.type === 'note'
        && incomingRecord.type === 'note'
        && !existingRecord.deleted
        && !incomingRecord.deleted
        && existingRecord.updatedAt > lastSync
        && incomingRecord.updatedAt > lastSync;
}

function mergeNoteRecords(existingRecord, incomingRecord) {
    const preferIncoming = incomingRecord.updatedAt >= existingRecord.updatedAt;
    const existingData = existingRecord.data || {};
    const incomingData = incomingRecord.data || {};

    return {
        id: existingRecord.id,
        type: 'note',
        updatedAt: Math.max(Date.now(), existingRecord.updatedAt, incomingRecord.updatedAt),
        deleted: false,
        data: {
            ...existingData,
            ...incomingData,
            title: mergeShortText(existingData.title, incomingData.title, preferIncoming),
            content: mergeLongText(existingData.content, incomingData.content, preferIncoming),
            bookId: mergeShortText(existingData.bookId, incomingData.bookId, preferIncoming)
        }
    };
}

function resolveRecordChange(existingRecord, incomingRecord, lastSync) {
    if (!existingRecord) {
        return incomingRecord;
    }

    if (shouldMergeNoteConflict(existingRecord, incomingRecord, lastSync)) {
        return mergeNoteRecords(existingRecord, incomingRecord);
    }

    return incomingRecord.updatedAt > existingRecord.updatedAt ? incomingRecord : existingRecord;
}

// Initialize database
db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS sync_records (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      updatedAt INTEGER NOT NULL,
      deleted INTEGER DEFAULT 0
    )
  `);
    // Index for querying by timestamp
    db.run(`CREATE INDEX IF NOT EXISTS idx_updated_at ON sync_records(updatedAt)`);
});

app.get('/api/health', async (req, res) => {
    try {
        await dbGet('SELECT 1 AS ok');
        res.json({
            status: 'ok',
            timestamp: Date.now()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: 'Database unavailable'
        });
    }
});

app.post('/api/sync', async (req, res) => {
    const { lastSync = 0, changes = [] } = req.body;

    try {
        await dbRun('BEGIN TRANSACTION');

        for (const change of changes) {
            const incomingRecord = {
                id: change.id,
                type: change.type,
                data: change.data,
                updatedAt: change.updatedAt,
                deleted: Boolean(change.deleted)
            };

            const existingRow = await dbGet(
                'SELECT * FROM sync_records WHERE id = ?',
                [incomingRecord.id]
            );
            const existingRecord = parseRow(existingRow);
            const resolvedRecord = resolveRecordChange(existingRecord, incomingRecord, lastSync);

            if (existingRecord && resolvedRecord.updatedAt === existingRecord.updatedAt) {
                const samePayload = JSON.stringify(resolvedRecord.data) === JSON.stringify(existingRecord.data)
                    && resolvedRecord.deleted === existingRecord.deleted
                    && resolvedRecord.type === existingRecord.type;

                if (samePayload) {
                    continue;
                }
            }

            await dbRun(
                `
                INSERT INTO sync_records (id, type, data, updatedAt, deleted)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  type = excluded.type,
                  data = excluded.data,
                  updatedAt = excluded.updatedAt,
                  deleted = excluded.deleted
                `,
                serializeRecord(resolvedRecord)
            );
        }

        await dbRun('COMMIT');

        const rows = await dbAll(
            'SELECT * FROM sync_records WHERE updatedAt > ?',
            [lastSync]
        );

        const serverChanges = rows.map(parseRow);
        const responseTimestamp = Date.now();

        res.json({
            timestamp: responseTimestamp,
            changes: serverChanges
        });
    } catch (error) {
        try {
            await dbRun('ROLLBACK');
        } catch (rollbackError) {
            // Ignore rollback failures and return the original sync error.
        }

        res.status(500).json({ error: 'Sync failed on the server' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Sync server running on port ${PORT}`);
});
