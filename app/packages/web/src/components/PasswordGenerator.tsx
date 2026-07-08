import { useState, useEffect } from 'react';
import { RefreshCw, Copy, Check } from 'lucide-react';

interface PasswordGeneratorProps {
  onSelect: (password: string) => void;
  initialLength?: number;
}

export function PasswordGenerator({ onSelect, initialLength = 16 }: PasswordGeneratorProps) {
  const [length, setLength] = useState(initialLength);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = () => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+~`|}{[]:;?><,./-=';

    let chars = '';
    if (useUpper) chars += upper;
    if (useLower) chars += lower;
    if (useNumbers) chars += numbers;
    if (useSymbols) chars += symbols;

    if (chars === '') {
      chars = lower;
      setUseLower(true);
    }

    let generated = '';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);

    for (let i = 0; i < length; i++) {
      generated += chars[array[i] % chars.length];
    }

    setPassword(generated);
    onSelect(generated);
  };

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, useUpper, useLower, useNumbers, useSymbols]);

  const handleCopy = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 mb-4">
        <span className="font-mono text-lg tracking-wider text-gray-900 dark:text-gray-100">{password}</span>
        <div className="flex gap-2">
          <button type="button" onClick={generate} className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button type="button" onClick={handleCopy} className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>Length</span>
            <span>{length}</span>
          </label>
          <input
            type="range"
            min="8"
            max="64"
            value={length}
            onChange={(e) => setLength(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-300">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useUpper} onChange={(e) => setUseUpper(e.target.checked)} className="rounded text-primary focus:ring-primary" />
            Uppercase (A-Z)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useLower} onChange={(e) => setUseLower(e.target.checked)} className="rounded text-primary focus:ring-primary" />
            Lowercase (a-z)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useNumbers} onChange={(e) => setUseNumbers(e.target.checked)} className="rounded text-primary focus:ring-primary" />
            Numbers (0-9)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useSymbols} onChange={(e) => setUseSymbols(e.target.checked)} className="rounded text-primary focus:ring-primary" />
            Symbols (!@#)
          </label>
        </div>
      </div>
    </div>
  );
}
