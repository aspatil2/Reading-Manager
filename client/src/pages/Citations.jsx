import { useState, useEffect } from 'react';
import { getRecordsByType, saveRecord, deleteRecord } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Bookmark, Plus, Trash2, Book } from 'lucide-react';

export default function Citations() {
    const [citations, setCitations] = useState([]);
    const [books, setBooks] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newCitation, setNewCitation] = useState({ text: '', pageNumber: '', bookId: '' });
    const [filterBookId, setFilterBookId] = useState('');

    useEffect(() => {
        loadBooks();
        loadCitations();
        const interval = setInterval(loadCitations, 3000);
        return () => clearInterval(interval);
    }, [filterBookId]);

    const loadBooks = async () => {
        const data = await getRecordsByType('item'); // item = books
        setBooks(data);
    };

    const loadCitations = async () => {
        const data = await getRecordsByType('citation', filterBookId || null);
        setCitations(data);
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        if (!newCitation.text || !newCitation.bookId) return;

        const record = {
            id: uuidv4(),
            type: 'citation',
            data: newCitation,
            updatedAt: Date.now(),
            deleted: 0
        };
        await saveRecord(record);
        setIsAdding(false);
        setNewCitation({ text: '', pageNumber: '', bookId: '' });
        loadCitations();
    };

    const handleDelete = async (id) => {
        await deleteRecord(id);
        loadCitations();
    };

    const getBookTitle = (bookId) => {
        const book = books.find(b => b.id === bookId);
        return book ? book.data.title : 'Unknown Book';
    };

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Citations</h1>
                    <p className="page-subtitle">Save and organize important quotes and references.</p>
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
                    <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
                        <Plus size={18} /> New Citation
                    </button>
                </div>
            </div>

            {isAdding && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 className="section-title">Add New Citation</h2>
                        <form onSubmit={handleAddSubmit} className="form-stack">
                            <select
                                className="input-field"
                                value={newCitation.bookId}
                                onChange={e => setNewCitation({ ...newCitation, bookId: e.target.value })}
                                required
                            >
                                <option value="" disabled>Select Associated Book *</option>
                                {books.map(b => (
                                    <option key={b.id} value={b.id}>{b.data.title}</option>
                                ))}
                            </select>
                            <input
                                type="text"
                                placeholder="Page Number / Location"
                                className="input-field"
                                value={newCitation.pageNumber}
                                onChange={e => setNewCitation({ ...newCitation, pageNumber: e.target.value })}
                            />
                            <textarea
                                placeholder="Citation Text *"
                                className="input-field input-textarea"
                                value={newCitation.text}
                                onChange={e => setNewCitation({ ...newCitation, text: e.target.value })}
                                required
                            ></textarea>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setIsAdding(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={!newCitation.bookId || !newCitation.text}>Save Citation</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {citations.length === 0 ? (
                <div className="empty-state">
                    <Bookmark size={48} />
                    <h3>No Citations Saved</h3>
                    <p>Keep track of valuable information for future reference.</p>
                </div>
            ) : (
                <div className="data-grid">
                    {citations.map(record => (
                        <div key={record.id} className="card citation-card">
                            <div>
                                <div className="citation-text-wrap">
                                    <p className="citation-text">{record.data.text}</p>
                                </div>
                                <div className="card-split">
                                    <div className="book-reference">
                                        <Book size={14} />
                                        <span>{getBookTitle(record.data.bookId)}</span>
                                    </div>
                                    <span className="citation-page">
                                        pg {record.data.pageNumber || '?'}
                                    </span>
                                </div>
                            </div>
                            <div className="card-footer">
                                <button className="btn btn-danger" onClick={() => handleDelete(record.id)} title="Delete Citation">
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
