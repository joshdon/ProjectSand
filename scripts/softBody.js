/*
 * Interaction with matter.js.
 *
 * Copyright (C) 2025, Josh Don
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
 * This encapsulates all soft body animations (which are driven by matter.js),
 * such as zombies.js.
 *
 * To learn how matter.js works, I recommend reading the source code:
 * https://github.com/liabru/matter-js
 */

const softBodyEngine = Matter.Engine.create();  /* The global matter.js engine */

/*
 * Offscreen canvas for drawing soft body animations. We draw on
 * this canvas and then transfer the data to the main
 * canvas.
 */
const softBodyCanvas = document.createElement("canvas");
softBodyCanvas.width = width;
softBodyCanvas.height = height;
const softBodyCtx = softBodyCanvas.getContext("2d", { alpha: false });

/*
 * Globals for handling mouse interaction (ie. dragging the
 * soft bodies).
 */
var softBodyDragStart = 0;  /* timestamp in milliseconds */
var softBodyFreeDrag = false;  /* whether the dragged body should ignore collisions with canvas elements */
var softBodyMouse;
var softBodyMouseConstraint;

/* ======================= game.js API ====================== */

/* Initialize all soft body elements */
function initSoftBody() {
  softBodyEngine.gravity.scale = 0.0002;  /* library default is 0.001 */

  /*
   * These are the 4 walls that bound the animation to the canvas frame
   */
  const wallDepth = 60;  /* a fairly arbitrary value, to prevent clipping */
  const categoryIgnoreMouse = Matter.Body.nextCategory();
  const options = {
    isStatic: true,
    collisionFilter: { category: categoryIgnoreMouse },
  };
  var topWall = Matter.Bodies.rectangle(width / 2, -wallDepth / 2, width * 1.2, wallDepth, options);
  var bottomWall = Matter.Bodies.rectangle(width / 2, height + wallDepth / 2, width * 1.2, wallDepth, options);
  var leftWall = Matter.Bodies.rectangle(-wallDepth / 2, height / 2, wallDepth, height * 1.2, options);
  var rightWall = Matter.Bodies.rectangle(width + wallDepth / 2, height / 2, wallDepth, height * 1.2, options);

  Matter.Composite.add(softBodyEngine.world, [
    topWall,
    bottomWall,
    leftWall,
    rightWall,
  ]);

  /*
   * Add mouse handler to allow user to drag soft bodies around.
   */
  softBodyMouse = Matter.Mouse.create(document.getElementById("mainCanvas"));
  softBodyMouseConstraint = Matter.MouseConstraint.create(softBodyEngine, {
    mouse: softBodyMouse,
    constraint: {
      stiffness: 0.2,
      render: {
        visible: false,
      },
    },
    /* We need to prevent the mouse from interacting with these invisible boundary walls */
    collisionFilter: {
      mask: ~categoryIgnoreMouse
    },
  });
  /*
   * We're attaching the mouse to the main canvas, which is not the same
   * size as the internal game canvas. They differ in scaling by the pixel
   * ratio.
   */
  Matter.Mouse.setScale(softBodyMouse, {
    x: 1.0 / window.devicePixelRatio,
    y: 1.0 / window.devicePixelRatio,
  });
  Matter.Composite.add(softBodyEngine.world, [softBodyMouseConstraint]);

  Matter.Events.on(softBodyMouseConstraint, "startdrag", (event) => {
    softBodyDragStart = Date.now();
    softBodyFreeDrag = false;
  });
  /*
   * Note: this fires for all mouse up events, even when we weren't
   * previously dragging.
   */
  Matter.Events.on(softBodyMouseConstraint, "mouseup", (event) => {
    softBodyDragStart = 0;
  });
}

/* Advance the animation of all soft bodies by the given amount of milliseconds */
function softBodyAnimate(milliseconds) {
  const now = Date.now();
  const numZombies = zombies.length;
  for (var i = 0; i < numZombies; i++) {
    zombies[i].animate(now, i, milliseconds);
  }

  Matter.Engine.update(softBodyEngine, milliseconds);
}

/* Render all soft bodies onto the main canvas */
function softBodyRender() {
  var normalZombies = [];
  var wetZombies = [];
  var burningZombies = [];
  var frozenZombies = [];

  const numZombies = zombies.length;
  for (var i = 0; i < numZombies; i++) {
    var zombie = zombies[i];
    const state = zombie.state;
    if (state === ZOMBIE_STATE_NORMAL) {
      normalZombies.push(zombie);
    } else if (state === ZOMBIE_STATE_WET) {
      wetZombies.push(zombie);
    } else if (state === ZOMBIE_STATE_BURNING) {
      burningZombies.push(zombie);
    } else if (state === ZOMBIE_STATE_FROZEN) {
      frozenZombies.push(zombie);
    } else {
      throw "unexpected state";
    }
  }

  if (normalZombies.length) {
    drawZombies(normalZombies, ZOMBIE);
  }
  if (wetZombies.length) {
    drawZombies(wetZombies, ZOMBIE_WET);
  }
  if (burningZombies.length) {
    drawZombies(burningZombies, ZOMBIE_BURNING);
  }
  if (frozenZombies.length) {
    drawZombies(frozenZombies, ZOMBIE_FROZEN);
  }
}

/* ======================= Soft Body APIs ====================== */

/* Draw the given matter.js body onto the provided `ctx`. */
function drawBody(ctx, body) {
  const vertices = body.vertices;

  ctx.moveTo(vertices[0].x, vertices[0].y);

  for (var j = 1; j < vertices.length; j += 1) {
    ctx.lineTo(vertices[j].x, vertices[j].y);
  }

  ctx.lineTo(vertices[0].x, vertices[0].y);
}

