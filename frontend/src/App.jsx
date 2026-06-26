import { useState } from 'react';
import axios from 'axios';

function App() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post('http://localhost:3000/api/log-work', {
        userInput: input
      });
      setResult(response.data);
      setInput(''); 
    } catch (err) {
      setError(err.response?.data?.details || err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">AI Tempo Worklog Assistant</h1>
        
        <form onSubmit={handleSubmit} className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What did you work on today?
          </label>
          <textarea
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            rows="3"
            placeholder="e.g., Worked 2 hours on PROD-5746 from 10am fixing dropdown duplicate issue."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Processing & Logging...' : 'Generate & Log Worklog'}
          </button>
        </form>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
            <strong>Error:</strong> {JSON.stringify(error)}
          </div>
        )}

        {result && (
          <div className="p-5 bg-green-50 rounded-lg border border-green-200">
            <h3 className="text-green-800 font-bold mb-3 flex items-center">
              <span className="text-xl mr-2">✅</span> Worklog Logged Successfully
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p><strong>Issue:</strong> {result.issueKey}</p>
              <p><strong>Duration:</strong> {result.duration}</p>
              <p><strong>Start Time:</strong> {result.startTime}</p>
              <p><strong>Tempo ID:</strong> {result.tempoWorklogId}</p>
              <div className="mt-4 pt-4 border-t border-green-200">
                <strong>Generated Description:</strong>
                <p className="mt-1 italic">{result.description}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;