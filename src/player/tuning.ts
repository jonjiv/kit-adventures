// Every movement and feel number in the game lives here, so it is easy to
// tweak while Gideon playtests. Distances are in meters, times in seconds,
// speeds in meters per second, angles in degrees.

export const TUNING = {
  /** Physics steps per second. */
  physicsHz: 60,
  /** Longest frame the game will try to catch up on (stops a big jump after a hiccup). */
  maxFrameTime: 0.25,

  player: {
    /** Collision box. The cat fits through gaps 1 meter wide and 1 meter tall. */
    width: 0.6,
    height: 0.8,

    runSpeed: 6.5,
    /** How fast the cat speeds up and slows down on the ground. */
    groundAccel: 45,
    groundDecel: 55,
    /** Steering in the air (a little air control). */
    airAccel: 18,
    /** Slowing down in the air when no direction is held. */
    airDecel: 4,
    /** How fast the cat turns to face where it runs, in degrees per second. */
    turnSpeed: 800,

    /** Height of a full jump (holding Space). */
    jumpHeight: 1.7,
    /** Time to reach the top of a full jump. */
    timeToApex: 0.36,
    /** Falling is faster than rising, so jumps feel snappy (1 = same). */
    fallGravityMultiplier: 1.5,
    /** Letting go of Space early cuts upward speed by this much, for small hops. */
    jumpCutMultiplier: 0.5,
    /** Extra height from the double jump. */
    doubleJumpHeight: 1.3,
    /** Jumps allowed in the air. */
    airJumps: 1,
    maxFallSpeed: 22,

    /** Small ledges the cat walks straight up without jumping. */
    stepHeight: 0.3,
    /** You can still jump this long after running off a ledge. */
    coyoteTime: 0.12,
    /** Pressing jump this long before landing still jumps. */
    jumpBuffer: 0.12,
    /** Falling below this height sends the cat back (levels can set their own). */
    killHeight: -10,

    // Wall run: jump at a wall while holding toward it at an angle.
    /** Longest wall run. */
    wallRunTime: 1.2,
    /** Speed along the wall (faster than running, it feels like a boost). */
    wallRunSpeed: 9,
    /** Gravity during a wall run, as a share of normal gravity, so the cat drops slowly. */
    wallRunGravity: 0.22,
    /** Little hop upward when a wall run starts. */
    wallRunLift: 2.5,
    /** A wall run only starts once the jump has slowed to this upward speed, so it begins high up. */
    wallRunMaxRiseSpeed: 4,
    /** ...and only if the cat isn't falling faster than this. */
    wallRunMaxFallSpeed: 5,
    /** How much the held direction must push into the wall (0 = along it, 1 = straight in). */
    wallRunMinInto: 0.15,
    /** How much the held direction must point along the wall. */
    wallRunMinAlong: 0.35,
    /** Wait before another wall run can start. */
    wallRunCooldown: 0.3,
    /** Time between paw prints on the wall. */
    wallStepInterval: 0.11,

    // Wall jump: Space while touching a wall in the air.
    wallJumpHeight: 1.5,
    /** Speed pushing away from the wall. */
    wallJumpPush: 6.5,
    /** Share of the speed along the wall that is kept. */
    wallJumpKeep: 0.6,
    /** Steering is weaker for this long after a wall jump, so the kick-off isn't cancelled. */
    wallJumpLockTime: 0.2,
    /** Share of normal air steering during that time. */
    wallJumpControl: 0.25,
    /** A wall jump still works this long after leaving a wall. */
    wallCoyoteTime: 0.1,
    /** Slowest fall when sliding down a wall while holding toward it. */
    wallSlideSpeed: 3,
    /**
     * Holding this straight into a wall (0 to 1) makes Space a double jump
     * (if one is left) instead of a wall jump, so you can jump up cliffs.
     */
    headOnWall: 0.8,

    // Ledge grab: grabs automatically when falling with paws near a ledge.
    /** How far above the cat's head a ledge can be grabbed. */
    ledgeReach: 0.4,
    /** Ledges lower than this above the feet are climbed or stepped instead. */
    ledgeMinHeight: 0.45,
    /** How far below the ledge top the cat's feet hang. */
    ledgeHangDrop: 0.72,
    /** Hang at least this long before holding forward climbs. */
    ledgeMinHang: 0.15,
    /** After dropping off a ledge, wait this long before grabbing again. */
    ledgeRegrabDelay: 0.4,
    climbTime: 0.32,
    /** Walls up to this height are climbed automatically when running into them. */
    autoClimbHeight: 1.05,
    autoClimbTime: 0.22,

    // Dash / pounce: Shift.
    dashSpeed: 15,
    dashTime: 0.16,
    /** Speed kept after a dash ends. */
    dashExitSpeed: 7.5,
    /** Wait between dashes on the ground (in the air it's once per jump). */
    dashCooldown: 0.5,

    // Special obstacles: garden mushrooms, city fans and moon low-gravity bubbles.
    /** How high a mushroom bounces the cat. */
    bounceHeight: 5.5,
    /** Upward push from a fan's wind (normal gravity is about 26). */
    updraftAccel: 75,
    /** Fastest the wind lifts the cat. */
    updraftMaxRise: 7,
    /** Gravity inside a low-gravity bubble, as a share of normal gravity. */
    lowGravity: 0.3,
    /** Fastest fall inside a low-gravity bubble. */
    lowGravityMaxFall: 8,
  },

  camera: {
    fov: 65,
    /**
     * Nearest and farthest distances drawn. A bigger near distance gives the
     * depth test more precision far away (less flicker); keep it below
     * wallPadding so walls never get cut open, and keep far beyond the sky (500 m).
     */
    near: 0.15,
    far: 700,
    /** Distance behind the cat (5 back and 2 up, per the plan). */
    distance: 5.4,
    pitch: 22,
    minPitch: -15,
    maxPitch: 65,
    minDistance: 2.5,
    maxDistance: 9,
    /** Meters per mouse-wheel notch. */
    zoomStep: 0.6,
    /** Height above the cat's feet the camera looks at. */
    lookHeight: 0.7,
    /** How quickly the camera catches up with the cat going up and down (higher is quicker). */
    verticalFollow: 8,
    /** How quickly the camera slides back out after a wall pushed it in. */
    pullOutSpeed: 4,
    /** Space kept between the camera and walls. */
    wallPadding: 0.3,
  },

  mouse: {
    /** Radians of turn per pixel of mouse movement. */
    sensitivity: 0.0025,
  },

  /** On-screen controls for iPads and phones. Sizes are in screen pixels at "Medium". */
  touch: {
    /** How far the joystick knob moves from its center. */
    stickRadius: 60,
    /** Share of the radius that counts as nothing (so a resting thumb doesn't walk). */
    stickDeadZone: 0.15,
    /** Share of the radius where the stick counts as fully pushed (full run speed). */
    stickFullAt: 0.75,
    jumpButtonSize: 96,
    /** At "Small" this is still over 72 px. */
    dashButtonSize: 86,
    /** Button size settings. */
    sizeScale: { small: 0.85, medium: 1, large: 1.2 },
    /** Radians of turn per pixel dragged, a bit slower than the mouse feels. */
    lookSensitivity: 0.0045,
    /** Camera drag speed settings. */
    cameraSpeedScale: { slow: 0.65, normal: 1, fast: 1.4 },
    /** The camera starts swinging back behind the cat this long after the last look drag. */
    followDelay: 0.8,
    /** How fast it swings behind the cat when running at full speed, in radians per second. */
    followTurnSpeed: 1.6,
    /** How quickly it tips back to the normal height angle (higher is quicker). */
    followPitchSpeed: 1.5,
    /** More forgiving moves on touch (replace the player numbers above). */
    player: {
      coyoteTime: 0.18,
      jumpBuffer: 0.18,
      /** Wall runs grab from a wider angle. */
      wallRunMinInto: 0.08,
      wallRunMinAlong: 0.28,
    },
  },

  /** The race in every level: countdown, timer and the golden pad at the end. */
  race: {
    /** Seconds of 3, 2, 1 before GO, with the cat held still. */
    countdownSeconds: 3,
    /** How long GO! stays on screen. */
    goShowSeconds: 1,
    /** The golden pad counts this far from its middle, sideways (it's 3 m across). */
    goalHalfSize: 1.6,
    /** The cat's feet can be up to this high above the pad and still count. */
    goalReach: 1,
  },

  sound: {
    /** Loudness of all sound effects (0 to 1). */
    volume: 0.6,
    /** Landings slower than this (meters per second) make no sound, so small hops are quiet. */
    landQuietSpeed: 5,
    /** Landings this fast or faster make the loudest thump. */
    landLoudSpeed: 16,
  },

  /** Lighter graphics on phones and tablets, to keep 60 fps. */
  graphics: {
    maxPixelRatio: 2,
    mobileMaxPixelRatio: 1.5,
    shadowMapSize: 2048,
    mobileShadowMapSize: 1024,
    /** Fog starts and ends this much closer on mobile (shorter view distance). */
    mobileViewDistance: 0.7,
    /** Share of particles kept on mobile. */
    mobileParticles: 0.5,
  },

  /** Free-fly camera for the level editor. */
  fly: {
    speed: 10,
    verticalSpeed: 8,
    smoothing: 10,
    maxPitch: 85,
  },
};

export type PlayerTuning = typeof TUNING.player;

/** The player numbers used while playing with touch controls. */
export const TOUCH_PLAYER: PlayerTuning = { ...TUNING.player, ...TUNING.touch.player };

/** Gravity and launch speeds that give the jump heights and timing above. */
export function jumpPhysics(t: PlayerTuning) {
  const gravity = (2 * t.jumpHeight) / (t.timeToApex * t.timeToApex);
  return {
    gravity,
    jumpSpeed: gravity * t.timeToApex,
    doubleJumpSpeed: Math.sqrt(2 * gravity * t.doubleJumpHeight),
    wallJumpSpeed: Math.sqrt(2 * gravity * t.wallJumpHeight),
  };
}
