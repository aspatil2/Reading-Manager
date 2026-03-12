import { useState, useEffect } from 'react';
import { getRecordsByType, saveRecord, deleteRecord } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Share2, Plus, Trash2, Book } from 'lucide-react';

export default function MindMaps() {
    const [mindMaps, setMindMaps] = useState([]);
    const [books, setBooks] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newMindMap, setNewMindMap] = useState({ title: '', description: '', bookIds: [] });

    useEffect(() => {
        loadBooks();
        loadMindMaps();
        const interval = setInterval(loadMindMaps, 3000);
        return () => clearInterval(interval);
    }, []);

    const loadBooks = async () => {
        const data = await getRecordsByType('item'); // item = books
        setBooks(data);
    };

    const loadMindMaps = async () => {
        const data = await getRecordsByType('mindmap');
        setMindMaps(data);
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        if (!newMindMap.title) return;

        const record = {
            id: uuidv4(),
            type: 'mindmap',
            data: newMindMap,
            updatedAt: Date.now(),
            deleted: 0
        };
        await saveRecord(record);
        setIsAdding(false);
        setNewMindMap({ title: '', description: '', bookIds: [] });
        loadMindMaps();
    };

    const handleDelete = async (id) => {
        await deleteRecord(id);
        loadMindMaps();
    };

    const handleBookSelection = (bookId) => {
        setNewMindMap(prev => {
            const isSelected = prev.bookIds.includes(bookId);
            if (isSelected) {
                return { ...prev, bookIds: prev.bookIds.filter(id => id !== bookId) };
            } else {
                return { ...prev, bookIds: [...prev.bookIds, bookId] };
            }
        });
    };

    const getBookTitle = (bookId) => {
        const book = books.find(b => b.id === bookId);
        return book ? book.data.title : 'Unknown Book';
    };

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Mind Maps</h1>
                    <p className="page-subtitle">Visualize connections between books and ideas.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
                    <Plus size={18} /> Create Mind Map
                </button>
            </div>

            {isAdding && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 className="section-title">Create Mind Map</h2>
                        <form onSubmit={handleAddSubmit} className="form-stack">
                            <input
                                type="text"
                                placeholder="Mind Map Title *"
                                className="input-field"
                                value={newMindMap.title}
                                onChange={e => setNewMindMap({ ...newMindMap, title: e.target.value })}
                                required
                            />
                            <textarea
                                placeholder="Description / Central Idea"
                                className="input-field input-textarea input-textarea-sm"
                                value={newMindMap.description}
                                onChange={e => setNewMindMap({ ...newMindMap, description: e.target.value })}
                            ></textarea>

                            <div className="linked-books-block">
                                <label className="field-label">Link books to this mind map:</label>
                                <div className="linked-books-list">
                                    {books.map(b => (
                                        <label key={b.id} className="book-check">
                                            <input
                                                type="checkbox"
                                                checked={newMindMap.bookIds.includes(b.id)}
                                                onChange={() => handleBookSelection(b.id)}
                                            />
                                            <span>{b.data.title}</span>
                                        </label>
                                    ))}
                                    {books.length === 0 && <p className="muted-note">No books available. Add some reading materials first.</p>}
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setIsAdding(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={!newMindMap.title}>Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {mindMaps.length === 0 ? (
                <div className="empty-state">
                    <Share2 size={48} />
                    <h3>No Mind Maps Created</h3>
                    <p>Connect ideas visually. Click "Create Mind Map" to start mapping your thoughts.</p>
                </div>
            ) : (
                <div className="data-grid">
                    {mindMaps.map(record => (
                        <div key={record.id} className="card">
                            <div>
                                <div className="card-top-row">
                                    <h3 className="card-title">{record.data.title}</h3>
                                    <div className="mindmap-icon">
                                        <Share2 size={18} />
                                    </div>
                                </div>
                                <p className="note-content">{record.data.description || 'No description provided.'}</p>

                                {record.data.bookIds && record.data.bookIds.length > 0 && (
                                    <div className="linked-material">
                                        <span className="field-label">Linked Material</span>
                                        <div className="linked-chip-wrap">
                                            {record.data.bookIds.map(id => (
                                                <div key={id} className="linked-chip">
                                                    <Book size={12} />
                                                    <span>{getBookTitle(id)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="card-split">
                                <span className="small-muted">
                                    {new Date(record.updatedAt).toLocaleDateString()}
                                </span>
                                <button className="btn btn-danger" onClick={() => handleDelete(record.id)} title="Delete Mind Map">
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
