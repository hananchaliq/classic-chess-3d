'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import type {
  ChatMessageItem,
  PieceColor,
  RoomStateSnapshot,
  RoomVisibility,
  TimeControlPreset,
  YourRoleInRoom,
} from '../../types/chess.ts';
import { TIME_CONTROL_PRESETS } from '../../types/chess.ts';
import { ChessBrandEmblem } from './ChessBrandLogo.tsx';
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
  embedded?: boolean;
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
  embedded = false,
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
        className={`flex flex-col gap-3 transition-colors ${
          embedded
            ? ''
            : `rounded-2xl border p-4 ${
                isLight
                  ? 'bg-[#F4F1EA] border-[#C5BFB3] text-[#12231B]'
                  : 'bg-[#102018] border-[#7A9A76]/35 text-[#F3ECE0]'
              }`
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChessBrandEmblem
              size="sm"
              variant={isLight ? 'forest' : 'sand'}
            />
            <div>
              <h3 className="text-sm font-bold font-serif tracking-tight">
                Lobi Room Multiplayer
              </h3>
              <p
                className={`text-[11px] ${
                  isLight ? 'text-[#4A5D49]' : 'text-[#9BB09D]'
                }`}
              >
                {socketConnected ? 'Server Sinkronisasi Aktif' : 'Menghubungkan...'} · Kode 6 Huruf
              </p>
            </div>
          </div>
        </div>

        {errorBanner && (
          <div className="p-2.5 rounded-xl bg-[#991B1B] text-xs text-white font-medium">
            {errorBanner}
          </div>
        )}

        {/* Player Display Name */}
        <div>
          <label className="block text-[11px] font-semibold mb-1">
            Nama Pemain
          </label>
          <input
            type="text"
            maxLength={24}
            value={playerName}
            onChange={(e) => onPlayerNameChange(e.target.value)}
            placeholder="Masukkan nama Anda..."
            className={`w-full px-3 py-1.5 rounded-xl border text-xs focus:outline-none transition-colors ${
              isLight
                ? 'bg-[#EAE6DF] border-[#C5BFB3] text-[#12231B] placeholder-[#4A5D49]/60 focus:border-[#14261D]'
                : 'bg-[#0A140F] border-[#7A9A76]/35 text-[#F3ECE0] placeholder-[#9BB09D]/50 focus:border-[#DFC29B] shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]'
            }`}
          />
        </div>

        {/* Time Control Selector */}
        <div>
          <label className="block text-[11px] font-semibold mb-1">
            Durasi Jam Catur
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
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all whitespace-nowrap truncate ${
                    active
                      ? isLight
                        ? 'bg-[#14261D] text-[#EFE6D5] border-[#14261D]'
                        : 'bg-[#DFC29B] text-[#0E1B14] border-[#DFC29B] font-bold'
                      : isLight
                      ? 'bg-[#EAE6DF] text-[#12231B] border-[#C5BFB3] hover:bg-[#DFD9CE]'
                      : 'bg-[#0A140F] text-[#9BB09D] border-[#7A9A76]/30 hover:text-[#F3ECE0]'
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
            <label className="block text-[11px] font-semibold mb-1">
              Pilihan Bidak
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
                  className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                    preferredColor === opt.id
                      ? isLight
                        ? 'bg-[#4E392B] text-[#EFE6D5] border-[#4E392B]'
                        : 'bg-[#1A3326] text-[#DFC29B] border-[#DFC29B]/60 font-bold'
                      : isLight
                      ? 'bg-[#EAE6DF] text-[#12231B] border-[#C5BFB3]'
                      : 'bg-[#0A140F] text-[#9BB09D] border-[#7A9A76]/30 hover:text-[#F3ECE0]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1">
              Visibilitas
            </label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => onSelectRoomVisibility?.('public')}
                className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                  roomVisibility === 'public'
                    ? isLight
                      ? 'bg-[#4E392B] text-[#EFE6D5] border-[#4E392B]'
                      : 'bg-[#1A3326] text-[#DFC29B] border-[#DFC29B]/60 font-bold'
                    : isLight
                    ? 'bg-[#EAE6DF] text-[#12231B] border-[#C5BFB3]'
                    : 'bg-[#0A140F] text-[#9BB09D] border-[#7A9A76]/30 hover:text-[#F3ECE0]'
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>Publik</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectRoomVisibility?.('private')}
                className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                  roomVisibility === 'private'
                    ? isLight
                      ? 'bg-[#4E392B] text-[#EFE6D5] border-[#4E392B]'
                      : 'bg-[#1A3326] text-[#DFC29B] border-[#DFC29B]/60 font-bold'
                    : isLight
                    ? 'bg-[#EAE6DF] text-[#12231B] border-[#C5BFB3]'
                    : 'bg-[#0A140F] text-[#9BB09D] border-[#7A9A76]/30 hover:text-[#F3ECE0]'
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
          className={`w-full py-2 px-4 rounded-full text-xs font-bold transition-all whitespace-nowrap disabled:opacity-50 ${
            isLight
              ? 'bg-[#14261D] text-[#EFE6D5] hover:bg-[#1F3A2C]'
              : 'bg-[#DFC29B] text-[#0E1B14] hover:bg-[#EAD3B3] shadow-sm'
          }`}
        >
          Buat Room {roomVisibility === 'private' ? 'Privat' : 'Publik'} Baru
        </button>

        {/* Join by Code */}
        <div
          className={`border-t pt-2.5 ${
            isLight ? 'border-[#C5BFB3]/70' : 'border-[#7A9A76]/25'
          }`}
        >
          <label className="block text-[11px] font-semibold mb-1">
            Gabung Kode Room Teman
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (joinCodeInput.trim()) {
                onJoinRoomByCode(joinCodeInput.trim());
              }
            }}
            className="flex items-center gap-1.5"
          >
            <input
              type="text"
              maxLength={8}
              value={joinCodeInput}
              onChange={(e) => onJoinCodeInputChange(e.target.value.toUpperCase())}
              placeholder="Kode 6 huruf (mis: K7M9P2)"
              className={`flex-1 px-3 py-1.5 rounded-xl border font-mono uppercase tracking-widest text-xs focus:outline-none ${
                isLight
                  ? 'bg-[#EAE6DF] border-[#C5BFB3] text-[#12231B] placeholder-[#4A5D49]/60 focus:border-[#14261D]'
                  : 'bg-[#0A140F] border-[#7A9A76]/35 text-[#F3ECE0] placeholder-[#9BB09D]/45 focus:border-[#DFC29B] shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]'
              }`}
            />
            <button
              type="submit"
              disabled={!socketConnected || joinCodeInput.trim().length < 4}
              className="py-1.5 px-3.5 rounded-full text-xs font-bold bg-[#5E785D] text-[#F3ECE0] hover:bg-[#7A9A76] hover:text-[#0E1B14] transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
            >
              Gabung
            </button>
          </form>
        </div>

        {/* Live Waiting Rooms List */}
        <div
          className={`border-t pt-2.5 ${
            isLight ? 'border-[#C5BFB3]/70' : 'border-[#7A9A76]/25'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold">
              Room Publik Terbuka ({waitingRooms.length})
            </span>
            <button
              type="button"
              onClick={onRefreshLobby}
              className={`inline-flex items-center gap-1 text-[11px] font-medium transition-colors ${
                isLight
                  ? 'text-[#4A5D49] hover:text-[#12231B]'
                  : 'text-[#9BB09D] hover:text-[#DFC29B]'
              }`}
            >
              <RefreshCw className="w-3 h-3" />
              <span>Segarkan</span>
            </button>
          </div>

          {waitingRooms.length === 0 ? (
            <div
              className={`p-2.5 rounded-xl border text-[11px] text-center ${
                isLight
                  ? 'bg-[#EAE6DF] border-[#C5BFB3] text-[#4A5D49]'
                  : 'bg-[#0A140F] border-[#7A9A76]/25 text-[#9BB09D]'
              }`}
            >
              Belum ada room publik yang menunggu. Buat room baru atau undang teman!
            </div>
          ) : (
            <div
              className={`flex flex-col gap-1.5 max-h-[120px] overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:rounded-full ${
                isLight
                  ? '[scrollbar-color:#7A9A76_#EAE6DF] [&::-webkit-scrollbar-track]:bg-[#EAE6DF] [&::-webkit-scrollbar-thumb]:bg-[#7A9A76]/60 hover:[&::-webkit-scrollbar-thumb]:bg-[#14261D]'
                  : '[scrollbar-color:#7A9A76_#0A140F] [&::-webkit-scrollbar-track]:bg-[#0A140F] [&::-webkit-scrollbar-thumb]:bg-[#7A9A76]/60 hover:[&::-webkit-scrollbar-thumb]:bg-[#DFC29B]'
              }`}
            >
              {waitingRooms.map((r) => (
                <div
                  key={r.roomCode}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-xl border ${
                    isLight
                      ? 'bg-[#EAE6DF] border-[#C5BFB3] text-[#12231B]'
                      : 'bg-[#0A140F] border-[#7A9A76]/35 text-[#F3ECE0]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <span className="font-mono font-bold text-[#DFC29B]">{r.roomCode}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{r.hostName}</span>
                    </div>
                    <div
                      className={`text-[10px] ${
                        isLight ? 'text-[#4A5D49]' : 'text-[#9BB09D]'
                      }`}
                    >
                      {TIME_CONTROL_PRESETS[r.timeControl]?.label || r.timeControl} · Host{' '}
                      {r.hostColor === 'w' ? 'Putih' : 'Hitam'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onJoinRoomByCode(r.roomCode)}
                    className="py-1 px-3 rounded-full text-xs font-bold bg-[#DFC29B] text-[#0E1B14] hover:bg-[#EAD3B3] transition-colors whitespace-nowrap shrink-0"
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
      className={`flex flex-col gap-2.5 transition-colors ${
        embedded
          ? ''
          : `rounded-2xl border p-4 ${
              isLight
                ? 'bg-[#F4F1EA] border-[#C5BFB3] text-[#12231B]'
                : 'bg-[#102018] border-[#7A9A76]/35 text-[#F3ECE0]'
            }`
      }`}
    >
      {/* Room Header & Invite Controls */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-serif font-bold text-sm sm:text-base">
              Room {activeRoom.roomCode}
            </span>
            <span
              className={`text-[11px] ${
                isLight ? 'text-[#4A5D49]' : 'text-[#9BB09D]'
              }`}
            >
              · {activeRoom.visibility === 'private' ? 'Privat' : 'Publik'} ·{' '}
              {TIME_CONTROL_PRESETS[activeRoom.timeControl]?.label}
            </span>
          </div>
          <div
            className={`text-[11px] flex items-center gap-1.5 ${
              isLight ? 'text-[#4A5D49]' : 'text-[#9BB09D]'
            }`}
          >
            <span>
              Peran:{' '}
              <strong className={isLight ? 'text-[#12231B]' : 'text-[#DFC29B]'}>
                {myRole === 'w'
                  ? 'Putih'
                  : myRole === 'b'
                  ? 'Hitam'
                  : 'Penonton'}
              </strong>
            </span>
            {activeRoom.spectatorCount > 0 && (
              <span className="inline-flex items-center gap-1">
                · <Users className="w-3 h-3" /> {activeRoom.spectatorCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {activeRoom.status === 'waiting' && !bothSeated && onCancelRoom && (
            <button
              type="button"
              onClick={onCancelRoom}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#991B1B] text-white hover:bg-[#7F1D1D] transition-colors whitespace-nowrap shrink-0"
              title="Batalkan & Tutup Room"
            >
              <XCircle className="w-3 h-3" />
              <span>Batal</span>
            </button>
          )}
          <button
            type="button"
            onClick={onLeaveRoom}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              isLight
                ? 'bg-[#E2DDD3] text-[#12231B] border-[#C5BFB3] hover:bg-[#D5CFC3]'
                : 'bg-[#162B20] text-[#F3ECE0] border-[#7A9A76]/40 hover:border-[#DFC29B]'
            }`}
            title="Keluar dari Room"
          >
            <LogOut className="w-3 h-3" />
            <span>Keluar</span>
          </button>
        </div>
      </div>

      {/* Share Code & Invite Link Bar */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleCopyCode}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-full text-[11px] font-semibold border transition-colors whitespace-nowrap ${
            isLight
              ? 'bg-[#EAE6DF] text-[#12231B] border-[#C5BFB3] hover:bg-[#DFD9CE]'
              : 'bg-[#0A140F] text-[#F3ECE0] border-[#7A9A76]/35 hover:border-[#DFC29B]'
          }`}
        >
          {copiedCode ? (
            <Check className="w-3 h-3 text-[#7A9A76]" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
          <span>{copiedCode ? 'Kode Disalin!' : `Kode: ${activeRoom.roomCode}`}</span>
        </button>

        <button
          type="button"
          onClick={handleCopyInviteLink}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-full text-[11px] font-semibold border transition-colors whitespace-nowrap ${
            isLight
              ? 'bg-[#EAE6DF] text-[#12231B] border-[#C5BFB3] hover:bg-[#DFD9CE]'
              : 'bg-[#0A140F] text-[#F3ECE0] border-[#7A9A76]/35 hover:border-[#DFC29B]'
          }`}
        >
          {copiedLink ? (
            <Check className="w-3 h-3 text-[#7A9A76]" />
          ) : (
            <Link2 className="w-3 h-3" />
          )}
          <span>{copiedLink ? 'Tautan Disalin!' : 'Salin Tautan'}</span>
        </button>
      </div>

      {errorBanner && (
        <div className="p-2 rounded-xl bg-[#991B1B] text-xs text-white font-medium">
          {errorBanner}
        </div>
      )}

      {/* Waiting / Ready / Finished Status Callout */}
      {activeRoom.status === 'waiting' && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-xl bg-[#152A20] text-[#F3ECE0] border border-[#DFC29B]/40 flex flex-col gap-2"
        >
          {!bothSeated ? (
            <p className="text-xs leading-relaxed text-[#EFE6D5]/90">
              Menunggu teman bergabung ke room{' '}
              <strong className="font-mono text-[#DFC29B]">{activeRoom.roomCode}</strong>.
            </p>
          ) : canStartMatch ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-medium">
                Kedua pemain siap ({activeRoom.whitePlayer?.displayName} vs{' '}
                {activeRoom.blackPlayer?.displayName}).
              </span>
              <button
                type="button"
                onClick={onReadyToStart}
                className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3.5 rounded-full text-xs font-bold bg-[#DFC29B] text-[#0E1B14] hover:bg-[#EAD3B3] transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Mulai</span>
              </button>
            </div>
          ) : (
            <p className="text-xs font-medium">
              Menunggu pemain memulai pertandingan...
            </p>
          )}
        </motion.div>
      )}

      {(activeRoom.status === 'finished' || activeRoom.status === 'abandoned') && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-3 rounded-xl bg-[#1A3326] text-[#F3ECE0] border border-[#DFC29B]/45 flex items-center justify-between gap-2.5"
        >
          <div>
            <div className="text-xs sm:text-sm font-serif font-bold text-[#DFC29B]">
              Pertandingan Selesai ({activeRoom.result || 'Remis'})
            </div>
            <div className="text-[11px] text-[#EFE6D5]/90">
              {activeRoom.winnerColor === 'w'
                ? 'Putih Menang'
                : activeRoom.winnerColor === 'b'
                ? 'Hitam Menang'
                : 'Hasil Remis'}{' '}
              · {activeRoom.terminationReason}
            </div>
          </div>
          {myRole !== 'spectator' && (
            <button
              type="button"
              onClick={onRematch}
              className="py-1.5 px-3.5 rounded-full text-xs font-bold bg-[#DFC29B] text-[#0E1B14] hover:bg-[#EAD3B3] transition-colors whitespace-nowrap shrink-0"
            >
              Tanding Ulang
            </button>
          )}
        </motion.div>
      )}

      {/* Room Chat & Event Feed */}
      <div className="flex flex-col flex-1 min-h-[120px] max-h-[175px]">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold mb-1">
          <MessageSquare className="w-3 h-3 text-[#7A9A76]" />
          <span>Obrolan & Aktivitas Room</span>
        </div>

        <div
          ref={chatScrollRef}
          className={`flex-1 overflow-y-auto rounded-xl border p-2 space-y-1 text-xs [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:rounded-full ${
            isLight
              ? 'bg-[#EAE6DF] border-[#C5BFB3] text-[#12231B] shadow-inner [scrollbar-color:#7A9A76_#EAE6DF] [&::-webkit-scrollbar-track]:bg-[#EAE6DF] [&::-webkit-scrollbar-thumb]:bg-[#7A9A76]/60 hover:[&::-webkit-scrollbar-thumb]:bg-[#14261D]'
              : 'bg-[#0A140F] border-[#7A9A76]/30 text-[#F3ECE0] shadow-[inset_0_2px_8px_rgba(0,0,0,0.65)] [scrollbar-color:#7A9A76_#0A140F] [&::-webkit-scrollbar-track]:bg-[#0A140F] [&::-webkit-scrollbar-thumb]:bg-[#7A9A76]/60 hover:[&::-webkit-scrollbar-thumb]:bg-[#DFC29B]'
          }`}
        >
          {activeRoom.chatMessages.map((msg: ChatMessageItem) => (
            <div key={msg.id} className="leading-relaxed text-[11px]">
              {msg.senderColor === 'system' ? (
                <span
                  className={`font-medium ${
                    isLight ? 'text-[#4A5D49]' : 'text-[#9BB09D]'
                  }`}
                >
                  · {msg.message}
                </span>
              ) : (
                <div>
                  <span className="font-bold text-[#DFC29B]">
                    {msg.senderName} ({msg.senderColor === 'w' ? 'P' : 'H'}):{' '}
                  </span>
                  <span>{msg.message}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleChatSubmit} className="mt-1.5 flex items-center gap-1.5">
          <input
            type="text"
            maxLength={240}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Tulis pesan..."
            className={`flex-1 px-3 py-1.5 rounded-full border text-xs focus:outline-none ${
              isLight
                ? 'bg-[#EAE6DF] border-[#C5BFB3] text-[#12231B] placeholder-[#4A5D49]/60 focus:border-[#14261D]'
                : 'bg-[#0A140F] border-[#7A9A76]/35 text-[#F3ECE0] placeholder-[#9BB09D]/50 focus:border-[#DFC29B]'
            }`}
          />
          <button
            type="submit"
            className="p-1.5 rounded-full bg-[#DFC29B] text-[#0E1B14] hover:bg-[#EAD3B3] transition-colors shrink-0"
            title="Kirim Pesan"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
