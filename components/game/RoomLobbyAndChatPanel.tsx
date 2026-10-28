'use client';

import React, { useState, useRef, useEffect } from 'react';
import type {
  ChatMessageItem,
  PieceColor,
  RoomStateSnapshot,
  RoomVisibility,
  TimeControlPreset,
  YourRoleInRoom,
} from '../../types/chess.ts';
import { TIME_CONTROL_PRESETS } from '../../types/chess.ts';
import {
  Copy,
  Check,
  Send,
  Users,
  Link2,
  Play,
  RefreshCw,
  LogOut,
  MessageSquare,
  Lock,
  Globe,
  XCircle,
} from 'lucide-react';

interface WaitingRoomSummary {
  roomCode: string;
  hostName: string;
  hostColor: PieceColor;
  timeControl: TimeControlPreset;
  createdAt: number;
}

interface RoomLobbyAndChatPanelProps {
  socketConnected: boolean;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  selectedTimeControl: TimeControlPreset;
  onSelectTimeControl: (tc: TimeControlPreset) => void;
  preferredColor: 'w' | 'b' | 'random';
  onSelectPreferredColor: (c: 'w' | 'b' | 'random') => void;
  roomVisibility?: RoomVisibility;
  onSelectRoomVisibility?: (v: RoomVisibility) => void;
  joinCodeInput: string;
  onJoinCodeInputChange: (code: string) => void;
  waitingRooms: WaitingRoomSummary[];
  onCreateRoom: () => void;
  onJoinRoomByCode: (code: string) => void;
  onRefreshLobby: () => void;
  activeRoom: RoomStateSnapshot | null;
  myRole: YourRoleInRoom;
  onReadyToStart: () => void;
  onRematch: () => void;
  onLeaveRoom: () => void;
  onCancelRoom?: () => void;
  onSendChat: (message: string) => void;
  errorBanner: string | null;
}

