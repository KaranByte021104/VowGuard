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
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const value =
      e.target.type === "checkbox"
        ? (e.target as HTMLInputElement).checked
        : e.target.value;
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
      alert("Vault is locked. Cannot encrypt.");
      return;
    }

    // Password Policy Validation
    if (activePolicy && formData.password) {
      if (formData.password.length < activePolicy.minLength) {
        toast.error(
          `Password must be at least ${activePolicy.minLength} characters.`,
        );
        return;
      }
      if (formData.password.length > activePolicy.maxLength) {
        toast.error(
          `Password must be no more than ${activePolicy.maxLength} characters.`,
        );
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
      if (
        activePolicy.requireSymbols &&
        !/[^A-Za-z0-9]/.test(formData.password)
      ) {
        toast.error("Password must contain a symbol.");
        return;
      }
    }

    setLoading(true);

    try {
      // 1. Generate unique ItemKey
      const itemKey = await generateItemKey();

      // 2. Encrypt the payload (username, password, notes)
      const payload = {
        username: formData.username,
        password: formData.password,
        notes: formData.notes,
      };
      const { encryptedData, iv } = await encryptSecretPayload(
        payload,
        itemKey,
      );

      // 3. Encrypt the ItemKey with the User's Public Key
      const encryptedItemKey = await encryptItemKeyWithPublicKey(
        itemKey,
        publicKey,
      );

      // Compute assessment flags
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
          ? formData.password
              .toLowerCase()
              .includes(formData.username.toLowerCase())
          : false;

      // 4. Send to server
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
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Add Secret
        </h1>
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Quick Add from Catalog
        </h2>
        <div className="flex flex-wrap gap-2">
          {(siteCatalog || []).map((site: any) => (
            <button
              key={site.id || site.name}
              type="button"
              onClick={() => handleCatalogSelect(site)}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-700 transition-colors"
            >
              {site.name}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700"
      >
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Template
            </label>
            <select
              name="templateType"
              value={formData.templateType}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="WEBSITE">Website / Login</option>
              <option value="SERVER">Server / SSH</option>
              <option value="UNIX">Unix Account</option>
              <option value="WINDOWS">Windows Account</option>
              <option value="LICENSE">License Key</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Name
            </label>
            <input
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Domain / URL
          </label>
          <input
            name="domain"
            value={formData.domain}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        <hr className="border-gray-200 dark:border-gray-700" />

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Username
            </label>
            <input
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex justify-between">
              <span>Password</span>
              <button
                type="button"
                onClick={() => setShowGenerator(!showGenerator)}
                className="text-primary hover:text-blue-700"
              >
                Generator
              </button>
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleChange}
                className={`mt-1 block w-full rounded-md shadow-sm p-2 pr-10 bg-gray-50 dark:bg-gray-700 dark:text-white border ${formData.password ? (passwordScore < 3 ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-green-300 focus:border-green-500 focus:ring-green-500") : "border-gray-300 dark:border-gray-600"}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute bottom-2 right-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {formData.password && (
              <div className="flex gap-1 mt-2 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-full flex-1 ${
                      i < passwordScore
                        ? passwordScore < 3
                          ? "bg-red-500"
                          : passwordScore === 3
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        : "bg-transparent"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {showGenerator && (
          <PasswordGenerator
            onSelect={(pwd) => setFormData({ ...formData, password: pwd })}
          />
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Secure Notes
          </label>
          <textarea
            name="notes"
            rows={4}
            value={formData.notes}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2 mt-4">
          <input
            type="checkbox"
            id="isPersonal"
            name="isPersonal"
            checked={formData.isPersonal}
            onChange={handleChange}
            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
          />
          <label
            htmlFor="isPersonal"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Mark as Personal (Private, cannot be shared or added to shared
            folders)
          </label>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate("/secrets")}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !publicKey}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Shield className="w-4 h-4" />
            {loading ? "Encrypting..." : "Save Secret"}
          </button>
        </div>
      </form>
    </div>
  );
}
