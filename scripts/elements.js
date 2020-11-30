/*
 * Implementation of all the elements and their interactions.
 *
 * Copyright (C) 2020, Josh Don
 *
 * Project Sand is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Project Sand is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/*
 * ADDING NEW ELEMENTS:
 * 1. Define the element color using the __inGameColor() method.
 * 2. Add an entry for the element into the elements and elementActions
 *    arrays. The order of these arrays must match the order that elements
 *    are declared, so that we can index properly.
 * 3. If the element should be gas permeable (allow gas to pass through it),
 *    add it to the GAS_PERMEABLE dictionary in the initElements() function.
 * 4. Implement your element action function. This is a function that takes
 *    in the x, y, and i position of your element, and then responds
 *    based on your desired interaction properties.
 *
 * NOTE: Try to optimize for speed and reduce required calculation. For example,
 * limit an action to occur with probability p by using 'if (random() < p)'.
 */

/*
 * The canvas imagedata.data array is a byte array, where each pixel
 * has 4 entries: r, g, b, alpha. For speed, we treat this as a Uint32Array,
 * where each index represents these four combined values. Due to the endianness
 * of javascript, the byte order for our 32 bit integers is: alpha, b, g, r.
 *
 * We need a *fast* way to map a given 32 bit color to an index in our
 * elementActions array. To do this, we reserve the lowest 2 bits from each of
 * the r, g, and b fields. We then combine these 6 bits together, and treat this
 * value as the index. The human eye won't be able to notice that we've hijacked
 * these lower-ordered 2 bit regions of the r, g, and b channels. Thus, given
 * values of r, g, and b, the index for the color is naturally:
 * (r & 0x3) + (r & 0x300) >>> 6 + (r & 0x30000) >>> 12;
 *
 * This gives us the flexibility of using actual color data, while still
 * allowing us to *quickly* map colors to indices. A dictionary would be far too
 * slow, by several orders of magnitude (given that we need to do a lookup for
 * every pixel on the canvas, ~60-100 times per second). Similarly, implementing
 * the elements as classes and calling their class "action" methods would be too
 * slow, and lead to poor FPS.
 *
 * Originally, I toyed with using the alpha channel to represent the index, and
 * simply having the canvas ignore alpha. But it turns out that different
 * browers handle "ignoring alpha" differently, and this approach wasn't
 * supported on every browser.
 */
var __next_elem_idx = 0;
function __inGameColor(r, g, b) {
  const alpha = 0xff000000;
  r = r & 0xfc;
  g = g & 0xfc;
  b = b & 0xfc;

  const r_idx = __next_elem_idx & 0b11;
  const g_idx = (__next_elem_idx & 0b1100) >>> 2;
  const b_idx = (__next_elem_idx & 0b110000) >>> 4;

  r += r_idx;
  g += g_idx;
  b += b_idx;

  __next_elem_idx++;

  return alpha + (b << 16) + (g << 8) + r;
}

/* Order here MUST match order in elements and elementActions arrays */
const BACKGROUND = __inGameColor(0, 0, 0);
const WALL = __inGameColor(127, 127, 127);
const SAND = __inGameColor(223, 193, 99);
const WATER = __inGameColor(0, 10, 255);
const PLANT = __inGameColor(0, 220, 0);
const FIRE = __inGameColor(255, 0, 10);
const SALT = __inGameColor(253, 253, 253);
const SALT_WATER = __inGameColor(127, 175, 255);
const OIL = __inGameColor(150, 60, 0);
const SPOUT = __inGameColor(117, 189, 252);
const WELL = __inGameColor(131, 11, 28);
const TORCH = __inGameColor(200, 5, 0);
const GUNPOWDER = __inGameColor(170, 170, 140);
const WAX = __inGameColor(239, 225, 211);
const FALLING_WAX = __inGameColor(240, 225, 211);
const NITRO = __inGameColor(0, 150, 26);
const NAPALM = __inGameColor(220, 128, 70);
const C4 = __inGameColor(240, 230, 150);
const CONCRETE = __inGameColor(180, 180, 180);
const FUSE = __inGameColor(219, 175, 199);
const ICE = __inGameColor(161, 232, 255);
const CHILLED_ICE = __inGameColor(20, 153, 220);
const LAVA = __inGameColor(245, 110, 40);
const ROCK = __inGameColor(68, 40, 8);
const STEAM = __inGameColor(195, 214, 235);
const CRYO = __inGameColor(0, 213, 255);
const MYSTERY = __inGameColor(162, 232, 196);
const METHANE = __inGameColor(140, 140, 140);
const SOIL = __inGameColor(120, 75, 33);
const WET_SOIL = __inGameColor(70, 35, 10);
const BRANCH = __inGameColor(166, 128, 100);
const LEAF = __inGameColor(82, 107, 45);
const POLLEN = __inGameColor(230, 235, 110);
const CHARGED_NITRO = __inGameColor(245, 98, 78);
const ACID = __inGameColor(157, 240, 40);
const THERMITE = __inGameColor(195, 140, 70);
const BURNING_THERMITE = __inGameColor(255, 130, 130);

/*
 * It would be nice to combine the elements and elementActions
 * into a single 2d array, but to optimize for speed we need
 * to use a Uint32Array for the elements. It would also be nice
 * to abstract this out a bit and make each element its own
 * subclass. But again, this would be far too slow (class
 * property/function lookup time would be a severe bottleneck).
 */
const elements = new Uint32Array([
  BACKGROUND,
  WALL,
  SAND,
  WATER,
  PLANT,
  FIRE,
  SALT,
  SALT_WATER,
  OIL,
  SPOUT,
  WELL,
  TORCH,
  GUNPOWDER,
  WAX,
  FALLING_WAX,
  NITRO,
  NAPALM,
  C4,
  CONCRETE,
  FUSE,
  ICE,
  CHILLED_ICE,
  LAVA,
  ROCK,
  STEAM,
  CRYO,
  MYSTERY,
  METHANE,
  SOIL,
  WET_SOIL,
  BRANCH,
  LEAF,
  POLLEN,
  CHARGED_NITRO,
  ACID,
  THERMITE,
  BURNING_THERMITE,
]);
const elementActions = [
  BACKGROUND_ACTION,
  WALL_ACTION,
  SAND_ACTION,
  WATER_ACTION,
  PLANT_ACTION,
  FIRE_ACTION,
  SALT_ACTION,
  SALT_WATER_ACTION,
  OIL_ACTION,
  SPOUT_ACTION,
  WELL_ACTION,
  TORCH_ACTION,
  GUNPOWDER_ACTION,
  WAX_ACTION,
  FALLING_WAX_ACTION,
  NITRO_ACTION,
  NAPALM_ACTION,
  C4_ACTION,
  CONCRETE_ACTION,
  FUSE_ACTION,
  ICE_ACTION,
  CHILLED_ICE_ACTION,
  LAVA_ACTION,
  ROCK_ACTION,
  STEAM_ACTION,
  CRYO_ACTION,
  MYSTERY_ACTION,
  METHANE_ACTION,
  SOIL_ACTION,
  WET_SOIL_ACTION,
  BRANCH_ACTION,
  LEAF_ACTION,
  POLLEN_ACTION,
  CHARGED_NITRO_ACTION,
  ACID_ACTION,
  THERMITE_ACTION,
  BURNING_THERMITE_ACTION,
];
Object.freeze(elementActions);

