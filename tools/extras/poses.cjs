/* Poses of the extra penguins for every clip of the base penguin (same names, frame
 * counts, timing and loops; the contract comes from the base rig's animations.json).
 * The extras are drawn facing the viewer, as in their references, so the motion is the
 * base choreography translated to a front view: a waddle instead of a profile walk,
 * flippers raised sideways, falls with flailing flippers, squash on impact...
 *
 * Units: angles in degrees; distances in cut-out pixels (≈ 5.8 per game cell pixel).
 * L/R: raise of the viewer's left / right flipper (+ up and out, − in behind the torso).
 * R is the acting flipper (the base rig's near flipper): waves, throws, wipes, carries.
 */
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const pulse = t => Math.sin(Math.PI * clamp(t));

const LOOP = new Set(['idle', 'walk', 'run', 'look_around', 'dragged', 'fall_normal', 'fall_spin', 'fall_flap', 'sit_idle', 'carry_ladder', 'hold_ladder', 'climb', 'sleep', 'play', 'chase', 'shiver', 'make_snowball', 'ice_slide', 'walk_umbrella', 'hide_rain', 'chase_butterfly', 'sit_grass', 'play_beach', 'swim', 'wipe']);
const AIR = new Set(['dragged', 'fall_normal', 'fall_spin', 'fall_flap']);

/** Waddle: weight shifts side to side, the unloaded foot lifts, flippers swing a little. */
function waddle(z, s, co, { lift = 36, rot = 4.5, swing = 8, bounce = 14, out = 10 } = {}) {
  z.body.rot = rot * s;
  z.body.dx = 7 * s;
  z.body.dy = -bounce * Math.abs(co);
  z.footL = { dy: -lift * Math.max(0, s), rot: -6 * Math.max(0, s) };
  z.footR = { dy: -lift * Math.max(0, -s), rot: 6 * Math.max(0, -s) };
  z.L = out + swing * s;
  z.R = out - swing * s;
}

/** Sitting: body lowered and a little squat, feet sticking out in front. */
function sit(z, k) {
  if (!k) return;
  z.body.dy += 70 * k;
  z.body.sy *= 1 - 0.07 * k;
  z.body.sx *= 1 + 0.03 * k;
  z.footL = { ...(z.footL ?? {}), dx: (z.footL?.dx ?? 0) - 26 * k, dy: (z.footL?.dy ?? 0) + 8 * k, rot: (z.footL?.rot ?? 0) - 16 * k };
  z.footR = { ...(z.footR ?? {}), dx: (z.footR?.dx ?? 0) + 26 * k, dy: (z.footR?.dy ?? 0) + 8 * k, rot: (z.footR?.rot ?? 0) + 16 * k };
}