export default function RoomLobbyAndChatPanel({
  socketConnected,
  playerName,
  onPlayerNameChange,
  selectedTimeControl,
  onSelectTimeControl,
  preferredColor,
  onSelectPreferredColor,
  roomVisibility = 'public',
  onSelectRoomVisibility,
  joinCodeInput,
  onJoinCodeInputChange,
  waitingRooms,
  onCreateRoom,
  onJoinRoomByCode,
  onRefreshLobby,
  activeRoom,
  myRole,
  onReadyToStart,
  onRematch,
  onLeaveRoom,
  onCancelRoom,
  onSendChat,
  errorBanner,
}: RoomLobbyAndChatPanelProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [activeRoom?.chatMessages.length]);

  const handleCopyCode = async () => {
    if (!activeRoom) return;
    try {
      await navigator.clipboard.writeText(activeRoom.roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleCopyInviteLink = async () => {
    if (!activeRoom || typeof window === 'undefined') return;
    const url = `${window.location.origin}/?room=${activeRoom.roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput.trim());
    setChatInput('');
  };

  if (!activeRoom) {
    return (
      <div className="flex flex-col gap-3.5 bg-[#221D19] border border-[#38251C] rounded-xl p-4">
        <div className="flex items-center justify-between border-b border-[#38251C] pb-2.5">
          <div>
            <h3 className="text-base font-semibold text-[#F2E9DC] font-serif">
              Room Multiplayer & Kode Undangan
            </h3>
            <p className="text-xs text-[#B5A695]">
              Buat room privat/publik atau gabung dengan kode 6 karakter
            </p>
          </div>
          <span className="text-xs font-mono text-[#C7A66A] whitespace-nowrap">
            {socketConnected ? 'Server Aktif' : 'Menghubungkan...'}
          </span>
        </div>

        {errorBanner && (
          <div className="p-2.5 rounded-lg bg-[#3A1818] border border-[#D9534F] text-xs text-[#F2E9DC]">
            {errorBanner}
          </div>
        )}

        {/* Player Display Name */}
        <div>
          <label className="block text-xs font-medium text-[#E7D5B5] mb-1">
            Nama Pemain Anda
          </label>
          <input
            type="text"
            maxLength={24}
            value={playerName}
            onChange={(e) => onPlayerNameChange(e.target.value)}
            placeholder="Masukkan nama tampilan..."
            className="w-full px-3 py-1.5 rounded-lg bg-[#171513] border border-[#38251C] text-sm text-[#F2E9DC] placeholder-[#B5A695]/50 focus:outline-none focus:border-[#C7A66A]"
          />
        </div>

        {/* Time Control Selector */}
        <div>
          <label className="block text-xs font-medium text-[#E7D5B5] mb-1">
            Kontrol Waktu Pertandingan
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(TIME_CONTROL_PRESETS) as TimeControlPreset[]).map((tcKey) => {
              const preset = TIME_CONTROL_PRESETS[tcKey];
              const active = selectedTimeControl === tcKey;
              return (
                <button
                  key={tcKey}
                  type="button"
                  onClick={() => onSelectTimeControl(tcKey)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap truncate ${
                    active
                      ? 'bg-[#C7A66A] text-[#171513] border-[#C7A66A] font-semibold'
                      : 'bg-[#171513] text-[#F2E9DC]/90 border-[#38251C] hover:border-[#79543A]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preferred Color & Visibility */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-[#E7D5B5] mb-1">
              Pilihan Sisi
            </label>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'w' as const, label: 'Putih' },
                { id: 'random' as const, label: 'Acak' },
                { id: 'b' as const, label: 'Hitam' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelectPreferredColor(opt.id)}
                  className={`py-1.5 px-1.5 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap ${
                    preferredColor === opt.id
                      ? 'bg-[#38251C] text-[#C7A66A] border-[#C7A66A] font-semibold'
                      : 'bg-[#171513] text-[#B5A695] border-[#38251C] hover:text-[#F2E9DC]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#E7D5B5] mb-1">
              Visibilitas Room
            </label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => onSelectRoomVisibility?.('public')}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap ${
                  roomVisibility === 'public'
                    ? 'bg-[#38251C] text-[#C7A66A] border-[#C7A66A] font-semibold'
                    : 'bg-[#171513] text-[#B5A695] border-[#38251C] hover:text-[#F2E9DC]'
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>Publik</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectRoomVisibility?.('private')}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap ${
                  roomVisibility === 'private'
                    ? 'bg-[#38251C] text-[#C7A66A] border-[#C7A66A] font-semibold'
                    : 'bg-[#171513] text-[#B5A695] border-[#38251C] hover:text-[#F2E9DC]'
                }`}
              >
                <Lock className="w-3 h-3" />
                <span>Privat</span>
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={!socketConnected}
          onClick={onCreateRoom}
          className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold bg-[#C7A66A] text-[#171513] hover:bg-[#d4b67d] disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          Buat Room {roomVisibility === 'private' ? 'Privat' : 'Publik'} & Dapatkan Kode Undangan
        </button>

        {/* Join by Code */}
        <div className="border-t border-[#38251C] pt-2.5">
          <label className="block text-xs font-medium text-[#E7D5B5] mb-1">
            Gabung Room dengan Kode Undangan
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (joinCodeInput.trim()) {
                onJoinRoomByCode(joinCodeInput.trim());
              }
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              maxLength={8}
              value={joinCodeInput}
              onChange={(e) => onJoinCodeInputChange(e.target.value.toUpperCase())}
              placeholder="Contoh: K7M9P2"
              className="flex-1 px-3 py-1.5 rounded-lg bg-[#171513] border border-[#38251C] font-mono uppercase tracking-widest text-sm text-[#F2E9DC] placeholder-[#B5A695]/40 focus:outline-none focus:border-[#C7A66A]"
            />
            <button
              type="submit"
              disabled={!socketConnected || joinCodeInput.trim().length < 4}
              className="py-1.5 px-3.5 rounded-lg text-xs font-semibold bg-[#38251C] text-[#F2E9DC] hover:bg-[#79543A] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
            >
              Gabung Room
            </button>
          </form>
        </div>

        {/* Live Waiting Rooms List */}
        <div className="border-t border-[#38251C] pt-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-[#E7D5B5]">
              Room Publik Terbuka ({waitingRooms.length})
            </span>
            <button
              type="button"
              onClick={onRefreshLobby}
              className="inline-flex items-center gap-1 text-xs text-[#B5A695] hover:text-[#C7A66A] transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Segarkan</span>
            </button>
          </div>

          {waitingRooms.length === 0 ? (
            <div className="p-2.5 rounded-lg bg-[#171513] border border-[#38251C] text-xs text-[#B5A695]/80 text-center">
              Belum ada room publik yang menunggu lawan. Buat room di atas atau bagikan kode privat ke teman!
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto">
              {waitingRooms.map((r) => (
                <div
                  key={r.roomCode}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#171513] border border-[#38251C]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#F2E9DC]">
                      <span className="font-mono text-[#C7A66A]">{r.roomCode}</span>
                      <span>·</span>
                      <span className="truncate">{r.hostName}</span>
                    </div>
                    <div className="text-[11px] text-[#B5A695]">
                      {TIME_CONTROL_PRESETS[r.timeControl]?.label || r.timeControl} · Host{' '}
                      {r.hostColor === 'w' ? 'Putih' : 'Hitam'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onJoinRoomByCode(r.roomCode)}
                    className="py-1.5 px-3 rounded text-xs font-semibold bg-[#C7A66A] text-[#171513] hover:bg-[#d4b67d] transition-colors whitespace-nowrap shrink-0"
                  >
                    Masuk
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active Room View
  const bothSeated = Boolean(activeRoom.whitePlayer && activeRoom.blackPlayer);
  const canStartMatch =
    activeRoom.status === 'waiting' && bothSeated && myRole !== 'spectator';

  return (
    <div className="flex flex-col gap-3 bg-[#221D19] border border-[#38251C] rounded-xl p-4">
      {/* Room Header & Invite Controls */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#38251C]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#B5A695]">Kode Room:</span>
            <span className="font-mono text-base font-bold tracking-wider text-[#C7A66A]">
              {activeRoom.roomCode}
            </span>
            <span className="text-xs text-[#B5A695]">
              · {activeRoom.visibility === 'private' ? 'Privat' : 'Publik'} ·{' '}
              {TIME_CONTROL_PRESETS[activeRoom.timeControl]?.label}
            </span>
          </div>
          <div className="text-xs text-[#B5A695] mt-0.5 flex items-center gap-2">
            <span>
              Peran Anda:{' '}
              <strong className="text-[#F2E9DC]">
                {myRole === 'w'
                  ? 'Pemain Putih'
                  : myRole === 'b'
                  ? 'Pemain Hitam'
                  : 'Penonton'}
              </strong>
            </span>
            {activeRoom.spectatorCount > 0 && (
              <span className="inline-flex items-center gap-1">
                · <Users className="w-3 h-3" /> {activeRoom.spectatorCount} penonton
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {activeRoom.status === 'waiting' && !bothSeated && onCancelRoom && (
            <button
              type="button"
              onClick={onCancelRoom}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-[#3A1818] text-[#F2E9DC] hover:bg-[#522222] border border-[#D9534F] transition-colors whitespace-nowrap shrink-0"
              title="Batalkan & Tutup Room"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Batalkan</span>
            </button>
          )}
          <button
            type="button"
            onClick={onLeaveRoom}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-[#171513] text-[#B5A695] hover:text-[#F2E9DC] border border-[#38251C] transition-colors whitespace-nowrap shrink-0"
            title="Keluar dari Room"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </div>

      {/* Share Code & Invite Link Bar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopyCode}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium bg-[#171513] text-[#F2E9DC] border border-[#38251C] hover:border-[#C7A66A] transition-colors whitespace-nowrap"
        >
          {copiedCode ? (
            <Check className="w-3.5 h-3.5 text-[#C7A66A]" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-[#C7A66A]" />
          )}
          <span>{copiedCode ? 'Kode Tersalin!' : `Salin Kode (${activeRoom.roomCode})`}</span>
        </button>

        <button
          type="button"
          onClick={handleCopyInviteLink}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium bg-[#171513] text-[#F2E9DC] border border-[#38251C] hover:border-[#C7A66A] transition-colors whitespace-nowrap"
        >
          {copiedLink ? (
            <Check className="w-3.5 h-3.5 text-[#C7A66A]" />
          ) : (
            <Link2 className="w-3.5 h-3.5 text-[#C7A66A]" />
          )}
          <span>{copiedLink ? 'Tautan Tersalin!' : 'Salin Tautan Undangan'}</span>
        </button>
      </div>

      {errorBanner && (
        <div className="p-2.5 rounded-lg bg-[#3A1818] border border-[#D9534F] text-xs text-[#F2E9DC]">
          {errorBanner}
        </div>
      )}

      {/* Waiting / Ready / Finished Status Callout */}
      {activeRoom.status === 'waiting' && (
        <div className="p-3 rounded-lg bg-[#171513] border border-[#79543A] flex flex-col gap-2">
          {!bothSeated ? (
            <p className="text-xs text-[#E7D5B5]">
              Menunggu pemain kedua bergabung ke room <strong>{activeRoom.roomCode}</strong>. Bagikan kode atau buka tautan undangan di perangkat teman!
            </p>
          ) : canStartMatch ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#F2E9DC]">
                Kedua pemain sudah terhubung ({activeRoom.whitePlayer?.displayName} vs{' '}
                {activeRoom.blackPlayer?.displayName}). Siap bertanding!
              </span>
              <button
                type="button"
                onClick={onReadyToStart}
                className="inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg text-xs font-semibold bg-[#C7A66A] text-[#171513] hover:bg-[#d4b67d] transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Terima & Mulai Pertandingan</span>
              </button>
            </div>
          ) : (
            <p className="text-xs text-[#C7A66A]">
              Menunggu pemain memulai pertandingan...
            </p>
          )}
        </div>
      )}

      {(activeRoom.status === 'finished' || activeRoom.status === 'abandoned') && (
        <div className="p-3 rounded-lg bg-[#2D241B] border border-[#C7A66A] flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-[#C7A66A]">
              Pertandingan Selesai ({activeRoom.result || 'Remis'})
            </div>
            <div className="text-xs text-[#F2E9DC]">
              {activeRoom.winnerColor === 'w'
                ? 'Putih Menang'
                : activeRoom.winnerColor === 'b'
                ? 'Hitam Menang'
                : 'Hasil Remis (Draw)'}{' '}
              · {activeRoom.terminationReason}
            </div>
          </div>
          {myRole !== 'spectator' && (
            <button
              type="button"
              onClick={onRematch}
              className="py-2 px-3.5 rounded-lg text-xs font-semibold bg-[#C7A66A] text-[#171513] hover:bg-[#d4b67d] transition-colors whitespace-nowrap shrink-0"
            >
              Tanding Ulang
            </button>
          )}
        </div>
      )}

      {/* Room Chat & Event Feed */}
      <div className="flex flex-col flex-1 min-h-[150px] max-h-[210px]">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[#E7D5B5] mb-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-[#C7A66A]" />
          <span>Log Room & Chat Pertandingan</span>
        </div>

        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto rounded-lg bg-[#171513] border border-[#38251C] p-2.5 space-y-1.5 text-xs"
        >
          {activeRoom.chatMessages.map((msg: ChatMessageItem) => (
            <div key={msg.id} className="leading-relaxed">
              {msg.senderColor === 'system' ? (
                <span className="text-[#C7A66A]">[Sistem] {msg.message}</span>
              ) : (
                <div>
                  <span className="font-semibold text-[#F2E9DC]">
                    {msg.senderName} ({msg.senderColor === 'w' ? 'Putih' : 'Hitam'}):{' '}
                  </span>
                  <span className="text-[#E7D5B5]">{msg.message}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleChatSubmit} className="mt-2 flex items-center gap-1.5">
          <input
            type="text"
            maxLength={240}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Kirim pesan ke room..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-[#171513] border border-[#38251C] text-xs text-[#F2E9DC] placeholder-[#B5A695]/40 focus:outline-none focus:border-[#C7A66A]"
          />
          <button
            type="submit"
            className="p-2 rounded-lg bg-[#38251C] text-[#F2E9DC] hover:bg-[#79543A] transition-colors shrink-0"
            title="Kirim Pesan"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