const GAS_PERMEABLE = {};

const NUM_ELEMENTS = elements.length;

function initElements() {
  if (NUM_ELEMENTS > 64)
    throw "too many elements (we only use 6 bits for element index)";

  if (NUM_ELEMENTS !== elementActions.length) throw "need 1 action per element";

  const colors = {};

  for (var i = 0; i < elements.length; i++) {
    const color = elements[i];
    const color_idx =
      ((color & 0x30000) >>> 12) + ((color & 0x300) >>> 6) + (color & 0x3);

    if (color_idx !== i)
      throw "elements array order does not match element indices";

    if (color in colors) throw "duplicate color";

    if (color >>> 24 !== 0xff) {
      console.log(color, i);
      throw "alpha must be set to 0xff";
    }

    colors[color] = null;
  }

  /*
   * Add any gas-permeable elements here (ie. to allow steam etc. to pass
   * through).
   */
  GAS_PERMEABLE[SAND] = null;
  GAS_PERMEABLE[WATER] = null;
  GAS_PERMEABLE[SALT] = null;
  GAS_PERMEABLE[SALT_WATER] = null;
  GAS_PERMEABLE[OIL] = null;
  GAS_PERMEABLE[GUNPOWDER] = null;
  GAS_PERMEABLE[FALLING_WAX] = null;
  GAS_PERMEABLE[NITRO] = null;
  GAS_PERMEABLE[NAPALM] = null;
  GAS_PERMEABLE[CONCRETE] = null;
  GAS_PERMEABLE[ROCK] = null;
  GAS_PERMEABLE[CRYO] = null;
  GAS_PERMEABLE[MYSTERY] = null;
  GAS_PERMEABLE[SOIL] = null;
  GAS_PERMEABLE[WET_SOIL] = null;
  GAS_PERMEABLE[POLLEN] = null;
  GAS_PERMEABLE[CHARGED_NITRO] = null;
  GAS_PERMEABLE[ACID] = null;
  Object.freeze(GAS_PERMEABLE);
}

/* ======================= Element action handlers ======================= */

function WALL_ACTION(x, y, i) {}

function BACKGROUND_ACTION(x, y, i) {
  throw "As an optimization, we should never be invoking the action for the " +
        "background";
}

function SAND_ACTION(x, y, i) {
  /* Optimize for common case; can't sink through sand */
  if (y !== MAX_Y_IDX && uniformBelowAdjacent(x, y, i) !== SAND) {
    if (doDensitySink(x, y, i, WATER, true, 25)) return;
    if (doDensitySink(x, y, i, SALT_WATER, true, 25)) return;
  }

  if (doGravity(x, y, i, true, 95)) return;
}

function WATER_ACTION(x, y, i) {
  if (doGravity(x, y, i, true, 95)) return;
  if (doDensityLiquid(x, y, i, OIL, 25, 50)) return;
}

function PLANT_ACTION(x, y, i) {
  doGrow(x, y, i, WATER, 50);

  if (random() < 5) {
    const saltLoc = bordering(x, y, i, SALT);
    if (saltLoc !== -1) {
      gameImagedata32[i] = BACKGROUND;
      return;
    }
  }
}

function FIRE_ACTION(x, y, i) {
  /* water */
  if (random() < 80) {
    var waterLoc = bordering(x, y, i, WATER);
    if (waterLoc === -1) waterLoc = bordering(x, y, i, SALT_WATER);
    if (waterLoc !== -1) {
      /* A thermite fire is not extinguished by water */
      if (bordering(x, y, i, BURNING_THERMITE) === -1) {
        gameImagedata32[waterLoc] = STEAM;
        gameImagedata32[i] = BACKGROUND;
        return;
      }
    }
  }

  /* plant */
  if (random() < 20) {
    const plantLoc = borderingAdjacent(x, y, i, PLANT);
    if (plantLoc !== -1) {
      gameImagedata32[plantLoc] = FIRE;
      return;
    }
  }

  /* wax */
  if (random() < 1) {
    const waxLoc = bordering(x, y, i, WAX);
    if (waxLoc !== -1) {
      const waxXY = fastItoXYBordering(x, y, i, waxLoc);
      gameImagedata32[waxLoc] = FIRE;
      const fallLoc = below(
        Math.max(y, waxXY[1]),
        Math.max(i, waxLoc),
        BACKGROUND
      );
      if (fallLoc !== -1) gameImagedata32[fallLoc] = FALLING_WAX;
      return;
    }
  }

  /* fuse */
  if (random() < 80) {
    const fuseLoc = borderingAdjacent(x, y, i, FUSE);
    if (fuseLoc !== -1) {
      gameImagedata32[fuseLoc] = FIRE;
      return;
    }
  }

  /* flame out (unless in contact with element that needs to retain fire) */
  if (random() < 40) {
    var flameOut = true;

    const xStart = Math.max(x - 1, 0);
    const yStart = Math.max(y - 1, 0);
    const xEnd = Math.min(x + 2, MAX_X_IDX + 1);
    const yEnd = Math.min(y + 2, MAX_Y_IDX + 1);
    var xIter, yIter;
    for (yIter = yStart; yIter !== yEnd; yIter++) {
      const idxBase = yIter * width;
      for (xIter = xStart; xIter !== xEnd; xIter++) {
        if (yIter === y && xIter === x) continue;

        const idx = idxBase + xIter;
        const borderingElem = gameImagedata32[idx];

        if (borderingElem === FIRE) continue;

        if (
          borderingElem === PLANT ||
          borderingElem === FUSE ||
          borderingElem === BRANCH ||
          borderingElem === LEAF
        ) {
          flameOut = false;
          break;
        }

        /*
         * Wax doesn't burn at corners; flameout unles we're directly
         * touching it.
         */
        if (xIter == x || yIter == y) {
          if (borderingElem === WAX) {
            flameOut = false;
            break;
          }
        }

        if (borderingElem === OIL && random() < 50) {
          flameOut = false;
          break;
        }
      }

      if (!flameOut) break;
    }

    if (flameOut) {
      gameImagedata32[i] = BACKGROUND;
      return;
    }
  }

  /* rising fire */
  if (random() < 50) {
    const riseLoc = above(y, i, BACKGROUND);
    if (riseLoc !== -1) {
      gameImagedata32[riseLoc] = FIRE;
      return;
    }
  }
}

