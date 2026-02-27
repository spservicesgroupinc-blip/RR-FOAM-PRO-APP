import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Send, Trash2, Mail, MailOpen, FileText, Upload, X,
  Megaphone, MessageSquare, Paperclip, Loader2, ChevronDown,
  AlertCircle, CheckCircle2, RefreshCw
} from 'lucide-react';
import { CrewMessage, CrewMessageType } from '../types';
import {
  sendCrewMessage,
  getAdminMessages,
  deleteCrewMessage,
} from '../services/messagingService';

interface CrewMessagingProps {
  organizationId: string;
  userId: string;
  userName: string;
}

export const CrewMessaging: React.FC<CrewMessagingProps> = ({
  organizationId,
  userId,
  userName,
}) => {
  // ── State ──
  const [messages, setMessages] = useState<CrewMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Compose form
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [messageType, setMessageType] = useState<CrewMessageType>('text');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load Messages ──
  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAdminMessages(organizationId);
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Auto-clear notifications
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  // ── Send ──
  const handleSend = async () => {
    if (!subject.trim()) {
      setNotification({ type: 'error', text: 'Subject is required.' });
      return;
    }

    setIsSending(true);
    try {
      const msg = await sendCrewMessage(
        organizationId,
        userId,
        userName,
        subject.trim(),
        body.trim(),
        messageType,
        selectedFile || undefined
      );

      if (msg) {
        setMessages(prev => [msg, ...prev]);
        resetCompose();
        setNotification({ type: 'success', text: 'Message sent to crew!' });
      } else {
        setNotification({ type: 'error', text: 'Failed to send. Try again.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Send failed.' });
    } finally {
      setIsSending(false);
    }
  };

  const resetCompose = () => {
    setSubject('');
    setBody('');
    setMessageType('text');
    setSelectedFile(null);
    setShowCompose(false);
  };

  // ── Delete ──
  const handleDelete = async (msgId: string) => {
    if (!confirm('Delete this message? Crew will no longer see it.')) return;
    const success = await deleteCrewMessage(organizationId, msgId);
    if (success) {
      setMessages(prev => prev.filter(m => m.id !== msgId));
      setNotification({ type: 'success', text: 'Message deleted.' });
    } else {
      setNotification({ type: 'error', text: 'Failed to delete.' });
    }
  };

  // ── File Handling ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        setNotification({ type: 'error', text: 'File must be under 10MB.' });
        return;
      }
      setSelectedFile(file);
      setMessageType('document');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // ── Stats ──
  const totalMessages = messages.length;
  const readCount = messages.filter(m => m.isRead).length;
  const unreadCount = totalMessages - readCount;

  // ── Helpers ──
  const typeIcon = (t: CrewMessageType) => {
    switch (t) {
      case 'announcement': return <Megaphone className="w-4 h-4 text-amber-500" />;
      case 'document': return <FileText className="w-4 h-4 text-sky-500" />;
      default: return <MessageSquare className="w-4 h-4 text-slate-400" />;
    }
  };

  const typeLabel = (t: CrewMessageType) => {
    switch (t) {
      case 'announcement': return 'Announcement';
      case 'document': return 'Document';
      default: return 'Message';
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-16 right-4 md:top-8 md:right-8 z-[60] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-top-5 duration-300 ${
          notification.type === 'success'
            ? 'bg-slate-900 border-slate-800 text-white'
            : 'bg-red-50 border-red-100 text-red-600'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-bold text-sm">{notification.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Crew Messages</h1>
          <p className="text-sm text-slate-500 mt-1">Send messages and documents to your crew</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadMessages}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-brand hover:bg-red-700 transition-all shadow-lg shadow-red-200/50 active:scale-95"
          >
            <Send className="w-4 h-4" />
            New Message
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="text-2xl font-black text-slate-900">{totalMessages}</div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Total Sent</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="text-2xl font-black text-emerald-600">{readCount}</div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Read</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="text-2xl font-black text-amber-600">{unreadCount}</div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Unread</div>
        </div>
      </div>

      {/* ── Compose Modal ── */}
      {showCompose && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4" onClick={() => !isSending && resetCompose()}>
          <div className="bg-white md:rounded-3xl rounded-t-3xl p-6 w-full md:max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Drag handle on mobile */}
            <div className="md:hidden w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
            
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Compose Message</h3>
              <button onClick={() => !isSending && resetCompose()} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200 active:scale-90 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Message Type Selector */}
            <div className="flex gap-2 mb-4">
              {(['text', 'announcement', 'document'] as CrewMessageType[]).map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setMessageType(t);
                    if (t !== 'document') setSelectedFile(null);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    messageType === t
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {typeIcon(t)}
                  {typeLabel(t)}
                </button>
              ))}
            </div>

            {/* Subject */}
            <input
              type="text"
              placeholder="Subject *"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand mb-3"
              autoFocus
            />

            {/* Body */}
            <textarea
              placeholder="Message body..."
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand resize-none mb-3"
            />

            {/* File Upload (document type) */}
            {messageType === 'document' && (
              <div className="mb-4">
                {selectedFile ? (
                  <div className="flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
                    <FileText className="w-5 h-5 text-sky-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{selectedFile.name}</div>
                      <div className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</div>
                    </div>
                    <button onClick={() => setSelectedFile(null)} className="p-1 text-slate-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-brand hover:text-brand transition-colors"
                  >
                    <Upload className="w-5 h-5" />
                    <span className="font-bold text-sm">Attach Document (max 10MB)</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
                  onChange={handleFileSelect}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => !isSending && resetCompose()}
                disabled={isSending}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={isSending || !subject.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-brand hover:bg-red-700 transition-all shadow-lg shadow-red-200/50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="w-4 h-4" /> Send to Crew</>
                )}
              </button>
            </div>

            {/* Safe area padding on mobile */}
            <div className="md:hidden h-[env(safe-area-inset-bottom)]" />
          </div>
        </div>
      )}

      {/* ── Messages List ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-3" />
          <span className="font-semibold">Loading messages...</span>
        </div>
      ) : messages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">No Messages Yet</h3>
          <p className="text-sm text-slate-500 mb-6">Send your first message to keep crew informed.</p>
          <button
            onClick={() => setShowCompose(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-brand hover:bg-red-700 transition-all shadow-lg shadow-red-200/50 active:scale-95"
          >
            <Send className="w-4 h-4" />
            Compose Message
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map(msg => (
            <div
              key={msg.id}
              className="bg-white rounded-2xl border border-slate-100 hover:border-slate-200 p-4 transition-all group"
            >
              <div className="flex items-start gap-3">
                {/* Type Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  msg.messageType === 'announcement' ? 'bg-amber-50' :
                  msg.messageType === 'document' ? 'bg-sky-50' : 'bg-slate-100'
                }`}>
                  {typeIcon(msg.messageType)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-slate-900 truncate">{msg.subject}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      msg.messageType === 'announcement' ? 'bg-amber-100 text-amber-700' :
                      msg.messageType === 'document' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {typeLabel(msg.messageType)}
                    </span>
                  </div>

                  {msg.body && (
                    <p className="text-sm text-slate-600 line-clamp-2 mb-2">{msg.body}</p>
                  )}

                  {/* Document Link */}
                  {msg.documentUrl && msg.documentName && (
                    <a
                      href={msg.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-bold text-sky-600 bg-sky-50 px-3 py-1.5 rounded-lg hover:bg-sky-100 transition-colors mb-2"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      {msg.documentName}
                    </a>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{formatDate(msg.createdAt)}</span>
                    <span className="flex items-center gap-1">
                      {msg.isRead ? (
                        <><MailOpen className="w-3 h-3 text-emerald-500" /><span className="text-emerald-600 font-semibold">Read</span></>
                      ) : (
                        <><Mail className="w-3 h-3 text-amber-500" /><span className="text-amber-600 font-semibold">Unread</span></>
                      )}
                    </span>
                    {msg.readAt && (
                      <span className="text-slate-400">Read {formatDate(msg.readAt)}</span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(msg.id)}
                  className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                  title="Delete message"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
