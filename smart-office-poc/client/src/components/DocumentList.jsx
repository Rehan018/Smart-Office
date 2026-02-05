import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

function DocumentList() {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            const res = await api.get('/documents');
            setDocuments(res.data);
        } catch (error) {
            console.error("Failed to load documents", error);
            alert("Error loading documents. Is backend running?");
        } finally {
            setLoading(false);
        }
    };

    const createDocument = async () => {
        const title = prompt("Enter document title:", "New Document");
        if (!title) return;

        try {
            const res = await api.post('/documents', {
                title,
                content: { ops: [{ insert: "\n" }] },
                is_template: false
            });
            navigate(`/doc/${res.data.id}`);
        } catch (error) {
            console.error("Failed to create", error);
        }
    };

    // Basic Template Creator for testing
    const createTemplate = async () => {
        const title = prompt("Enter template title:", "New Template");
        if (!title) return;
        try {
            const res = await api.post('/templates', {
                title,
                content: { ops: [{ insert: "Template Content Here\n" }] },
                is_template: true
            });
            // For now, redirect to same editor, backend handles it same way logic-wise? 
            // Actually implementation shows templates are docs with flag. 
            // reusing editor route for simplicity, typically would lock structure.
            alert("Template created! ID: " + res.data.id);
            fetchDocuments(); // Refresh list to see if we listed templates? No, list filters is_template=False
            // The UI doesn't have a template list view yet as per 'Basic UI' request, but I'll add logic if needed.
        } catch (e) {
            console.error(e);
        }
    }

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={createDocument}>+ New Document</button>
                <button onClick={createTemplate} style={{ backgroundColor: '#6c757d' }}>+ New Template</button>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>ID</th>
                        <th>Last Modified</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {documents.map(doc => (
                        <tr key={doc.id}>
                            <td>{doc.title}</td>
                            <td>{doc.id.substring(0, 8)}...</td>
                            <td>{new Date(doc.updated_at).toLocaleString()}</td>
                            <td>
                                <Link to={`/doc/${doc.id}`}>Open</Link>
                            </td>
                        </tr>
                    ))}
                    {documents.length === 0 && (
                        <tr><td colSpan="4">No documents found. Create one!</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default DocumentList;