function SALT_ACTION(x, y, i) {
  if (doGravity(x, y, i, true, 95)) return;
  if (doTransform(x, y, i, WATER, SALT_WATER, 25, 50)) return;
  if (doDensitySink(x, y, i, SALT_WATER, true, 25)) return;
}

function SALT_WATER_ACTION(x, y, i) {
  if (doGravity(x, y, i, true, 95)) return;
  if (doDensityLiquid(x, y, i, WATER, 50, 50)) return;
}

function OIL_ACTION(x, y, i) {
  if (random() < 30) {
    if (bordering(x, y, i, FIRE) !== -1) {
      __doBorderBurn(x, y, i);
      return;
    }
  }

  if (doGravity(x, y, i, true, 95)) return;
}

function SPOUT_ACTION(x, y, i) {
  doProducer(x, y, i, WATER, false, 5);
}

function WELL_ACTION(x, y, i) {
  doProducer(x, y, i, OIL, false, 10);
}

function TORCH_ACTION(x, y, i) {
  doProducer(x, y, i, FIRE, true, 25);
}

function GUNPOWDER_ACTION(x, y, i) {
  if (random() < 95) {
    if (bordering(x, y, i, FIRE) !== -1) {
      /* Chance to set off a star shaped explosion */
      if (
        random() < 1 &&
        random() < 25 &&
        particles.particleCounts[MAGIC1_PARTICLE] < 30
      ) {
        const particle = particles.addActiveParticle(UNKNOWN_PARTICLE, x, y, i);
        if (particle) {
          particle.setColor(FIRE);
          particles.reinitializeParticle(particle, MAGIC1_PARTICLE);
        }
      } else {
        __doGunpowderExplosion(x, y, i);
      }
      return;
    }
  }

  if (doGravity(x, y, i, true, 95)) return;
}

function WAX_ACTION(x, y, i) {}

function FALLING_WAX_ACTION(x, y, i) {
  if (doGravity(x, y, i, false, 100)) return;
  gameImagedata32[i] = WAX;
}

function NITRO_ACTION(x, y, i) {
  if (doGravity(x, y, i, true, 95)) return;

  /* optimize for common case of being surrounded by nitro */
  if (surroundedByAdjacent(x, y, i, NITRO)) return;

  if (borderingAdjacent(x, y, i, FIRE) !== -1) {
    if (random() < 30) {
      if (!particles.addActiveParticle(NITRO_PARTICLE, x, y, i)) return;
      __doBorderBurn(x, y, i);
      return;
    } else if (random() < 20) {
      gameImagedata32[i] = FIRE;
      return;
    }
  }

  if (y !== MAX_Y_IDX && uniformBelowAdjacent(x, y, i) !== NITRO) {
    if (doDensitySink(x, y, i, OIL, true, 25)) return;
    if (doDensitySink(x, y, i, WATER, true, 25)) return;
    if (doDensitySink(x, y, i, SALT_WATER, true, 25)) return;
    if (doDensitySink(x, y, i, POLLEN, true, 25)) return;
  }
}

function NAPALM_ACTION(x, y, i) {
  if (random() < 25 && bordering(x, y, i, FIRE) !== -1) {
    if (!particles.addActiveParticle(NAPALM_PARTICLE, x, y, i)) {
      gameImagedata32[i] = FIRE;
    }
    return;
  }

  if (doGravity(x, y, i, true, 95)) return;
}

function C4_ACTION(x, y, i) {
  if (random() < 60 && bordering(x, y, i, FIRE) !== -1) {
    if (!particles.addActiveParticle(C4_PARTICLE, x, y, i)) {
      gameImagedata32[i] = FIRE;
    }
    return;
  }
}

function CONCRETE_ACTION(x, y, i) {
  if (y !== MAX_Y_IDX && uniformBelowAdjacent(x, y, i) !== CONCRETE) {
    if (doDensitySink(x, y, i, WATER, true, 35)) return;
    if (doDensitySink(x, y, i, SALT_WATER, true, 35)) return;
  }

  /*
   * Try to harden before falling.
   * Note that I've found the below random check works better than a single
   * check against random() < 1.
   */
  if (random() < 10 && random() < 10) {
    const wallLoc = borderingAdjacent(x, y, i, WALL);
    if (wallLoc !== -1) {
      gameImagedata32[i] = WALL;
      return;
    }
  }

  if (doGravity(x, y, i, true, 95)) return;

  if (random() < 10 && random() < 10 && random() < 5) gameImagedata32[i] = WALL;
}

function FUSE_ACTION(x, y, i) {}

function ICE_ACTION(x, y, i) {
  /*
   * NOTE: we use surroundedBy instead of surroundedByAdjacent, because all
   * of the below checks are bordering(), not borderingAdjacent().
   */
  if (surroundedBy(x, y, i, ICE)) {
    return;
  }

  /* Slow melt from WATER */
  if (random() < 1) {
    if (bordering(x, y, i, WATER) !== -1) {
      gameImagedata32[i] = WATER;
      return;
    }
  }

  /* Really fast melt from STEAM */
  if (random() < 70) {
    const steamLoc = bordering(x, y, i, STEAM);
    if (steamLoc !== -1) {
      gameImagedata32[i] = WATER;
      if (random() < 50) gameImagedata32[steamLoc] = WATER;
      return;
    }
  }

  /* Fast melt from SALT and SALT_WATER */
  if (random() < 10) {
    var saltLoc = bordering(x, y, i, SALT);
    if (saltLoc === -1) saltLoc = bordering(x, y, i, SALT_WATER);

    if (saltLoc !== -1) {
      gameImagedata32[i] = WATER;
      return;
    }
  }

  /* Fast melt from FIRE */
  if (random() < 50) {
    if (bordering(x, y, i, FIRE) !== -1) {
      gameImagedata32[i] = WATER;
      return;
    }
  }

  /* Fast melt from LAVA */
  if (random() < 50) {
    if (bordering(x, y, i, LAVA) !== -1) {
      gameImagedata32[i] = WATER;
      return;
    }
  }
}

function CHILLED_ICE_ACTION(x, y, i) {
  /* thaw to regular ice */
  if (random() < 6) {
    gameImagedata32[i] = ICE;
    return;
  }

  /*
   * Check the four surrounding pixels (up, down, left, right)
   * for something that will make us thaw faster
   */
  if (
    bordering(x, y, i, SALT) !== -1 ||
    bordering(x, y, i, SALT_WATER) !== -1 ||
    bordering(x, y, i, LAVA) !== -1 ||
    bordering(x, y, i, FIRE) !== -1 ||
    bordering(x, y, i, STEAM) !== -1
  ) {
    gameImagedata32[i] = ICE;
    return;
  }

  doGrow(x, y, i, WATER, 50);
}

/*
 * Faster than using a dictionary.
 * This assumption may change as this list gets longer.
 */
