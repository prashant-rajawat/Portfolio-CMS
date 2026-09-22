import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  MailOpen,
  Trash2,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Calendar,
  User,
  Inbox,
  Filter,
  Eye,
  Send,
  Clock,
  Check,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { Modal } from '../components/Modal.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { AlertMessage } from '../components/AlertMessage.tsx';
import { LoadingState } from '../components/LoadingState.tsx';
import { EmptyState } from '../components/EmptyState.tsx';

export interface MessageItem {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

type FilterType = 'all' | 'unread' | 'read';

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

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export const AdminMessagesPage: React.FC = () => {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [filter, setFilter] = useState<FilterType>('all');
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Message Details Modal
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<MessageItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Mark Read Loading State Map
  const [statusLoadingMap, setStatusLoadingMap] = useState<Record<string, boolean>>({});

  const fetchMessages = useCallback(async () => {
    setInitialLoading(true);
    setErrorMessage(null);
    try {
      const response = await api.get<MessageItem[]>('/api/messages');
      const raw = response as any;
      const items: MessageItem[] = Array.isArray(response.data)
        ? response.data
        : Array.isArray(raw)
        ? raw
        : [];
      setMessages(items);

      const count =
        typeof raw.unread_count === 'number'
          ? raw.unread_count
          : typeof raw.unreadCount === 'number'
          ? raw.unreadCount
          : items.filter((m) => !m.is_read).length;

      setUnreadCount(count);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load contact messages from the server.';
      setErrorMessage(msg);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Toggle Read / Unread status
  const handleToggleReadStatus = async (item: MessageItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    const nextReadState = !item.is_read;
    setStatusLoadingMap((prev) => ({ ...prev, [item.id]: true }));
    setErrorMessage(null);

    try {
      const response = await api.put<MessageItem>(`/api/messages/${item.id}/read`, {
        is_read: nextReadState,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to update message status.');
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, is_read: nextReadState } : m))
      );

      setUnreadCount((prev) => (nextReadState ? Math.max(0, prev - 1) : prev + 1));

      if (selectedMessage && selectedMessage.id === item.id) {
        setSelectedMessage({ ...selectedMessage, is_read: nextReadState });
      }

      setSuccessMessage(
        `Message from "${item.name}" marked as ${nextReadState ? 'read' : 'unread'}.`
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update message read status.';
      setErrorMessage(msg);
    } finally {
      setStatusLoadingMap((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  // Open Details Modal and auto-mark as read if unread
  const handleOpenDetails = async (item: MessageItem) => {
    setSelectedMessage(item);

    if (!item.is_read) {
      // Auto-mark as read in the background
      try {
        await api.put(`/api/messages/${item.id}/read`, { is_read: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === item.id ? { ...m, is_read: true } : m))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setSelectedMessage((prev) => (prev ? { ...prev, is_read: true } : null));
      } catch {
        // Silently continue; detail view is open
      }
    }
  };

  // Delete message confirmed
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await api.delete(`/api/messages/${deleteTarget.id}`);
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete message.');
      }

      const wasUnread = !deleteTarget.is_read;
      setMessages((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      setSuccessMessage(`Message from "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      if (selectedMessage?.id === deleteTarget.id) {
        setSelectedMessage(null);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'An error occurred while deleting the message.';
      setErrorMessage(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered message list
  const filteredMessages = messages.filter((m) => {
    if (filter === 'unread') return !m.is_read;
    if (filter === 'read') return m.is_read;
    return true;
  });

  return (
    <div className="space-y-6" id="admin-messages-page">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Inbox className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">Contact Messages</h1>
            {unreadCount > 0 && (
              <span
                id="unread-count-badge"
                className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono"
              >
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            View, read, and manage client inquiries submitted via your portfolio contact form.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            id="refresh-messages-btn"
            onClick={fetchMessages}
            disabled={initialLoading}
            className="flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition disabled:opacity-50 cursor-pointer"
            title="Refresh messages list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${initialLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
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

      {/* Filter Tabs & Counter Toolbar */}
      {!initialLoading && messages.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center space-x-1.5" role="tablist">
            <button
              type="button"
              id="filter-all-btn"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                filter === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              All ({messages.length})
            </button>
            <button
              type="button"
              id="filter-unread-btn"
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                filter === 'unread'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/30 text-cyan-200 text-[10px] font-mono">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              id="filter-read-btn"
              onClick={() => setFilter('read')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                filter === 'read'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              Read ({messages.length - unreadCount})
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono self-end sm:self-center pr-1">
            Showing <strong className="text-slate-200">{filteredMessages.length}</strong> of{' '}
            {messages.length} inquiries
          </div>
        </div>
      )}

      {/* Main Content State */}
      {initialLoading ? (
        <LoadingState message="Loading contact messages..." />
      ) : messages.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No contact messages yet"
          description="Inquiries submitted by visitors through your portfolio contact form will appear here automatically."
        />
      ) : filteredMessages.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-slate-400">
          <Filter className="w-8 h-8 mx-auto mb-2 text-slate-500" />
          <p className="text-sm font-semibold text-slate-300">
            No {filter === 'unread' ? 'unread' : 'read'} messages found
          </p>
          <p className="text-xs text-slate-500 mt-1">Try switching the filter back to "All".</p>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="mt-4 px-3.5 py-1.5 text-xs rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition cursor-pointer"
          >
            Show All Messages
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Inbox Table */}
          <div className="hidden md:block overflow-hidden bg-slate-900 border border-slate-800 rounded-xl shadow-xs">
            <table className="w-full text-left border-collapse" id="messages-table">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">Status</th>
                  <th className="py-3 px-4 w-52">Sender</th>
                  <th className="py-3 px-4">Subject & Preview</th>
                  <th className="py-3 px-4 w-36 text-right">Received</th>
                  <th className="py-3 px-4 w-28 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {filteredMessages.map((item) => {
                  const isUpdating = statusLoadingMap[item.id];
                  return (
                    <tr
                      key={item.id}
                      id={`message-row-${item.id}`}
                      onClick={() => handleOpenDetails(item)}
                      className={`group cursor-pointer transition hover:bg-slate-800/50 ${
                        !item.is_read ? 'bg-slate-800/20 font-medium' : 'text-slate-400'
                      }`}
                    >
                      {/* Read / Unread Status Indicator */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => handleToggleReadStatus(item, e)}
                          disabled={isUpdating}
                          className="p-1 rounded-md text-slate-400 hover:text-cyan-400 transition cursor-pointer"
                          title={item.is_read ? 'Mark as unread' : 'Mark as read'}
                          aria-label={item.is_read ? 'Mark as unread' : 'Mark as read'}
                        >
                          {!item.is_read ? (
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-xs shadow-cyan-400 ring-2 ring-cyan-500/30" />
                          ) : (
                            <MailOpen className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
                          )}
                        </button>
                      </td>

                      {/* Sender Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span
                            className={`truncate max-w-[190px] ${
                              !item.is_read ? 'text-slate-100 font-semibold' : 'text-slate-300'
                            }`}
                          >
                            {item.name}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 truncate max-w-[190px]">
                            {item.email}
                          </span>
                        </div>
                      </td>

                      {/* Subject & Preview */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`truncate max-w-[200px] ${
                              !item.is_read ? 'text-slate-200 font-semibold' : 'text-slate-300'
                            }`}
                          >
                            {item.subject}
                          </span>
                          <span className="text-slate-600 hidden lg:inline">—</span>
                          <span className="text-slate-400 truncate max-w-[280px] hidden lg:inline">
                            {item.message}
                          </span>
                        </div>
                      </td>

                      {/* Received Date */}
                      <td className="py-3.5 px-4 text-right text-slate-400 font-mono whitespace-nowrap text-[11px]">
                        <span title={formatDate(item.created_at)}>
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </td>

                      {/* Row Action Toolbar */}
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition cursor-pointer"
                            title="View full message"
                            aria-label="View message details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleToggleReadStatus(item, e)}
                            disabled={isUpdating}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition cursor-pointer"
                            title={item.is_read ? 'Mark as unread' : 'Mark as read'}
                            aria-label={item.is_read ? 'Mark as unread' : 'Mark as read'}
                          >
                            {item.is_read ? (
                              <Mail className="w-4 h-4" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Delete message"
                            aria-label="Delete message"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Message Cards (xs/sm screen layout) */}
          <div className="md:hidden space-y-3" id="messages-mobile-list">
            {filteredMessages.map((item) => {
              const isUpdating = statusLoadingMap[item.id];
              return (
                <div
                  key={item.id}
                  id={`mobile-message-card-${item.id}`}
                  onClick={() => handleOpenDetails(item)}
                  className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3 cursor-pointer ${
                    !item.is_read
                      ? 'bg-slate-900 border-cyan-500/40 shadow-xs'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400'
                  }`}
                >
                  {/* Top Row: Sender & Status Pill */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      {!item.is_read && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-xs ring-2 ring-cyan-500/30 flex-shrink-0" />
                      )}
                      <div>
                        <h3
                          className={`text-xs font-semibold ${
                            !item.is_read ? 'text-slate-100' : 'text-slate-300'
                          }`}
                        >
                          {item.name}
                        </h3>
                        <p className="text-[11px] font-mono text-slate-400 truncate max-w-[200px]">
                          {item.email}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>

                  {/* Subject & Snippet */}
                  <div className="space-y-1">
                    <h4
                      className={`text-xs ${
                        !item.is_read ? 'text-slate-200 font-semibold' : 'text-slate-300'
                      }`}
                    >
                      {item.subject}
                    </h4>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                  </div>

                  {/* Bottom Actions Row */}
                  <div
                    className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={(e) => handleToggleReadStatus(item, e)}
                      disabled={isUpdating}
                      className="text-[11px] font-medium text-slate-400 hover:text-cyan-400 flex items-center space-x-1.5 transition py-1 cursor-pointer"
                    >
                      {item.is_read ? (
                        <>
                          <Mail className="w-3.5 h-3.5" />
                          <span>Mark Unread</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-cyan-400 font-semibold">Mark Read</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(item)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                        title="View details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                        title="Delete message"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Message Details Modal */}
      {selectedMessage && (
        <Modal
          isOpen={!!selectedMessage}
          onClose={() => setSelectedMessage(null)}
          title="Message Details"
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs" id="message-detail-modal">
            {/* Header / Sender Card */}
            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-sm">
                    {selectedMessage.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-100">{selectedMessage.name}</h3>
                    <a
                      href={`mailto:${selectedMessage.email}`}
                      className="text-[11px] font-mono text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      {selectedMessage.email}
                      <ExternalLink className="w-3 h-3 inline opacity-70" />
                    </a>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{formatDate(selectedMessage.created_at)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-400">Subject:</span>
                  <strong className="text-slate-200">{selectedMessage.subject}</strong>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                    selectedMessage.is_read
                      ? 'bg-slate-800 text-slate-400'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}
                >
                  {selectedMessage.is_read ? 'Read' : 'Unread'}
                </span>
              </div>
            </div>

            {/* Complete, non-truncated message content */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Message Body</label>
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-slate-200 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto font-sans text-xs select-text">
                {selectedMessage.message}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="flex items-center space-x-2">
                <a
                  href={`mailto:${selectedMessage.email}?subject=Re: ${encodeURIComponent(
                    selectedMessage.subject
                  )}`}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition shadow-xs cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Reply by Email</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleToggleReadStatus(selectedMessage)}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition cursor-pointer"
                >
                  {selectedMessage.is_read ? (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      <span>Mark as Unread</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Mark as Read</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center space-x-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedMessage;
                    setSelectedMessage(null);
                    setDeleteTarget(target);
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                  Delete
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMessage(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Contact Message"
        message={
          deleteTarget
            ? `Are you sure you want to permanently delete the inquiry from "${deleteTarget.name}" (${deleteTarget.email}) regarding "${deleteTarget.subject}"? This action cannot be undone.`
            : 'Are you sure you want to delete this message?'
        }
        confirmLabel="Delete Permanently"
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
      />
    </div>
  );
};
