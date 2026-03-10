import { useState } from 'react';
import { apiPost } from '../lib/api';

export default function ImportPage() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  async function upload() {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    setIsUploading(true);
    setMessage('');
    try {
      const data = await apiPost('/api/smes/import', form, true);
      setMessage(`Import complete. Imported ${data.imported}, skipped ${data.skipped}, total ${data.total}.`);
    } catch (e) {
      setMessage('Import failed. Admin role required and valid CSV needed.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-4xl font-semibold tracking-tight">Bulk Import SMEs</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-600">
          This importer supports your NIS SME sheet format, including columns like Name, Skillset, Certifications,
          Contract title and position, Clearance level, OK to contact directly, and Preferred Method.
        </p>
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button
            className="ml-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            onClick={upload}
            disabled={!file || isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload CSV'}
          </button>
        </div>
        {message && <p className="mt-4 text-sm">{message}</p>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 text-lg font-semibold">Expected Data Notes</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Skillsets and certifications can be separated by semicolons.</li>
          <li>Intro/help rows such as Example rows are skipped automatically.</li>
          <li>Unknown or missing optional fields are imported with safe defaults.</li>
        </ul>
      </div>
    </div>
  );
}