const __lava_immune = [
  LAVA,
  BACKGROUND,
  FIRE,
  WALL,
  ROCK,
  WATER,
  SALT_WATER,
  STEAM,
];
Object.freeze(__lava_immune);
const __num_lava_immune = __lava_immune.length;

function LAVA_ACTION(x, y, i) {
  if (random() < 1 && random() < 50) {
    const wallLoc = borderingAdjacent(x, y, i, WALL);
    if (wallLoc !== -1) gameImagedata32[wallLoc] = LAVA;
  }

  const up = y !== 0 ? i - width : -1;
  const down = y !== MAX_Y_IDX ? i + width : -1;
  const left = x !== 0 ? i - 1 : -1;
  const right = x !== MAX_X_IDX ? i + 1 : -1;

  var skipDirectAdjacent = true;
  if (up !== -1 && gameImagedata32[up] !== LAVA) skipDirectAdjacent = false;
  else if (
    left !== -1 &&
    gameImagedata32[left] !== LAVA &&
    gameImagedata32[left] !== BACKGROUND
  )
    skipDirectAdjacent = false;
  else if (
    right !== -1 &&
    gameImagedata32[right] !== LAVA &&
    gameImagedata32[right] !== BACKGROUND
  )
    skipDirectAdjacent = false;
  else if (
    down !== -1 &&
    gameImagedata32[down] !== LAVA &&
    gameImagedata32[down] !== BACKGROUND
  )
    skipDirectAdjacent = false;

  /*
   * Optimization. The only checks made within this scope are
   * of the four directly adjacent pixels.
   *
   * DO NOT ADD ANYTHING IN HERE THAT CHECKS CORNER PIXELS.
   */
  if (!skipDirectAdjacent) {
    var waterLoc = bordering(x, y, i, WATER);
    if (waterLoc === -1) waterLoc = bordering(x, y, i, SALT_WATER);
    if (waterLoc !== -1) {
      gameImagedata32[waterLoc] = STEAM;
      gameImagedata32[i] = ROCK;
      return;
    }

    if (random() < 4) {
      const numLavaParticles = particles.particleCounts[LAVA_PARTICLE];
      const spawnChance = numLavaParticles < 10 ? 100 : 35;
      if (random() < spawnChance) {
        if (bordering(x, y, i, OIL) !== -1) {
          particles.addActiveParticle(LAVA_PARTICLE, x, y, i);
          gameImagedata32[i] = BACKGROUND;
          return;
        }
      }
    }

    if (random() < 25) {
      const burnLocs = [up, down, left, right];
      const numBurnLocs = burnLocs.length;
      var j, k;

      for (j = 0; j !== numBurnLocs; j++) {
        const burnLoc = burnLocs[j];

        if (burnLoc === -1) continue;

        const elem = gameImagedata32[burnLoc];
        var burn = true;
        for (k = 0; k !== __num_lava_immune; k++) {
          if (elem === __lava_immune[k]) {
            burn = false;
            break;
          }
        }
        if (burn) gameImagedata32[burnLoc] = FIRE;
      }
    }

    if (random() < 6 && up !== -1) {
      if (gameImagedata32[up] === BACKGROUND) gameImagedata32[up] = FIRE;
    }

    if (down !== -1) {
      const belowElem = gameImagedata32[down];
      if (belowElem === FIRE) {
        gameImagedata32[down] = BACKGROUND;
      } else if (belowElem === STEAM && random() < 95) {
        /* Allow steam to pass through */
        gameImagedata32[down] = LAVA;
        gameImagedata32[i] = STEAM;
        return;
      }
    }

    /*
     * Allow lava to burn sideways through fire. Useful for interaction with
     * burning wax, for example.
     */
    if (random() < 15) {
      if (left !== -1) {
        if (gameImagedata32[left] === FIRE) gameImagedata32[left] = BACKGROUND;
      }
      if (right !== -1) {
        if (gameImagedata32[right] === FIRE)
          gameImagedata32[right] = BACKGROUND;
      }
    }
  }

  if (doGravity(x, y, i, true, 100)) return;
}

function ROCK_ACTION(x, y, i) {
  if (y !== MAX_Y_IDX && uniformBelowAdjacent(x, y, i) !== ROCK) {
    if (doDensitySink(x, y, i, WATER, false, 95)) return;
    if (doDensitySink(x, y, i, OIL, false, 95)) return;
    if (doDensitySink(x, y, i, SALT_WATER, false, 95)) return;
    if (doDensitySink(x, y, i, LAVA, false, 20)) return;
  }

  if (doGravity(x, y, i, false, 99)) return;

  /* Produce METHANE when in contact with OIL */
  if (random() < 1 && random() < 20 && above(y, i, OIL) !== -1) {
    const aboveOil = above(y, i, OIL);
    if (aboveOil !== -1) {
      if (random() < 50) gameImagedata32[aboveOil] = METHANE;
      else gameImagedata32[i] = METHANE;
      return;
    }
  }
}

function STEAM_ACTION(x, y, i) {
  if (doDensityGas(x, y, i, 70)) return;
  if (doRise(x, y, i, 70, 60)) return;

  /* condense due to water */
  if (random() < 5) {
    if (bordering(x, y, i, WATER) !== -1) {
      gameImagedata32[i] = WATER;
      return;
    }
  }

  /* condense/disappear due to air cooling */
  if (random() < 5 && random() < 40) {
    if (below(y, i, BACKGROUND) !== -1 && above(y, i, BACKGROUND) === -1) {
      if (random() < 30) gameImagedata32[i] = WATER;
      else gameImagedata32[i] = BACKGROUND;
      return;
    }
  }

  /* condense due to spout */
  if (random() < 5) {
    if (bordering(x, y, i, SPOUT) !== -1) {
      gameImagedata32[i] = WATER;
      return;
    }
  }

  /* steam may be trapped; disappear slowly */
  if (random() < 1 && random() < 5) {
    if (below(y, i, STEAM) === -1) {
      gameImagedata32[i] = BACKGROUND;
      return;
    }
  }
}

