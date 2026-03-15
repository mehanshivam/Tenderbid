"use client";

import { useState, useRef, useCallback } from "react";
import {
  Building2,
  Users,
  Briefcase,
  User,
  Landmark,
  Upload,
  FileText,
  Loader2,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Plus,
  Sparkles,
  ArrowRight,
  FolderOpen,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVaultStore } from "@/store/vaultStore";
import {
  saveFile,
  saveMetadata,
  saveCompanyProfile,
} from "@/lib/vaultDB";
import {
  extractTextFromBlob,
  renderPdfPagesToImages,
} from "@/lib/extractText";
import type {
  EntityType,
  CompanyProfile,
  VaultDocumentMeta,
  VaultCategory,
} from "@/lib/types";
import { BUSINESS_DOMAINS, FOLDER_CATEGORY_MAP } from "@/lib/types";

// ─── Entity Type Config ───

const ENTITY_OPTIONS: {
  type: EntityType;
  label: string;
  icon: typeof Building2;
  docName: string;
  docHint: string;
}[] = [
  {
    type: "Partnership Firm",
    label: "Partnership Firm",
    icon: Users,
    docName: "Partnership Deed",
    docHint: "The registered deed listing all partners",
  },
  {
    type: "Private Limited",
    label: "Private Limited",
    icon: Building2,
    docName: "Certificate of Incorporation / MOA",
    docHint: "Your company registration certificate",
  },
  {
    type: "LLP",
    label: "LLP",
    icon: Briefcase,
    docName: "LLP Agreement / Certificate",
    docHint: "Your LLP incorporation certificate",
  },
  {
    type: "Proprietorship",
    label: "Proprietorship",
    icon: User,
    docName: "UDYAM / GST Certificate",
    docHint: "Your UDYAM or GST registration",
  },
  {
    type: "Society",
    label: "Society / Trust",
    icon: Landmark,
    docName: "Registration Certificate / Trust Deed",
    docHint: "Your society or trust registration document",
  },
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Chandigarh", "Puducherry",
];

// ─── Step Indicator ───

