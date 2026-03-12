import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRecordsByType, saveRecord, deleteRecord } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import {
    Book,
    BookOpen,
    Bookmark,
    FileText,
    Grid2X2,
    List,
    PenSquare,
    Plus,
    Sparkles,
    Trash2
} from 'lucide-react';

const BOOK_MODE_KEY = 'reading-manager-books-mode';
const EMPTY_BOOK = {
    title: '',
    author: '',
    status: 'reading'
};
const STATUS_OPTIONS = [
    { value: 'all', label: 'All statuses' },
    { value: 'reading', label: 'Currently Reading' },
    { value: 'completed', label: 'Completed' },
    { value: 'want_to_read', label: 'Want to Read' }
];
const SHELF_ORDER = ['reading', 'want_to_read', 'completed'];

function createEmptyBookDraft() {
    return { ...EMPTY_BOOK };
}

function getInitialMode() {
    if (typeof window === 'undefined') {
        return 'spreadsheet';
    }

    const storedMode = window.localStorage.getItem(BOOK_MODE_KEY);
    return storedMode === 'library' ? 'library' : 'spreadsheet';
}

function formatStatusLabel(status) {
    return status.replace(/_/g, ' ');
}

function formatDate(timestamp) {
    if (!timestamp) {
        return 'Just now';
    }

    return new Date(timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function getCoverTone(title = '') {
    const tones = [
        'tone-olive',
        'tone-rust',
        'tone-ink',
        'tone-gold',
        'tone-fern',
        'tone-plum'
    ];

    const seed = title.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
    return tones[seed % tones.length];
}

function getBookMonogram(title = '') {
    const cleaned = title.trim();
    if (!cleaned) {
        return 'BK';
    }

    const words = cleaned.split(/\s+/).slice(0, 2);
    return words.map(word => word[0]?.toUpperCase() ?? '').join('') || 'BK';
}

function buildBookRows(books, notes, citations) {
    const metricsByBookId = new Map();

    for (const note of notes) {
        const bookId = note.data.bookId;
        if (!bookId) {
            continue;
        }

        const metrics = metricsByBookId.get(bookId) || {
            notesCount: 0,
            citationsCount: 0,
            lastActivityAt: 0
        };

        metrics.notesCount += 1;
        metrics.lastActivityAt = Math.max(metrics.lastActivityAt, note.updatedAt || 0);
        metricsByBookId.set(bookId, metrics);
    }

    for (const citation of citations) {
        const bookId = citation.data.bookId;
        if (!bookId) {
            continue;
        }

        const metrics = metricsByBookId.get(bookId) || {
            notesCount: 0,
            citationsCount: 0,
            lastActivityAt: 0
        };

        metrics.citationsCount += 1;
        metrics.lastActivityAt = Math.max(metrics.lastActivityAt, citation.updatedAt || 0);
        metricsByBookId.set(bookId, metrics);
    }

    return books
        .map(book => {
            const metrics = metricsByBookId.get(book.id) || {
                notesCount: 0,
                citationsCount: 0,
                lastActivityAt: 0
            };
            const lastActivityAt = Math.max(book.updatedAt || 0, metrics.lastActivityAt || 0);

            return {
                ...book,
                notesCount: metrics.notesCount,
                citationsCount: metrics.citationsCount,
                lastActivityAt
            };
        })
        .sort((left, right) => right.lastActivityAt - left.lastActivityAt);
}

function BookCover({ title, author, large = false }) {
    return (
        <div className={`book-cover ${getCoverTone(title)} ${large ? 'is-large' : ''}`}>
            <span className="book-cover-monogram">{getBookMonogram(title)}</span>
            <div className="book-cover-copy">
                <span className="book-cover-title">{title || 'Untitled'}</span>
                <span className="book-cover-author">{author || 'Unknown Author'}</span>
            </div>
        </div>
    );
}

function WorkspaceModeToggle({ mode, onChange }) {
    return (
        <div className="books-mode-toggle" role="tablist" aria-label="Reading list view mode">
            <button
                type="button"
                className={`mode-chip ${mode === 'spreadsheet' ? 'active' : ''}`}
                onClick={() => onChange('spreadsheet')}
            >
                <List size={16} />
                Spreadsheet
            </button>
            <button
                type="button"
                className={`mode-chip ${mode === 'library' ? 'active' : ''}`}
                onClick={() => onChange('library')}
            >
                <Grid2X2 size={16} />
                Library
            </button>
        </div>
    );
}

function RelatedItemsSection({ title, icon, items, type }) {
    return (
        <section className="book-panel-section">
            <div className="book-panel-section-title">
                {icon}
                <h3>{title}</h3>
            </div>

            {items.length === 0 ? (
                <p className="muted-note">No {type} linked to this book yet.</p>
            ) : (
                <div className="book-linked-list">
                    {items.slice(0, 4).map(item => (
                        <article key={item.id} className="book-linked-card">
                            <strong>{item.data.title || item.data.pageNumber || 'Saved item'}</strong>
                            <p>{item.data.content || item.data.text || 'No preview available.'}</p>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}

function BookEditorPanel({
    draft,
    isCreating,
    isDirty,
    selectedRow,
    selectedNotes,
    selectedCitations,
    onDraftChange,
    onSave,
    onReset,
    onDelete
}) {
    const title = isCreating
        ? 'New Book'
        : selectedRow
            ? 'Book Details'
            : 'Inspector';
    const subtitle = isCreating
        ? 'Add a new title directly from the workspace.'
        : selectedRow
            ? 'Edit metadata, review linked notes, and keep context in view.'
            : 'Select a row to inspect a book or start a new entry.';

    return (
        <aside className="books-inspector">
            <div className="books-inspector-header">
                <div>
                    <p className="books-panel-kicker">{isCreating ? 'Workspace Draft' : 'Selected Book'}</p>
                    <h2>{title}</h2>
                    <p>{subtitle}</p>
                </div>
                {(isCreating || selectedRow) && (
                    <BookCover
                        title={draft.title || selectedRow?.data.title}
                        author={draft.author || selectedRow?.data.author}
                        large
                    />
                )}
            </div>

            {!isCreating && !selectedRow ? (
                <div className="books-empty-panel">
                    <BookOpen size={28} />
                    <p>Choose a book from the table to inspect it, or create a new one from the toolbar.</p>
                </div>
            ) : (
                <form className="books-editor-form" onSubmit={onSave}>
                    <label className="books-field">
                        <span className="field-label">Title</span>
                        <input
                            type="text"
                            className="input-field"
                            value={draft.title}
                            onChange={event => onDraftChange('title', event.target.value)}
                            placeholder="Book title"
                            required
                        />
                    </label>

                    <label className="books-field">
                        <span className="field-label">Author</span>
                        <input
                            type="text"
                            className="input-field"
                            value={draft.author}
                            onChange={event => onDraftChange('author', event.target.value)}
                            placeholder="Author"
                        />
                    </label>

                    <label className="books-field">
                        <span className="field-label">Status</span>
                        <select
                            className="input-field"
                            value={draft.status}
                            onChange={event => onDraftChange('status', event.target.value)}
                        >
                            {STATUS_OPTIONS.filter(option => option.value !== 'all').map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="books-inspector-stats">
                        <div>
                            <span>Notes</span>
                            <strong>{selectedNotes.length}</strong>
                        </div>
                        <div>
                            <span>Citations</span>
                            <strong>{selectedCitations.length}</strong>
                        </div>
                        <div>
                            <span>Last update</span>
                            <strong>{formatDate(selectedRow?.lastActivityAt)}</strong>
                        </div>
                    </div>

                    <div className="books-inspector-actions">
                        <button type="button" className="btn btn-secondary" onClick={onReset}>
                            {isDirty ? 'Reset changes' : isCreating ? 'Clear draft' : 'Refresh fields'}
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={!draft.title.trim()}>
                            <PenSquare size={16} />
                            {isCreating ? 'Create Book' : 'Save Changes'}
                        </button>
                    </div>

                    {!isCreating && selectedRow && (
                        <button type="button" className="btn btn-danger books-delete-btn" onClick={onDelete}>
                            <Trash2 size={16} />
                            Delete Book
                        </button>
                    )}

                    <div className="books-shortcuts">
                        <Link className="books-shortcut-link" to="/notes">
                            <FileText size={16} />
                            Open notes
                        </Link>
                        <Link className="books-shortcut-link" to="/citations">
                            <Bookmark size={16} />
                            Open citations
                        </Link>
                    </div>

                    <RelatedItemsSection
                        title="Related Notes"
                        icon={<FileText size={18} />}
                        items={selectedNotes}
                        type="notes"
                    />

                    <RelatedItemsSection
                        title="Saved Citations"
                        icon={<Bookmark size={18} />}
                        items={selectedCitations}
                        type="citations"
                    />
                </form>
            )}
        </aside>
    );
}

function SpreadsheetBooksView({
    rows,
    selectedBookId,
    onSelectBook,
    draft,
    isCreating,
    isDirty,
    selectedRow,
    selectedNotes,
    selectedCitations,
    onDraftChange,
    onSave,
    onReset,
    onDelete
}) {
    return (
        <div className="books-workspace books-workspace-spreadsheet">
            <section className="books-table-surface">
                {rows.length === 0 ? (
                    <div className="empty-state books-workspace-empty">
                        <List size={48} />
                        <h3>No Books In This View</h3>
                        <p>Adjust the status filter or add a new title to start building the spreadsheet workspace.</p>
                    </div>
                ) : (
                    <div className="books-table-wrap">
                        <table className="books-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Author</th>
                                    <th>Status</th>
                                    <th>Notes</th>
                                    <th>Citations</th>
                                    <th>Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(row => (
                                    <tr
                                        key={row.id}
                                        className={row.id === selectedBookId ? 'selected' : ''}
                                        onClick={() => onSelectBook(row.id)}
                                    >
                                        <td>
                                            <div className="books-row-title">
                                                <BookCover title={row.data.title} author={row.data.author} />
                                                <div>
                                                    <strong>{row.data.title}</strong>
                                                    <span>{row.data.author || 'Unknown Author'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{row.data.author || 'Unknown Author'}</td>
                                        <td>
                                            <span className={`status-chip ${row.data.status}`}>
                                                {formatStatusLabel(row.data.status)}
                                            </span>
                                        </td>
                                        <td>{row.notesCount}</td>
                                        <td>{row.citationsCount}</td>
                                        <td>{formatDate(row.lastActivityAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <BookEditorPanel
                draft={draft}
                isCreating={isCreating}
                isDirty={isDirty}
                selectedRow={selectedRow}
                selectedNotes={selectedNotes}
                selectedCitations={selectedCitations}
                onDraftChange={onDraftChange}
                onSave={onSave}
                onReset={onReset}
                onDelete={onDelete}
            />
        </div>
    );
}

function LibraryBooksView({
    rows,
    selectedBookId,
    draft,
    isCreating,
    isDirty,
    selectedRow,
    selectedNotes,
    selectedCitations,
    onSelectBook,
    onDraftChange,
    onSave,
    onReset,
    onDelete
}) {
    const groupedRows = SHELF_ORDER
        .map(status => ({
            status,
            label: STATUS_OPTIONS.find(option => option.value === status)?.label || formatStatusLabel(status),
            rows: rows.filter(row => row.data.status === status)
        }))
        .filter(section => section.rows.length > 0);

    return (
        <div className="books-workspace books-workspace-library">
            <section className="library-stage">
                {groupedRows.length === 0 ? (
                    <div className="empty-state books-workspace-empty">
                        <Sparkles size={48} />
                        <h3>No Books On This Shelf</h3>
                        <p>There are no books in the current filter. Change the filter or add a new title.</p>
                    </div>
                ) : (
                    groupedRows.map(section => (
                        <div key={section.status} className="library-shelf">
                            <div className="library-shelf-header">
                                <div>
                                    <p className="books-panel-kicker">Shelf</p>
                                    <h2>{section.label}</h2>
                                </div>
                                <span className="library-count">{section.rows.length} titles</span>
                            </div>

                            <div className="library-grid">
                                {section.rows.map(row => (
                                    <button
                                        key={row.id}
                                        type="button"
                                        className={`library-book ${row.id === selectedBookId ? 'selected' : ''}`}
                                        onClick={() => onSelectBook(row.id)}
                                    >
                                        <BookCover title={row.data.title} author={row.data.author} large />
                                        <div className="library-book-meta">
                                            <strong>{row.data.title}</strong>
                                            <span>{row.data.author || 'Unknown Author'}</span>
                                            <div className="library-book-stats">
                                                <span>{row.notesCount} notes</span>
                                                <span>{row.citationsCount} citations</span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </section>

            <aside className="library-detail-drawer">
                <div className="library-detail-header">
                    <p className="books-panel-kicker">{isCreating ? 'New Shelf Entry' : 'Now Selected'}</p>
                    <h2>{isCreating ? 'Add a book' : selectedRow ? selectedRow.data.title : 'Browse the library'}</h2>
                    <p>
                        {isCreating
                            ? 'Create a new title without leaving the shelf view.'
                            : selectedRow
                                ? 'Review notes, citations, and update the book details from the side drawer.'
                                : 'Pick a title to open its reading context.'}
                    </p>
                </div>

                {!isCreating && !selectedRow ? (
                    <div className="books-empty-panel">
                        <Book size={28} />
                        <p>Select any title card to open its detail drawer.</p>
                    </div>
                ) : (
                    <form className="books-editor-form library-editor-form" onSubmit={onSave}>
                        <BookCover
                            title={draft.title || selectedRow?.data.title}
                            author={draft.author || selectedRow?.data.author}
                            large
                        />

                        <label className="books-field">
                            <span className="field-label">Title</span>
                            <input
                                type="text"
                                className="input-field"
                                value={draft.title}
                                onChange={event => onDraftChange('title', event.target.value)}
                                placeholder="Book title"
                                required
                            />
                        </label>

                        <label className="books-field">
                            <span className="field-label">Author</span>
                            <input
                                type="text"
                                className="input-field"
                                value={draft.author}
                                onChange={event => onDraftChange('author', event.target.value)}
                                placeholder="Author"
                            />
                        </label>

                        <label className="books-field">
                            <span className="field-label">Status</span>
                            <select
                                className="input-field"
                                value={draft.status}
                                onChange={event => onDraftChange('status', event.target.value)}
                            >
                                {STATUS_OPTIONS.filter(option => option.value !== 'all').map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="library-inline-stats">
                            <span>{selectedNotes.length} notes</span>
                            <span>{selectedCitations.length} citations</span>
                            <span>{formatDate(selectedRow?.lastActivityAt)}</span>
                        </div>

                        <div className="books-inspector-actions">
                            <button type="button" className="btn btn-secondary" onClick={onReset}>
                                {isDirty ? 'Reset changes' : isCreating ? 'Clear draft' : 'Refresh fields'}
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={!draft.title.trim()}>
                                <PenSquare size={16} />
                                {isCreating ? 'Create Book' : 'Save Changes'}
                            </button>
                        </div>

                        {!isCreating && selectedRow && (
                            <button type="button" className="btn btn-danger books-delete-btn" onClick={onDelete}>
                                <Trash2 size={16} />
                                Delete Book
                            </button>
                        )}

                        <RelatedItemsSection
                            title="Notes Nearby"
                            icon={<FileText size={18} />}
                            items={selectedNotes}
                            type="notes"
                        />

                        <RelatedItemsSection
                            title="Marked Citations"
                            icon={<Bookmark size={18} />}
                            items={selectedCitations}
                            type="citations"
                        />
                    </form>
                )}
            </aside>
        </div>
    );
}

export default function Books() {
    const [books, setBooks] = useState([]);
    const [notes, setNotes] = useState([]);
    const [citations, setCitations] = useState([]);
    const [mode, setMode] = useState(getInitialMode);
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedBookId, setSelectedBookId] = useState(null);
    const [draft, setDraft] = useState(createEmptyBookDraft);
    const [isCreating, setIsCreating] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    async function loadWorkspace() {
        const [bookData, noteData, citationData] = await Promise.all([
            getRecordsByType('item'),
            getRecordsByType('note'),
            getRecordsByType('citation')
        ]);

        setBooks(bookData);
        setNotes(noteData);
        setCitations(citationData);
    }

    useEffect(() => {
        const kickoff = window.setTimeout(() => {
            void loadWorkspace();
        }, 0);
        const interval = window.setInterval(() => {
            void loadWorkspace();
        }, 3000);

        return () => {
            window.clearTimeout(kickoff);
            window.clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        window.localStorage.setItem(BOOK_MODE_KEY, mode);
    }, [mode]);

    const bookRows = useMemo(() => buildBookRows(books, notes, citations), [books, notes, citations]);

    const filteredRows = useMemo(() => {
        if (statusFilter === 'all') {
            return bookRows;
        }

        return bookRows.filter(row => row.data.status === statusFilter);
    }, [bookRows, statusFilter]);

    const selectedRow = useMemo(
        () => bookRows.find(row => row.id === selectedBookId) || null,
        [bookRows, selectedBookId]
    );

    const selectedNotes = useMemo(
        () => notes.filter(note => note.data.bookId === selectedBookId),
        [notes, selectedBookId]
    );

    const selectedCitations = useMemo(
        () => citations.filter(citation => citation.data.bookId === selectedBookId),
        [citations, selectedBookId]
    );


    function openNewBook() {
        setSelectedBookId(null);
        setDraft(createEmptyBookDraft());
        setIsCreating(true);
        setIsDirty(false);
    }

    function handleSelectBook(bookId) {
        const row = bookRows.find(book => book.id === bookId);
        if (!row) {
            return;
        }

        setSelectedBookId(bookId);
        setDraft({
            title: row.data.title || '',
            author: row.data.author || '',
            status: row.data.status || 'reading'
        });
        setIsCreating(false);
        setIsDirty(false);
    }

    function handleDraftChange(field, value) {
        setDraft(currentDraft => ({
            ...currentDraft,
            [field]: value
        }));
        setIsDirty(true);
    }

    function resetDraft() {
        if (isCreating) {
            setDraft(createEmptyBookDraft());
            setIsDirty(false);
            return;
        }

        if (!selectedRow) {
            return;
        }

        setDraft({
            title: selectedRow.data.title || '',
            author: selectedRow.data.author || '',
            status: selectedRow.data.status || 'reading'
        });
        setIsDirty(false);
    }

    async function handleSaveBook(event) {
        event.preventDefault();

        const normalizedTitle = draft.title.trim();
        if (!normalizedTitle) {
            return;
        }

        const recordId = isCreating ? uuidv4() : selectedBookId;
        const record = {
            id: recordId,
            type: 'item',
            data: {
                title: normalizedTitle,
                author: draft.author.trim(),
                status: draft.status
            },
            updatedAt: Date.now(),
            deleted: 0
        };

        await saveRecord(record);
        await loadWorkspace();
        setSelectedBookId(record.id);
        setDraft(record.data);
        setIsCreating(false);
        setIsDirty(false);
    }

    async function handleDeleteBook() {
        if (!selectedBookId) {
            return;
        }

        const confirmed = window.confirm('Delete this book from the reading list?');
        if (!confirmed) {
            return;
        }

        const deletingId = selectedBookId;
        setSelectedBookId(null);
        setDraft(createEmptyBookDraft());
        setIsCreating(false);
        setIsDirty(false);
        await deleteRecord(deletingId);
        await loadWorkspace();
    }

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Reading List</h1>
                    <p className="page-subtitle">
                        Switch between a spreadsheet desk for active management and a browse-first library for discovery.
                    </p>
                </div>
            </div>

            <div className="books-toolbar">
                <div className="books-toolbar-left">
                    <WorkspaceModeToggle mode={mode} onChange={setMode} />

                    <label className="books-filter">
                        <span className="field-label">Status</span>
                        <select
                            className="input-field"
                            value={statusFilter}
                            onChange={event => setStatusFilter(event.target.value)}
                        >
                            {STATUS_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="books-toolbar-right">
                    <div className="books-toolbar-summary">
                        <strong>{filteredRows.length}</strong>
                        <span>{statusFilter === 'all' ? 'visible books' : `${formatStatusLabel(statusFilter)} books`}</span>
                    </div>
                    <button type="button" className="btn btn-primary" onClick={openNewBook}>
                        <Plus size={16} />
                        Add Book
                    </button>
                </div>
            </div>

            {mode === 'spreadsheet' ? (
                <SpreadsheetBooksView
                    rows={filteredRows}
                    selectedBookId={selectedBookId}
                    onSelectBook={handleSelectBook}
                    draft={draft}
                    isCreating={isCreating}
                    isDirty={isDirty}
                    selectedRow={selectedRow}
                    selectedNotes={selectedNotes}
                    selectedCitations={selectedCitations}
                    onDraftChange={handleDraftChange}
                    onSave={handleSaveBook}
                    onReset={resetDraft}
                    onDelete={handleDeleteBook}
                />
            ) : (
                <LibraryBooksView
                    rows={filteredRows}
                    selectedBookId={selectedBookId}
                    draft={draft}
                    isCreating={isCreating}
                    isDirty={isDirty}
                    selectedRow={selectedRow}
                    selectedNotes={selectedNotes}
                    selectedCitations={selectedCitations}
                    onSelectBook={handleSelectBook}
                    onDraftChange={handleDraftChange}
                    onSave={handleSaveBook}
                    onReset={resetDraft}
                    onDelete={handleDeleteBook}
                />
            )}
        </div>
    );
}

