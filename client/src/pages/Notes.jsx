import { useState, useEffect } from 'react';
import { getRecordsByType, saveRecord, deleteRecord } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { FileText, Plus, Trash2, Book, PenSquare, X } from 'lucide-react';

function createEmptyNote() {
    return { title: '', content: '', bookId: '' };
}

export default function Notes() {
    const [notes, setNotes] = useState([]);
    const [books, setBooks] = useState([]);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [noteDraft, setNoteDraft] = useState(createEmptyNote);
    const [filterBookId, setFilterBookId] = useState('');

    useEffect(() => {
        loadBooks();
        loadNotes();
        const interval = setInterval(loadNotes, 3000);
        return () => clearInterval(interval);
    }, [filterBookId]);

    const loadBooks = async () => {
        const data = await getRecordsByType('item'); // item = books
        setBooks(data);
    };

    const loadNotes = async () => {
        const data = await getRecordsByType('note', filterBookId || null);
        setNotes(data);
    };

    const openNewNoteEditor = () => {
        setEditingNoteId(null);
        setNoteDraft(createEmptyNote());
        setIsEditorOpen(true);
    };

    const openEditNoteEditor = (record) => {
        setEditingNoteId(record.id);
        setNoteDraft({
            title: record.data.title || '',
            content: record.data.content || '',
            bookId: record.data.bookId || ''
        });
        setIsEditorOpen(true);
    };

    const closeEditor = () => {
        setEditingNoteId(null);
        setNoteDraft(createEmptyNote());
        setIsEditorOpen(false);
    };

    const handleSaveNote = async (e) => {
        e.preventDefault();
        if (!noteDraft.title || !noteDraft.bookId) return;

        const record = {
            id: editingNoteId || uuidv4(),
            type: 'note',
            data: noteDraft,
            updatedAt: Date.now(),
            deleted: 0
        };
        await saveRecord(record);
        closeEditor();
        await loadNotes();
    };

    const handleDelete = async (id) => {
        await deleteRecord(id);
        loadNotes();
    };

    const getBookTitle = (bookId) => {
        const book = books.find(b => b.id === bookId);
        return book ? book.data.title : 'Unknown Book';
    };

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Notes</h1>
                    <p className="page-subtitle">Your personal insights and reflections.</p>
                </div>

                <div className="page-actions">
                    <select
                        className="input-field filter-select"
                        value={filterBookId}
                        onChange={(e) => setFilterBookId(e.target.value)}
                    >
                        <option value="">All Books</option>
                        {books.map(b => (
                            <option key={b.id} value={b.id}>{b.data.title}</option>
                        ))}
                    </select>
                    <button className="btn btn-primary" onClick={openNewNoteEditor}>
                        <Plus size={18} /> New Note
                    </button>
                </div>
            </div>

            {isEditorOpen && (
                <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeEditor(); }}>
                    <div className="modal-content modal-wide note-editor-modal">
                        <div className="note-editor-topbar">
                            <div className="note-editor-chip">
                                <PenSquare size={16} />
                                {editingNoteId ? 'Editing note' : 'Fresh note'}
                            </div>
                            <button className="icon-btn" onClick={closeEditor} title="Close note editor">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveNote} className="note-editor-layout">
                            <section className="note-editor-main">
                                <input
                                    type="text"
                                    placeholder="Untitled note"
                                    className="note-editor-title-input"
                                    value={noteDraft.title}
                                    onChange={e => setNoteDraft({ ...noteDraft, title: e.target.value })}
                                    required
                                />

                                <textarea
                                    placeholder="Capture an idea, rewrite a thought, or build out the next sentence."
                                    className="note-editor-body-input"
                                    value={noteDraft.content}
                                    onChange={e => setNoteDraft({ ...noteDraft, content: e.target.value })}
                                ></textarea>
                            </section>

                            <aside className="note-editor-sidebar">
                                <div className="note-editor-panel">
                                    <span className="field-label">Attached Book</span>
                                    <select
                                        className="input-field"
                                        value={noteDraft.bookId}
                                        onChange={e => setNoteDraft({ ...noteDraft, bookId: e.target.value })}
                                        required
                                    >
                                        <option value="" disabled>Select Associated Book *</option>
                                        {books.map(b => (
                                            <option key={b.id} value={b.id}>{b.data.title}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="note-editor-panel">
                                    <span className="field-label">Writing Surface</span>
                                    <p className="note-editor-helper">
                                        Built for revising existing notes, not just adding new ones. Replace wording, extend paragraphs, and keep the same note identity.
                                    </p>
                                </div>

                                <div className="note-editor-actions">
                                    <button type="button" className="btn btn-secondary" onClick={closeEditor}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={!noteDraft.title || !noteDraft.bookId}>
                                        Save Note
                                    </button>
                                </div>
                            </aside>
                        </form>
                    </div>
                </div>
            )}

            {notes.length === 0 ? (
                <div className="empty-state">
                    <FileText size={48} />
                    <h3>No Notes Yet</h3>
                    <p>Capture your thoughts while reading. Click "New Note" to get started.</p>
                </div>
            ) : (
                <div className="data-grid">
                    {notes.map(record => (
                        <div
                            key={record.id}
                            className="card note-card"
                            onClick={() => openEditNoteEditor(record)}
                        >
                            <div>
                                <div className="card-top-row">
                                    <h3 className="card-title">{record.data.title}</h3>
                                    <button
                                        className="btn btn-secondary note-edit-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openEditNoteEditor(record);
                                        }}
                                        title="Edit Note"
                                    >
                                        <PenSquare size={16} />
                                    </button>
                                </div>
                                <div className="book-reference">
                                    <Book size={14} />
                                    <span>{getBookTitle(record.data.bookId)}</span>
                                </div>
                                <p className="note-content">{record.data.content}</p>
                            </div>
                            <div className="card-footer">
                                <span className="card-hint note-card-hint">
                                    Click to edit
                                </span>
                                <button
                                    className="btn btn-danger"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(record.id);
                                    }}
                                    title="Delete Note"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