function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ["Incorporation", "Review", "PAN Card", "GST", "Reg & Finance", "Experience"];
  return (
    <div className="flex items-center gap-1 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-1">
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-all ${
              i < current
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : i === current
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40"
                  : "bg-slate-800 text-slate-600 border border-slate-700/50"
            }`}
          >
            {i < current ? <Check size={12} /> : i + 1}
          </div>
          <span
            className={`text-[10px] hidden sm:inline ${
              i === current ? "text-indigo-400" : i < current ? "text-emerald-400/70" : "text-slate-600"
            }`}
          >
            {labels[i]}
          </span>
          {i < total - 1 && (
            <div
              className={`w-6 h-px mx-1 ${
                i < current ? "bg-emerald-500/40" : "bg-slate-700/50"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───

export default function OnboardingWizard() {
  const {
    setCompanyProfile,
    setOnboardingComplete,
    setOnboardingStep,
    addDocument,
    addDocuments,
    onboardingStep,
  } = useVaultStore();

  const [step, setStep] = useState(onboardingStep);

  // Step 0 state — entity type + incorporation doc
  const [entityType, setEntityType] = useState<EntityType | "">("");
  const [uploadedFile, setUploadedFile] = useState<{
    id: string;
    name: string;
    blob: Blob;
    fileType: string;
  } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState("");

  // Step 1 state — review extracted data
  const [extractedName, setExtractedName] = useState("");
  const [extractedAddress, setExtractedAddress] = useState("");
  const [extractedPartners, setExtractedPartners] = useState<string[]>([]);
  const [newPartner, setNewPartner] = useState("");
  const [yearOfEstablishment, setYearOfEstablishment] = useState("");
  const [businessDomains, setBusinessDomains] = useState<string[]>([]);
  const [stateCity, setStateCity] = useState("");

  // Step 2 state — PAN card
  const [panFile, setPanFile] = useState<{
    id: string;
    name: string;
    blob: Blob;
    fileType: string;
  } | null>(null);
  const [extractedPan, setExtractedPan] = useState("");
  const [panExtracting, setPanExtracting] = useState(false);
  const [panError, setPanError] = useState("");
  const [panExtracted, setPanExtracted] = useState(false);
  const [panPreview, setPanPreview] = useState<string | null>(null);

  // Step 3 state — GST certificate
  const [gstFile, setGstFile] = useState<{
    id: string;
    name: string;
    blob: Blob;
    fileType: string;
  } | null>(null);
  const [extractedGstin, setExtractedGstin] = useState("");
  const [gstExtracting, setGstExtracting] = useState(false);
  const [gstError, setGstError] = useState("");
  const [gstExtracted, setGstExtracted] = useState(false);
  const [gstPreview, setGstPreview] = useState<string | null>(null);

  // Step 4/5 state — bulk uploads
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const panInputRef = useRef<HTMLInputElement>(null);
  const gstInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const bulkFolderInputRef = useRef<HTMLInputElement>(null);

  // ─── Navigation ───

  const goNext = () => {
    const next = step + 1;
    setStep(next);
    setOnboardingStep(next);
  };

  const goBack = () => {
    const prev = step - 1;
    setStep(prev);
    setOnboardingStep(prev);
  };

  // ─── Step 0: Upload Incorporation Doc & Extract ───

  const handleIncorporationUpload = async (file: File) => {
    const id = crypto.randomUUID();
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";

    setUploadedFile({ id, name: file.name, blob: file, fileType: ext });
    setExtracting(true);
    setExtractionError("");

    try {
      await saveFile(id, file, "extracting");

      const text = await extractTextFromBlob(file, ext);
      let images: string[] = [];

      // Always render PDF pages as images — scanned PDFs have garbled text layers
      // that fool the text-length check but are unreadable by AI
      if (ext === "pdf") {
        images = await renderPdfPagesToImages(file, 3);
      }

      // Handle image files (JPG/PNG scans)
      if (["jpg", "jpeg", "png"].includes(ext)) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const b64 = base64.split(",")[1];
        if (b64) images = [b64];
      }

      if (!text && images.length === 0) {
        throw new Error("Could not extract text from this document. Try a different file format.");
      }

      console.log("[Onboarding] Sending to API:", { text: text ? text.length + " chars" : "none", images: images.length + " images", imageSizes: images.map((i: string) => Math.round(i.length / 1024) + "KB") });

      const res = await fetch("/api/vault/extract-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text || undefined,
          images: images.length > 0 ? images : undefined,
          fileName: file.name,
          fileType: ext,
          entityType,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`Extraction failed: ${errBody.slice(0, 200)}`);
      }

      const data = await res.json();

      console.log("[Onboarding] Extraction result:", JSON.stringify(data));

      // Populate review fields
      setExtractedName(data.companyName || "");
      setExtractedAddress(data.registeredAddress || "");
      setExtractedPartners(data.partners || []);
      if (data.pan) setExtractedPan(data.pan);
      if (data.yearOfEstablishment) setYearOfEstablishment(String(data.yearOfEstablishment));
      if (data.stateCity) setStateCity(data.stateCity);

      setExtracting(false);
      goNext(); // → Step 1 (Review)
    } catch (err) {
      console.error("[Onboarding] Extraction failed:", err);
      setExtractionError(
        err instanceof Error ? err.message : "Extraction failed. Please try again."
      );
      setExtracting(false);
    }
  };

  // ─── Step 2: Upload PAN Card & Extract ───

  const handlePanUpload = async (file: File) => {
    const id = crypto.randomUUID();
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";

    setPanFile({ id, name: file.name, blob: file, fileType: ext });
    setPanExtracting(true);
    setPanError("");
    setPanExtracted(false);
    setPanPreview(null);

    try {
      await saveFile(id, file, "extracting");

      const text = await extractTextFromBlob(file, ext);
      let images: string[] = [];

      // PAN card — always render images (scanned docs have unreliable text)
      if (ext === "pdf") {
        images = await renderPdfPagesToImages(file, 2);
      } else if (["jpg", "jpeg", "png"].includes(ext)) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const b64 = base64.split(",")[1];
        if (b64) images = [b64];
      }

      // Set preview image (first page/image)
      if (images.length > 0) {
        const preview = images[0].startsWith("data:") ? images[0] : `data:image/jpeg;base64,${images[0]}`;
        setPanPreview(preview);
      }

      const res = await fetch("/api/vault/extract-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text || undefined,
          images: images.length > 0 ? images : undefined,
          fileName: file.name,
          fileType: ext,
          entityType,
        }),
      });

      if (!res.ok) {
        throw new Error("PAN extraction failed");
      }

      const data = await res.json();

      if (data.pan) setExtractedPan(data.pan);
      setPanExtracting(false);
      setPanExtracted(true);
    } catch (err) {
      console.error("[Onboarding] PAN extraction failed:", err);
      setPanError(
        err instanceof Error ? err.message : "Extraction failed. Please try again."
      );
      setPanExtracting(false);
    }
  };

  // ─── Step 3: Upload GST Certificate & Extract ───

  const handleGstUpload = async (file: File) => {
    const id = crypto.randomUUID();
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";

    setGstFile({ id, name: file.name, blob: file, fileType: ext });
    setGstExtracting(true);
    setGstError("");
    setGstExtracted(false);
    setGstPreview(null);

    try {
      await saveFile(id, file, "extracting");

      const text = await extractTextFromBlob(file, ext);
      let images: string[] = [];

      if (ext === "pdf") {
        images = await renderPdfPagesToImages(file, 2);
      } else if (["jpg", "jpeg", "png"].includes(ext)) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const b64 = base64.split(",")[1];
        if (b64) images = [b64];
      }

      // Set preview image (first page/image)
      if (images.length > 0) {
        const preview = images[0].startsWith("data:") ? images[0] : `data:image/jpeg;base64,${images[0]}`;
        setGstPreview(preview);
      }

      const res = await fetch("/api/vault/extract-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text || undefined,
          images: images.length > 0 ? images : undefined,
          fileName: file.name,
          fileType: ext,
          entityType,
        }),
      });

      if (!res.ok) {
        throw new Error("GST extraction failed");
      }

      const data = await res.json();

      if (data.gstin) setExtractedGstin(data.gstin);
      setGstExtracting(false);
      setGstExtracted(true);
    } catch (err) {
      console.error("[Onboarding] GST extraction failed:", err);
      setGstError(
        err instanceof Error ? err.message : "Extraction failed. Please try again."
      );
      setGstExtracting(false);
    }
  };

  // ─── Confirm & Save Profile (after GST step) ───

  const handleConfirmProfile = async () => {
    if (!uploadedFile) return;

    const profile: CompanyProfile = {
      entityType: entityType as EntityType,
      companyName: extractedName,
      yearOfEstablishment: yearOfEstablishment
        ? parseInt(yearOfEstablishment)
        : undefined,
      businessDomain: businessDomains,
      stateCity,
      pan: extractedPan,
      gstin: extractedGstin,
      registeredAddress: extractedAddress,
      partners: extractedPartners,
      turnoverHistory: [],
      totalProjects: 0,
      pastProjects: [],
      certifications: [],
      registrations: [],
      lastUpdated: new Date().toISOString(),
      onboardingDocId: uploadedFile.id,
    };

    await saveCompanyProfile(profile);
    setCompanyProfile(profile);

    // Save incorporation document as a vault doc
    const docMeta: VaultDocumentMeta = {
      id: uploadedFile.id,
      name: uploadedFile.name,
      category: "Registration Certificates",
      fileType: uploadedFile.fileType,
      fileSize: uploadedFile.blob.size,
      uploadedAt: new Date().toISOString(),
      extractionStatus: "done",
      isOnboardingDoc: true,
    };

    addDocument(docMeta);
    await saveMetadata(uploadedFile.id, {
      companyName: extractedName,
      registeredAddress: extractedAddress,
      partners: extractedPartners,
    }, "done");

    // Also save PAN file if uploaded
    if (panFile) {
      const panDocMeta: VaultDocumentMeta = {
        id: panFile.id,
        name: panFile.name,
        category: "Registration Certificates",
        fileType: panFile.fileType,
        fileSize: panFile.blob.size,
        uploadedAt: new Date().toISOString(),
        extractionStatus: "done",
        isOnboardingDoc: true,
      };
      addDocument(panDocMeta);
      await saveMetadata(panFile.id, { pan: extractedPan }, "done");
    }

    // Also save GST file if uploaded
    if (gstFile) {
      const gstDocMeta: VaultDocumentMeta = {
        id: gstFile.id,
        name: gstFile.name,
        category: "Registration Certificates",
        fileType: gstFile.fileType,
        fileSize: gstFile.blob.size,
        uploadedAt: new Date().toISOString(),
        extractionStatus: "done",
        isOnboardingDoc: true,
      };
      addDocument(gstDocMeta);
      await saveMetadata(gstFile.id, { gstin: extractedGstin }, "done");
    }

    goNext(); // → Step 4
  };

  // ─── Steps 3 & 4: Bulk Upload ───

  const handleBulkFiles = useCallback(
    async (files: FileList | File[]) => {
      setBulkUploading(true);
      const fileArr = Array.from(files);
      setBulkProgress({ done: 0, total: fileArr.length });

      const newDocs: VaultDocumentMeta[] = [];

      for (let i = 0; i < fileArr.length; i++) {
        const file = fileArr[i];
        const id = crypto.randomUUID();
        const ext = file.name.split(".").pop()?.toLowerCase() || "file";

        await saveFile(id, file, "pending");

        let category: VaultCategory = "Other";

        if ("webkitRelativePath" in file && (file as File & { webkitRelativePath: string }).webkitRelativePath) {
          const path = (file as File & { webkitRelativePath: string }).webkitRelativePath;
          const parts = path.split("/");
          if (parts.length > 1) {
            const folder = parts[parts.length - 2].toLowerCase();
            for (const [key, val] of Object.entries(FOLDER_CATEGORY_MAP)) {
              if (folder.includes(key)) {
                category = val;
                break;
              }
            }
          }
        }

        const doc: VaultDocumentMeta = {
          id,
          name: file.name,
          category,
          fileType: ext,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          extractionStatus: "pending",
        };

        newDocs.push(doc);
        setBulkProgress({ done: i + 1, total: fileArr.length });
      }

      addDocuments(newDocs);
      setBulkUploading(false);
    },
    [addDocuments]
  );

  const handleFinishOnboarding = () => {
    setOnboardingComplete(true);
    setOnboardingStep(6);
  };

  // ─── Partner chip helpers ───

  const addPartner = () => {
    if (newPartner.trim()) {
      setExtractedPartners([...extractedPartners, newPartner.trim()]);
      setNewPartner("");
    }
  };

  const removePartner = (index: number) => {
    setExtractedPartners(extractedPartners.filter((_, i) => i !== index));
  };

  // ─── Domain toggle ───

  const toggleDomain = (domain: string) => {
    setBusinessDomains((prev) =>
      prev.includes(domain)
        ? prev.filter((d) => d !== domain)
        : [...prev, domain]
    );
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 80 }, (_, i) => currentYear - i);

  const entityConfig = ENTITY_OPTIONS.find((e) => e.type === entityType);

  // ─── Render ───

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-4">
            <Sparkles size={14} className="text-indigo-400" />
            <span className="text-xs text-indigo-400 font-medium">
              Company Vault Setup
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {step === 0 && "Select entity type & upload document"}
            {step === 1 && "Review extracted company data"}
            {step === 2 && "Upload your PAN card"}
            {step === 3 && "Upload your GST certificate"}
            {step === 4 && "Upload registration & financial documents"}
            {step === 5 && "Upload experience & work orders"}
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            {step === 0 &&
              "Pick your incorporation type and upload the key document. AI will extract your company details."}
            {step === 1 &&
              "Verify the AI-extracted data. You can edit anything before confirming."}
            {step === 2 &&
              "Upload your PAN card — AI will extract your PAN number."}
            {step === 3 &&
              "Upload your GST certificate — AI will extract your GSTIN."}
            {step === 4 &&
              "These help auto-match RFP eligibility and fill financial forms."}
            {step === 5 &&
              "LOAs and experience certificates build your project portfolio."}
          </p>
        </div>

        <StepIndicator current={step} total={6} />

        {/* ═══ STEP 0: Entity Type + Upload Incorporation Doc ═══ */}
        {step === 0 && (
          <div className="space-y-5">
            {/* Entity Type */}
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Type of Entity
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ENTITY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = entityType === opt.type;
                  return (
                    <button
                      key={opt.type}
                      onClick={() => setEntityType(opt.type)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selected
                          ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300"
                          : "bg-slate-800/50 border-slate-700/40 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      <Icon size={18} className="mb-1.5" />
                      <p className="text-sm font-medium">{opt.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Upload area — only show after entity type is selected */}
            {entityType && (
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                  Upload {entityConfig?.docName || "Document"}
                </label>
                <div
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                    uploadedFile
                      ? "border-emerald-500/30 bg-emerald-500/[0.03]"
                      : "border-slate-700/50 bg-slate-800/20 hover:border-slate-600"
                  }`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files[0]) {
                      handleIncorporationUpload(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  {extracting ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={32} className="text-indigo-400 animate-spin" />
                      <p className="text-sm text-indigo-300">
                        AI is reading your document...
                      </p>
                      <p className="text-xs text-slate-500">
                        Extracting company details from {uploadedFile?.name}
                      </p>
                    </div>
                  ) : uploadedFile && extractionError ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                        <FileText size={24} className="text-red-400" />
                      </div>
                      <p className="text-sm text-white font-medium">
                        {uploadedFile.name}
                      </p>
                      <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-xs text-red-400">{extractionError}</p>
                        <Button
                          onClick={() =>
                            handleIncorporationUpload(
                              new File([uploadedFile.blob], uploadedFile.name)
                            )
                          }
                          size="sm"
                          variant="outline"
                          className="mt-2 text-xs border-red-500/30 text-red-400"
                        >
                          Retry
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center">
                        <Upload size={24} className="text-slate-500" />
                      </div>
                      <p className="text-sm text-slate-300">
                        Drop your{" "}
                        <span className="text-indigo-400 font-medium">
                          {entityConfig?.docName || "document"}
                        </span>{" "}
                        here
                      </p>
                      <p className="text-xs text-slate-600">
                        {entityConfig?.docHint} — PDF, DOCX, or image
                      </p>
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        className="mt-2 border-slate-700 text-slate-300"
                      >
                        Select File
                      </Button>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleIncorporationUpload(e.target.files[0]);
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* ═══ STEP 1: Review Incorporation Data ═══ */}
        {step === 1 && (
          <div className="space-y-4">
            {/* AI-extracted badge */}
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/[0.05] border border-emerald-500/15 rounded-xl">
              <Sparkles size={14} className="text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-300/70">
                AI extracted this from <span className="font-medium text-emerald-300">{uploadedFile?.name || "your document"}</span>. Edit anything that&apos;s wrong.
              </p>
            </div>

            {/* Warning if some fields are empty */}
            {(!extractedName && !extractedAddress && extractedPartners.length === 0) && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/[0.07] border border-amber-500/20 rounded-xl">
                <AlertCircle size={14} className="text-amber-400 shrink-0" />
                <p className="text-xs text-amber-300/70">
                  Extraction returned limited data. Please fill in the fields manually.
                </p>
              </div>
            )}

            <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-5 space-y-4">
              {/* Company Name */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">
                  Company Name
                </label>
                <input
                  type="text"
                  value={extractedName}
                  onChange={(e) => setExtractedName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/40 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              {/* Address */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">
                  Registered Address
                </label>
                <textarea
                  value={extractedAddress}
                  onChange={(e) => setExtractedAddress(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/40 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500/50 resize-none"
                />
              </div>

              {/* Partners */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 block">
                  {entityType === "Partnership Firm"
                    ? "Partners"
                    : entityType === "Proprietorship"
                      ? "Proprietor"
                      : entityType === "LLP"
                        ? "Designated Partners"
                        : "Directors"}
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {extractedPartners.map((p, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-800/80 text-slate-300 rounded-lg border border-slate-700/40"
                    >
                      {p}
                      <button
                        onClick={() => removePartner(i)}
                        className="text-slate-600 hover:text-red-400"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPartner}
                    onChange={(e) => setNewPartner(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addPartner()}
                    placeholder="Add a name..."
                    className="flex-1 px-3 py-1.5 bg-slate-900/50 border border-slate-700/40 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500/50"
                  />
                  <Button
                    onClick={addPartner}
                    size="sm"
                    variant="outline"
                    className="border-slate-700 text-slate-400 h-8"
                  >
                    <Plus size={12} />
                  </Button>
                </div>
              </div>
            </div>

            {/* Additional details — year, state, domain */}
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-5 space-y-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                Additional Details (for eligibility matching)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">
                    Year of Establishment
                  </label>
                  <select
                    value={yearOfEstablishment}
                    onChange={(e) => setYearOfEstablishment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/40 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="">Select year</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">
                    State
                  </label>
                  <select
                    value={stateCity}
                    onChange={(e) => setStateCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/40 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Business Domain */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 block">
                  Business Domain(s)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {BUSINESS_DOMAINS.map((d) => (
                    <button
                      key={d}
                      onClick={() => toggleDomain(d)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                        businessDomains.includes(d)
                          ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                          : "bg-slate-800/40 border-slate-700/30 text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={goBack}
                variant="outline"
                className="border-slate-700 text-slate-400"
              >
                <ChevronLeft size={16} />
                Back
              </Button>
              <Button
                onClick={goNext}
                disabled={!extractedName.trim() || extractedPartners.length === 0}
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white h-11"
              >
                <Check size={16} />
                Confirm & Continue
              </Button>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: PAN Card Upload ═══ */}
        {step === 2 && (
          <div className="space-y-5">
            <div
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                panFile && panExtracted
                  ? "border-emerald-500/30 bg-emerald-500/[0.03]"
                  : "border-slate-700/50 bg-slate-800/20 hover:border-slate-600"
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) {
                  handlePanUpload(e.dataTransfer.files[0]);
                }
              }}
            >
              {panExtracting ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={32} className="text-indigo-400 animate-spin" />
                  <p className="text-sm text-indigo-300">
                    AI is reading your PAN card...
                  </p>
                </div>
              ) : panFile && panExtracted ? (
                <div className="flex flex-col items-center gap-3">
                  {panPreview ? (
                    <img
                      src={panPreview}
                      alt="PAN Card Preview"
                      className="max-h-48 rounded-lg border border-slate-700/40 object-contain"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <CreditCard size={24} className="text-emerald-400" />
                    </div>
                  )}
                  <p className="text-sm text-white font-medium">
                    {panFile.name}
                  </p>
                  <p className="text-xs text-emerald-400 flex items-center gap-1">
                    <Check size={10} /> PAN extracted successfully
                  </p>
                  <button
                    onClick={() => panInputRef.current?.click()}
                    className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
                  >
                    Re-upload
                  </button>
                </div>
              ) : panFile && panError ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                    <CreditCard size={24} className="text-red-400" />
                  </div>
                  <p className="text-sm text-white">{panFile.name}</p>
                  <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-xs text-red-400">{panError}</p>
                    <Button
                      onClick={() => handlePanUpload(new File([panFile.blob], panFile.name))}
                      size="sm"
                      variant="outline"
                      className="mt-2 text-xs border-red-500/30 text-red-400"
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center">
                    <CreditCard size={24} className="text-slate-500" />
                  </div>
                  <p className="text-sm text-slate-300">
                    Drop your <span className="text-indigo-400 font-medium">PAN card</span> here
                  </p>
                  <p className="text-xs text-slate-600">
                    PDF, image (JPG/PNG), or scanned copy
                  </p>
                  <Button
                    onClick={() => panInputRef.current?.click()}
                    variant="outline"
                    className="mt-2 border-slate-700 text-slate-300"
                  >
                    Select File
                  </Button>
                </div>
              )}
            </div>

            <input
              ref={panInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handlePanUpload(e.target.files[0]);
                }
              }}
            />

            {/* Extracted PAN — editable */}
            {(panExtracted || extractedPan) && (
              <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-5">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">
                  PAN Number
                </label>
                <input
                  type="text"
                  value={extractedPan}
                  onChange={(e) => setExtractedPan(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/40 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-indigo-500/50"
                />
                {extractedPan && extractedPan.length === 10 && (
                  <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                    <Check size={10} /> Valid PAN format
                  </p>
                )}
              </div>
            )}

            {/* Option to type PAN manually if no card */}
            {!panFile && !extractedPan && (
              <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-5">
                <p className="text-xs text-slate-500 mb-2">Or enter PAN manually:</p>
                <input
                  type="text"
                  value={extractedPan}
                  onChange={(e) => setExtractedPan(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/40 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={goBack}
                variant="outline"
                className="border-slate-700 text-slate-400"
              >
                <ChevronLeft size={16} />
                Back
              </Button>
              <Button
                onClick={goNext}
                disabled={!extractedPan || extractedPan.length !== 10}
                className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-500 text-white h-11"
              >
                Continue
                <ChevronRight size={16} />
              </Button>
              <Button
                onClick={goNext}
                variant="outline"
                className="border-slate-700 text-slate-400"
              >
                Skip PAN
              </Button>
            </div>
          </div>
        )}

        {/* ═══ STEP 3: GST Certificate Upload ═══ */}
        {step === 3 && (
          <div className="space-y-5">
            <div
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                gstFile && gstExtracted
                  ? "border-emerald-500/30 bg-emerald-500/[0.03]"
                  : "border-slate-700/50 bg-slate-800/20 hover:border-slate-600"
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) {
                  handleGstUpload(e.dataTransfer.files[0]);
                }
              }}
            >
              {gstExtracting ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={32} className="text-indigo-400 animate-spin" />
                  <p className="text-sm text-indigo-300">
                    AI is reading your GST certificate...
                  </p>
                </div>
              ) : gstFile && gstExtracted ? (
                <div className="flex flex-col items-center gap-3">
                  {gstPreview ? (
                    <img
                      src={gstPreview}
                      alt="GST Certificate Preview"
                      className="max-h-48 rounded-lg border border-slate-700/40 object-contain"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <FileText size={24} className="text-emerald-400" />
                    </div>
                  )}
                  <p className="text-sm text-white font-medium">
                    {gstFile.name}
                  </p>
                  <p className="text-xs text-emerald-400 flex items-center gap-1">
                    <Check size={10} /> GSTIN extracted successfully
                  </p>
                  <button
                    onClick={() => gstInputRef.current?.click()}
                    className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
                  >
                    Re-upload
                  </button>
                </div>
              ) : gstFile && gstError ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                    <FileText size={24} className="text-red-400" />
                  </div>
                  <p className="text-sm text-white">{gstFile.name}</p>
                  <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-xs text-red-400">{gstError}</p>
                    <Button
                      onClick={() => handleGstUpload(new File([gstFile.blob], gstFile.name))}
                      size="sm"
                      variant="outline"
                      className="mt-2 text-xs border-red-500/30 text-red-400"
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center">
                    <FileText size={24} className="text-slate-500" />
                  </div>
                  <p className="text-sm text-slate-300">
                    Drop your <span className="text-indigo-400 font-medium">GST certificate</span> here
                  </p>
                  <p className="text-xs text-slate-600">
                    PDF, image (JPG/PNG), or scanned copy
                  </p>
                  <Button
                    onClick={() => gstInputRef.current?.click()}
                    variant="outline"
                    className="mt-2 border-slate-700 text-slate-300"
                  >
                    Select File
                  </Button>
                </div>
              )}
            </div>

            <input
              ref={gstInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleGstUpload(e.target.files[0]);
                }
              }}
            />

            {/* Extracted GSTIN — editable */}
            {(gstExtracted || extractedGstin) && (
              <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-5">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">
                  GSTIN
                </label>
                <input
                  type="text"
                  value={extractedGstin}
                  onChange={(e) => setExtractedGstin(e.target.value.toUpperCase())}
                  placeholder="15-digit GST number"
                  maxLength={15}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/40 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-indigo-500/50"
                />
                {extractedGstin && extractedGstin.length === 15 && (
                  <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                    <Check size={10} /> Valid GSTIN format
                  </p>
                )}
              </div>
            )}

            {/* Option to type GSTIN manually */}
            {!gstFile && !extractedGstin && (
              <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-5">
                <p className="text-xs text-slate-500 mb-2">Or enter GSTIN manually:</p>
                <input
                  type="text"
                  value={extractedGstin}
                  onChange={(e) => setExtractedGstin(e.target.value.toUpperCase())}
                  placeholder="22AAAAA0000A1Z5"
                  maxLength={15}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/40 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={goBack}
                variant="outline"
                className="border-slate-700 text-slate-400"
              >
                <ChevronLeft size={16} />
                Back
              </Button>
              <Button
                onClick={handleConfirmProfile}
                disabled={!extractedGstin || extractedGstin.length !== 15}
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white h-11"
              >
                <Check size={16} />
                Confirm & Save Profile
              </Button>
              <Button
                onClick={handleConfirmProfile}
                variant="outline"
                className="border-slate-700 text-slate-400"
              >
                Skip GST
              </Button>
            </div>
          </div>
        )}

        {/* ═══ STEP 4: Registration & Financial Documents ═══ */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                className="border border-dashed border-slate-700/50 rounded-xl p-5 text-center hover:border-slate-600 cursor-pointer transition-all"
                onClick={() => bulkFileInputRef.current?.click()}
              >
                <FileText size={24} className="text-blue-400 mx-auto mb-2" />
                <p className="text-sm text-slate-300 font-medium">
                  Registration Documents
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  GST cert, UDYAM, ISO...
                </p>
              </div>

              <div
                className="border border-dashed border-slate-700/50 rounded-xl p-5 text-center hover:border-slate-600 cursor-pointer transition-all"
                onClick={() => bulkFolderInputRef.current?.click()}
              >
                <FolderOpen size={24} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-slate-300 font-medium">
                  Financial Documents
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Balance sheets, ITR, turnover certs...
                </p>
              </div>
            </div>

            <input
              ref={bulkFileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleBulkFiles(e.target.files);
              }}
            />
            <input
              ref={bulkFolderInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleBulkFiles(e.target.files);
              }}
            />

            {bulkUploading && (
              <div className="px-4 py-3 bg-blue-500/[0.07] border border-blue-500/20 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 size={14} className="text-blue-400 animate-spin" />
                  <span className="text-xs text-blue-300">
                    Saving {bulkProgress.done} / {bulkProgress.total} files...
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1">
                  <div
                    className="bg-blue-500 h-1 rounded-full transition-all"
                    style={{
                      width: `${
                        bulkProgress.total
                          ? (bulkProgress.done / bulkProgress.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            {bulkProgress.total > 0 && !bulkUploading && (
              <div className="px-4 py-3 bg-emerald-500/[0.07] border border-emerald-500/20 rounded-xl flex items-center gap-2">
                <Check size={14} className="text-emerald-400" />
                <span className="text-xs text-emerald-300">
                  {bulkProgress.total} files saved. AI extraction will run in background.
                </span>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={goNext}
                variant="outline"
                className="border-slate-700 text-slate-400"
              >
                Skip for now
              </Button>
              <Button
                onClick={goNext}
                className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-500 text-white h-11"
              >
                Continue
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* ═══ STEP 5: Experience & Work Orders ═══ */}
        {step === 5 && (
          <div className="space-y-5">
            <div
              className="border-2 border-dashed border-slate-700/50 rounded-2xl p-8 text-center hover:border-slate-600 cursor-pointer transition-all"
              onClick={() => bulkFileInputRef.current?.click()}
            >
              <FolderOpen size={32} className="text-amber-400 mx-auto mb-3" />
              <p className="text-sm text-slate-300">
                Upload LOAs, Work Orders, and Experience Certificates
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Drop files or a folder — AI will extract project details
              </p>
              <Button
                variant="outline"
                className="mt-4 border-slate-700 text-slate-300"
              >
                Select Files
              </Button>
            </div>

            {/* Reuse hidden inputs from step 3 */}
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
              className="hidden"
              ref={bulkFileInputRef}
              onChange={(e) => {
                if (e.target.files) handleBulkFiles(e.target.files);
              }}
            />

            {bulkProgress.total > 0 && !bulkUploading && (
              <div className="px-4 py-3 bg-emerald-500/[0.07] border border-emerald-500/20 rounded-xl flex items-center gap-2">
                <Check size={14} className="text-emerald-400" />
                <span className="text-xs text-emerald-300">
                  {bulkProgress.total} files saved.
                </span>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleFinishOnboarding}
                variant="outline"
                className="border-slate-700 text-slate-400"
              >
                Skip for now
              </Button>
              <Button
                onClick={handleFinishOnboarding}
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white h-11"
              >
                <ArrowRight size={16} />
                Go to Vault
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
