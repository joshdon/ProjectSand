/*
 * Drives the primary game loops.
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

/* ================================ Globals ================================ */

/* Scaling due to device pixel ratio */
const onscreenPixelRatio = window.devicePixelRatio;
const onscreenScaledWidth = onscreenPixelRatio * width;
const onscreenScaledHeight = onscreenPixelRatio * height;

/* Onscreen canvas. Scaled based on pixel ratio. */
const onscreenCanvas = document.getElementById("mainCanvas");
onscreenCanvas.width = onscreenScaledWidth;
onscreenCanvas.height = onscreenScaledHeight;
onscreenCanvas.style.width = width + "px";
onscreenCanvas.style.height = height + "px";
const onscreenCtx = onscreenCanvas.getContext("2d", { alpha: false });

/*
 * Offscreen game canvas. Drawn at in-game resolution, then
 * scaled and transferred to the onscreen canvas.
 */
const gameCanvas = document.createElement("canvas");
gameCanvas.width = width;
gameCanvas.height = height;
const gameCtx = gameCanvas.getContext("2d");
const gameImagedata = gameCtx.createImageData(width, height);
const gameImagedata32 = new Uint32Array(gameImagedata.data.buffer);

/* Storage for game save state. */
const saveGameImagedata32 = new Uint32Array(gameImagedata32.length);
var gamestateSaved = false;

/* Cached for performance */
const MAX_X_IDX = width - 1;
const MAX_Y_IDX = height - 1;
const MAX_IDX = width * height - 1;

/* Globals for tracking and maintaining FPS */
var fpsSetting; /* controlled via menu */
var msPerFrame;
var lastLoop = 0;
var frameDebt = 0;
var lastFPSLabelUpdate = 0;
const refreshTimes = [];

/* ========================================================================= */

function init() {
  var gameWrapper = document.getElementById("gameWrapper");
  gameWrapper.style.height = height + "px";
  gameWrapper.style.width = width + "px";

  /* setting FPS must occur before initMenu() */
  setFPS(DEFAULT_FPS);

  initCursors();
  initElements();
  initParticles();
  initSpigots();
  initMenu();

  /* Initialize imagedata */
  const len = gameImagedata32.length;
  for (var i = 0; i < len; i++) {
    gameImagedata32[i] = BACKGROUND;
    saveGameImagedata32[i] = BACKGROUND;
  }

  /* Nice crisp pixels, regardless of pixel ratio */
  onscreenCtx.mozImageSmoothingEnabled = false;
  onscreenCtx.imageSmoothingEnabled = false;
  onscreenCtx.webkitImageSmoothingEnabled = false;
  onscreenCtx.msImageSmoothingEnabled = false;
  onscreenCtx.oImageSmoothingEnabled = false;
}

function setFPS(fps) {
  fpsSetting = fps;
  if (fps > 0) msPerFrame = 1000.0 / fpsSetting;
  else drawFPSLabel(0);
}

function updateGame() {
  updateSpigots();
  updateParticles();

  var x, y;
  var i = MAX_IDX;
  /*
   * Since i starts at MAX_IDX, we need to guarantee that we will start
   * our traversal by going to the left.
   */
  const direction = MAX_Y_IDX & 1;

  /*
   * Iterate the canvas from the bottom to top, zigzagging
   * the rows left and right.
   * To optimize for speed, we duplicate the code for the
   * left->right and right->left cases, as this is our hottest
   * inner path. This sacrifices readability, and violates DRY,
   * but is necessary for game performance.
   */
  for (y = MAX_Y_IDX; y !== -1; y--) {
    const Y = y;
    if ((Y & 1) === direction) {
      for (x = MAX_X_IDX; x !== -1; x--) {
        const elem = gameImagedata32[i];
        if (elem === BACKGROUND) {
          i--;
          continue; /* optimize to skip background */
        }
        const elem_idx =
          ((elem & 0x30000) >>> 12) + ((elem & 0x300) >>> 6) + (elem & 0x3);
        elementActions[elem_idx](x, Y, i);
        i--;
      }
      i++;
    } else {
      for (x = 0; x !== width; x++) {
        const elem = gameImagedata32[i];
        if (elem === BACKGROUND) {
          i++;
          continue;
        }
        const elem_idx =
          ((elem & 0x30000) >>> 12) + ((elem & 0x300) >>> 6) + (elem & 0x3);
        elementActions[elem_idx](x, Y, i);
        i++;
      }
      i--;
    }
    i -= width;
  }

  perfRecordFrame();
  frameDebt--;
}

