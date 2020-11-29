/*
 * Handling for the four primary game spigots.
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

/* Menu options for the spigots */
const SPIGOT_ELEMENT_OPTIONS = [
  SAND,
  WATER,
  SALT,
  OIL,
  GUNPOWDER,
  NITRO,
  NAPALM,
  CONCRETE,
  LAVA,
  CRYO,
  ACID,
  MYSTERY,
];
const SPIGOT_SIZE_OPTIONS = [0, 5, 10, 15, 20, 25];
const DEFAULT_SPIGOT_SIZE_IDX = 1;

/* Type and size of each spigot. Controlled via the menu. */
const SPIGOT_ELEMENTS = [SAND, WATER, SALT, OIL];
const SPIGOT_SIZES = [];

const SPIGOT_HEIGHT = 10;
const MAX_SPIGOT_WIDTH = Math.max(...SPIGOT_SIZE_OPTIONS);
const NUM_SPIGOTS = SPIGOT_ELEMENTS.length;
const SPIGOT_SPACING = Math.round(
  (width - MAX_SPIGOT_WIDTH * NUM_SPIGOTS) / (NUM_SPIGOTS + 1) +
    MAX_SPIGOT_WIDTH
);
const SPIGOTS_ENABLED =
  MAX_SPIGOT_WIDTH * NUM_SPIGOTS <= width && SPIGOT_HEIGHT <= height;

function initSpigots() {
  const defaultSize = SPIGOT_SIZE_OPTIONS[DEFAULT_SPIGOT_SIZE_IDX];
  for (var i = 0; i !== NUM_SPIGOTS; i++) {
    SPIGOT_SIZES.push(defaultSize);
  }
}

function updateSpigots() {
  if (!SPIGOTS_ENABLED) return;

  var i, w, h;
  for (i = 0; i !== NUM_SPIGOTS; i++) {
    const elem = SPIGOT_ELEMENTS[i];
    const spigotLeft = SPIGOT_SPACING * (i + 1) - MAX_SPIGOT_WIDTH;
    const spigotRight = spigotLeft + SPIGOT_SIZES[i];
    if (spigotLeft < 0) continue;
    if (spigotRight > MAX_X_IDX) break;
    var heightOffset = 0;
    for (h = 0; h !== SPIGOT_HEIGHT; h++) {
      for (w = spigotLeft; w !== spigotRight; w++) {
        if (random() < 10) gameImagedata32[w + heightOffset] = elem;
      }
      heightOffset += width;
    }
  }
}
