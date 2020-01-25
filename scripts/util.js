/*
 * Miscellaneous utility functions and constants.
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

/* Pre-compute to improve performance */
const TWO_PI = 2 * Math.PI;
const HALF_PI = Math.PI / 2;
const QUARTER_PI = Math.PI / 4;
const EIGHTH_PI = Math.PI / 8;
const SIXTEENTH_PI = Math.PI / 16;
const EIGHTEENTH_PI = Math.PI / 18;

const __num_rand_ints = 8192;
const __rand_ints = new Uint8Array(__num_rand_ints);
var __next_rand = 0;
for (var i = 0; i < __num_rand_ints; i++) {
  __rand_ints[i] = Math.floor(Math.random() * 100);
}

/*
 * Returns a pre-generated random byte between 0-99.
 * This is especially important for hot-paths that
 * can't tolerate the time to call Math.random() directly
 * (or deal with floats).
 */
function random() {
  const r = __rand_ints[__next_rand];

  __next_rand++;
  if (__next_rand === __num_rand_ints) __next_rand = 0;

  return r;
}

function executeAndTime(func) {
  const start = performance.now();
  func();
  const end = performance.now();

  return end - start;
}

function displayPerformance(func, funcName) {
  const execTime = executeAndTime(func);

  console.log(funcName, ": ", execTime, "ms");
}

function docOffsetLeft(elem) {
  var offsetLeft = 0;
  do {
    if (!isNaN(elem.offsetLeft)) {
      offsetLeft += elem.offsetLeft;
    }
  } while ((elem = elem.offsetParent));
  return offsetLeft;
}

function docOffsetTop(elem) {
  var offsetTop = 0;
  do {
    if (!isNaN(elem.offsetTop)) {
      offsetTop += elem.offsetTop;
    }
  } while ((elem = elem.offsetParent));
  return offsetTop;
}

function distance(x1, y1, x2, y2) {
  const dx = x1 - x2;
  const dy = y1 - y2;

  return Math.sqrt(dx * dx + dy * dy);
}

/*
 * We could convert i to xy using division and modulus, but
 * this can be slow. In cases where we want to convert a coordinate
 * 'i' that is known to border another coordinate with known xy,
 * we can determine the xy of the coordinate by iterating all
 * bordering pixels.
 */
function fastItoXYBorderingAdjacent(startX, startY, startI, goalI) {
  const bottom = startI + width;
  if (bottom === goalI) return [startX, startY + 1];
  else if (bottom - 1 === goalI) return [startX - 1, startY + 1];
  else if (bottom + 1 === goalI) return [startX + 1, startY + 1];

  if (startI - 1 === goalI) return [startX - 1, startY];
  else if (startI + 1 === goalI) return [startX + 1, startY];

  const top = startI - width;
  if (top === goalI) return [startX, startY - 1];
  else if (top - 1 === goalI) return [startX - 1, startY - 1];
  else if (top + 1 === goalI) return [startX + 1, startY - 1];

  throw "Not passed a bordering coordinate";
}

/*
 * See comment on fastItoXYBorderingAdjacent.
 * This function does the same, but ignores corners.
 */
function fastItoXYBordering(startX, startY, startI, goalI) {
  if (startI + width === goalI) return [startX, startY + 1];

  if (startI - 1 === goalI) return [startX - 1, startY];
  else if (startI + 1 === goalI) return [startX + 1, startY];

  if (startI - width === goalI) return [startX, startY - 1];

  throw "Not passed a bordering coordinate";
}
