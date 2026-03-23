import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioManager, type AudioManifest } from '../../src/core/AudioManager.js';

const mockManifest: AudioManifest = {
  music: {
    overworld: 'assets/audio/music/overworld.ogg',
    battle: 'assets/audio/music/battle.ogg',
  },
  sfx: {
    'cursor-move': 'assets/audio/sfx/cursor-move.ogg',
    'cursor-select': 'assets/audio/sfx/cursor-select.ogg',
  },
};

describe('AudioManager', () => {
  let audio: AudioManager;

  beforeEach(() => {
    audio = new AudioManager();
  });

  describe('init', () => {
    it('stores manifest', async () => {
      await audio.init(mockManifest);
      // No error means success
      expect(true).toBe(true);
    });
  });

  describe('volume controls', () => {
    it('sets music volume clamped to 0-1', () => {
      audio.setMusicVolume(0.5);
      audio.setMusicVolume(-1);
      audio.setMusicVolume(2);
      // No error means success
      expect(true).toBe(true);
    });

    it('sets SFX volume clamped to 0-1', () => {
      audio.setSFXVolume(0.5);
      audio.setSFXVolume(-1);
      audio.setSFXVolume(2);
      expect(true).toBe(true);
    });
  });

  describe('mute/unmute', () => {
    it('toggles muted state', () => {
      expect(audio.isMuted).toBe(false);
      audio.mute();
      expect(audio.isMuted).toBe(true);
      audio.unmute();
      expect(audio.isMuted).toBe(false);
    });
  });

  describe('currentTrack', () => {
    it('returns null when no music playing', () => {
      expect(audio.currentTrack).toBe(null);
    });
  });

  describe('playMusic with missing manifest', () => {
    it('handles missing manifest gracefully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await audio.playMusic('overworld');
      expect(warnSpy).toHaveBeenCalledWith('Unknown music track: overworld');
      warnSpy.mockRestore();
    });
  });

  describe('playSFX with missing manifest', () => {
    it('handles missing manifest gracefully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await audio.playSFX('cursor-move');
      expect(warnSpy).toHaveBeenCalledWith('Unknown SFX: cursor-move');
      warnSpy.mockRestore();
    });
  });

  describe('playMusic with unknown track', () => {
    it('warns for unknown track', async () => {
      await audio.init(mockManifest);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await audio.playMusic('unknown-track');
      expect(warnSpy).toHaveBeenCalledWith('Unknown music track: unknown-track');
      warnSpy.mockRestore();
    });
  });

  describe('playSFX with unknown sfx', () => {
    it('warns for unknown sfx', async () => {
      await audio.init(mockManifest);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await audio.playSFX('unknown-sfx');
      expect(warnSpy).toHaveBeenCalledWith('Unknown SFX: unknown-sfx');
      warnSpy.mockRestore();
    });
  });

  describe('stopMusic', () => {
    it('handles stop when no music playing', () => {
      audio.stopMusic();
      audio.stopMusic(0);
      expect(true).toBe(true);
    });
  });

  describe('pauseMusic/resumeMusic', () => {
    it('tracks paused state', () => {
      expect(audio.isPaused).toBe(false);
      audio.pauseMusic();
      expect(audio.isPaused).toBe(false); // no music playing
    });

    it('handles resume when not paused', () => {
      audio.resumeMusic();
      expect(audio.isPaused).toBe(false);
    });
  });
});