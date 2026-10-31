// Every movement and feel number in the game lives here, so it is easy to
// tweak while Gideon playtests. Distances are in blocks (1 block = 1 meter),
// times in seconds, angles in degrees.

export const TUNING = {
  /** Physics steps per second. */
  physicsHz: 60,
  /** Longest frame the game will try to catch up on (stops a big jump after a hiccup). */
  maxFrameTime: 0.25,

  camera: {
    fov: 70,
  },

  /** Free-fly camera (Phase 1 explore mode, and the level editor later). */
  fly: {
    speed: 10,
    verticalSpeed: 8,
    /** How fast it speeds up and slows down (higher is snappier). */
    smoothing: 10,
  },

  mouse: {
    /** Radians of turn per pixel of mouse movement. */
    sensitivity: 0.0025,
    maxPitch: 85,
  },
};
