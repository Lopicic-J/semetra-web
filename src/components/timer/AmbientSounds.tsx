"use client";

import { useState, useRef, useEffect, memo } from "react";
import { Volume2, VolumeX } from "lucide-react";

interface Sound {
  id: string;
  label: string;
  emoji: string;
  /** URL to audio file — use free ambient sound URLs */
  url: string;
}

// Free ambient sound URLs (royalty-free, loopable)
// These are placeholder URLs — replace with actual hosted audio files
const AMBIENT_SOUNDS: Sound[] = [
  { id: "rain", label: "Regen", emoji: "🌧️", url: "/sounds/rain.mp3" },
  { id: "forest", label: "Wald", emoji: "🌲", url: "/sounds/forest.mp3" },
  { id: "cafe", label: "Café", emoji: "☕", url: "/sounds/cafe.mp3" },
  { id: "waves", label: "Wellen", emoji: "🌊", url: "/sounds/waves.mp3" },
];

interface Props {
  /** Only play when timer is active */
  isTimerRunning: boolean;
}

/**
 * Ambient sound toggle for the timer page.
 * Plays background sounds to help students focus.
 * Auto-pauses when timer pauses, auto-plays when timer runs.
 */
function AmbientSounds({ isTimerRunning }: Props) {
  const [activeSound, setActiveSound] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("semetra_ambient_sound") ?? null;
  });
  const [volume, setVolume] = useState(0.3);
  const [showPicker, setShowPicker] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Manage audio playback
  useEffect(() => {
    if (!activeSound) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      return;
    }

    const sound = AMBIENT_SOUNDS.find(s => s.id === activeSound);
    if (!sound) return;

    // Create or update audio element
    if (!audioRef.current || audioRef.current.src !== sound.url) {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(sound.url);
      audio.loop = true;
      audio.volume = volume;
      audioRef.current = audio;
    }

    // Play/pause based on timer state
    if (isTimerRunning) {
      audioRef.current.play().catch(() => {}); // May fail if no user interaction yet
    } else {
      audioRef.current.pause();
    }

    return () => {
      // Don't cleanup on every render — only on unmount
    };
  }, [activeSound, isTimerRunning, volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const toggleSound = (soundId: string) => {
    if (activeSound === soundId) {
      setActiveSound(null);
      localStorage.removeItem("semetra_ambient_sound");
    } else {
      setActiveSound(soundId);
      localStorage.setItem("semetra_ambient_sound", soundId);
    }
    setShowPicker(false);
  };

  const activeLabel = AMBIENT_SOUNDS.find(s => s.id === activeSound);

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
          activeSound
            ? "bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400"
            : "bg-surface-100 dark:bg-surface-800 text-surface-500 hover:text-surface-700"
        }`}
        title="Hintergrundgeräusche"
      >
        {activeSound ? <Volume2 size={13} /> : <VolumeX size={13} />}
        {activeLabel ? `${activeLabel.emoji} ${activeLabel.label}` : "Sounds"}
      </button>

      {/* Sound Picker Dropdown */}
      {showPicker && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-[rgb(var(--card-bg))] border border-surface-200 dark:border-surface-700 rounded-xl shadow-lg z-50 overflow-hidden">
          {AMBIENT_SOUNDS.map(sound => (
            <button
              key={sound.id}
              onClick={() => toggleSound(sound.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                activeSound === sound.id
                  ? "bg-brand-50 dark:bg-brand-950/20 text-brand-600"
                  : "text-surface-600 hover:bg-surface-50 dark:hover:bg-surface-800"
              }`}
            >
              <span className="text-base">{sound.emoji}</span>
              <span className="flex-1">{sound.label}</span>
              {activeSound === sound.id && <span className="text-[10px] text-brand-500">Aktiv</span>}
            </button>
          ))}

          {/* Volume Slider */}
          {activeSound && (
            <div className="px-3 py-2 border-t border-surface-100 dark:border-surface-800">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                className="w-full h-1 accent-brand-500"
              />
              <p className="text-[10px] text-surface-400 text-center mt-0.5">Lautstärke: {Math.round(volume * 100)}%</p>
            </div>
          )}

          {/* Off Button */}
          {activeSound && (
            <button
              onClick={() => { setActiveSound(null); localStorage.removeItem("semetra_ambient_sound"); setShowPicker(false); }}
              className="w-full px-3 py-2 text-xs text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/10 border-t border-surface-100 dark:border-surface-800 text-left"
            >
              <VolumeX size={12} className="inline mr-1.5" /> Ausschalten
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(AmbientSounds);