function draw() {
  gameCtx.putImageData(gameImagedata, 0, 0);

  /*
   * To make sure our game looks crisp, we need to handle
   * device pixel ratio. We do this by taking our offscreen
   * game canvas (at our ingame resolution), and then scaling
   * and transferring it to the displayed canvas.
   */
  gameCtx.scale(onscreenPixelRatio, onscreenPixelRatio);
  onscreenCtx.drawImage(
    gameCanvas,
    0,
    0,
    onscreenScaledWidth,
    onscreenScaledHeight
  );
}

function setGameCanvas(elem) {
  const iterEnd = MAX_IDX + 1;
  for (var i = 0; i !== iterEnd; i++) {
    gameImagedata32[i] = elem;
  }
}

function clearGameCanvas() {
  particles.inactivateAll();
  setGameCanvas(BACKGROUND);
}

/*
 * Saves the current canvas state. Note that we don't also save particle state.
 */
function saveGameCanvas() {
  /*
   * Copy it manually, rather than use a slice, so that we can use a constant
   * global pointer.
   */
  const iterEnd = MAX_IDX + 1;
  for (var i = 0; i !== iterEnd; i++)
    saveGameImagedata32[i] = gameImagedata32[i];

  gamestateSaved = true;
}

function loadGameCanvas() {
  if (!gamestateSaved) return;

  particles.inactivateAll();

  const iterEnd = MAX_IDX + 1;
  for (var i = 0; i !== iterEnd; i++)
    gameImagedata32[i] = saveGameImagedata32[i];
}

/* Signal that we've updated a game frame to our FPS counter */
function perfRecordFrame() {
  const now = performance.now();
  const oneSecondAgo = now - 1000;
  while (refreshTimes.length > 0 && refreshTimes[0] <= oneSecondAgo) {
    refreshTimes.shift();
  }
  refreshTimes.push(now);

  if (now - lastFPSLabelUpdate > 200) {
    drawFPSLabel(refreshTimes.length);
    lastFPSLabelUpdate = now;
  }
}

function mainLoop(now) {
  window.requestAnimationFrame(mainLoop);

  /* Handle initial update */
  if (lastLoop === 0) {
    lastLoop = now;
    return;
  }

  const deltaMs = now - lastLoop;
  lastLoop = now;
  if (deltaMs < 0) {
    console.log("time has gone backwards");
    return;
  }

  if (fpsSetting > 0) frameDebt += deltaMs / msPerFrame;

  /*
   * Avoid accumulating too much frame debt, which can
   * occur, for example, from:
   * - animation loop being paused due to loss of browser
   *   tab focus
   * - excessive time needed for updateGame() due to
   *   complex update
   *
   * Naturally, this also limits our max theoretical FPS, but
   * our MAX_FPS is set lower than this limit anyway.
   */
  frameDebt = Math.min(frameDebt, 5);

  /*
   * Always update the user stroke, regardless of whether
   * we're updating the gamestate. This results in smooth
   * drawing regardless of the current set FPS.
   */
  updateUserStroke();

  if (frameDebt >= 1) {
    if (frameDebt < 2) {
      /* shortcut for the common case of a single-frame update */
      updateGame();
    } else {
      /* multi-frame update */

      /* first get approx time for a single update */
      const updateTimeMs = executeAndTime(updateGame);

      /*
       * Approx time for doing stroke, draw, etc.
       * This is very rough and could be improved.
       */
      const loopMiscTimeMs = 3.5;
      var timeRemaining = deltaMs - loopMiscTimeMs - updateTimeMs;
      while (timeRemaining > updateTimeMs && frameDebt >= 1) {
        updateGame();
        timeRemaining -= updateTimeMs;
      }
    }
  }

  draw();
}

window.onload = function () {
  init();
  mainLoop(0);
};
