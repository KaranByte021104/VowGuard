import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSessionStore } from "../store/session";
import toast from "react-hot-toast";
import {
  decryptSecretPayload,
  decryptItemKeyWithPrivateKey,
  encryptSecretPayload,
  encryptItemKeyWithPublicKey,
  importPublicKey,
} from "@app/shared/src/crypto";
import {
  Eye,
  EyeOff,
  Save,
  Trash,
  ArrowLeft,
  Paperclip,
  History,
  Clock,
  Download,
  Share2,
} from "lucide-react";
import { PasswordGenerator } from "../components/PasswordGenerator";
import { Modal } from "../components/Modal";
import zxcvbn from "zxcvbn";
import { apiFetch } from "../lib/apiFetch";

import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";

export function SecretDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { privateKey, publicKey, user } = useSessionStore();

  const [formData, setFormData] = useState({
    name: "",
    domain: "",
    username: "",
    password: "",
    notes: "",
    isPersonal: false,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [decryptionError, setDecryptionError] = useState("");
  const [activeTab, setActiveTab] = useState<
    "details" | "attachments" | "history" | "sharing" | "access-control"
  >("details");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [decryptedVersions, setDecryptedVersions] = useState<
    Record<string, any>
  >({});
  const [previewAttachment, setPreviewAttachment] = useState<{
    id: string;
    type: string;
    url: string;
    content?: string;
  } | null>(null);
  const [orgUsers, setOrgUsers] = useState<any[]>([]);
  const [orgGroups, setOrgGroups] = useState<any[]>([]);

  // Access Control states
  const [acConfig, setAcConfig] = useState({
    enabled: false,
    minimumApproverCount: 1,
    autoVoidHours: 24,
    grantedAccessHours: 1,
    automaticApprovalRule: "NONE",
  });
  const [acApprovers, setAcApprovers] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [shareRecipientId, setShareRecipientId] = useState("");
  const [sharePermission, setSharePermission] = useState("VIEW");
  const [shareType, setShareType] = useState<"user" | "group" | "email">(
    "user",
  );
  const [shareEmail, setShareEmail] = useState("");

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmColor?: "red" | "primary";
    confirmText?: string;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const {
    data: secret,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["secret", id],
    queryFn: async () => {
      const res = await apiFetch(`http://localhost:3000/secrets/${id}`, {
        credentials: "include",
      });
      if (res.status === 403) {
        const data = await res.json();
        setIsLocked(true);
        setLockReason(data.message);
        return { isLocked: true };
      }
      if (res.status === 410) {
        setIsLocked(true);
        setLockReason(
          "Your granted access has expired. You must request access again.",
        );
        return { isLocked: true };
      }
      setIsLocked(false);
      setLockReason("");
      if (!res.ok) throw new Error("Secret not found");
      return res.json();
    },
  });

  useEffect(() => {
    async function decrypt() {
      if (!secret || !privateKey) return;
      try {
        if (secret.isLocked) return;

        let keyToUse = secret.encryptedItemKey;
        if (user && secret.ownerId !== user.id) {
          const myShare = secret.shares?.find(
            (s: any) => s.recipientUserId === user.id,
          );
          if (myShare) {
            keyToUse = myShare.encryptedItemKey;
          } else {
            const sortedRequests = [...(secret.accessRequests || [])].sort(
              (a: any, b: any) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            );
            const myRequest = sortedRequests.find(
              (r: any) => r.status === "APPROVED",
            );
            if (myRequest && myRequest.encryptedItemKey) {
              keyToUse = myRequest.encryptedItemKey;
            }
          }
        }
        const encryptedItemKeyBuf = Uint8Array.from(atob(keyToUse), (c) =>
          c.charCodeAt(0),
        ).buffer;
        const itemKey = await decryptItemKeyWithPrivateKey(
          encryptedItemKeyBuf,
          privateKey,
        );

        const encryptedDataBuf = Uint8Array.from(
          atob(secret.encryptedData),
          (c) => c.charCodeAt(0),
        ).buffer;
        const ivBuf = Uint8Array.from(atob(secret.iv), (c) => c.charCodeAt(0));

        const payload = await decryptSecretPayload(
          encryptedDataBuf,
          ivBuf,
          itemKey,
        );

        setFormData({
          name: secret.name,
          domain: secret.domain || "",
          username: payload.username || "",
          password: payload.password || "",
          notes: payload.notes || "",
          isPersonal: secret.isPersonal || false,
        });
      } catch (e) {
        setDecryptionError("Failed to decrypt secret.");
        console.error(e);
      }
    }
    decrypt();
  }, [secret, privateKey]);

  useEffect(() => {
    if (activeTab === "attachments") {
      apiFetch(`http://localhost:3000/attachments/secret/${id}`, {
        credentials: "include",
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(await res.text());
          return res.json();
        })
        .then((data) => {
          if (Array.isArray(data)) setAttachments(data);
          else setAttachments([]);
        })
        .catch((err) => {
          console.error(err);
          setAttachments([]);
        });
    } else if (activeTab === "history") {
      apiFetch(`http://localhost:3000/secrets/${id}/versions`, {
        credentials: "include",
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(await res.text());
          return res.json();
        })
        .then(async (fetchedVersions) => {
          if (!Array.isArray(fetchedVersions)) return;
          setVersions(fetchedVersions);
          if (!privateKey) return;
          const decrypted: Record<string, any> = {};
          for (const v of fetchedVersions) {
            try {
              let keyToUse = v.encryptedItemKey;
              if (user && secret.ownerId !== user.id) {
                const myShare = secret.shares?.find(
                  (s: any) => s.recipientUserId === user.id,
                );
                if (myShare) {
                  keyToUse = myShare.encryptedItemKey;
                } else {
                  const sortedRequests = [
                    ...(secret.accessRequests || []),
                  ].sort(
                    (a: any, b: any) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime(),
                  );
                  const myRequest = sortedRequests.find(
                    (r: any) => r.status === "APPROVED",
                  );
                  if (myRequest && myRequest.encryptedItemKey) {
                    keyToUse = myRequest.encryptedItemKey;
                  }
                }
              }
              const encryptedItemKeyBuf = Uint8Array.from(atob(keyToUse), (c) =>
                c.charCodeAt(0),
              ).buffer;
              const itemKey = await decryptItemKeyWithPrivateKey(
                encryptedItemKeyBuf,
                privateKey,
              );
              const encryptedDataBuf = Uint8Array.from(
                atob(v.encryptedData),
                (c) => c.charCodeAt(0),
              ).buffer;
              const ivBuf = Uint8Array.from(atob(v.iv), (c) => c.charCodeAt(0));
              const payload = await decryptSecretPayload(
                encryptedDataBuf,
                ivBuf,
                itemKey,
              );
              decrypted[v.id] = payload;
            } catch (e) {
              decrypted[v.id] = { error: "Failed" };
            }
          }
          setDecryptedVersions(decrypted);
        })
        .catch((e) => {
          console.error(e);
          setVersions([]);
        });
    } else if (activeTab === "sharing") {
      apiFetch("http://localhost:3000/users", { credentials: "include" })
        .then((res) => res.json())
        .then(setOrgUsers)
        .catch(console.error);
      apiFetch("http://localhost:3000/groups", { credentials: "include" })
        .then((res) => res.json())
        .then(setOrgGroups)
        .catch(console.error);
    } else if (activeTab === "access-control") {
      apiFetch("http://localhost:3000/users", { credentials: "include" })
        .then((res) => res.json())
        .then(setOrgUsers)
        .catch(console.error);

      if (secret?.accessControlConfig) {
        setAcConfig({
          enabled: true,
          minimumApproverCount: secret.accessControlConfig.minimumApproverCount,
          autoVoidHours: secret.accessControlConfig.autoVoidHours,
          grantedAccessHours: secret.accessControlConfig.grantedAccessHours,
          automaticApprovalRule:
            secret.accessControlConfig.automaticApprovalRule || "NONE",
        });
        if (secret.accessControlConfig.approvers) {
          setAcApprovers(secret.accessControlConfig.approvers.map((a: any) => a.userId));
        }
      }
    }
  }, [activeTab, id, secret]);

  const handleRestore = async (versionId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Restore Version",
      message: "Restore this version? This will overwrite the current secret.",
      confirmText: "Restore",
      onConfirm: async () => {
        setLoading(true);
        try {
          await apiFetch(
            `http://localhost:3000/secrets/${id}/versions/${versionId}/restore`,
            {
              method: "POST",
              credentials: "include",
            },
          );
          await refetch();
          setActiveTab("details");
        } catch (e) {
          toast.error("Failed to restore");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !secret || !privateKey) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10 MB limit");
      return;
    }

    setLoading(true);
    try {
      // 1. Get ItemKey
      const encryptedItemKeyBuf = Uint8Array.from(
        atob(secret.encryptedItemKey),
        (c) => c.charCodeAt(0),
      ).buffer;
      const itemKey = await decryptItemKeyWithPrivateKey(
        encryptedItemKeyBuf,
        privateKey,
      );

      // 2. Encrypt File
      const fileBuf = await file.arrayBuffer();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encryptedFileBuf = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        itemKey,
        fileBuf,
      );

      const encryptedFile = new File([encryptedFileBuf], file.name, {
        type: file.type,
      });

      const formData = new FormData();
      formData.append("file", encryptedFile);
      formData.append("iv", arrayBufferToBase64(iv.buffer));
      formData.append("encryptedItemKey", secret.encryptedItemKey);

      await apiFetch(`http://localhost:3000/attachments/${id}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      setActiveTab("details"); // trigger refresh or something
      setTimeout(() => setActiveTab("attachments"), 50);
    } catch (e) {
      console.error(e);
      toast.error("Failed to upload attachment");
    } finally {
      setLoading(false);
    }
  };

  const fetchAndDecryptAttachment = async (att: any) => {
    if (!privateKey) throw new Error("No private key");
    const res = await apiFetch(
      `http://localhost:3000/attachments/${att.id}/download`,
      { credentials: "include" },
    );
    const encryptedBlob = await res.blob();
    const encryptedBuf = await encryptedBlob.arrayBuffer();

    const encryptedItemKeyBuf = Uint8Array.from(
      atob(att.encryptedItemKey),
      (c) => c.charCodeAt(0),
    ).buffer;
    const itemKey = await decryptItemKeyWithPrivateKey(
      encryptedItemKeyBuf,
      privateKey,
    );
    const iv = Uint8Array.from(atob(att.iv), (c) => c.charCodeAt(0));

    const decryptedBuf = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      itemKey,
      encryptedBuf,
    );

    return new Blob([decryptedBuf], { type: att.mimeType });
  };

  const handlePreviewAttachment = async (att: any) => {
    try {
      const blob = await fetchAndDecryptAttachment(att);

      if (att.mimeType.startsWith("image/")) {
        const url = URL.createObjectURL(blob);
        setPreviewAttachment({ id: att.id, type: "image", url });
      } else if (att.mimeType === "application/pdf") {
        const url = URL.createObjectURL(blob);
        setPreviewAttachment({ id: att.id, type: "pdf", url });
      } else if (
        att.mimeType.startsWith("text/") ||
        att.mimeType === "application/json"
      ) {
        const text = await blob.text();
        setPreviewAttachment({
          id: att.id,
          type: "text",
          url: "",
          content: text,
        });
      } else {
        toast.error("Preview not available for this file type.");
      }
    } catch (e) {
      toast.error("Failed to load preview");
    }
  };

  const handleDownloadAttachment = async (att: any) => {
    try {
      const blob = await fetchAndDecryptAttachment(att);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Failed to download attachment");
    }
  };

  const handleDeleteAttachment = async (attId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Attachment",
      message: "Are you sure you want to delete this attachment?",
      confirmText: "Delete",
      confirmColor: "red",
      onConfirm: async () => {
        try {
          const res = await apiFetch(
            `http://localhost:3000/attachments/${attId}`,
            {
              method: "DELETE",
              credentials: "include",
            },
          );
          if (!res.ok) throw new Error("Delete failed");
          setAttachments((prev) => prev.filter((a) => a.id !== attId));
        } catch (e) {
          toast.error("Failed to delete attachment");
        }
      },
    });
  };

  const passwordScore = formData.password ? zxcvbn(formData.password).score : 0;

  const arrayBufferToBase64 = (buffer: ArrayBufferLike) => {
    let binary = "";
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
      let keyToUse = secret.encryptedItemKey;
      if (user && secret.ownerId !== user.id) {
        const myShare = secret.shares?.find(
          (s: any) => s.recipientUserId === user.id,
        );
        if (myShare) {
          keyToUse = myShare.encryptedItemKey;
        } else {
          const sortedRequests = [...(secret.accessRequests || [])].sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          const myRequest = sortedRequests.find(
            (r: any) => r.status === "APPROVED",
          );
          if (myRequest && myRequest.encryptedItemKey) {
            keyToUse = myRequest.encryptedItemKey;
          }
        }
      }

      const encryptedItemKeyBuf = Uint8Array.from(atob(keyToUse), (c) =>
        c.charCodeAt(0),
      ).buffer;
      const itemKey = await decryptItemKeyWithPrivateKey(
        encryptedItemKeyBuf,
        privateKey!,
      );

      const payload = {
        username: formData.username,
        password: formData.password,
        notes: formData.notes,
      };

      const { encryptedData, iv } = await encryptSecretPayload(
        payload,
        itemKey,
      );

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
      const isRecycled =
        secret.versions?.some(
          (v: any) => v.encryptedData === arrayBufferToBase64(encryptedData),
        ) || false;

      const res = await apiFetch(`http://localhost:3000/secrets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.name,
          domain: formData.domain,
          encryptedData: arrayBufferToBase64(encryptedData),
          iv: arrayBufferToBase64(iv.buffer),
          encryptedItemKey: secret.encryptedItemKey, // Key hasn't changed
          passwordScore: zResult.score,
          isWeak,
          containsUsername,
          isDictionaryWord,
          isReused: false,
          isRecycled,
          isPersonal: formData.isPersonal,
        }),
      });

      if (!res.ok) throw new Error("Update failed");
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      toast.error("Error updating secret");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Secret",
      message:
        "Are you absolutely sure you want to delete this secret? This cannot be undone.",
      confirmText: "Delete",
      confirmColor: "red",
      onConfirm: async () => {
        await apiFetch(`http://localhost:3000/secrets/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        navigate("/secrets");
      },
    });
  };

  const handleShareSubmit = async () => {
    if (!privateKey || !secret) return;
    setLoading(true);
    let keyToUse = secret.encryptedItemKey;
    if (user && secret.ownerId !== user.id) {
      const myShare = secret.shares?.find(
        (s: any) => s.recipientUserId === user.id,
      );
      if (myShare) keyToUse = myShare.encryptedItemKey;
    }
    try {
      if (shareType === "user") {
        const recipient = orgUsers.find((u) => u.id === shareRecipientId);
        if (!recipient) throw new Error("User not found");

        const encryptedItemKeyBuf = Uint8Array.from(atob(keyToUse), (c) =>
          c.charCodeAt(0),
        ).buffer;
        const itemKey = await decryptItemKeyWithPrivateKey(
          encryptedItemKeyBuf,
          privateKey,
        );

        const publicKeyBuf = Uint8Array.from(atob(recipient.publicKey), (c) =>
          c.charCodeAt(0),
        ).buffer;
        const cryptoPubKey = await importPublicKey(publicKeyBuf);
        const newEncryptedItemKey = await encryptItemKeyWithPublicKey(
          itemKey,
          cryptoPubKey,
        );

        const res = await apiFetch(`http://localhost:3000/shares/internal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            secretId: id,
            recipientUserId: shareRecipientId,
            permission: sharePermission,
            encryptedItemKey: arrayBufferToBase64(newEncryptedItemKey),
          }),
        });
        if (!res.ok) throw new Error(await res.text());
      } else if (shareType === "group") {
        const group = orgGroups.find((g) => g.id === shareRecipientId);
        if (!group) throw new Error("Group not found");

        const encryptedItemKeyBuf = Uint8Array.from(atob(keyToUse), (c) =>
          c.charCodeAt(0),
        ).buffer;
        const itemKey = await decryptItemKeyWithPrivateKey(
          encryptedItemKeyBuf,
          privateKey,
        );

        // Build encryptedItemKeys map for ALL group members atomically via /shares/group
        const encryptedItemKeys: Record<string, string> = {};
        for (const member of group.members) {
          if (!member.user?.publicKey) continue;
          const publicKeyBuf = Uint8Array.from(
            atob(member.user.publicKey),
            (c) => c.charCodeAt(0),
          ).buffer;
          const cryptoPubKey = await importPublicKey(publicKeyBuf);
          const newEncryptedItemKey = await encryptItemKeyWithPublicKey(
            itemKey,
            cryptoPubKey,
          );
          encryptedItemKeys[member.userId] =
            arrayBufferToBase64(newEncryptedItemKey);
        }
        // Single atomic call — backed by a DB transaction on the backend
        const res = await apiFetch(`http://localhost:3000/shares/group`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            secretId: id,
            groupId: shareRecipientId,
            permission: sharePermission,
            encryptedItemKeys,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || await res.text());
        }
      } else if (shareType === "email") {
        const res = await apiFetch(`http://localhost:3000/shares/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            secretId: id,
            email: shareEmail,
            permission: sharePermission,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || await res.text());
        }
      }

      await refetch();
      setShareRecipientId("");
      setShareEmail("");
      toast.success("Shared successfully!");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to share");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeInvite = async (invite: any) => {
    if (!privateKey || !secret) return;
    setLoading(true);
    try {
      let keyToUse = secret.encryptedItemKey;
      if (user && secret.ownerId !== user.id) {
        const myShare = secret.shares?.find((s: any) => s.recipientUserId === user.id);
        if (myShare) keyToUse = myShare.encryptedItemKey;
      }

      const encryptedItemKeyBuf = Uint8Array.from(atob(keyToUse), c => c.charCodeAt(0)).buffer;
      const itemKey = await decryptItemKeyWithPrivateKey(encryptedItemKeyBuf, privateKey);

      const publicKeyBuf = Uint8Array.from(atob(invite.ephemeralPublicKey), c => c.charCodeAt(0)).buffer;
      const cryptoPubKey = await importPublicKey(publicKeyBuf);
      const newEncryptedItemKey = await encryptItemKeyWithPublicKey(itemKey, cryptoPubKey);

      const res = await apiFetch(`http://localhost:3000/shares/invite/${invite.id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          encryptedItemKey: arrayBufferToBase64(newEncryptedItemKey),
        })
      });

      if (!res.ok) throw new Error(await res.text());

      await refetch();
      toast.success('Invite finalized successfully!');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to finalize invite');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    try {
      await apiFetch(`http://localhost:3000/shares/${shareId}`, {
        method: "DELETE",
        credentials: "include",
      });
      refetch();
    } catch (e) {
      toast.error("Failed to revoke");
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await apiFetch(`http://localhost:3000/shares/invite/${inviteId}`, {
        method: "DELETE",
        credentials: "include",
      });
      refetch();
      toast.success("Invite revoked");
    } catch (e) {
      toast.error("Failed to revoke invite");
    }
  };

  const handleRevokeRequest = async (requestId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Revoke Access Request",
      message: "Are you sure you want to revoke this access request?",
      confirmText: "Revoke",
      confirmColor: "red",
      onConfirm: async () => {
        try {
          await apiFetch(`http://localhost:3000/requests/${requestId}/revoke`, {
            method: "POST",
            credentials: "include",
          });
          toast.success("Request revoked");
          refetch();
        } catch (e) {
          toast.error("Failed to revoke request");
        }
      },
    });
  };

  const handleEnableAccessControl = async () => {
    try {
      const res = await apiFetch(
        `http://localhost:3000/secrets/${id}/access-control`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            minimumApproverCount: acConfig.minimumApproverCount,
            autoVoidHours: acConfig.autoVoidHours,
            grantedAccessHours: acConfig.grantedAccessHours,
            automaticApprovalRule:
              acConfig.automaticApprovalRule === "NONE"
                ? null
                : acConfig.automaticApprovalRule,
            approvers: acApprovers,
          }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      toast.success("Access Control Enabled!");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to enable access control");
    }
  };

  const handleRequestAccess = async () => {
    try {
      const res = await apiFetch(
        `http://localhost:3000/secrets/${id}/requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            reason: requestReason,
            timing: "IMMEDIATE",
          }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      toast.success("Request submitted!");
      setRequestSubmitted(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to request access");
    }
  };

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!privateKey) {
    return (
      <div className="p-8 text-center bg-yellow-50 dark:bg-yellow-900/20 rounded-lg max-w-xl mx-auto mt-20 border border-yellow-200 dark:border-yellow-900/50">
        <h2 className="text-xl font-bold text-yellow-800 dark:text-yellow-500">
          VowGuard Locked
        </h2>
        <p className="mt-2 text-yellow-700 dark:text-yellow-600">
          Please unlock your vault to view this secret.
        </p>
        <button
          onClick={() => (window.location.href = "/login")}
          className="mt-4 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-medium"
        >
          Unlock VowGuard
        </button>
      </div>
    );
  }

  if (isLocked || secret?.isLocked) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-300">
          <EyeOff className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold mb-2 dark:text-white">
          Access Locked
        </h2>
        <p className="text-gray-500 mb-6">
          {lockReason || "This secret is protected by Access Control."}
        </p>

        {requestSubmitted ? (
          <div className="bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300 p-4 rounded text-sm mb-4">
            Your request has been successfully submitted and is pending
            approval. You will be able to access the secret once approved.
          </div>
        ) : lockReason?.includes("PENDING") ? null : (
          <div className="text-left space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Reason for Request
            </label>
            <textarea
              rows={3}
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              className="w-full border-gray-300 rounded shadow-sm p-2 dark:bg-gray-700 dark:text-white"
              placeholder="I need access to deploy to production..."
            />
            <button
              onClick={handleRequestAccess}
              disabled={!requestReason}
              className="w-full bg-primary text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Submit Request
            </button>
          </div>
        )}
        <div className="mt-6 flex flex-col gap-2 justify-center items-center">
          <button
            onClick={() => {
              setRequestSubmitted(false);
              refetch();
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded font-medium"
          >
            Refresh Status
          </button>
          <button
            onClick={() => navigate("/secrets")}
            className="text-gray-500 hover:underline"
          >
            Return to VowGuard
          </button>
        </div>
      </div>
    );
  }

  if (decryptionError)
    return <div className="p-8 text-red-500">{decryptionError}</div>;

  const canModify =
    secret?.ownerId === user?.id ||
    secret?.shares?.some(
      (s: any) => s.recipientUserId === user?.id && s.permission === "MODIFY",
    );
  
  const hasManagePerm =
    secret?.ownerId === user?.id ||
    secret?.shares?.some(
      (s: any) => s.recipientUserId === user?.id && s.permission === "MANAGE",
    );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <Button variant="ghost" onClick={() => navigate("/secrets")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="flex gap-2">
          {!isEditing ? (
            <>
              {canModify && (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              )}
              {canModify && (
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash className="w-4 h-4 mr-2" /> Delete
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={loading}>
                <Save className="w-4 h-4 mr-2" /> {loading ? "Saving..." : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full flex flex-col">
        <TabsList className="mb-6 w-full justify-start h-auto p-1 bg-muted/30 rounded-lg overflow-x-auto border border-border flex-row">
          <TabsTrigger value="details" className="text-sm">Details</TabsTrigger>
          <TabsTrigger value="attachments" className="text-sm gap-2"><Paperclip className="w-4 h-4" /> Attachments</TabsTrigger>
          {user?.id === secret?.ownerId && (
            <TabsTrigger value="history" className="text-sm gap-2"><History className="w-4 h-4" /> History</TabsTrigger>
          )}
          <TabsTrigger value="sharing" className="text-sm gap-2"><Share2 className="w-4 h-4" /> Sharing</TabsTrigger>
          {user?.id === secret?.ownerId && (
            <TabsTrigger value="access-control" className="text-sm gap-2"><EyeOff className="w-4 h-4" /> Access Control</TabsTrigger>
          )}
        </TabsList>

      {['details', 'attachments', 'history'].includes(activeTab) && (
      <div className="space-y-6 bg-card p-6 md:p-8 rounded-xl border border-border shadow-sm">
        {activeTab === "details" && (
          <>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Name
                </label>
                <input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  disabled={!isEditing}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:text-white disabled:opacity-75 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Domain / URL
                </label>
                <input
                  value={formData.domain}
                  onChange={(e) =>
                    setFormData({ ...formData, domain: e.target.value })
                  }
                  disabled={!isEditing}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:text-white disabled:opacity-75 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                />
              </div>
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Username
                </label>
                <input
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  disabled={!isEditing}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:text-white disabled:opacity-75 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex justify-between">
                  <span>Password</span>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => setShowGenerator(!showGenerator)}
                      className="text-primary hover:text-blue-700"
                    >
                      Generator
                    </button>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    disabled={!isEditing}
                    className={`mt-1 block w-full rounded-md shadow-sm p-2 pr-10 bg-gray-50 dark:bg-gray-700 dark:text-white disabled:opacity-75 disabled:bg-gray-100 dark:disabled:bg-gray-800 ${isEditing && formData.password ? (passwordScore < 3 ? "border-red-300" : "border-green-300") : "border-gray-300 dark:border-gray-600"}`}
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
                {isEditing && formData.password && (
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

            {showGenerator && isEditing && (
              <PasswordGenerator
                onSelect={(pwd) => setFormData({ ...formData, password: pwd })}
              />
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Secure Notes
              </label>
              <textarea
                rows={4}
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                disabled={!isEditing}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:text-white disabled:opacity-75 disabled:bg-gray-100 dark:disabled:bg-gray-800"
              />
            </div>

            <div className="mt-4 flex items-center">
              <input
                type="checkbox"
                id="isPersonal"
                checked={formData.isPersonal}
                onChange={(e) =>
                  setFormData({ ...formData, isPersonal: e.target.checked })
                }
                disabled={!isEditing}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded disabled:opacity-50"
              />
              <label
                htmlFor="isPersonal"
                className={`ml-2 block text-sm ${!isEditing ? "text-gray-400" : "text-gray-700 dark:text-gray-300"}`}
              >
                Personal Secret (Only visible to you)
              </label>
            </div>
          </>
        )}

        {activeTab === "attachments" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Attachments</h3>
              <label className="cursor-pointer bg-primary text-white px-4 py-2 rounded hover:bg-blue-700">
                Upload File
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={loading}
                />
              </label>
            </div>
            {attachments.length === 0 ? (
              <p className="text-gray-500">No attachments found.</p>
            ) : (
              <ul className="space-y-3">
                {attachments.map((att) => (
                  <li
                    key={att.id}
                    className="flex justify-between items-center p-3 border rounded bg-gray-50 dark:bg-gray-900 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <Paperclip className="w-5 h-5 text-gray-400" />
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {att.originalName}
                      </span>
                      <span className="text-xs text-gray-500">
                        {(att.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handlePreviewAttachment(att)}
                        className="text-gray-500 hover:text-primary transition-colors"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadAttachment(att)}
                        className="text-gray-500 hover:text-primary transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="text-gray-500 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {previewAttachment && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                onClick={() => setPreviewAttachment(null)}
              >
                <div
                  className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                    <h4 className="font-semibold text-lg dark:text-white">
                      File Preview
                    </h4>
                    <button
                      onClick={() => setPreviewAttachment(null)}
                      className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-bold text-xl"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto flex justify-center bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    {previewAttachment.type === "image" && (
                      <img
                        src={previewAttachment.url}
                        alt="Preview"
                        className="max-w-full object-contain"
                      />
                    )}
                    {previewAttachment.type === "pdf" && (
                      <iframe
                        src={previewAttachment.url}
                        className="w-full h-[70vh] rounded"
                        title="PDF Preview"
                      />
                    )}
                    {previewAttachment.type === "text" && (
                      <pre className="text-sm text-gray-800 dark:text-gray-300 w-full whitespace-pre-wrap">
                        {previewAttachment.content}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div>
            <h3 className="text-lg font-medium mb-4">Version History</h3>
            {versions.length === 0 ? (
              <p className="text-gray-500">No previous versions.</p>
            ) : (
              <ul className="space-y-4 relative border-l border-gray-200 dark:border-gray-700 ml-3 pl-6">
                {versions.map((v) => (
                  <li key={v.id} className="relative">
                    <span className="absolute -left-[33px] top-1 bg-white dark:bg-gray-800 p-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-400">
                      <Clock className="w-4 h-4" />
                    </span>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Updated values
                        </p>
                        <p className="text-xs text-gray-500 mb-2">
                          {new Date(v.createdAt).toLocaleString()}
                        </p>
                        {decryptedVersions[v.id] && (
                          <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                            <div className="grid grid-cols-[80px_1fr] gap-2">
                              <span className="font-medium text-gray-500 dark:text-gray-400">
                                Username:
                              </span>
                              <span>
                                {decryptedVersions[v.id].username || "-"}
                              </span>
                              <span className="font-medium text-gray-500 dark:text-gray-400">
                                Password:
                              </span>
                              <span>
                                {decryptedVersions[v.id].password
                                  ? "********"
                                  : "-"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRestore(v.id)}
                        disabled={loading}
                        className="text-sm text-primary hover:text-blue-700 border border-blue-200 px-3 py-1 rounded bg-blue-50"
                      >
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
      )}
      {activeTab === "sharing" && (
        <div className="space-y-6 bg-card p-6 md:p-8 rounded-xl border border-border shadow-sm">
          <div className="p-0">
            <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">
              Share Access
            </h3>
            {secret?.isPersonal ? (
              <p className="text-red-500">Personal secrets cannot be shared.</p>
            ) : !hasManagePerm ? (
              <p className="text-gray-500 dark:text-gray-400">You do not have permission to share this secret.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-4 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="radio"
                      checked={shareType === "user"}
                      onChange={() => setShareType("user")}
                    />{" "}
                    User
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="radio"
                      checked={shareType === "group"}
                      onChange={() => setShareType("group")}
                    />{" "}
                    Group
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="radio"
                      checked={shareType === "email"}
                      onChange={() => setShareType("email")}
                    />{" "}
                    External Email
                  </label>
                </div>

                <div className="flex gap-4">
                  {shareType === "user" && (
                    <select
                      value={shareRecipientId}
                      onChange={(e) => setShareRecipientId(e.target.value)}
                      className="flex-1 rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Select User...</option>
                      {orgUsers
                        .filter((u) => u.id !== secret.ownerId)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.email}
                          </option>
                        ))}
                    </select>
                  )}
                  {shareType === "group" && (
                    <select
                      value={shareRecipientId}
                      onChange={(e) => setShareRecipientId(e.target.value)}
                      className="flex-1 rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Select Group...</option>
                      {orgGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {shareType === "email" && (
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      className="flex-1 rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:text-white"
                    />
                  )}

                  <select
                    value={sharePermission}
                    onChange={(e) => setSharePermission(e.target.value)}
                    className="w-48 rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="ONE_CLICK_LOGIN_ONLY">One-Click Only</option>
                    <option value="VIEW">View</option>
                    <option value="MODIFY">Modify</option>
                    <option value="MANAGE">Manage</option>
                  </select>

                  <button
                    onClick={handleShareSubmit}
                    disabled={loading || (!shareRecipientId && !shareEmail)}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    Share
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">
              Current Access
            </h3>
            {secret?.shares?.length === 0 &&
            secret?.thirdPartyInvites?.length === 0 &&
            (!secret?.accessRequests || secret.accessRequests.filter((r: any) => r.status === 'APPROVED' || r.status === 'PENDING').length === 0) ? (
              <p className="text-gray-500">Not shared with anyone.</p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {secret?.shares?.map((share: any) => (
                  <li
                    key={share.id}
                    className="py-3 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {share.recipientUser?.email}
                      </p>
                      <p className="text-xs text-gray-500">
                        Permission: {share.permission}
                      </p>
                    </div>
                    {hasManagePerm && (
                      <button
                        onClick={() => handleRevoke(share.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                ))}
                {secret?.thirdPartyInvites?.map((invite: any) => (
                  <li
                    key={invite.id}
                    className="py-3 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {invite.email}{" "}
                        <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                          External
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Status: {invite.status} | Permission:{" "}
                        {invite.permission}
                      </p>
                    </div>
                    {hasManagePerm && (
                      <div className="flex gap-2">
                        {invite.status === 'ACCEPTED' && !invite.encryptedItemKey && (
                          <button
                            onClick={() => handleFinalizeInvite(invite)}
                            className="text-primary hover:text-blue-700 text-sm font-medium mr-2"
                          >
                            Finalize
                          </button>
                        )}
                        <button
                          onClick={() => handleRevokeInvite(invite.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                  </li>
                ))}
                {secret?.accessRequests?.filter((r: any) => r.status === 'APPROVED' || r.status === 'PENDING').map((req: any) => (
                  <li
                    key={req.id}
                    className="py-3 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {req.requester?.email} 
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                          Access Request
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Status: {req.status} {req.expiresAt ? `| Expires: ${new Date(req.expiresAt).toLocaleString()}` : ''}
                      </p>
                    </div>
                    {user?.id === secret?.ownerId && (
                      <button
                        onClick={() => handleRevokeRequest(req.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {activeTab === "access-control" && (
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Access Control Settings
            </h3>
          </div>
          {secret?.isPersonal ? (
            <p className="text-red-500">
              Personal secrets cannot use Access Control.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Minimum Approvers
                </label>
                <input
                  type="number"
                  min="1"
                  value={acConfig.minimumApproverCount}
                  onChange={(e) =>
                    setAcConfig({
                      ...acConfig,
                      minimumApproverCount: parseInt(e.target.value),
                    })
                  }
                  className="mt-1 block w-32 rounded-md border-gray-300 p-2 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Auto-Void Unanswered Requests (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  value={acConfig.autoVoidHours}
                  onChange={(e) =>
                    setAcConfig({
                      ...acConfig,
                      autoVoidHours: parseInt(e.target.value),
                    })
                  }
                  className="mt-1 block w-32 rounded-md border-gray-300 p-2 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Granted Access Duration (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  value={acConfig.grantedAccessHours}
                  onChange={(e) =>
                    setAcConfig({
                      ...acConfig,
                      grantedAccessHours: parseInt(e.target.value),
                    })
                  }
                  className="mt-1 block w-32 rounded-md border-gray-300 p-2 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Approvers
                </label>

                <div className="mt-2 flex flex-wrap gap-2 mb-2">
                  {acApprovers.map((id) => {
                    const u = orgUsers.find((user) => user.id === id);
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded text-sm"
                      >
                        <span>
                          {u ? u.email : id} {u?.id === user?.id ? "(You)" : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAcApprovers(acApprovers.filter((a) => a !== id))
                          }
                          className="hover:text-blue-900 dark:hover:text-white ml-1 font-bold"
                        >
                          &times;
                        </button>
                      </div>
                    );
                  })}
                  {acApprovers.length === 0 && (
                    <span className="text-sm text-gray-500">
                      No approvers selected.
                    </span>
                  )}
                </div>

                <select
                  value=""
                  onChange={(e) => {
                    if (
                      e.target.value &&
                      !acApprovers.includes(e.target.value)
                    ) {
                      setAcApprovers([...acApprovers, e.target.value]);
                    }
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-gray-50 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Add an approver...</option>
                  {orgUsers
                    .filter((u) => !acApprovers.includes(u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.email}
                        {u.id === user?.id ? " (You)" : ""}
                      </option>
                    ))}
                </select>
              </div>
              <button
                onClick={handleEnableAccessControl}
                className="bg-primary text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                {secret.accessControlEnabled
                  ? "Update Access Control"
                  : "Enable Access Control"}
              </button>
            </div>
          )}
        </div>
      )}

      </Tabs>
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmColor={confirmModal.confirmColor}
        onConfirm={confirmModal.onConfirm}
      />
    </div>
  );
}