function CRYO_ACTION(x, y, i) {
  /* Freeze a surrounding surface */
  const xStart = Math.max(x - 1, 0);
  const yStart = Math.max(y - 1, 0);
  const xEnd = Math.min(x + 2, MAX_X_IDX + 1);
  const yEnd = Math.min(y + 2, MAX_Y_IDX + 1);
  var xIter, yIter;
  for (yIter = yStart; yIter !== yEnd; yIter++) {
    const idxBase = yIter * width;
    for (xIter = xStart; xIter !== xEnd; xIter++) {
      if (yIter === y && xIter === x) continue;

      const idx = idxBase + xIter;
      const borderingElem = gameImagedata32[idx];

      if (borderingElem === CRYO) continue;

      if (borderingElem === CHILLED_ICE && random() < 1 && random() < 5) {
        gameImagedata32[i] = CHILLED_ICE;
        return;
      }

      if (
        borderingElem === WALL ||
        borderingElem === SPOUT ||
        borderingElem === WAX ||
        borderingElem === WELL ||
        borderingElem === FUSE ||
        borderingElem === PLANT ||
        borderingElem === C4
      ) {
        gameImagedata32[i] = CHILLED_ICE;
        return;
      }

      if (borderingElem === WATER || borderingElem === ICE) {
        gameImagedata32[idx] = CHILLED_ICE;
        gameImagedata32[i] = CHILLED_ICE;
        return;
      }

      if (borderingElem === LAVA) {
        gameImagedata32[i] = BACKGROUND;
        gameImagedata32[idx] = ROCK;
        return;
      }
    }
  }

  if (doGravity(x, y, i, true, 95)) return;

  /* Freeze even if there are no nearby freezable surfaces */
  if (random() < 1 && random() < 50) {
    if (bordering(x, y, i, BACKGROUND) === -1 && !surroundedBy(x, y, i, CRYO)) {
      gameImagedata32[i] = CHILLED_ICE;
      return;
    }
  }
}

function MYSTERY_ACTION(x, y, i) {
  if (
    particles.particleActive(MAGIC1_PARTICLE) ||
    particles.particleActive(MAGIC2_PARTICLE)
  ) {
    gameImagedata32[i] = BACKGROUND;
    return;
  }

  if (doGravity(x, y, i, true, 95)) return;

  /* reduce computation cost */
  if (random() < 50) return;

  if (borderingAdjacent(x, y, i, SAND) !== -1) {
    particles.addActiveParticle(MAGIC1_PARTICLE, x, y, i);
    gameImagedata32[i] = BACKGROUND;
    return;
  }

  if (borderingAdjacent(x, y, i, SALT) !== -1) {
    particles.addActiveParticle(MAGIC2_PARTICLE, x, y, i);
    gameImagedata32[i] = BACKGROUND;
    return;
  }

  /* Random scramble the canvas when in contact with FIRE */
  if (bordering(x, y, i, FIRE) !== -1) {
    for (var idx = MAX_IDX; idx !== 0; idx--) {
      const currElem = gameImagedata32[idx];
      if (currElem === WALL) {
        continue;
      } else if (currElem === FIRE) {
        gameImagedata32[idx] = BACKGROUND;
        continue;
      } else if (currElem === MYSTERY) {
        gameImagedata32[idx] = BACKGROUND;
        continue;
      }

      const swapIdx = Math.floor(Math.random() * idx);
      const swapElem = gameImagedata32[swapIdx];

      if (swapElem === WALL || swapElem === FIRE || swapElem === MYSTERY)
        continue;

      gameImagedata32[idx] = swapElem;
      gameImagedata32[swapIdx] = currElem;
    }
  }

  /* Set off a NUKE_PARTICLE when in contact with POLLEN */
  if (bordering(x, y, i, POLLEN) !== -1) {
    particles.addActiveParticle(NUKE_PARTICLE, x, y, i);
    gameImagedata32[i] = BACKGROUND;
    return;
  }
}

function METHANE_ACTION(x, y, i) {
  if (random() < 25 && bordering(x, y, i, FIRE) !== -1) {
    if (!particles.addActiveParticle(METHANE_PARTICLE, x, y, i)) {
      gameImagedata32[i] = FIRE;
    }
    return;
  }

  /* methane is less dense than air */
  if (doRise(x, y, i, 25, 65)) return;

  if (doDensityGas(x, y, i, 70)) return;
}

function SOIL_ACTION(x, y, i) {
  if (doGravity(x, y, i, false, 99)) return;

  /* Optimize for common case; can't sink through SOIL */
  if (y !== MAX_Y_IDX && uniformBelowAdjacent(x, y, i) !== SOIL) {
    if (doDensitySink(x, y, i, WATER, true, 50)) return;
    if (doDensitySink(x, y, i, SALT_WATER, true, 50)) return;
    if (doDensitySink(x, y, i, POLLEN, true, 50)) return;
  }

  if (doTransform(x, y, i, NITRO, CHARGED_NITRO, 25, 100)) return;

  if (random() < 15) {
    const waterLoc = aboveAdjacent(x, y, i, WATER);
    if (waterLoc !== -1) {
      gameImagedata32[waterLoc] = BACKGROUND;
      gameImagedata32[i] = WET_SOIL;
      return;
    }
  }
}

function WET_SOIL_ACTION(x, y, i) {
  if (random() < 15) {
    const waterLoc = aboveAdjacent(x, y, i, WATER);
    if (waterLoc !== -1) {
      gameImagedata32[waterLoc] = BACKGROUND;
    }
  }

  if (doGravity(x, y, i, false, 99)) return;
  if (doDensitySink(x, y, i, WATER, true, 50)) return;
  if (doDensitySink(x, y, i, SALT_WATER, true, 50)) return;

  if (random() < 5) {
    if (random() < 97) {
      if (borderingAdjacent(x, y, i, WATER) === -1) gameImagedata32[i] = SOIL;
      return;
    }

    /* make tree generation less likely */
    if (random() < 35) return;

    if (
      aboveAdjacent(x, y, i, BACKGROUND) !== -1 &&
      (belowAdjacent(x, y, i, SOIL) !== -1 ||
        belowAdjacent(x, y, i, WALL) !== -1)
    ) {
      if (particles.addActiveParticle(TREE_PARTICLE, x, y, i)) {
        gameImagedata32[i] = SOIL;
      }
    }
  }
}

function BRANCH_ACTION(x, y, i) {
  if (random() < 3) {
    if (borderingAdjacent(x, y, i, FIRE) !== -1) {
      gameImagedata32[i] = FIRE;
    }
  }
}

function LEAF_ACTION(x, y, i) {
  if (random() < 5) {
    if (borderingAdjacent(x, y, i, FIRE) !== -1) {
      gameImagedata32[i] = FIRE;
    }
  }

  if (random() < 20) {
    const saltLoc = borderingAdjacent(x, y, i, SALT);
    if (saltLoc !== -1) {
      gameImagedata32[i] = BACKGROUND;
      return;
    }
  }

  if (random() < 1 && random() < 9) doProducer(x, y, i, POLLEN, false, 100);
}

function POLLEN_ACTION(x, y, i) {
  if (doGravity(x, y, i, true, 95)) return;
}

function CHARGED_NITRO_ACTION(x, y, i) {
  if (doGravity(x, y, i, true, 95)) return;

  if (y !== MAX_Y_IDX && uniformBelowAdjacent(x, y, i) !== CHARGED_NITRO) {
    if (doDensitySink(x, y, i, SOIL, true, 25)) return;
    if (doDensitySink(x, y, i, WET_SOIL, true, 25)) return;
    if (doDensitySink(x, y, i, NITRO, true, 25)) return;
    if (doDensitySink(x, y, i, POLLEN, true, 25)) return;
  }

  if (borderingAdjacent(x, y, i, FIRE) !== -1) {
    particles.addActiveParticle(CHARGED_NITRO_PARTICLE, x, y, i);
    gameImagedata32[i] = FIRE;
    return;
  }
}

