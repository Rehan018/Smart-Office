import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import DocumentList from './components/DocumentList';
import Editor from './components/Editor';

function App() {
  return (
    <BrowserRouter>
      <div className="container">
        <header>
          <h1>Smart Office (Offline)</h1>
          <nav>
            <Link to="/"><button>Home / Documents</button></Link>
          </nav>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<DocumentList />} />
            <Route path="/doc/:id" element={<Editor />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
