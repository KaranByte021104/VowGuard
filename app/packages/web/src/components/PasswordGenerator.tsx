import { useState, useEffect } from 'react';
import { RefreshCw, Copy, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';

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
    <div className="bg-card border border-border rounded-lg p-5 mb-4 shadow-sm">
      <div className="flex items-center justify-between bg-muted/30 p-3 rounded-md border border-border mb-6">
        <span className="font-mono text-lg tracking-wider text-foreground">{password}</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={generate} title="Regenerate">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleCopy} title="Copy">
            {copied ? <Check className="w-4 h-4 text-status-success" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="flex justify-between text-sm font-medium text-foreground mb-3">
            <span>Length</span>
            <span className="text-muted-foreground">{length}</span>
          </label>
          <input
            type="range"
            min="8"
            max="64"
            value={length}
            onChange={(e) => setLength(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm text-foreground">
          <div className="flex items-center space-x-2">
            <Checkbox id="useUpper" checked={useUpper} onCheckedChange={(c) => setUseUpper(!!c)} />
            <label htmlFor="useUpper" className="text-sm font-medium leading-none cursor-pointer">
              Uppercase (A-Z)
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="useLower" checked={useLower} onCheckedChange={(c) => setUseLower(!!c)} />
            <label htmlFor="useLower" className="text-sm font-medium leading-none cursor-pointer">
              Lowercase (a-z)
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="useNumbers" checked={useNumbers} onCheckedChange={(c) => setUseNumbers(!!c)} />
            <label htmlFor="useNumbers" className="text-sm font-medium leading-none cursor-pointer">
              Numbers (0-9)
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="useSymbols" checked={useSymbols} onCheckedChange={(c) => setUseSymbols(!!c)} />
            <label htmlFor="useSymbols" className="text-sm font-medium leading-none cursor-pointer">
              Symbols (!@#)
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