function ACID_ACTION(x, y, i) {
  /* Dissolve a bordering element */
  if (random() < 10) {
    const up = y > 0 ? y - 1 : -1;
    const down = y < MAX_Y_IDX ? y + 1 : -1;
    const left = x > 0 ? x - 1 : -1;
    const right = x < MAX_X_IDX ? x + 1 : -1;
    const xLocs = [left, right, x];
    const yLocs = [down, up, y];
    /* Don't bias left/right or up/down */
    if (random() < 50) {
      xLocs[0] = right;
      xLocs[1] = left;
    }
    if (random() < 50) {
      yLocs[0] = up;
      yLocs[1] = down;
    }
    var xLocsIter, yLocsIter;
    for (yLocsIter = 0; yLocsIter !== 3; yLocsIter++) {
      const yIter = yLocs[yLocsIter];
      if (yIter === -1) continue;

      if (random() < 25 && yIter !== down)
        continue;

      const idxBase = yIter * width;
      for (xLocsIter = 0; xLocsIter !== 3; xLocsIter++) {
        const xIter = xLocs[xLocsIter];
        if (xIter === -1) continue;

        if (yIter === y && xIter === x) continue;

        /* Don't consider corners */
        if (xIter !== x && yIter !== y) continue;

        const idx = idxBase + xIter;
        const borderingElem = gameImagedata32[idx];

        if (borderingElem === ACID ||
            borderingElem === BACKGROUND ||
            borderingElem === WATER ||
            borderingElem === SALT_WATER ||
            borderingElem === ICE ||
            borderingElem === CHILLED_ICE ||
            borderingElem === CRYO)
          continue;

        if (yIter !== y + 1) {
          gameImagedata32[idx] = BACKGROUND;
          return;
        }

        gameImagedata32[i] = BACKGROUND;
        if (borderingElem !== WALL || random() < 75)
          gameImagedata32[idx] = ACID;
        return;
      }
    }
  }

  if (doDensityLiquid(x, y, i, WATER, 25, 30)) return;
  if (doDensityLiquid(x, y, i, SALT_WATER, 25, 30)) return;

  if (doGravity(x, y, i, true, 100)) return;
}

function THERMITE_ACTION(x, y, i) {
  if (surroundedByAdjacent(x, y, i, THERMITE)) return;

  /* Chance to turn into BURNING_THERMITE if near fire */
  if (random() < 50) {
    if (borderingAdjacent(x, y, i, FIRE) !== -1) {
      gameImagedata32[i] = BURNING_THERMITE;
      return;
    }
  }

  if (doDensitySink(x, y, i, WATER, false, 95)) return;
  if (doDensitySink(x, y, i, SALT_WATER, false, 95)) return;
  if (doDensitySink(x, y, i, OIL, false, 95)) return;

  if (doGravity(x, y, i, false, 99)) return;
}

function BURNING_THERMITE_ACTION(x, y, i) {
  const aboveIdx = y > 0 ? i - width : -1;
  const leftIdx = x > 0 ? i - 1 : -1;
  const rightIdx = x < MAX_X_IDX ? i + 1 : -1;
  const burnLocs = [aboveIdx, leftIdx, rightIdx];
  var iter;
  for (iter = 0; iter !== 3; iter++) {
    const burnLoc = burnLocs[iter];
    if (burnLoc === -1) continue;

    const elem = gameImagedata32[burnLoc];
    if (elem !== THERMITE &&
        elem !== BURNING_THERMITE &&
        elem !== LAVA &&
        elem !== WALL) {
      gameImagedata32[burnLoc] = FIRE;
    }
  }

  if (random() < 2 && random() < 7) {
    particles.addActiveParticle(CHARGED_NITRO_PARTICLE, x, y, i);
    gameImagedata32[i] = FIRE;
    return;
  }

  /* Chance to consume */
  if (random() < 2) {
    gameImagedata32[i] = FIRE;
    return;
  }

  /* Burn through WALL */
  if (random() < 8) {
    const adjWall = adjacent(x, i, WALL);
    if (adjWall !== -1)
      gameImagedata32[adjWall] = BACKGROUND;

    const belowWall = below(y, i, WALL);
    if (belowWall !== -1)
      gameImagedata32[belowWall] = BACKGROUND;
  }

  /*
   * Need to be able to fall through a fire set by by a neighbor in the
   * (x +- 1, y + 1) position.
   */
  const belowFire = below(y, i, FIRE);
  if (belowFire !== -1)
    gameImagedata32[belowFire] = BACKGROUND;
  if (doGravity(x, y, i, false, 99)) return;

  if (doDensitySink(x, y, i, WATER, false, 95)) return;
  if (doDensitySink(x, y, i, SALT_WATER, false, 95)) return;
  if (doDensitySink(x, y, i, OIL, false, 95)) return;
}

/*  =============================== Helpers =============================== */

function __pickRandValid(a, b) {
  const aValid = a !== -1;
  const bValid = b !== -1;

  if (aValid && bValid) return random() < 50 ? a : b;
  else if (aValid) return a;
  else if (bValid) return b;
  else return -1;
}

/* Checks single pixel immediately below */
function below(y, i, type) {
  if (y === MAX_Y_IDX) return -1;

  const belowSpot = i + width;
  if (gameImagedata32[belowSpot] === type) return belowSpot;
  return -1;
}

/* Checks the pixel below, and the 2 diagonally below */
function belowAdjacent(x, y, i, type) {
  if (y === MAX_Y_IDX) return -1;

  const belowSpot = i + width;

  if (gameImagedata32[belowSpot] === type) return belowSpot;

  const belowLeftSpot = belowSpot - 1;
  const belowLeftMatch =
    x !== 0 && gameImagedata32[belowLeftSpot] === type ? belowLeftSpot : -1;

  const belowRightSpot = belowSpot + 1;
  const belowRightMatch =
    x !== MAX_X_IDX && gameImagedata32[belowRightSpot] === type
      ? belowRightSpot
      : -1;

  return __pickRandValid(belowLeftMatch, belowRightMatch);
}

/* Checks single pixel immediately above */
function above(y, i, type) {
  if (y === 0) return -1;

  const aboveSpot = i - width;
  if (gameImagedata32[aboveSpot] === type) return aboveSpot;
  return -1;
}

/* Checks the pixel above, and the 2 diagonally above */
function aboveAdjacent(x, y, i, type) {
  if (y === 0) return -1;

  const aboveSpot = i - width;
  if (gameImagedata32[aboveSpot] === type) return aboveSpot;

  const aboveLeftSpot = aboveSpot - 1;
  const aboveLeftMatch =
    x !== 0 && gameImagedata32[aboveLeftSpot] === type ? aboveLeftSpot : -1;

  const aboveRightSpot = aboveSpot + 1;
  const aboveRightMatch =
    x !== MAX_X_IDX && gameImagedata32[aboveRightSpot] === type
      ? aboveRightSpot
      : -1;

  return __pickRandValid(aboveLeftMatch, aboveRightMatch);
}

