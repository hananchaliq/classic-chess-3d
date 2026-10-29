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
  themeMode?: 'light' | 'dark';
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
  themeMode = 'dark',
}: RoomLobbyAndChatPanelProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const isLight = themeMode === 'light';

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
      <div
        className={`flex flex-col gap-3.5 rounded-xl border-2 p-4 transition-colors ${
          isLight
            ? 'bg-[#BEB5A9] border-[#A78D78] text-[#291C0E]'
            : 'bg-[#6E473B] border-[#A78D78] text-[#E1D4C2]'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#A78D78] pb-2.5">
          <div>
            <h3 className="text-base font-bold font-serif">
              Room Multiplayer & Kode Undangan
            </h3>
            <p
              className={`text-xs ${
                isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'
              }`}
            >
              Buat room privat/publik atau gabung dengan kode 6 karakter
            </p>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-xs font-mono font-bold whitespace-nowrap border ${
              isLight
                ? 'bg-[#291C0E] text-[#E1D4C2] border-[#6E473B]'
                : 'bg-[#291C0E] text-[#E1D4C2] border-[#A78D78]'
            }`}
          >
            {socketConnected ? 'Server Aktif' : 'Menghubungkan...'}
          </span>
        </div>

        {errorBanner && (
          <div className="p-2.5 rounded-lg bg-[#291C0E] border-2 border-[#E1D4C2] text-xs text-[#E1D4C2] font-semibold">
            {errorBanner}
          </div>
        )}

        {/* Player Display Name */}
        <div>
          <label className="block text-xs font-bold mb-1">
            Nama Pemain Anda
          </label>
          <input
            type="text"
            maxLength={24}
            value={playerName}
            onChange={(e) => onPlayerNameChange(e.target.value)}
            placeholder="Masukkan nama tampilan..."
            className={`w-full px-3 py-1.5 rounded-lg border-2 text-sm focus:outline-none ${
              isLight
                ? 'bg-[#E1D4C2] border-[#A78D78] text-[#291C0E] placeholder-[#6E473B]/60 focus:border-[#291C0E]'
                : 'bg-[#291C0E] border-[#A78D78] text-[#E1D4C2] placeholder-[#BEB5A9]/50 focus:border-[#E1D4C2]'
            }`}
          />
        </div>

        {/* Time Control Selector */}
        <div>
          <label className="block text-xs font-bold mb-1">
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
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap truncate ${
                    active
                      ? isLight
                        ? 'bg-[#6E473B] text-[#E1D4C2] border-[#291C0E] font-bold'
                        : 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] font-bold'
                      : isLight
                      ? 'bg-[#E1D4C2] text-[#291C0E] border-[#A78D78] hover:bg-[#A78D78]'
                      : 'bg-[#291C0E] text-[#E1D4C2] border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E]'
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
            <label className="block text-xs font-bold mb-1">
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
                  className={`py-1.5 px-1.5 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                    preferredColor === opt.id
                      ? isLight
                        ? 'bg-[#291C0E] text-[#E1D4C2] border-[#6E473B] font-bold'
                        : 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] font-bold'
                      : isLight
                      ? 'bg-[#E1D4C2] text-[#291C0E] border-[#A78D78] hover:bg-[#A78D78]'
                      : 'bg-[#291C0E] text-[#BEB5A9] border-[#A78D78] hover:text-[#E1D4C2]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">
              Visibilitas Room
            </label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => onSelectRoomVisibility?.('public')}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                  roomVisibility === 'public'
                    ? isLight
                      ? 'bg-[#291C0E] text-[#E1D4C2] border-[#6E473B] font-bold'
                      : 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] font-bold'
                    : isLight
                    ? 'bg-[#E1D4C2] text-[#291C0E] border-[#A78D78] hover:bg-[#A78D78]'
                    : 'bg-[#291C0E] text-[#BEB5A9] border-[#A78D78] hover:text-[#E1D4C2]'
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>Publik</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectRoomVisibility?.('private')}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                  roomVisibility === 'private'
                    ? isLight
                      ? 'bg-[#291C0E] text-[#E1D4C2] border-[#6E473B] font-bold'
                      : 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] font-bold'
                    : isLight
                    ? 'bg-[#E1D4C2] text-[#291C0E] border-[#A78D78] hover:bg-[#A78D78]'
                    : 'bg-[#291C0E] text-[#BEB5A9] border-[#A78D78] hover:text-[#E1D4C2]'
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
          className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap disabled:opacity-50 ${
            isLight
              ? 'bg-[#6E473B] text-[#E1D4C2] border-[#291C0E] hover:bg-[#291C0E]'
              : 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] hover:bg-[#BEB5A9]'
          }`}
        >
          Buat Room {roomVisibility === 'private' ? 'Privat' : 'Publik'} & Dapatkan Kode Undangan
        </button>

        {/* Join by Code */}
        <div className="border-t border-[#A78D78] pt-2.5">
          <label className="block text-xs font-bold mb-1">
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
              className={`flex-1 px-3 py-1.5 rounded-lg border-2 font-mono uppercase tracking-widest text-sm focus:outline-none ${
                isLight
                  ? 'bg-[#E1D4C2] border-[#A78D78] text-[#291C0E] placeholder-[#6E473B]/50 focus:border-[#291C0E]'
                  : 'bg-[#291C0E] border-[#A78D78] text-[#E1D4C2] placeholder-[#BEB5A9]/40 focus:border-[#E1D4C2]'
              }`}
            />
            <button
              type="submit"
              disabled={!socketConnected || joinCodeInput.trim().length < 4}
              className={`py-2 px-3.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 ${
                isLight
                  ? 'bg-[#291C0E] text-[#E1D4C2] border-[#6E473B] hover:bg-[#6E473B]'
                  : 'bg-[#A78D78] text-[#291C0E] border-[#E1D4C2] hover:bg-[#E1D4C2]'
              }`}
            >
              Gabung Room
            </button>
          </form>
        </div>

        {/* Live Waiting Rooms List */}
        <div className="border-t border-[#A78D78] pt-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold">
              Room Publik Terbuka ({waitingRooms.length})
            </span>
            <button
              type="button"
              onClick={onRefreshLobby}
              className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors ${
                isLight
                  ? 'text-[#6E473B] hover:text-[#291C0E]'
                  : 'text-[#BEB5A9] hover:text-[#E1D4C2]'
              }`}
            >
              <RefreshCw className="w-3 h-3" />
              <span>Segarkan</span>
            </button>
          </div>

          {waitingRooms.length === 0 ? (
            <div
              className={`p-2.5 rounded-lg border text-xs text-center ${
                isLight
                  ? 'bg-[#E1D4C2] border-[#A78D78] text-[#6E473B]'
                  : 'bg-[#291C0E] border-[#A78D78] text-[#BEB5A9]'
              }`}
            >
              Belum ada room publik yang menunggu lawan. Buat room di atas atau bagikan kode privat ke teman!
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto">
              {waitingRooms.map((r) => (
                <div
                  key={r.roomCode}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                    isLight
                      ? 'bg-[#E1D4C2] border-[#A78D78] text-[#291C0E]'
                      : 'bg-[#291C0E] border-[#A78D78] text-[#E1D4C2]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <span className="font-mono px-1.5 py-0.5 rounded bg-[#6E473B] text-[#E1D4C2]">
                        {r.roomCode}
                      </span>
                      <span>·</span>
                      <span className="truncate">{r.hostName}</span>
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'
                      }`}
                    >
                      {TIME_CONTROL_PRESETS[r.timeControl]?.label || r.timeControl} · Host{' '}
                      {r.hostColor === 'w' ? 'Putih' : 'Hitam'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onJoinRoomByCode(r.roomCode)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap shrink-0 ${
                      isLight
                        ? 'bg-[#6E473B] text-[#E1D4C2] border-[#291C0E] hover:bg-[#291C0E]'
                        : 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] hover:bg-[#BEB5A9]'
                    }`}
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
    <div
      className={`flex flex-col gap-3 rounded-xl border-2 p-4 transition-colors ${
        isLight
          ? 'bg-[#BEB5A9] border-[#A78D78] text-[#291C0E]'
          : 'bg-[#6E473B] border-[#A78D78] text-[#E1D4C2]'
      }`}
    >
      {/* Room Header & Invite Controls */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#A78D78]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">Kode Room:</span>
            <span className="px-2 py-0.5 rounded bg-[#291C0E] text-[#E1D4C2] font-mono text-sm font-bold tracking-wider">
              {activeRoom.roomCode}
            </span>
            <span
              className={`text-xs ${
                isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'
              }`}
            >
              · {activeRoom.visibility === 'private' ? 'Privat' : 'Publik'} ·{' '}
              {TIME_CONTROL_PRESETS[activeRoom.timeControl]?.label}
            </span>
          </div>
          <div className="text-xs mt-1 flex items-center gap-2">
            <span>
              Peran Anda:{' '}
              <strong>
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
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#291C0E] text-[#E1D4C2] hover:bg-[#A78D78] hover:text-[#291C0E] border border-[#E1D4C2] transition-colors whitespace-nowrap shrink-0"
              title="Batalkan & Tutup Room"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Batalkan</span>
            </button>
          )}
          <button
            type="button"
            onClick={onLeaveRoom}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              isLight
                ? 'bg-[#E1D4C2] text-[#291C0E] border-[#6E473B] hover:bg-[#6E473B] hover:text-[#E1D4C2]'
                : 'bg-[#291C0E] text-[#E1D4C2] border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E]'
            }`}
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
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
            isLight
              ? 'bg-[#E1D4C2] text-[#291C0E] border-[#6E473B] hover:bg-[#A78D78]'
              : 'bg-[#291C0E] text-[#E1D4C2] border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E]'
          }`}
        >
          {copiedCode ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span>{copiedCode ? 'Kode Disalin!' : `Salin Kode (${activeRoom.roomCode})`}</span>
        </button>

        <button
          type="button"
          onClick={handleCopyInviteLink}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
            isLight
              ? 'bg-[#E1D4C2] text-[#291C0E] border-[#6E473B] hover:bg-[#A78D78]'
              : 'bg-[#291C0E] text-[#E1D4C2] border-[#A78D78] hover:bg-[#A78D78] hover:text-[#291C0E]'
          }`}
        >
          {copiedLink ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Link2 className="w-3.5 h-3.5" />
          )}
          <span>{copiedLink ? 'Tautan Disalin!' : 'Salin Tautan'}</span>
        </button>
      </div>

      {errorBanner && (
        <div className="p-2.5 rounded-lg bg-[#291C0E] border-2 border-[#E1D4C2] text-xs text-[#E1D4C2] font-semibold">
          {errorBanner}
        </div>
      )}

      {/* Waiting / Ready / Finished Status Callout */}
      {activeRoom.status === 'waiting' && (
        <div
          className={`p-3 rounded-lg border-2 flex flex-col gap-2 ${
            isLight
              ? 'bg-[#E1D4C2] border-[#6E473B] text-[#291C0E]'
              : 'bg-[#291C0E] border-[#E1D4C2] text-[#E1D4C2]'
          }`}
        >
          {!bothSeated ? (
            <p className="text-xs leading-relaxed">
              Menunggu pemain kedua bergabung ke room <strong>{activeRoom.roomCode}</strong>. Bagikan kode atau tautan undangan ke teman Anda!
            </p>
          ) : canStartMatch ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold">
                Kedua pemain terhubung ({activeRoom.whitePlayer?.displayName} vs{' '}
                {activeRoom.blackPlayer?.displayName}). Siap bertanding!
              </span>
              <button
                type="button"
                onClick={onReadyToStart}
                className="inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg text-xs font-bold bg-[#6E473B] text-[#E1D4C2] border border-[#E1D4C2] hover:bg-[#A78D78] hover:text-[#291C0E] transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Terima & Mulai</span>
              </button>
            </div>
          ) : (
            <p className="text-xs font-semibold">
              Menunggu pemain memulai pertandingan...
            </p>
          )}
        </div>
      )}

      {(activeRoom.status === 'finished' || activeRoom.status === 'abandoned') && (
        <div className="p-3 rounded-lg bg-[#A78D78] text-[#291C0E] border-2 border-[#291C0E] flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold">
              Pertandingan Selesai ({activeRoom.result || 'Remis'})
            </div>
            <div className="text-xs">
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
              className="py-2 px-3.5 rounded-lg text-xs font-bold bg-[#291C0E] text-[#E1D4C2] hover:bg-[#6E473B] transition-colors whitespace-nowrap shrink-0"
            >
              Tanding Ulang
            </button>
          )}
        </div>
      )}

      {/* Room Chat & Event Feed */}
      <div className="flex flex-col flex-1 min-h-[140px] max-h-[200px]">
        <div className="flex items-center gap-1.5 text-xs font-bold mb-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Log Room & Chat Pertandingan</span>
        </div>

        <div
          ref={chatScrollRef}
          className={`flex-1 overflow-y-auto rounded-lg border-2 p-2.5 space-y-1.5 text-xs ${
            isLight
              ? 'bg-[#E1D4C2] border-[#A78D78] text-[#291C0E]'
              : 'bg-[#291C0E] border-[#A78D78] text-[#E1D4C2]'
          }`}
        >
          {activeRoom.chatMessages.map((msg: ChatMessageItem) => (
            <div key={msg.id} className="leading-relaxed">
              {msg.senderColor === 'system' ? (
                <span
                  className={`font-semibold ${
                    isLight ? 'text-[#6E473B]' : 'text-[#BEB5A9]'
                  }`}
                >
                  [Sistem] {msg.message}
                </span>
              ) : (
                <div>
                  <span className="font-bold">
                    {msg.senderName} ({msg.senderColor === 'w' ? 'Putih' : 'Hitam'}):{' '}
                  </span>
                  <span>{msg.message}</span>
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
            className={`flex-1 px-3 py-1.5 rounded-lg border-2 text-xs focus:outline-none ${
              isLight
                ? 'bg-[#E1D4C2] border-[#A78D78] text-[#291C0E] placeholder-[#6E473B]/60 focus:border-[#291C0E]'
                : 'bg-[#291C0E] border-[#A78D78] text-[#E1D4C2] placeholder-[#BEB5A9]/50 focus:border-[#E1D4C2]'
            }`}
          />
          <button
            type="submit"
            className={`p-2 rounded-lg border transition-colors shrink-0 ${
              isLight
                ? 'bg-[#6E473B] text-[#E1D4C2] border-[#291C0E] hover:bg-[#291C0E]'
                : 'bg-[#E1D4C2] text-[#291C0E] border-[#BEB5A9] hover:bg-[#BEB5A9]'
            }`}
            title="Kirim Pesan"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
