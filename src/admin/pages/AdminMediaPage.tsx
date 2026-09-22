import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  Copy,
  Check,
  Eye,
  RefreshCw,
  FileImage,
  AlertCircle,
  ExternalLink,
  Calendar,
  HardDrive,
  FileType,
  X,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { Modal } from '../components/Modal.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { AlertMessage } from '../components/AlertMessage.tsx';
import { LoadingState } from '../components/LoadingState.tsx';
import { EmptyState } from '../components/EmptyState.tsx';

export interface MediaItem {
  id: string;
  filename: string;
  original_filename: string;
  storage_path: string;
  storage_url: string;
  mime_type: string;
  file_size: number | string;
  uploaded_by?: string | null;
  created_at: string;
  updated_at: string;
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function formatBytes(bytes: number | string): string {
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(num) || num <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(num) / Math.log(1024));
  return `${(num / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export const AdminMediaPage: React.FC = () => {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detail Modal State
  const [detailItem, setDetailItem] = useState<MediaItem | null>(null);
  const [detailImageError, setDetailImageError] = useState<boolean>(false);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Copy URL Feedback State
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedDetail, setCopiedDetail] = useState<boolean>(false);

  // Image load error tracking for cards
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const fetchMedia = useCallback(async () => {
    setInitialLoading(true);
    setErrorMessage(null);
    try {
      const response = await api.get<MediaItem[]>('/api/upload');
      const items = Array.isArray(response.data) ? response.data : [];
      setMediaList(items);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load media items from the server.';
      setErrorMessage(msg);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // Clean up object URL on preview change/unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle File Selection
  const handleFileChange = (file: File | null) => {
    setUploadError(null);
    if (!file) {
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      return;
    }

    // Client-side validation matching backend
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError(`File size (${formatBytes(file.size)}) exceeds the maximum 5 MB limit.`);
      return;
    }

    const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;
    const isValidType =
      ACCEPTED_IMAGE_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.includes(fileExt);

    if (!isValidType) {
      setUploadError('Unsupported file type. Allowed formats: JPEG (.jpg, .jpeg), PNG (.png), and WebP (.webp).');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Upload Action
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please choose an image file to upload.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await api.post<MediaItem>('/api/upload/image', formData);

      if (!response.success) {
        throw new Error(response.error || 'Upload failed');
      }

      const uploadedItem = response.data;
      if (uploadedItem) {
        setMediaList((prev) => [uploadedItem, ...prev]);
      } else {
        await fetchMedia();
      }

      setSuccessMessage(`Successfully uploaded "${selectedFile.name}"`);
      handleCloseUploadModal();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to upload image. Please try again.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCloseUploadModal = () => {
    setIsUploadModalOpen(false);
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Copy Public Storage URL
  const handleCopyUrl = async (url: string, id?: string) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        setCopiedDetail(true);
        setTimeout(() => setCopiedDetail(false), 2000);
      }
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        setCopiedDetail(true);
        setTimeout(() => setCopiedDetail(false), 2000);
      }
    }
  };

  // Delete Action
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await api.delete(`/api/upload/${deleteTarget.id}`);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete media item.');
      }

      setMediaList((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setSuccessMessage(`Media item "${deleteTarget.original_filename}" deleted successfully.`);
      setDeleteTarget(null);
      if (detailItem?.id === deleteTarget.id) {
        setDetailItem(null);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'An error occurred while deleting the media item.';
      setErrorMessage(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-6" id="admin-media-page">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <ImageIcon className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">Media Library</h1>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Manage portfolio media assets, project screenshots, and cover images.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            id="refresh-media-btn"
            onClick={fetchMedia}
            disabled={initialLoading}
            className="flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition disabled:opacity-50 cursor-pointer"
            title="Refresh media list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${initialLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            id="open-upload-modal-btn"
            onClick={() => {
              setUploadError(null);
              setIsUploadModalOpen(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 shadow-sm shadow-cyan-950 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {successMessage && (
        <AlertMessage
          type="success"
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {errorMessage && (
        <AlertMessage
          type="error"
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {/* Content Section */}
      {initialLoading ? (
        <LoadingState message="Loading media library..." />
      ) : mediaList.length === 0 ? (
        <EmptyState
          icon={FileImage}
          title="No media uploaded yet"
          description="Upload project images, blog thumbnails, or icons to build your portfolio asset library. Supports JPEG, PNG, and WebP up to 5 MB."
          actionLabel="Upload Image"
          onAction={() => {
            setUploadError(null);
            setIsUploadModalOpen(true);
          }}
        />
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-slate-400">
              Showing <strong className="text-slate-200">{mediaList.length}</strong> {mediaList.length === 1 ? 'asset' : 'assets'}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Max 5 MB • JPEG, PNG, WebP
            </span>
          </div>

          {/* Responsive Media Grid */}
          <div
            id="media-grid"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
          >
            {mediaList.map((item) => {
              const isBroken = brokenImages[item.id];
              const isCopied = copiedId === item.id;

              return (
                <div
                  key={item.id}
                  id={`media-card-${item.id}`}
                  className="group relative flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition shadow-xs"
                >
                  {/* Image Thumbnail Canvas */}
                  <div className="relative aspect-4/3 bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-800/80">
                    {!isBroken ? (
                      <img
                        src={item.storage_url}
                        alt={item.original_filename}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenImages((prev) => ({ ...prev, [item.id]: true }))
                        }
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-600 p-4 text-center">
                        <AlertCircle className="w-7 h-7 mb-1 text-slate-500" />
                        <span className="text-[11px] font-mono text-slate-400">Image unavailable</span>
                      </div>
                    )}

                    {/* MIME Badge */}
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-slate-900/80 backdrop-blur-xs text-[10px] font-mono text-slate-300 border border-slate-700/60 uppercase">
                      {item.mime_type.replace('image/', '')}
                    </span>

                    {/* Hover Action Overlay */}
                    <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDetailImageError(false);
                          setDetailItem(item);
                        }}
                        className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700 transition cursor-pointer"
                        title="View details"
                        aria-label="View media details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyUrl(item.storage_url, item.id)}
                        className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-cyan-400 border border-slate-700 transition cursor-pointer"
                        title={isCopied ? 'Copied URL!' : 'Copy public URL'}
                        aria-label="Copy public storage URL"
                      >
                        {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="p-2 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 transition cursor-pointer"
                        title="Delete media item"
                        aria-label="Delete media item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Card Content & Metadata */}
                  <div className="p-3 flex flex-col justify-between flex-1 gap-2">
                    <div>
                      <h3
                        className="text-xs font-semibold text-slate-200 truncate"
                        title={item.original_filename}
                      >
                        {item.original_filename}
                      </h3>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 font-mono">
                        <span>{formatBytes(item.file_size)}</span>
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                    </div>

                    {/* Footer Quick Action Toolbar */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(item.storage_url, item.id)}
                        className="text-[11px] font-medium text-slate-400 hover:text-cyan-400 flex items-center space-x-1 transition cursor-pointer"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy URL</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDetailImageError(false);
                          setDetailItem(item);
                        }}
                        className="text-[11px] font-medium text-slate-400 hover:text-slate-200 flex items-center space-x-1 transition cursor-pointer"
                      >
                        <span>Details</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={handleCloseUploadModal}
        title="Upload Image Asset"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4" id="upload-media-form">
          {uploadError && (
            <AlertMessage
              type="error"
              message={uploadError}
              onClose={() => setUploadError(null)}
            />
          )}

          {/* Drag & Drop Canvas */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[160px] ${
              isDragging
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-slate-700 bg-slate-950/60 hover:border-slate-600 hover:bg-slate-900/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              id="media-file-input"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
              className="hidden"
            />

            {previewUrl ? (
              <div className="flex flex-col items-center space-y-3">
                <div className="relative w-36 h-28 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 shadow-md">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFileChange(null);
                    }}
                    className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/80 text-slate-300 hover:text-rose-400 hover:bg-slate-900 transition"
                    title="Remove selected file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-slate-200 truncate max-w-[240px]">
                    {selectedFile?.name}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400">
                    {selectedFile ? formatBytes(selectedFile.size) : ''}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2 text-slate-400">
                <div className="p-3 rounded-full bg-slate-800/80 text-cyan-400 mb-1">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-slate-200">
                  Click to browse or drag and drop an image
                </p>
                <p className="text-[11px] text-slate-400">
                  Supports JPEG, PNG, or WebP (Max 5 MB)
                </p>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 font-mono space-y-0.5">
            <p>• Accepted formats: .jpg, .jpeg, .png, .webp</p>
            <p>• File size limit: 5 MB per image</p>
            <p>• Images will be cryptographically hashed and uploaded to secure cloud storage</p>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleCloseUploadModal}
              disabled={isUploading}
              className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-upload-btn"
              disabled={!selectedFile || isUploading}
              className="flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 shadow-sm shadow-cyan-950 transition disabled:opacity-50 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Image</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Media Details Modal */}
      {detailItem && (
        <Modal
          isOpen={!!detailItem}
          onClose={() => setDetailItem(null)}
          title="Media Asset Details"
        >
          <div className="space-y-4" id="media-detail-modal">
            {/* Image Preview Canvas */}
            <div className="relative aspect-16/9 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
              {!detailImageError ? (
                <img
                  src={detailItem.storage_url}
                  alt={detailItem.original_filename}
                  referrerPolicy="no-referrer"
                  onError={() => setDetailImageError(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 p-4">
                  <AlertCircle className="w-8 h-8 mb-2" />
                  <span className="text-xs">Preview unavailable</span>
                </div>
              )}
            </div>

            {/* Metadata Information Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1 font-mono">
                  <FileImage className="w-3.5 h-3.5 text-cyan-400" /> Original Filename
                </span>
                <p className="font-semibold text-slate-200 truncate" title={detailItem.original_filename}>
                  {detailItem.original_filename}
                </p>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1 font-mono">
                  <HardDrive className="w-3.5 h-3.5 text-cyan-400" /> File Size
                </span>
                <p className="font-semibold text-slate-200 font-mono">
                  {formatBytes(detailItem.file_size)} ({typeof detailItem.file_size === 'number' ? detailItem.file_size.toLocaleString() : detailItem.file_size} bytes)
                </p>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1 font-mono">
                  <FileType className="w-3.5 h-3.5 text-cyan-400" /> MIME Type
                </span>
                <p className="font-semibold text-slate-200 font-mono">{detailItem.mime_type}</p>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Upload Date
                </span>
                <p className="font-semibold text-slate-200">{formatDate(detailItem.created_at)}</p>
              </div>
            </div>

            {/* Public Storage URL Display & Copy */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Public Storage URL</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={detailItem.storage_url}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-hidden select-all"
                />
                <button
                  type="button"
                  id="detail-copy-url-btn"
                  onClick={() => handleCopyUrl(detailItem.storage_url)}
                  className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700 transition cursor-pointer"
                >
                  {copiedDetail ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <a
                  href={detailItem.storage_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-cyan-400 hover:bg-slate-700 border border-slate-700 transition"
                  title="Open image in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const target = detailItem;
                  setDetailItem(null);
                  setDeleteTarget(target);
                }}
                className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Asset</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Media Asset"
        message={
          deleteTarget
            ? `Are you sure you want to permanently delete "${deleteTarget.original_filename}"? This will remove the file from cloud storage and database records. Any portfolio items referencing this URL will no longer be able to display it.`
            : 'Are you sure you want to delete this media asset?'
        }
        confirmLabel="Delete Permanently"
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
      />
    </div>
  );
};
