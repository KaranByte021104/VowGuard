import { useState, useEffect } from 'react';
import { Cloud, CheckCircle, Clock, Download } from 'lucide-react';
import { Modal } from '../components/Modal';


interface BackupConfig {
  id: string;
  provider: string;
  frequency: 'DAILY' | 'WEEKLY';
  ownedOnly: boolean;
  nextScheduledRun: string | null;
}

interface BackupFile {
  id: string;
  name: string;
  createdTime: string;
  size: string;
}

export function CloudBackup() {
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [files, setFiles] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY'>('WEEKLY');
  const [ownedOnly, setOwnedOnly] = useState(true);

  // Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    mode: 'alert' | 'confirm';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    mode: 'alert'
  });

  const showAlert = (title: string, message: string) => {
    setModalState({ isOpen: true, title, message, mode: 'alert' });
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (config) {
      setFrequency(config.frequency);
      setOwnedOnly(config.ownedOnly);
      fetchFiles();
    }
  }, [config]);

  const fetchConfig = async () => {
    try {
      const res = await fetch('http://localhost:3000/backup/config', { credentials: 'include' });
      if (res.ok) {
        setConfig(await res.json());
      } else {
        setConfig(null);
      }
    } catch (e) {
      setConfig(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async () => {
    try {
      const res = await fetch('http://localhost:3000/backup/files', { credentials: 'include' });
      if (res.ok) {
        setFiles(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleConnect = async () => {
    try {
      const res = await fetch('http://localhost:3000/backup/connect/google', { credentials: 'include' });
      const data = await res.json();
      window.location.href = data.url;
    } catch (e) {
      showAlert('Connection Error', 'Failed to initiate connection');
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('http://localhost:3000/backup/disconnect', { method: 'POST', credentials: 'include' });
      setConfig(null);
      setFiles([]);
      showAlert('Disconnected', 'Your Google Drive account has been disconnected.');
    } catch (e) {
      showAlert('Error', 'Failed to disconnect');
    }
  };

  const handleSaveConfig = async () => {
    try {
      const res = await fetch('http://localhost:3000/backup/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ frequency, ownedOnly })
      });
      setConfig(await res.json());
      showAlert('Success', 'Backup settings have been saved.');
    } catch (e) {
      showAlert('Error', 'Failed to save settings');
    }
  };

  const handleRestore = (fileId: string) => {
    setModalState({
      isOpen: true,
      title: 'Confirm Restore',
      message: 'Are you sure you want to restore from this backup? This will attempt to re-create the secrets.',
      mode: 'confirm',
      onConfirm: async () => {
        try {
          const res = await fetch(`http://localhost:3000/backup/files/${fileId}/download`, {
            credentials: 'include'
          });
          
          if (!res.ok) throw new Error('Failed to download backup');
          
          const data = await res.json();
          
          if (!Array.isArray(data)) {
            showAlert('Error', 'Invalid backup file format');
            return;
          }
          
          let successCount = 0;
          for (const item of data) {
            try {
              const postRes = await fetch('http://localhost:3000/secrets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(item) // Note: In a full real flow, we might need to re-encrypt with a new itemKey or re-use it. Since backup has encryptedData, we can just push it back.
              });
              if (postRes.ok) successCount++;
            } catch (e) {
              console.error('Failed to restore item', e);
            }
          }
          
          showAlert('Restore Successful', `Successfully restored ${successCount} out of ${data.length} items from backup.`);
        } catch (e) {
          showAlert('Error', 'Failed to download backup');
          console.error(e);
        }
      }
    });
  };

  // If redirecting back with code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      fetch('http://localhost:3000/backup/callback/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code })
      }).then(() => {
        window.history.replaceState({}, '', '/backup');
        fetchConfig();
        showAlert('Success', 'Successfully connected to Google Drive!');
      }).catch((e) => {
        showAlert('Connection Failed', 'Failed to complete connection. Check console.');
        console.error(e);
      });
    }
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Cloud className="w-6 h-6 text-blue-500" />
          Cloud Backup
        </h1>
      </div>

      {!config ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <Cloud className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Connect Cloud Storage</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Connect your Google Drive to automatically back up your vault. 
            All data is encrypted end-to-end and Google cannot read your secrets.
          </p>
          <button
            onClick={handleConnect}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Connect Google Drive
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Connected to {config.provider}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Automated backups are active</p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Disconnect
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Backup Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Owned Only</span>
                  <span className="text-xs text-gray-500">Exclude secrets shared with you</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ownedOnly}
                    onChange={(e) => setOwnedOnly(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/80 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                </label>
              </div>
              <button
                onClick={handleSaveConfig}
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
              >
                Save Settings
              </button>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>Next Run: {config.nextScheduledRun ? new Date(config.nextScheduledRun).toLocaleString() : 'Pending'}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Restore from Backup</h3>
            {files.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No backups found in connected storage.</p>
            ) : (
              <div className="space-y-3">
                {files.map(file => (
                  <div key={file.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div>
                      <div className="font-medium text-sm text-gray-900 dark:text-white">{file.name}</div>
                      <div className="text-xs text-gray-500">{new Date(file.createdTime).toLocaleString()} &bull; {(parseInt(file.size)/1024).toFixed(1)} KB</div>
                    </div>
                    <button
                      onClick={() => handleRestore(file.id)}
                      className="p-2 text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Restore"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reusable Modal for Alerts and Confirms */}
      <Modal
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        message={modalState.message}
      >
        <div className="flex justify-end gap-3 mt-6">
          {modalState.mode === 'confirm' && (
            <button
              onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => {
              if (modalState.mode === 'confirm' && modalState.onConfirm) {
                modalState.onConfirm();
              }
              setModalState(prev => ({ ...prev, isOpen: false }));
            }}
            className="px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            OK
          </button>
        </div>
      </Modal>
    </div>
  );
}