function pose(clip, i, n) {
  const loop = LOOP.has(clip), t = loop ? i / n : i / Math.max(1, n - 1);
  const a = TAU * t, s = Math.sin(a), co = Math.cos(a), q = smooth(t), p = pulse(t);
  const z = { body: { rot: 0, dx: 0, dy: 0, sx: 1, sy: 1 }, L: 2, R: 2, eye: 1, big: 0, happy: false, air: AIR.has(clip), props: [] };
  let seat = 0;
  switch (clip) {
    case 'idle': case 'blink':
      z.body.sy = 1 + 0.01 * s;
      z.L = 2 + 2 * co; z.R = 2 + 2 * s;
      z.eye = clip === 'blink' ? 1 - 0.98 * p : 1 - 0.92 * Math.pow(Math.max(0, s), 12);
      break;
    case 'walk': case 'enter':
      waddle(z, s, co);
      break;
    case 'run': case 'chase':
      waddle(z, s, co, { lift: 52, rot: 7, swing: 22, bounce: 26, out: 22 });
      break;
    case 'chase_butterfly':
      waddle(z, s, co, { lift: 48, rot: 6, swing: 10, bounce: 22, out: 14 });
      z.R = 95 + 20 * s; // reaching for it
      break;
    case 'carry_ladder':
      waddle(z, s, co, { lift: 30, rot: 3.5 });
      z.R = 150; z.L = 12 + 6 * s; // the ladder rides on the raised flipper
      break;
    case 'walk_umbrella':
      waddle(z, s, co, { lift: 30, rot: 3.5 });
      z.R = 135; z.L = 10 + 6 * s;
      z.props.push({ kind: 'umbrella', open: 1 });
      break;
    case 'look_up': case 'notice_name': case 'group_look_up': case 'notice_weather':
      z.body.sy = 1 + 0.035 * q; z.body.dy = -6 * q; z.body.rot = -2 * q;
      z.R = 2 + 22 * q; z.L = 2 + 6 * q; z.big = 0.25 * q;
      break;
    case 'look_around':
      z.body.rot = 5 * s; z.body.dx = 12 * s;
      z.L = 4 - 3 * s; z.R = 4 + 3 * s;
      break;
    case 'curious':
      z.body.rot = 7 * p; z.body.sy = 1 + 0.03 * p; z.body.dy = -6 * p;
      z.R = 2 + 18 * p; z.big = 0.3 * p;
      break;
    case 'confused': case 'weather_confused': case 'watch_bloom':
      z.body.rot = -8 * p + 3 * s * p; z.body.dx = -6 * p;
      z.R = 2 + 70 * p; z.L = 2 + 8 * p; // flipper to the head, puzzled
      if (clip === 'watch_bloom') { z.R = 2 + 20 * p; z.happy = t > 0.5; }
      break;
    case 'scared':
      z.big = q; z.body.sy = 1 + 0.06 * q; z.body.dy = -20 * q;
      z.L = 45 * q; z.R = 45 * q;
      break;
    case 'dragged':
      z.big = 1; z.L = 140 + 10 * s; z.R = 140 - 10 * s;
      z.footL = { rot: 14 + 6 * s, dy: 10 }; z.footR = { rot: -14 + 6 * s, dy: 10 };
      z.body.rot = 3 * s;
      break;
    case 'fall_normal':
      z.big = 1; z.body.rot = 4 * s;
      z.L = 125 + 20 * co; z.R = 125 - 20 * co;
      z.footL = { rot: 16 + 8 * s, dy: 12 }; z.footR = { rot: -16 - 8 * s, dy: 12 };
      break;
    case 'fall_flap':
      z.big = 1; z.L = 85 + 55 * s; z.R = 85 + 55 * s;
      z.footL = { rot: 12, dy: 10 - 8 * s }; z.footR = { rot: -12, dy: 10 - 8 * s };
      break;
    case 'fall_spin':
      z.big = 1; z.spin = 360 * t; z.L = 70 + 15 * s; z.R = 70 - 15 * s;
      z.footL = { rot: 12, dy: 10 }; z.footR = { rot: -12, dy: 10 };
      break;
    case 'impact_light': case 'impact_medium': case 'impact_heavy': {
      const k = { impact_light: 0.16, impact_medium: 0.31, impact_heavy: 0.46 }[clip];
      z.body.sy = 1 - k * p * (1 - q); z.body.sx = 1 + 0.7 * k * p * (1 - q);
      z.big = 0.7 * p * (1 - q); z.eye = lerp(1 - 0.95 * p, 0.3, q);
      z.L = lerp(70 * p, 25, q); z.R = lerp(70 * p, 15, q);
      seat = q; z.body.rot = 7 * q;
      break;
    }
    case 'get_up':
      seat = 1 - q; z.body.rot = 7 * (1 - q); z.eye = 0.3 + 0.7 * q;
      z.L = 25 * (1 - q) + 30 * p; z.R = 15 * (1 - q) + 30 * p; // push off the ground
      break;
    case 'stumble':
      z.body.rot = -16 * p; z.body.dx = -18 * p; z.big = p;
      z.L = 70 * p; z.R = 55 * p;
      z.footL = { dx: -16 * p, dy: -30 * p, rot: -12 * p };
      break;
    case 'bump':
      z.body.sx = 1 - 0.12 * p; z.body.rot = 12 * p; z.body.dx = 14 * p;
      z.R = 2 + 35 * p; z.L = 2 + 20 * p; z.eye = 1 - 0.6 * p;
      break;
    case 'push':
      z.body.rot = -10 * p; z.body.dx = -12 * p;
      z.L = 2 + 75 * p; z.R = 2 + 30 * p; // pushing to the side with both flippers
      z.footR = { dx: 10 * p, dy: -10 * p };
      break;
    case 'sit_down': seat = q; z.L = 2 + 12 * p; z.R = 2 + 12 * p; break;
    case 'stand_up': seat = 1 - q; z.L = 2 + 12 * p; z.R = 2 + 12 * p; break;
    case 'sit_idle': case 'sit_grass':
      seat = 1; z.body.sy = 1 + 0.01 * s;
      z.L = 6 + 3 * co; z.R = 6 + 3 * s;
      z.eye = 1 - (clip === 'sit_idle' ? 0.8 * Math.pow(Math.max(0, s), 8) : 0);
      if (clip === 'sit_grass') z.happy = s > 0.6;
      break;
    case 'switch_light':
      z.R = 2 + 100 * p; z.body.rot = -3 * p; z.body.dy = -6 * p;
      break;
    case 'place_ladder': case 'assemble_ladder': case 'hold_ladder':
      z.R = 115 + (clip === 'assemble_ladder' ? 10 * s : 12 * p); z.L = 100;
      z.body.rot = clip === 'place_ladder' ? 8 * p : 2 * s;
      if (clip === 'place_ladder') seat = 0.25 * p;
      break;
    case 'climb':
      // facing the viewer on the ladder: flippers reach up in turn, feet step
      z.L = 150 + 25 * s; z.R = 150 - 25 * s;
      z.footL = { dy: -30 * Math.max(0, s) }; z.footR = { dy: -30 * Math.max(0, -s) };
      z.body.dy = 10 * co; z.body.rot = 2 * s;
      break;
    case 'reach_rope': z.R = 2 + 150 * q; z.body.sy = 1 + 0.04 * q; z.body.dy = -10 * q; break;
    case 'cut_rope': z.R = 150 + 6 * s; z.body.sy = 1.04; z.body.dy = -10; break;
    case 'react_name_fall':
      z.big = p; z.L = 65 * p; z.R = 65 * p; z.body.rot = 4 * s; z.body.dy = -10 * p;
      break;
    case 'celebrate':
      z.L = 125 * p; z.R = 125 * p; z.body.dy = -45 * p; z.body.jump = -45 * p; z.happy = true;
      z.footL = { rot: -8 * p }; z.footR = { rot: 8 * p };
      break;
    case 'sleep':
      seat = 1; z.eye = 0.04; z.body.rot = 4 + 1.5 * s; z.body.sy = 1 + 0.018 * s;
      z.L = -6; z.R = -6;
      break;
    case 'wake_up':
      seat = 1 - q; z.eye = 0.04 + 0.96 * q; z.body.rot = 4 * (1 - q);
      z.L = 2 + 120 * p; z.R = 2 + 120 * p; // a big stretch
      break;
    case 'greet':
      z.R = 2 + 120 * p + 18 * Math.sin(3 * Math.PI * t) * p; z.body.rot = -3 * p; z.happy = p > 0.5;
      break;
    case 'play':
      z.body.rot = 7 * s; z.body.dy = -22 * Math.abs(s); z.body.jump = -22 * Math.abs(s);
      z.L = 40 + 25 * s; z.R = 40 - 25 * s; z.happy = true;
      break;
    case 'laugh':
      z.happy = true; z.eye = 0.3;
      z.body.sy = 1 - 0.04 * Math.sin(3 * Math.PI * t) ** 2; z.body.rot = 2 * Math.sin(3 * Math.PI * t);
      z.L = 18; z.R = 18;
      break;
    case 'interact_object': case 'pick_up_object': case 'put_down_object': {
      const v = clip === 'pick_up_object' ? q : clip === 'put_down_object' ? 1 - q : p;
      z.body.rot = 9 * p; z.body.dx = 10 * p; seat = 0.3 * p;
      z.R = 2 + 40 * v; // reaching down to the side
      break;
    }
    case 'resume_after_weather':
      z.body.sy = 1 + 0.03 * (1 - q); z.body.rot = 3 * (1 - q); z.L = 2 + 10 * (1 - q); z.R = 2 + 10 * (1 - q);
      break;
    case 'remove_accessories':
      z.L = 95 * p; z.R = 95 * p; z.eye = 1 - 0.3 * p;
      break;
    case 'put_scarf':
      z.L = 85 * p; z.R = 85 * p;
      break;
    case 'put_boots':
      seat = 0.7 * p; z.R = 2 + 40 * p; z.footR = { dy: -26 * p, rot: 12 * p };
      break;
    case 'open_umbrella':
      z.R = 135; z.L = 6;
      z.props.push({ kind: 'umbrella', open: clamp((t - 0.25) / 0.6) });
      break;
    case 'shiver':
      z.body.rot = 2.5 * Math.sin(2 * a); z.body.dx = 4 * Math.sin(4 * a); z.body.sx = 1 + 0.01 * Math.sin(2 * a);
      z.L = -8 - 3 * s; z.R = -8 + 3 * s; z.eye = 0.6;
      break;
    case 'make_snowball': case 'build_snowman': case 'build_sandcastle':
      seat = 0.4; z.body.rot = 5 + 4 * s;
      z.L = 30 + 18 * s; z.R = 30 - 18 * s;
      if (clip === 'make_snowball') z.props.push({ kind: 'snowball', hand: 'armR', r: 0.6 + 0.4 * t });
      break;
    case 'throw_snowball':
      z.R = 2 + 160 * pulse(Math.min(1, t * 1.3)); z.body.rot = 8 * Math.sin(TAU * t); z.L = 10;
      if (t < 0.62) z.props.push({ kind: 'snowball', hand: 'armR', r: 1 });
      break;
    case 'ice_slide':
      // gliding: arms out for balance, a slight wobble on the ice
      z.body.rot = -8 + 2 * s; z.body.dx = -10; z.body.dy = 5 * co; z.L = 70 + 8 * s; z.R = 60 - 8 * s;
      z.footL = { dx: -14, rot: -10 }; z.footR = { dx: 14, rot: 10 };
      seat = 0.18;
      break;
    case 'jump_puddle':
      z.body.dy = -70 * p; z.body.jump = -70 * p; seat = 0.15 * (1 - p);
      z.L = 55 * p; z.R = 55 * p; z.footL = { rot: -10 * p }; z.footR = { rot: 10 * p };
      break;
    case 'play_leaves':
      z.R = 2 + 100 * p; z.L = 2 + 60 * p; z.body.rot = -6 * p; z.body.dy = -10 * p; z.happy = p > 0.6;
      break;
    case 'hide_rain':
      // huddled under the umbrella: breathing and a slight sway, eyes squint at the rain
      seat = 0.2; z.R = 150 + 4 * s; z.L = -4; z.body.sy = 1 + 0.012 * s;
      z.eye = 1 - 0.4 * Math.max(0, s);
      z.props.push({ kind: 'umbrella', open: 1 });
      break;
    case 'smell_flower':
      z.body.rot = -10 * p; z.body.dx = -10 * p; seat = 0.2 * p;
      z.eye = 1 - 0.7 * p; z.happy = p > 0.7; z.R = 2 + 15 * p;
      break;
    case 'apply_sunscreen':
      z.R = 70 + 30 * Math.sin(4 * Math.PI * t) * p; z.L = 6; z.body.rot = 3 * p;
      break;
    case 'play_beach':
      z.L = 70 + 30 * s; z.R = 80 - 30 * s; z.body.dy = -14 * Math.abs(s); z.body.jump = -14 * Math.abs(s);
      z.happy = true;
      break;
    case 'enter_water':
      seat = 0.6 * q; z.L = 30 * q; z.R = 30 * q;
      break;
    case 'swim':
      z.body.rot = 7 * s; z.body.dy = 12 * s;
      z.L = 70 + 45 * s; z.R = 70 - 45 * s;
      z.footL = { dy: -20 * Math.max(0, s) }; z.footR = { dy: -20 * Math.max(0, -s) };
      z.eye = 1 - 0.15 * Math.max(0, co);
      break;
    case 'wipe':
      // on the ladder: the right flipper holds on, the left one polishes in circles (the
      // game puts the sparkle on that hand, the "far" anchor)
      z.R = 120; z.L = 150 + 22 * Math.sin(2 * a); z.body.rot = 2.5 * s; z.body.dx = 6 * Math.sin(2 * a);
      break;
    case 'shake_water':
      z.body.rot = 12 * Math.sin(3 * Math.PI * t) * p; z.body.dx = 8 * Math.sin(3 * Math.PI * t) * p;
      z.L = 35 * p; z.R = 35 * p; z.eye = 0.4;
      break;
    default:
      throw new Error(`clip sin pose: ${clip}`);
  }
  sit(z, seat);
  return z;
}

module.exports = { pose, LOOP, AIR };
