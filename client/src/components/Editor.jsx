import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import api from '../api';


// Toolbar configuration
const modules = {
    toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'align': [] }],
        ['clean']
    ],
};

function Editor() {
    const { id } = useParams();
    const [content, setContent] = useState(''); // Quill works with HTML or Delta, here simpler with value/onChange
    const [title, setTitle] = useState('');
    const [status, setStatus] = useState('Loading...');
    const [version, setVersion] = useState(1);
    const [lockedBy, setLockedBy] = useState(null);
    const [presenceUsers, setPresenceUsers] = useState([]);
    const [uploadStatus, setUploadStatus] = useState('');
    const [uploads, setUploads] = useState([]);
    const [userName, setUserName] = useState(() => {
        const existing = localStorage.getItem('smart_office_user');
        if (existing) return existing;
        const generated = `user-${Math.floor(Math.random() * 10000)}`;
        localStorage.setItem('smart_office_user', generated);
        return generated;
    });

    
    const socketRef = useRef(null);

    useEffect(() => {
        loadDocument();
        return () => {
            // Cleanup WS - use close() for native WebSocket
            if (socketRef.current) socketRef.current.close();
            unlockDocument();
        };
    }, [id]);

    // setupWebSocket removed - using native WebSocket in useEffect below

    useEffect(() => {
        // Native WebSocket Implementation
        if (!userName) return;
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Use current host (handles port 5173, 5174 etc) and proxy via Vite
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/documents/${id}?user=${encodeURIComponent(userName)}`);

        ws.onopen = () => {
            console.log("WS Connected");
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("WS Message:", data);
            if (data.type === 'presence' || data.type === 'user_joined' || data.type === 'user_left') {
                setPresenceUsers(Array.isArray(data.users) ? data.users : []);
            }
        };

        socketRef.current = ws;

        return () => {
            ws.close();
        }
    }, [id, userName]);

    const loadDocument = async () => {
        try {
            const res = await api.get(`/documents/${id}`);
            setTitle(res.data.title);
            // Quill needs HTML or Delta. 
            // Backend stores Delta JSON. ReactQuill `value` prop takes HTML string OR Delta object if using uncontrolled?
            // Actually ReactQuill `value` usually expects HTML string. 
            // If we pass Delta object, we might need a converter or use `defaultValue` with Delta.
            // For POC simplicity, let's treat content as ... wait, backend logic assumes JSON.
            // If I send HTML string back to backend, backend validation might look for 'ops'.
            // My backend `DocumentBase` schema allows `Any` for content.
            // My backend creation `{"ops": ...}` was manual.
            // If I use ReactQuill, typically it outputs HTML.
            // Let's stick to HTML for the "Basic UI" request to avoid complex Delta parsing in frontend POC.
            // I will override the backend initial content with whatever Quill gives me.

            // If backend has ops structure, we need to convert? 
            // ReactQuill handles `value` as Delta if passed object? No, usually not stable.
            // Let's try passing the content directly. If it's the initial "ops" object, check if Quill accepts it.
            // Usually better to use raw HTML for simple POC.
            // I'll assume for now I can save whatever.

            console.log("Loaded content from API:", res.data.content);
            setContent(res.data.content);
            setVersion(res.data.version);
            setLockedBy(res.data.locked_by || null);
            setStatus('Ready');

            // Try to acquire lock
            lockDocument();

        } catch (error) {
            console.error(error);
            setStatus('Error loading');
        }
    };

    const lockDocument = async () => {
        try {
            // Just a random user ID for POC
            const res = await api.post(`/documents/${id}/lock`, null, { params: { user: userName } });
            if (res?.data?.locked_by) {
                setLockedBy(res.data.locked_by);
            }
        } catch (e) {
            console.error("Could not acquire lock", e);
            if (e.response && e.response.status === 423) {
                try {
                    const res = await api.get(`/documents/${id}`);
                    setLockedBy(res.data.locked_by || null);
                    setStatus(`Locked by ${res.data.locked_by || 'another user'}`);
                } catch (err) {
                    console.error("Failed to refresh lock state", err);
                }
            }
        }
    };

    const unlockDocument = async () => {
        try {
            const url = `/api/documents/${id}/unlock?user=${encodeURIComponent(userName)}`;
            navigator.sendBeacon(url); // Beacon for reliability on close
        } catch (e) { }
    };

    const saveDocument = async () => {
        setStatus('Saving...');
        try {
            // We send `content` which is managed by Quill.
            const res = await api.put(`/documents/${id}`, {
                title,
                content: content,
                base_version: version
            });
            setVersion(res.data.version);
            setStatus('Saved!');
            setTimeout(() => setStatus('Ready'), 2000);
        } catch (error) {
            console.error(error);
            if (error.response && error.response.status === 409) {
                setStatus('Conflict! Refresh page.');
                alert("Conflict detected. Someone else edited this.");
            } else {
                setStatus('Error saving');
            }
        }
    };

    const handleFileChange = async (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        setUploadStatus('Uploading...');

        try {
            const res = await api.post(`/documents/${id}/assets`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const url = res.data?.url || '';
            setUploads(prev => [
                ...prev,
                {
                    filename: res.data?.filename || file.name,
                    url,
                    isImage: file.type.startsWith('image/')
                }
            ]);
            setUploadStatus('Uploaded');
        } catch (e) {
            console.error("Upload failed", e);
            setUploadStatus('Upload failed');
        } finally {
            event.target.value = '';
            setTimeout(() => setUploadStatus(''), 2000);
        }
    };

    return (
        <div className="editor-container">
            <div className="status-bar">
                <span>Status: <strong>{status}</strong></span>
                {lockedBy && <span style={{ color: 'red' }}>Locked by {lockedBy}</span>}
                <span style={{ marginLeft: '10px' }}>
                    Active: {presenceUsers.length}
                </span>
                {presenceUsers.length > 0 && (
                    <span style={{ marginLeft: '10px' }}>
                        Users: {presenceUsers.join(', ')}
                    </span>
                )}
                <span style={{ marginLeft: '10px' }}>
                    User:
                    <input
                        value={userName}
                        onChange={(e) => {
                            setUserName(e.target.value);
                            localStorage.setItem('smart_office_user', e.target.value);
                        }}
                        style={{ marginLeft: '6px', padding: '2px 6px', width: '140px' }}
                    />
                </span>
            </div>

            <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    style={{ fontSize: '20px', padding: '5px', width: '300px' }}
                />
                <button onClick={saveDocument}>Save Document</button>
            </div>

            <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label htmlFor="file-upload">Upload attachment:</label>
                <input id="file-upload" type="file" onChange={handleFileChange} />
                {uploadStatus && <span>{uploadStatus}</span>}
            </div>

            {uploads.length > 0 && (
                <div style={{ marginBottom: '10px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {uploads.map((file, index) => (
                        <div key={`${file.filename}-${index}`} style={{ border: '1px solid #ddd', padding: '6px' }}>
                            {file.isImage ? (
                                <img src={file.url} alt={file.filename} style={{ maxWidth: '160px', maxHeight: '160px' }} />
                            ) : (
                                <a href={file.url} target="_blank" rel="noreferrer">{file.filename}</a>
                            )}
                            {file.isImage && (
                                <div style={{ fontSize: '12px', marginTop: '4px' }}>{file.filename}</div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <ReactQuill
                theme="snow"
                value={content}
                onChange={setContent}
                modules={modules}
            />
        </div>
    );
}

export default Editor;
