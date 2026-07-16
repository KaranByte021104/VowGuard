import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSessionStore } from "../store/session";
import {
  generateItemKey,
  encryptSecretPayload,
  encryptItemKeyWithPublicKey,
} from "@app/shared/src/crypto";
import { PasswordGenerator } from "../components/PasswordGenerator";
import { Shield, Eye, EyeOff, ArrowLeft } from "lucide-react";
import zxcvbn from "zxcvbn";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/apiFetch";
import toast from "react-hot-toast";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

export function AddSecret() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get("folderId");
  const { publicKey } = useSessionStore();
  const [activePolicy, setActivePolicy] = useState<any>(null);
  const [formData, setFormData] = useState({
    templateType: "WEBSITE",
    name: "",
    domain: "",
    username: "",
    password: "",
    notes: "",
    isPersonal: false,
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);

  const { data: siteCatalog } = useQuery({
    queryKey: ["site-catalog"],
    queryFn: async () => {
      const res = await apiFetch("http://localhost:3000/site-catalog");
      if (!res.ok) throw new Error("Failed to fetch catalog");
      return res.json();
    },
  });

  const passwordScore = zxcvbn(formData.password).score;

  React.useEffect(() => {
    async function fetchPolicy() {
      try {
        const res = await apiFetch("http://localhost:3000/policies/active", {
          credentials: "include",
        });
        if (res.ok) {
          const policy = await res.json();
          setActivePolicy(policy);
        }
      } catch (e) {
        console.error("Failed to fetch policy", e);
      }
    }
    fetchPolicy();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement
    >,
  ) => {
    const value = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleCatalogSelect = (site: any) => {
    setFormData({
      ...formData,
      name: site.name,
      domain: site.domain,
      templateType: site.templateType,
    });
  };

  const arrayBufferToBase64 = (buffer: ArrayBufferLike) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) {
      toast.error("VowGuard is locked. Cannot encrypt.");
      return;
    }

    if (activePolicy && formData.password) {
      if (formData.password.length < activePolicy.minLength) {
        toast.error(`Password must be at least ${activePolicy.minLength} characters.`);
        return;
      }
      if (formData.password.length > activePolicy.maxLength) {
        toast.error(`Password must be no more than ${activePolicy.maxLength} characters.`);
        return;
      }
      if (activePolicy.requireUppercase && !/[A-Z]/.test(formData.password)) {
        toast.error("Password must contain an uppercase letter.");
        return;
      }
      if (activePolicy.requireLowercase && !/[a-z]/.test(formData.password)) {
        toast.error("Password must contain a lowercase letter.");
        return;
      }
      if (activePolicy.requireNumbers && !/[0-9]/.test(formData.password)) {
        toast.error("Password must contain a number.");
        return;
      }
      if (activePolicy.requireSymbols && !/[^A-Za-z0-9]/.test(formData.password)) {
        toast.error("Password must contain a symbol.");
        return;
      }
    }

    setLoading(true);

    try {
      const itemKey = await generateItemKey();
      const payload = {
        username: formData.username,
        password: formData.password,
        notes: formData.notes,
      };
      const { encryptedData, iv } = await encryptSecretPayload(payload, itemKey);
      const encryptedItemKey = await encryptItemKeyWithPublicKey(itemKey, publicKey);

      const zResult = zxcvbn(formData.password || "");
      const isWeak = zResult.score < 3;
      const isDictionaryWord = zResult.sequence.some(
        (s) =>
          s.dictionary_name === "passwords" ||
          s.dictionary_name === "english_wikipedia" ||
          s.dictionary_name === "us_tv_and_film",
      );
      const containsUsername =
        formData.username && formData.password
          ? formData.password.toLowerCase().includes(formData.username.toLowerCase())
          : false;

      const res = await apiFetch("http://localhost:3000/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          templateType: formData.templateType,
          name: formData.name,
          domain: formData.domain,
          encryptedData: arrayBufferToBase64(encryptedData),
          iv: arrayBufferToBase64(iv.buffer),
          encryptedItemKey: arrayBufferToBase64(encryptedItemKey),
          isPersonal: formData.isPersonal,
          accessControlEnabled: false,
          folderId: folderId || undefined,
          passwordScore: zResult.score,
          isWeak,
          containsUsername,
          isDictionaryWord,
          isReused: false,
          isRecycled: false,
        }),
      });

      if (!res.ok) throw new Error("Failed to save secret");
      navigate("/secrets");
    } catch (e) {
      console.error(e);
      toast.error("Error saving secret");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Add Secret
        </h1>
      </div>

      <div className="bg-muted/30 p-4 rounded-lg border border-border">
        <h2 className="text-sm font-medium text-foreground mb-3 tracking-tight">
          Quick Add from Catalog
        </h2>
        <div className="flex flex-wrap gap-2">
          {(siteCatalog || []).map((site: any) => (
            <Button
              key={site.id || site.name}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleCatalogSelect(site)}
            >
              {site.name}
            </Button>
          ))}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-card p-6 md:p-8 rounded-xl shadow-sm border border-border"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Template
            </label>
            <Select value={formData.templateType} onValueChange={(val: any) => setFormData({ ...formData, templateType: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WEBSITE">Website / Login</SelectItem>
                <SelectItem value="SERVER">Server / SSH</SelectItem>
                <SelectItem value="UNIX">Unix Account</SelectItem>
                <SelectItem value="WINDOWS">Windows Account</SelectItem>
                <SelectItem value="LICENSE">License Key</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Name
            </label>
            <Input
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. My Database"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Domain / URL
          </label>
          <Input
            name="domain"
            value={formData.domain}
            onChange={handleChange}
            placeholder="https://example.com"
          />
        </div>

        <hr className="border-border" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Username
            </label>
            <Input
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="admin"
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-foreground">Password</label>
              <button
                type="button"
                onClick={() => setShowGenerator(!showGenerator)}
                className="text-sm text-primary hover:text-blue-700 font-medium transition-colors"
              >
                Generator
              </button>
            </div>
            <div className="relative">
              <Input
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={`pr-10 ${formData.password ? (passwordScore < 3 ? "border-status-danger focus-visible:ring-status-danger" : "border-status-success focus-visible:ring-status-success") : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {formData.password && (
              <div className="flex gap-1 mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-full flex-1 transition-all ${
                      i < passwordScore
                        ? passwordScore < 3
                          ? "bg-status-danger"
                          : passwordScore === 3
                            ? "bg-status-warning"
                            : "bg-status-success"
                        : "bg-transparent"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {showGenerator && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200">
            <PasswordGenerator
              onSelect={(pwd) => setFormData({ ...formData, password: pwd })}
            />
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Secure Notes
          </label>
          <textarea
            name="notes"
            rows={4}
            value={formData.notes}
            onChange={handleChange}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            placeholder="Add any additional context or instructions here..."
          />
        </div>

        <div className="flex items-center space-x-2 bg-muted/30 p-4 rounded-md border border-border">
          <Checkbox
            id="isPersonal"
            name="isPersonal"
            checked={formData.isPersonal}
            onCheckedChange={(c) => setFormData({ ...formData, isPersonal: !!c })}
          />
          <label
            htmlFor="isPersonal"
            className="text-sm font-medium leading-none cursor-pointer"
          >
            Mark as Personal <span className="text-muted-foreground font-normal">(Private, cannot be shared or added to shared folders)</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/secrets")}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !publicKey}
            className="flex items-center gap-2"
          >
            <Shield className="w-4 h-4" />
            {loading ? "Encrypting..." : "Save Secret"}
          </Button>
        </div>
      </form>
    </div>
  );
}