/* Checks the two pixels on the side (right and left) */
function adjacent(x, i, type) {
  const leftSpot = i - 1;
  const rightSpot = i + 1;

  const leftMatch =
    x !== 0 && gameImagedata32[leftSpot] === type ? leftSpot : -1;
  const rightMatch =
    x !== MAX_X_IDX && gameImagedata32[rightSpot] === type ? rightSpot : -1;

  return __pickRandValid(leftMatch, rightMatch);
}

/* Checks up, down, left, and right. Does not check corners. */
function bordering(x, y, i, type) {
  var loc = -1;

  if (y !== MAX_Y_IDX) {
    loc = below(y, i, type);
  }

  if (loc === -1) {
    loc = adjacent(x, i, type);
  }

  if (loc === -1 && y !== 0) {
    loc = above(y, i, type);
  }

  return loc;
}

/* Checks all 8 adjacent pixels, including corners */
function borderingAdjacent(x, y, i, type) {
  var loc = -1;

  if (y !== MAX_Y_IDX) {
    loc = belowAdjacent(x, y, i, type);
  }

  if (loc === -1) {
    loc = adjacent(x, i, type);
  }

  if (loc === -1 && y !== 0) {
    loc = aboveAdjacent(x, y, i, type);
  }

  return loc;
}

/* Checks up, down, left, and right. Does not check corners. */
function surroundedBy(x, y, i, type) {
  if (y !== MAX_Y_IDX && gameImagedata32[i + width] !== type) return false;
  if (y !== 0 && gameImagedata32[i - width] !== type) return false;
  if (x !== 0 && gameImagedata32[i - 1] !== type) return false;
  if (x !== MAX_X_IDX && gameImagedata32[i + 1] !== type) return false;

  return true;
}

/* Checks all 8 adjacent pixels, including corners */
function surroundedByAdjacent(x, y, i, type) {
  const atBottom = y === MAX_Y_IDX;
  const atTop = y === 0;

  if (!atBottom && gameImagedata32[i + width] !== type) return false;
  if (!atTop && gameImagedata32[i - width] !== type) return false;

  if (x !== 0) {
    const idx = i - 1;
    if (gameImagedata32[idx] !== type) return false;
    if (!atTop && gameImagedata32[idx - width] !== type) return false;
    if (!atBottom && gameImagedata32[idx + width] !== type) return false;
  }

  if (x !== MAX_X_IDX) {
    const idx = i + 1;
    if (gameImagedata32[idx] !== type) return false;
    if (!atTop && gameImagedata32[idx - width] !== type) return false;
    if (!atBottom && gameImagedata32[idx + width] !== type) return false;
  }

  return true;
}

/* Checks up, down, left, and right. Does not check corners. */
function surroundedByCount(x, y, i, type) {
  var count = 0;

  if (y !== MAX_Y_IDX && gameImagedata32[i + width] === type) count++;
  if (y !== 0 && gameImagedata32[i - width] === type) count++;
  if (x !== 0 && gameImagedata32[i - 1] === type) count++;
  if (x !== MAX_X_IDX && gameImagedata32[i + 1] === type) count++;

  return count;
}

/*
 * Counts number of bordering elements of the given type (checks all 8
 * adjacent pixels).
 */
function surroundedByAdjacentCount(x, y, i, type) {
  const atBottom = y === MAX_Y_IDX;
  const atTop = y === 0;
  var count = 0;

  if (!atBottom && gameImagedata32[i + width] === type) count++;
  if (!atTop && gameImagedata32[i - width] === type) count++;

  if (x !== 0) {
    const idx = i - 1;
    if (gameImagedata32[idx] === type) count++;
    if (!atTop && gameImagedata32[idx - width] === type) count++;
    if (!atBottom && gameImagedata32[idx + width] === type) count++;
  }

  if (x !== MAX_X_IDX) {
    const idx = i + 1;
    if (gameImagedata32[idx] === type) count++;
    if (!atTop && gameImagedata32[idx - width] === type) count++;
    if (!atBottom && gameImagedata32[idx + width] === type) count++;
  }

  return count;
}

function doGravity(x, y, i, fallAdjacent, chance) {
  if (random() >= chance) return false;

  if (y === MAX_Y_IDX) {
    gameImagedata32[i] = BACKGROUND;
    return true;
  }

  var newI;

  if (fallAdjacent) newI = belowAdjacent(x, y, i, BACKGROUND);
  else newI = below(y, i, BACKGROUND);

  if (newI === -1 && fallAdjacent) newI = adjacent(x, i, BACKGROUND);

  if (newI !== -1) {
    gameImagedata32[newI] = gameImagedata32[i];
    gameImagedata32[i] = BACKGROUND;
    return true;
  }

  return false;
}

/*
 * Note that this will not behave *exactly* like an inverse to
 * the gravity function. This is because the assumption that
 * elements only travel downwards is baked into key components
 * of the game (for example, the fact that we update the game
 * from bottom to top).
 */
function doRise(x, y, i, riseChance, adjacentChance) {
  var newI = -1;
  if (random() < riseChance) {
    if (y === 0) {
      gameImagedata32[i] = BACKGROUND;
      return true;
    } else {
      newI = aboveAdjacent(x, y, i, BACKGROUND);
    }
  }

  if (newI === -1 && random() < adjacentChance)
    newI = adjacent(x, i, BACKGROUND);

  if (newI !== -1) {
    gameImagedata32[newI] = gameImagedata32[i];
    gameImagedata32[i] = BACKGROUND;
    return true;
  }

  return false;
}

/* Sink the current solid element if it is on top of heavierThan */
function doDensitySink(x, y, i, heavierThan, sinkAdjacent, chance) {
  if (random() >= chance) return false;

  if (y === MAX_Y_IDX) return false;

  var newI;
  if (sinkAdjacent) newI = belowAdjacent(x, y, i, heavierThan);
  else newI = below(y, i, heavierThan);

  if (newI === -1) return false;

  gameImagedata32[newI] = gameImagedata32[i];
  gameImagedata32[i] = heavierThan;
  return true;
}

/* Sink the current liquid element if it is on top of heavierThan */
function doDensityLiquid(x, y, i, heavierThan, sinkChance, equalizeChance) {
  var newI = -1;

  if (random() < sinkChance) newI = belowAdjacent(x, y, i, heavierThan);

  if (newI === -1 && random() < equalizeChance)
    newI = adjacent(x, i, heavierThan);

  if (newI === -1) return false;

  gameImagedata32[newI] = gameImagedata32[i];
  gameImagedata32[i] = heavierThan;
  return true;
}

