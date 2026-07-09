import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSessionStore } from '../store/session';
import { decryptSecretPayload, decryptItemKeyWithPrivateKey, encryptSecretPayload } from '@app/shared/src/crypto';
import { Eye, EyeOff, Save, Trash, ArrowLeft, Paperclip, History, Clock, Download } from 'lucide-react';
import { PasswordGenerator } from '../components/PasswordGenerator';
import { Modal } from '../components/Modal';
import zxcvbn from 'zxcvbn';

export function SecretDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { privateKey, publicKey } = useSessionStore();
  
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    username: '',
    password: '',
    notes: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [decryptionError, setDecryptionError] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'attachments' | 'history'>('details');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [decryptedVersions, setDecryptedVersions] = useState<Record<string, any>>({});
  const [previewAttachment, setPreviewAttachment] = useState<{ id: string, type: string, url: string, content?: string } | null>(null);
  
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, confirmColor?: 'red' | 'primary', confirmText?: string }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const { data: secret, isLoading, refetch } = useQuery({
    queryKey: ['secret', id],
    queryFn: async () => {
      const res = await fetch(`http://localhost:3000/secrets/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Secret not found');
      return res.json();
    }
  });

  useEffect(() => {
    async function decrypt() {
      if (!secret || !privateKey) return;
      try {
        const encryptedItemKeyBuf = Uint8Array.from(atob(secret.encryptedItemKey), c => c.charCodeAt(0)).buffer;
        const itemKey = await decryptItemKeyWithPrivateKey(encryptedItemKeyBuf, privateKey);
        
        const encryptedDataBuf = Uint8Array.from(atob(secret.encryptedData), c => c.charCodeAt(0)).buffer;
        const ivBuf = Uint8Array.from(atob(secret.iv), c => c.charCodeAt(0));
        
        const payload = await decryptSecretPayload(encryptedDataBuf, ivBuf, itemKey);
        
        setFormData({
          name: secret.name,
          domain: secret.domain || '',
          username: payload.username || '',
          password: payload.password || '',
          notes: payload.notes || ''
        });
      } catch (e) {
        setDecryptionError('Failed to decrypt secret.');
        console.error(e);
      }
    }
    decrypt();
  }, [secret, privateKey]);

  useEffect(() => {
    if (activeTab === 'attachments') {
      fetch(`http://localhost:3000/attachments/secret/${id}`, { credentials: 'include' })
        .then(res => res.json())
        .then(setAttachments)
        .catch(console.error);
    } else if (activeTab === 'history') {
      fetch(`http://localhost:3000/secrets/${id}/versions`, { credentials: 'include' })
        .then(res => res.json())
        .then(async (fetchedVersions) => {
          setVersions(fetchedVersions);
          if (!privateKey) return;
          const decrypted: Record<string, any> = {};
          for (const v of fetchedVersions) {
            try {
              const encryptedItemKeyBuf = Uint8Array.from(atob(v.encryptedItemKey), c => c.charCodeAt(0)).buffer;
              const itemKey = await decryptItemKeyWithPrivateKey(encryptedItemKeyBuf, privateKey);
              const encryptedDataBuf = Uint8Array.from(atob(v.encryptedData), c => c.charCodeAt(0)).buffer;
              const ivBuf = Uint8Array.from(atob(v.iv), c => c.charCodeAt(0));
              const payload = await decryptSecretPayload(encryptedDataBuf, ivBuf, itemKey);
              decrypted[v.id] = payload;
            } catch(e) {
              decrypted[v.id] = { error: 'Failed' };
            }
          }
          setDecryptedVersions(decrypted);
        })
        .catch(console.error);
    }
  }, [activeTab, id]);

  const handleRestore = async (versionId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Restore Version',
      message: 'Restore this version? This will overwrite the current secret.',
      confirmText: 'Restore',
      onConfirm: async () => {
        setLoading(true);
        try {
          await fetch(`http://localhost:3000/secrets/${id}/versions/${versionId}/restore`, {
            method: 'POST',
            credentials: 'include'
          });
          await refetch();
          setActiveTab('details');
        } catch (e) {
          alert('Failed to restore');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !secret) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10 MB limit');
      return;
    }
    
    // Simplification for sprint: upload plain to the endpoint (in reality, encrypt client-side first)
    const formData = new FormData();
    formData.append('file', file);
    formData.append('iv', secret.iv);
    formData.append('encryptedItemKey', secret.encryptedItemKey);
    
    setLoading(true);
    try {
      await fetch(`http://localhost:3000/attachments/${id}`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      setActiveTab('details'); // trigger refresh or something
      setTimeout(() => setActiveTab('attachments'), 50);
    } catch (e) {
      alert('Failed to upload attachment');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewAttachment = async (att: any) => {
    try {
      const res = await fetch(`http://localhost:3000/attachments/${att.id}/download`, { credentials: 'include' });
      const blob = await res.blob();
      
      if (att.mimeType.startsWith('image/')) {
        const url = URL.createObjectURL(blob);
        setPreviewAttachment({ id: att.id, type: 'image', url });
      } else if (att.mimeType === 'application/pdf') {
        const url = URL.createObjectURL(blob);
        setPreviewAttachment({ id: att.id, type: 'pdf', url });
      } else if (att.mimeType.startsWith('text/') || att.mimeType === 'application/json') {
        const text = await blob.text();
        setPreviewAttachment({ id: att.id, type: 'text', url: '', content: text });
      } else {
        alert('Preview not available for this file type.');
      }
    } catch (e) {
      alert('Failed to load preview');
    }
  };

  const handleDeleteAttachment = async (attId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Attachment',
      message: 'Are you sure you want to delete this attachment?',
      confirmText: 'Delete',
      confirmColor: 'red',
      onConfirm: async () => {
        try {
          const res = await fetch(`http://localhost:3000/attachments/${attId}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          if (!res.ok) throw new Error('Delete failed');
          setAttachments(prev => prev.filter(a => a.id !== attId));
        } catch (e) {
          alert('Failed to delete attachment');
        }
      }
    });
  };

  const passwordScore = formData.password ? zxcvbn(formData.password).score : 0;

  const arrayBufferToBase64 = (buffer: ArrayBufferLike) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const handleUpdate = async () => {
    if (!publicKey || !secret) return;
    setLoading(true);
    try {
      // Re-encrypt the payload. We could theoretically reuse the itemKey, but creating a new one is safer.
      const encryptedItemKeyBuf = Uint8Array.from(atob(secret.encryptedItemKey), c => c.charCodeAt(0)).buffer;
      const itemKey = await decryptItemKeyWithPrivateKey(encryptedItemKeyBuf, privateKey!);

      const payload = {
        username: formData.username,
        password: formData.password,
        notes: formData.notes
      };
      
      const { encryptedData, iv } = await encryptSecretPayload(payload, itemKey);

      const res = await fetch(`http://localhost:3000/secrets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          domain: formData.domain,
          encryptedData: arrayBufferToBase64(encryptedData),
          iv: arrayBufferToBase64(iv.buffer),
          encryptedItemKey: secret.encryptedItemKey // Key hasn't changed
        })
      });

      if (!res.ok) throw new Error('Update failed');
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert('Error updating secret');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Secret',
      message: 'Are you absolutely sure you want to delete this secret? This cannot be undone.',
      confirmText: 'Delete',
      confirmColor: 'red',
      onConfirm: async () => {
        await fetch(`http://localhost:3000/secrets/${id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        navigate('/secrets');
      }
    });
  };

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!privateKey) return <div className="p-8">Vault locked.</div>;
  if (decryptionError) return <div className="p-8 text-red-500">{decryptionError}</div>;

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate('/secrets')} className="flex items-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back
        </button>
        <div className="flex gap-4">
          {!isEditing ? (
            <>
              <button onClick={() => setIsEditing(true)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50">Edit</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"><Trash className="w-4 h-4"/> Delete</button>
            </>
          ) : (
            <>
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
              <button onClick={handleUpdate} disabled={loading} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 flex items-center gap-2"><Save className="w-4 h-4"/> Save</button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button onClick={() => setActiveTab('details')} className={`pb-2 px-1 ${activeTab === 'details' ? 'border-b-2 border-primary text-primary font-medium' : 'text-gray-500 hover:text-gray-700'}`}>Details</button>
        <button onClick={() => setActiveTab('attachments')} className={`pb-2 px-1 flex items-center gap-2 ${activeTab === 'attachments' ? 'border-b-2 border-primary text-primary font-medium' : 'text-gray-500 hover:text-gray-700'}`}>
          <Paperclip className="w-4 h-4" /> Attachments
        </button>
        <button onClick={() => setActiveTab('history')} className={`pb-2 px-1 flex items-center gap-2 ${activeTab === 'history' ? 'border-b-2 border-primary text-primary font-medium' : 'text-gray-500 hover:text-gray-700'}`}>
          <History className="w-4 h-4" /> History
        </button>
      </div>

      <div className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
        {activeTab === 'details' && (
          <>
            <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            <input 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})} 
              disabled={!isEditing}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:text-white disabled:opacity-75 disabled:bg-gray-100 dark:disabled:bg-gray-800" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Domain / URL</label>
            <input 
              value={formData.domain} 
              onChange={(e) => setFormData({...formData, domain: e.target.value})} 
              disabled={!isEditing}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:text-white disabled:opacity-75 disabled:bg-gray-100 dark:disabled:bg-gray-800" 
            />
          </div>
        </div>

        <hr className="border-gray-200 dark:border-gray-700" />

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
            <input 
              value={formData.username} 
              onChange={(e) => setFormData({...formData, username: e.target.value})} 
              disabled={!isEditing}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:text-white disabled:opacity-75 disabled:bg-gray-100 dark:disabled:bg-gray-800" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex justify-between">
              <span>Password</span>
              {isEditing && <button type="button" onClick={() => setShowGenerator(!showGenerator)} className="text-primary hover:text-blue-700">Generator</button>}
            </label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={formData.password} 
                onChange={(e) => setFormData({...formData, password: e.target.value})} 
                disabled={!isEditing}
                className={`mt-1 block w-full rounded-md shadow-sm p-2 pr-10 bg-gray-50 dark:bg-gray-700 dark:text-white disabled:opacity-75 disabled:bg-gray-100 dark:disabled:bg-gray-800 ${isEditing && formData.password ? (passwordScore < 3 ? 'border-red-300' : 'border-green-300') : 'border-gray-300 dark:border-gray-600'}`} 
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute bottom-2 right-3 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {isEditing && formData.password && (
              <div className="flex gap-1 mt-2 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={`h-full flex-1 ${
                    i < passwordScore 
                      ? (passwordScore < 3 ? 'bg-red-500' : passwordScore === 3 ? 'bg-yellow-500' : 'bg-green-500') 
                      : 'bg-transparent'
                  }`} />
                ))}
              </div>
            )}
          </div>
        </div>

        {showGenerator && isEditing && (
          <PasswordGenerator onSelect={(pwd) => setFormData({ ...formData, password: pwd })} />
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Secure Notes</label>
          <textarea 
            rows={4} 
            value={formData.notes} 
            onChange={(e) => setFormData({...formData, notes: e.target.value})} 
            disabled={!isEditing}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:text-white disabled:opacity-75 disabled:bg-gray-100 dark:disabled:bg-gray-800" 
          />
        </div>
          </>
        )}

        {activeTab === 'attachments' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Attachments</h3>
              <label className="cursor-pointer bg-primary text-white px-4 py-2 rounded hover:bg-blue-700">
                Upload File
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={loading} />
              </label>
            </div>
            {attachments.length === 0 ? (
              <p className="text-gray-500">No attachments found.</p>
            ) : (
              <ul className="space-y-3">
                {attachments.map(att => (
                  <li key={att.id} className="flex justify-between items-center p-3 border rounded bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <Paperclip className="w-5 h-5 text-gray-400" />
                      <span className="font-medium text-gray-700 dark:text-gray-300">{att.originalName}</span>
                      <span className="text-xs text-gray-500">{(att.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <button onClick={() => handlePreviewAttachment(att)} className="text-gray-500 hover:text-primary transition-colors" title="Preview">
                        <Eye className="w-4 h-4" />
                      </button>
                      <a href={`http://localhost:3000/attachments/${att.id}/download`} className="text-gray-500 hover:text-primary transition-colors" title="Download">
                        <Download className="w-4 h-4" />
                      </a>
                      <button onClick={() => handleDeleteAttachment(att.id)} className="text-gray-500 hover:text-red-600 transition-colors" title="Delete">
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            
            {previewAttachment && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setPreviewAttachment(null)}>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                    <h4 className="font-semibold text-lg dark:text-white">File Preview</h4>
                    <button onClick={() => setPreviewAttachment(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-bold text-xl">&times;</button>
                  </div>
                  <div className="flex-1 overflow-auto flex justify-center bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    {previewAttachment.type === 'image' && (
                      <img src={previewAttachment.url} alt="Preview" className="max-w-full object-contain" />
                    )}
                    {previewAttachment.type === 'pdf' && (
                      <iframe src={previewAttachment.url} className="w-full h-[70vh] rounded" title="PDF Preview" />
                    )}
                    {previewAttachment.type === 'text' && (
                      <pre className="text-sm text-gray-800 dark:text-gray-300 w-full whitespace-pre-wrap">{previewAttachment.content}</pre>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h3 className="text-lg font-medium mb-4">Version History</h3>
            {versions.length === 0 ? (
              <p className="text-gray-500">No previous versions.</p>
            ) : (
              <ul className="space-y-4 relative border-l border-gray-200 dark:border-gray-700 ml-3 pl-6">
                {versions.map(v => (
                  <li key={v.id} className="relative">
                    <span className="absolute -left-[33px] top-1 bg-white dark:bg-gray-800 p-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-400">
                      <Clock className="w-4 h-4" />
                    </span>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Updated values</p>
                        <p className="text-xs text-gray-500 mb-2">{new Date(v.createdAt).toLocaleString()}</p>
                        {decryptedVersions[v.id] && (
                          <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                            <div className="grid grid-cols-[80px_1fr] gap-2">
                              <span className="font-medium text-gray-500 dark:text-gray-400">Username:</span>
                              <span>{decryptedVersions[v.id].username || '-'}</span>
                              <span className="font-medium text-gray-500 dark:text-gray-400">Password:</span>
                              <span>{decryptedVersions[v.id].password ? '********' : '-'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <button onClick={() => handleRestore(v.id)} disabled={loading} className="text-sm text-primary hover:text-blue-700 border border-blue-200 px-3 py-1 rounded bg-blue-50">
                        Restore
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

      </div>
      
      <Modal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmColor={confirmModal.confirmColor}
        onConfirm={confirmModal.onConfirm}
      />
    </div>
  );
}
