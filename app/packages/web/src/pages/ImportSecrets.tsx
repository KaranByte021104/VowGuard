import toast from 'react-hot-toast';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/session';
import { generateItemKey, encryptSecretPayload, encryptItemKeyWithPublicKey } from '@app/shared/src/crypto';
import { Upload, FileText, AlertCircle, ArrowLeft } from 'lucide-react';
import { apiFetch } from '../lib/apiFetch';

export function ImportSecrets() {
  const navigate = useNavigate();
  const { publicKey } = useSessionStore();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  const arrayBufferToBase64 = (buffer: ArrayBufferLike) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!publicKey) {
      setError("Vault is locked. Cannot encrypt imported secrets.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const text = await file.text();
      // Simple CSV parser (assumes Name,Url,Username,Password,Notes format, RFC-4180 simple)
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));
      // Remove header
      const headers = rows[0].map(h => h.toLowerCase());
      const dataRows = rows.slice(1).filter(r => r.length > 1);
      
      setTotal(dataRows.length);

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        
        const name = row[headers.indexOf('name')] || `Imported Secret ${i+1}`;
        const domain = row[headers.indexOf('url')] || '';
        const username = row[headers.indexOf('username')] || '';
        const password = row[headers.indexOf('password')] || '';
        const notes = row[headers.indexOf('notes')] || '';

        const itemKey = await generateItemKey();
        const payload = { username, password, notes };
        
        const { encryptedData, iv } = await encryptSecretPayload(payload, itemKey);
        const encryptedItemKey = await encryptItemKeyWithPublicKey(itemKey, publicKey);

        await apiFetch('http://localhost:3000/secrets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            templateType: 'WEBSITE', // default for bulk import
            name,
            domain,
            encryptedData: arrayBufferToBase64(encryptedData),
            iv: arrayBufferToBase64(iv.buffer),
            encryptedItemKey: arrayBufferToBase64(encryptedItemKey),
            isPersonal: false,
            accessControlEnabled: false
          })
        });

        setProgress(i + 1);
      }

      toast.success(`Successfully imported ${dataRows.length} secrets.`);
      navigate('/secrets');
    } catch (e) {
      console.error(e);
      setError('Failed to process CSV file. Please check format.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Secrets</h1>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
        <Upload className="w-12 h-12 text-primary mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Upload CSV File</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Your file is parsed and encrypted entirely in the browser. 
          The server never sees your plaintext passwords.
        </p>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 justify-center">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <div className="flex justify-center">
          <label className="cursor-pointer px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Select CSV File
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              onChange={handleFileUpload}
              disabled={loading}
            />
          </label>
        </div>

        {loading && (
          <div className="mt-8">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Encrypting and uploading...</span>
              <span>{progress} / {total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div 
                className="bg-primary h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${(progress / Math.max(total, 1)) * 100}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-100 dark:border-blue-800">
        <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">CSV Format Expected</h3>
        <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">The first row must be a header containing these exact columns (in any order):</p>
        <code className="text-xs bg-white dark:bg-gray-800 px-3 py-2 rounded shadow-sm text-gray-800 dark:text-gray-200 block">
          name, url, username, password, notes
        </code>
      </div>
    </div>
  );
}