function doGrow(x, y, i, intoColor, chance) {
  if (random() >= chance) return false;

  const growLoc = borderingAdjacent(x, y, i, intoColor);
  if (growLoc === -1) return false;

  gameImagedata32[growLoc] = gameImagedata32[i];
  return true;
}

function __doBorderBurn(x, y, i) {
  if (y !== 0) gameImagedata32[i - width] = FIRE;
  if (y !== MAX_Y_IDX) gameImagedata32[i + width] = FIRE;
  if (x !== 0) gameImagedata32[i - 1] = FIRE;
  if (x !== MAX_X_IDX) gameImagedata32[i + 1] = FIRE;

  gameImagedata32[i] = FIRE;
}

function __doGunpowderExplosion(x, y, i) {
  const burn = random() < 60;
  const replace = burn ? FIRE : GUNPOWDER;
  const isNotLeftmost = x !== 0;
  const isNotRightmost = x !== MAX_X_IDX;

  gameImagedata32[i] = replace;
  if (y !== 0) {
    const up = i - width;
    gameImagedata32[up] = replace;
    if (isNotLeftmost) gameImagedata32[up - 1] = replace;
    if (isNotRightmost) gameImagedata32[up + 1] = replace;
  }

  if (isNotLeftmost) gameImagedata32[i - 1] = replace;
  if (isNotRightmost) gameImagedata32[i + 1] = replace;

  if (y !== MAX_Y_IDX) {
    const down = i + width;
    gameImagedata32[down] = replace;
    if (isNotLeftmost) gameImagedata32[down - 1] = replace;
    if (isNotRightmost) gameImagedata32[down + 1] = replace;
  }

  if (!burn) return;

  /* make less likely to burn at 2 pixel distance */
  if (random() >= 40) return;

  if (y - 2 >= 0) {
    const twoUp = i - 2 * width;
    if (gameImagedata32[twoUp] !== GUNPOWDER || random() < 50)
      gameImagedata32[twoUp] = FIRE;
  }
  if (y + 2 >= 0) {
    const twoDown = i + 2 * width;
    if (gameImagedata32[twoDown] !== GUNPOWDER || random() < 50)
      gameImagedata32[twoDown] = FIRE;
  }
  if (x - 2 >= 0) {
    const twoLeft = i - 2;
    if (gameImagedata32[twoLeft] !== GUNPOWDER || random() < 50)
      gameImagedata32[twoLeft] = FIRE;
  }
  if (x + 2 >= 0) {
    const twoRight = i + 2;
    if (gameImagedata32[twoRight] !== GUNPOWDER || random() < 50)
      gameImagedata32[twoRight] = FIRE;
  }
}

function doTransform(
  x,
  y,
  i,
  transformBy,
  transformInto,
  transformChance,
  consumeChance
) {
  const rand = random();
  if (rand >= transformChance) return false;

  const transformLoc = bordering(x, y, i, transformBy);
  if (transformLoc === -1) return false;

  gameImagedata32[i] = transformInto;
  if (rand < consumeChance) gameImagedata32[transformLoc] = transformInto;
  return true;
}

function doProducer(x, y, i, produce, overwriteAdjacent, chance) {
  if (random() >= chance) return false;

  const up = i - width;
  const down = i + width;
  const left = i - 1;
  const right = i + 1;

  if (y !== 0 && (overwriteAdjacent || gameImagedata32[up] === BACKGROUND))
    gameImagedata32[up] = produce;
  if (
    y !== MAX_Y_IDX &&
    (overwriteAdjacent || gameImagedata32[down] === BACKGROUND)
  )
    gameImagedata32[down] = produce;
  if (x !== 0 && (overwriteAdjacent || gameImagedata32[left] === BACKGROUND))
    gameImagedata32[left] = produce;
  if (
    x !== MAX_X_IDX &&
    (overwriteAdjacent || gameImagedata32[right] === BACKGROUND)
  )
    gameImagedata32[right] = produce;
}

/*
 * If there is only a single type of element in the 3 pixels
 * below this coordinate, return that element. Otherwise, -1.
 */
function uniformBelowAdjacent(x, y, i) {
  if (y === MAX_Y_IDX) return -1;

  const belowIdx = i + width;
  const belowElem = gameImagedata32[belowIdx];

  if (x !== 0 && gameImagedata32[belowIdx - 1] !== belowElem) return -1;

  if (x !== MAX_X_IDX && gameImagedata32[belowIdx + 1] !== belowElem) return -1;

  return belowElem;
}

function gasPermeable(elem) {
  /* optimize for common case */
  if (elem === BACKGROUND || elem === STEAM || elem === METHANE) return false;

  return elem in GAS_PERMEABLE;
}

/* allow elements to fall through/displace gas elements */
function doDensityGas(x, y, i, chance) {
  if (random() >= chance) return false;

  if (y === 0) return false;

  const gasElem = gameImagedata32[i];

  var swapSpot = -1;
  const aboveSpot = i - width;
  const aboveLeft = aboveSpot - 1;
  const aboveRight = aboveSpot + 1;
  const aboveElem = gameImagedata32[aboveSpot];
  if (gasPermeable(aboveElem)) swapSpot = aboveSpot;
  else {
    const aboveLeft = aboveSpot - 1;
    const aboveRight = aboveSpot + 1;
    const aboveLeftElem = x !== 0 ? gameImagedata32[aboveLeft] : -1;
    const aboveRightElem = x !== MAX_X_IDX ? gameImagedata32[aboveRight] : -1;
    var swapAboveLeft = -1;
    var swapAboveRight = -1;

    /*
     * This code is longer than usual in order to optimize to reduce the
     * number of dictionary lookups performed.
     */

    if (aboveLeftElem !== aboveElem && gasPermeable(aboveLeftElem))
      swapAboveLeft = aboveLeft;

    if (aboveRightElem !== aboveElem) {
      if (swapAboveLeft !== -1 && aboveLeftElem === aboveRightElem)
        swapAboveRight = aboveRight;
      else if (gasPermeable(aboveRightElem)) swapAboveRight = aboveRight;
    }

    swapSpot = __pickRandValid(swapAboveLeft, swapAboveRight);
  }

  /*
   * We also have a chance to swap adjacent; this makes the behavior look more
   * like a gas.
   */
  if (swapSpot === -1 && x !== 0 && x !== MAX_X_IDX && y !== MAX_Y_IDX) {
    const leftElem = gameImagedata32[i - 1];
    if (gasPermeable(leftElem) && gameImagedata32[i - 1 + width] !== gasElem) {
      swapSpot = i - 1;
    } else {
      const rightElem = gameImagedata32[i + 1];
      if (gasPermeable(rightElem) && gameImagedata32[i + 1 + width] !== gasElem)
        swapSpot = i + 1;
    }
  }

  if (swapSpot === -1) return false;

  gameImagedata32[i] = gameImagedata32[swapSpot];
  gameImagedata32[swapSpot] = gasElem;
  return true;
}
