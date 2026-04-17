# Ambient Sounds for Timer

Place these audio files here for the timer's ambient sound feature:

- `rain.mp3` — Rain/storm ambient (loopable, ~30-60 seconds)
- `forest.mp3` — Forest/birds/nature ambient (loopable)
- `cafe.mp3` — Coffee shop background noise (loopable)
- `waves.mp3` — Ocean waves ambient (loopable)

## Requirements
- Format: MP3 (for maximum browser compatibility)
- Duration: 30-60 seconds (they loop automatically)
- Volume: Normalized, not too loud (user controls volume 0-100%)
- License: Royalty-free / Creative Commons

## Free Sources
- https://freesound.org (search for "ambient loop")
- https://mixkit.co/free-sound-effects/
- https://pixabay.com/sound-effects/

The AmbientSounds component (`src/components/timer/AmbientSounds.tsx`)
references these files via `/sounds/{name}.mp3`.
