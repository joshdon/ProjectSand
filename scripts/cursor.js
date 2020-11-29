/*
 * Deals with the user drawing on the canvas.
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
 * Cursor options. Controlled via the menu.
 */
var PENSIZE;
var SELECTED_ELEM;
var OVERWRITE_ENABLED;

/*
 * Offscreen canvas for drawing user stroke. We draw on
 * this canvas and then transfer the data to the main
 * canvas. We can't use the built-in drawing methods directly
 * on the main game canvas, since it produces off-shade colors
 * in order to perform anti-aliasing.
 */
const userstrokeCanvas = document.createElement("canvas");
userstrokeCanvas.width = width;
userstrokeCanvas.height = height;
const userstrokeCtx = userstrokeCanvas.getContext("2d", { alpha: false });

const CURSORS = [];

/* Generic cursor */
class Cursor {
  constructor(canvas) {
    /* x, y, prevX, and prevY are coordinates *inside* the canvas */
    this.x = 0;
    this.y = 0;
    this.prevX = 0;
    this.prevY = 0;

    /*
     * documentX and documentY are coordinates relative to the canvas, but
     * be outside the canvas (ie. negative)
     */
    this.documentX = 0;
    this.documentY = 0;

    this.isDown = false;
    this.inCanvas = false;
    this.canvas = canvas;
  }

  canvasCursorDown(x, y) {
    this.isDown = true;
    this.inCanvas = true;

    this.prevX = x;
    this.prevY = y;
    this.x = x;
    this.y = y;
  }

  canvasCursorMove(getPos) {
    if (!this.isDown) return;

    const pos = getPos();

    this.x = pos[0];
    this.y = pos[1];
  }

  canvasCursorEnter(getInnerCoords, getOuterCoords) {
    this.inCanvas = true;

    if (!this.isDown) return;

    const innerCoords = getInnerCoords(this);
    const outerCoords = getOuterCoords(this);

    Cursor.interpolateCursorBorderPosition(innerCoords, outerCoords);

    this.prevX = outerCoords[0];
    this.prevY = outerCoords[1];
    this.x = innerCoords[0];
    this.y = innerCoords[1];
  }

  canvasCursorLeave(getOuterCoords) {
    this.inCanvas = false;

    if (!this.isDown) return;

    const outerCoords = getOuterCoords(this);
    Cursor.interpolateCursorBorderPosition(
      [this.prevX, this.prevY],
      outerCoords
    );

    this.x = outerCoords[0];
    this.y = outerCoords[1];
  }

  documentCursorMove(getPos) {
    if (!this.isDown) return;
    if (this.inCanvas) return;

    const pos = getPos();
    this.documentX = pos[0];
    this.documentY = pos[1];
  }

  documentCursorUp() {
    this.isDown = false;
  }

  documentCursorDown(e, getPos) {
    if (e.target == onscreenCanvas) return;
    if (this.isDown) return;

    this.isDown = true;
    this.inCanvas = false;

    /*
     * prevent drawStroke() from mistakenly drawing another segment if the
     * cursor was previously in the canvas
     */
    this.prevX = this.x;
    this.prevY = this.y;

    const pos = getPos(this);
    this.documentX = pos[0];
    this.documentY = pos[1];
  }

  documentVisibilityChange(e) {}

  /*
   * Given that the cursor moved from coordinates outside the canvas
   * to coordinates inside the canvas, interpolate the coordinate that
   * the cursor passed through on the border of the canvas.
   *
   * Modifies and returns the result in outercoords.
   *
   * Note that outercoords is relative to the canvas, not the document.
   */
  static interpolateCursorBorderPosition(innercoords, outercoords) {
    /* Get line parameters */
    var dy = innercoords[1] - outercoords[1];
    var dx = innercoords[0] - outercoords[0];
    if (dy === 0) dy = 0.001;
    if (dx === 0) dx = 0.001;
    const slope = dy / dx;
    const y_intercept = innercoords[1] - slope * innercoords[0];

    if (outercoords[0] < 0) {
      outercoords[0] = 0;
      outercoords[1] = y_intercept;
    } else if (outercoords[0] > MAX_X_IDX) {
      outercoords[0] = MAX_X_IDX;
      outercoords[1] = slope * MAX_X_IDX + y_intercept;
    }

    if (outercoords[1] < 0) {
      outercoords[1] = 0;
      outercoords[0] = (0 - y_intercept) / slope;
    } else if (outercoords[1] > MAX_Y_IDX) {
      outercoords[1] = MAX_Y_IDX;
      outercoords[0] = (MAX_Y_IDX - y_intercept) / slope;
    }

    outercoords[0] = Math.floor(outercoords[0]);
    outercoords[1] = Math.floor(outercoords[1]);

    /* Just in case... */
    outercoords[0] = Math.max(Math.min(outercoords[0], MAX_X_IDX), 0);
    outercoords[1] = Math.max(Math.min(outercoords[1], MAX_Y_IDX), 0);

    return outercoords;
  }

  /*
   * This is a lot of code, but the idea here is simple.
   * We use a subset of the cursor canvas just big enough
   * to fit the user stroke (ie. why bother use the entire
   * width*height canvas if the userstroke is really small).
   * However, this means that we need to do a bit of math to
   * translate the cursor stroke into its proper position on
   * the main canvas.
   */
  drawStroke() {
    if (!this.isDown) return;
    if (!this.inCanvas) {
      if (this.prevX === this.x && this.prevY === this.y) return;
    }

    const color = SELECTED_ELEM;
    const overwrite = OVERWRITE_ENABLED || color === BACKGROUND;
    const r = color & 0xff;
    const g = (color & 0xff00) >>> 8;
    const b = (color & 0xff0000) >>> 16;
    /*
     * As an optimization, we skip over 0xff000000 below.
     * If this is our color (ie. eraser), we need to slightly
     * modify it.
     */
    const colorString =
      color !== 0xff000000
        ? "rgba(" + r + "," + g + "," + b + ", 1)"
        : "rgba(1, 0, 0, 1)";

    /* (x1, y1) is the leftmost coordinate */
    const x1 = Math.min(this.prevX, this.x);
    const x2 = Math.max(this.prevX, this.x);
    const y1 = this.prevX <= this.x ? this.prevY : this.y;
    const y2 = this.prevX <= this.x ? this.y : this.prevY;

    this.prevX = this.x;
    this.prevY = this.y;

    const strokeBuffer = Math.ceil(PENSIZE / 2);
    const x_translate = x1 - strokeBuffer;
    const y_translate = Math.min(y1, y2) - strokeBuffer;
    const x1_relative = x1 - x_translate;
    const y1_relative = y1 - y_translate;
    const x2_relative = x2 - x_translate;
    const y2_relative = y2 - y_translate;

    /* Initialize offscreen canvas. Ensure our drawing area starts black */
    const userstroke_width = x2_relative + PENSIZE + 2;
    const userstroke_height = Math.max(y1_relative, y2_relative) + PENSIZE + 2;
    if (userstrokeCanvas.width < userstroke_width)
      userstrokeCanvas.width = userstroke_width;
    if (userstrokeCanvas.height < userstroke_height)
      userstrokeCanvas.height = userstroke_height;

    userstrokeCtx.beginPath();
    userstrokeCtx.rect(0, 0, userstroke_width, userstroke_height);
    userstrokeCtx.fillStyle = "rgba(0, 0, 0, 1)";
    userstrokeCtx.fill();

    /*
     * Some browsers *cough* Edge *cough* Safari *cough* can't
     * handle drawing a line if the start and end are the same point.
     * So, special case this and draw a circle instead.
     */
    if (x1_relative === x2_relative && y1_relative === y2_relative) {
      userstrokeCtx.beginPath();
      userstrokeCtx.lineWidth = 0;
      userstrokeCtx.fillStyle = colorString;
      userstrokeCtx.arc(x1_relative, y1_relative, PENSIZE / 2, 0, TWO_PI);
      userstrokeCtx.fill();
    } else {
      userstrokeCtx.lineWidth = PENSIZE;
      userstrokeCtx.strokeStyle = colorString;
      userstrokeCtx.lineCap = "round";
      userstrokeCtx.beginPath();
      userstrokeCtx.moveTo(x1_relative, y1_relative);
      userstrokeCtx.lineTo(x2_relative, y2_relative);
      userstrokeCtx.stroke();
    }

    const strokeImageData = userstrokeCtx.getImageData(
      0,
      0,
      userstroke_width,
      userstroke_height
    );
    const strokeImageData32 = new Uint32Array(strokeImageData.data.buffer);

    /* Transfer line from offscreen canvas to main canvas */
    var x, y;
    const xStart = Math.max(0, -1 * x_translate);
    const yStart = Math.max(0, -1 * y_translate);
    const xTerminate = Math.min(userstroke_width, width - x_translate);
    const yTerminate = Math.min(userstroke_height, height - y_translate);
    if (xStart > xTerminate || yStart > yTerminate) {
      console.log("Bug in userstroke drawing");
      return;
    }
    for (y = yStart; y !== yTerminate; y++) {
      const y_absolute = y + y_translate;
      const offset_absolute = y_absolute * width;
      const offset_relative = y * userstroke_width;
      for (x = xStart; x !== xTerminate; x++) {
        const x_absolute = x + x_translate;

        /*
         * Note that not all pixels will be equal to 'color'; browser will
         * anti-alias the line, which will result in some grayscale colors as
         * well. So, it is sufficient (and necessary) to consider a pixel
         * colored as long as it is not black.
         */
        if (strokeImageData32[x + offset_relative] !== 0xff000000) {
          const absIdx = x_absolute + offset_absolute;
          if (overwrite || gameImagedata32[absIdx] === BACKGROUND)
            gameImagedata32[absIdx] = color;
        }
      }
    }
  }
}

class Mouse extends Cursor {
  constructor(canvas) {
    super(canvas);

    this.shiftStartX = 0;
    this.shiftStartY = 0;
    this.shiftPressed = false;
    this.lineDirection = Mouse.NO_DIRECTION; /* for use with shift key */
  }

  canvasMouseDown(e) {
    const mousePos = Mouse.getMousePos(e, true, this.canvas);

    /* Fix bug that left the canvas stuck in "shift" mode */
    if (this.shiftPressed && !e.shiftKey) this.shiftPressed = false;

    if (this.shiftPressed) {
      this.shiftStartX = mousePos[0];
      this.shiftStartY = mousePos[1];
      this.lineDirection = Mouse.NO_DIRECTION;
    }

    super.canvasCursorDown(mousePos[0], mousePos[1]);
  }

  canvasMouseMove(e) {
    const canvas = this.canvas;
    const getPos = function () {
      return Mouse.getMousePos(e, true, canvas);
    };

    super.canvasCursorMove(getPos);
  }

  canvasMouseEnter(e) {
    const canvas = this.canvas;
    const getInnerPos = function (self) {
      return Mouse.getMousePos(e, true, canvas);
    };
    const getOuterPos = function (self) {
      return [self.documentX, self.documentY];
    };

    super.canvasCursorEnter(getInnerPos, getOuterPos);

    /*
     * relies on the fact that super.CanvasCursorEnter has already fixed
     * prevX/prevY to be on the canvas border
     */
    if (
      this.isDown &&
      this.shiftPressed &&
      this.lineDirection === Mouse.NO_DIRECTION
    ) {
      this.shiftStartX = this.prevX;
      this.shiftStartY = this.prevY;
    }
  }

  canvasMouseLeave(e) {
    const canvas = this.canvas;
    const getOuterPos = function (self) {
      return Mouse.getMousePos(e, false, canvas);
    };

    super.canvasCursorLeave(getOuterPos);
  }

  documentMouseMove(e) {
    if (e.target == onscreenCanvas) return;

    const canvas = this.canvas;
    const getPos = function () {
      return Mouse.getMousePos(e, false, canvas);
    };

    super.documentCursorMove(getPos);
  }

  documentMouseUp(e) {
    /*
     * Don't use e, may be passed as null. Assigning here explicitly to avoid
     * bugs.
     */
    e = null;

    this.lineDirection = Mouse.NO_DIRECTION;

    super.documentCursorUp();
  }

  documentMouseDown(e) {
    /* only need handling when clicking outside the canvas */
    if (e.target == onscreenCanvas) return;

    const canvas = this.canvas;
    const getPos = function () {
      return Mouse.getMousePos(e, false, canvas);
    };

    /* Fix bug that left the canvas stuck in "shift" mode */
    if (this.shiftPressed && !e.shiftKey) this.shiftPressed = false;

    if (this.shiftPressed) this.lineDirection = Mouse.NO_DIRECTION;

    super.documentCursorDown(e, getPos);
  }

  static getMousePos(e, withinCanvas, canvas) {
    var x, y;

    if (withinCanvas) {
      x = e.offsetX;
      y = e.offsetY;

      if (x < 0) x = 0;
      else if (x >= width) x = MAX_X_IDX;

      if (y < 0) y = 0;
      else if (y >= height) y = MAX_Y_IDX;
    } else {
      x = e.pageX - docOffsetLeft(canvas);
      y = e.pageY - docOffsetTop(canvas);
    }

    return [Math.round(x), Math.round(y)];
  }

  documentKeyDown(e) {
    if (!e.shiftKey) return;

    if (this.shiftPressed) return;

    this.shiftPressed = true;
    this.lineDirection = Mouse.NO_DIRECTION;

    if (!this.isDown) return;

    if (!this.inCanvas) return;

    this.shiftStartX = this.x;
    this.shiftStartY = this.y;
  }

  documentKeyUp(e) {
    if (!e.shiftKey && this.shiftPressed) this.shiftPressed = false;
  }

  documentVisibilityChange(e) {
    const visibilityState = document.visibilityState;
    if (visibilityState == "hidden") {
      this.documentMouseUp(null);
      this.shiftPressed = false;
    }

    super.documentVisibilityChange(e);
  }

  /*
   * We draw straight lines when shift is held down.
   *
   * If this returns true, skip drawing the stroke (we need
   * to figure out what direction the line is going).
   */
  handleShift() {
    if (!this.isDown) return false;

    if (!this.shiftPressed) return false;

    if (!this.inCanvas) {
      if (this.prevX === this.x && this.prevY === this.y) return;
    }

    if (this.lineDirection === Mouse.NO_DIRECTION) {
      if (!this.inCanvas) return false;

      const dx = this.x - this.shiftStartX;
      const dy = this.y - this.shiftStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      /* Wait to see what direction the mouse is going in */
      if (Math.max(absDx, absDy) < 8) return true;

      if (Math.abs(absDx - absDy) < 5) {
        if (dy * dx < 0) this.lineDirection = Mouse.DIAGONAL_DOWN;
        else this.lineDirection = Mouse.DIAGONAL_UP;
      } else if (absDx > absDy) {
        this.lineDirection = Mouse.HORIZONTAL;
      } else {
        this.lineDirection = Mouse.VERTICAL;
      }
    }

    const direction = this.lineDirection;
    if (direction === Mouse.HORIZONTAL) {
      this.prevY = this.shiftStartY;
      this.y = this.shiftStartY;
    } else if (direction === Mouse.VERTICAL) {
      this.prevX = this.shiftStartX;
      this.x = this.shiftStartX;
    } else if (
      direction === Mouse.DIAGONAL_DOWN ||
      direction === Mouse.DIAGONAL_UP
    ) {
      this.prevX = this.shiftStartX;
      this.prevY = this.shiftStartY;
      const slope = direction === Mouse.DIAGONAL_DOWN ? -1 : 1;
      const yIntercept = this.shiftStartY - slope * this.shiftStartX;

      const yAdjusted = slope * this.x + yIntercept;
      const xAdjusted = (this.y - yIntercept) / slope;
      if (
        distance(xAdjusted, this.y, this.shiftStartX, this.shiftStartY) >
        distance(this.x, yAdjusted, this.shiftStartX, this.shiftStartY)
      ) {
        this.x = xAdjusted;
      } else {
        this.y = yAdjusted;
      }
    }

    return false;
  }

  drawStroke() {
    /* alters prevX, prevY, x, and y to handle drawing in straight lines */
    if (this.handleShift()) return;

    super.drawStroke();
  }
}

/* Touch cursor (ie. mobile users) */
class TouchCursor extends Cursor {
  constructor(canvas) {
    super(canvas);
  }

  canvasTouchStart(e) {
    const pos = TouchCursor.getTouchPos(e);

    if (!pos) return;

    super.canvasCursorDown(pos[0], pos[1]);

    /* prevent scrolling */
    e.preventDefault();

    return false;
  }

  canvasTouchEnd(e) {
    super.documentCursorUp();

    /* prevent scrolling */
    e.preventDefault();

    return false;
  }

  canvasTouchMove(e) {
    const pos = TouchCursor.getTouchPos(e);

    if (!pos) return;

    const getPos = function () {
      return pos;
    };

    super.canvasCursorMove(getPos);

    /* prevent scrolling */
    e.preventDefault();

    return false;
  }

  static getTouchPos(e) {
    if (!e.touches) return null;

    const touch = e.touches[0];
    if (!touch) return null;

    const rect = e.target.getBoundingClientRect();
    var x = Math.round(touch.pageX - rect.left - window.scrollX);
    var y = Math.round(touch.pageY - rect.top - window.scrollY);

    if (x < 0) x = 0;
    else if (x >= width) x = MAX_X_IDX;

    if (y < 0) y = 0;
    else if (y >= height) y = MAX_Y_IDX;

    return [x, y];
  }
}

function initCursors() {
  PENSIZE = PEN_SIZES[DEFAULT_PEN_IDX];
  SELECTED_ELEM = WALL;
  OVERWRITE_ENABLED = true;

  /* Set up direction constants for drawing straight lines */
  Mouse.NO_DIRECTION = 0;
  Mouse.HORIZONTAL = 1;
  Mouse.VERTICAL = 2;
  Mouse.DIAGONAL_UP = 3;
  Mouse.DIAGONAL_DOWN = 4;

  /*
   * Setting the event handler functions in this way allows the handlers
   * to properly access the 'this' pointer.
   */
  const mouseCursor = new Mouse(onscreenCanvas);
  onscreenCanvas.onmousedown = function (e) {
    mouseCursor.canvasMouseDown(e);
  };
  onscreenCanvas.onmousemove = function (e) {
    mouseCursor.canvasMouseMove(e);
  };
  onscreenCanvas.onmouseleave = function (e) {
    mouseCursor.canvasMouseLeave(e);
  };
  onscreenCanvas.onmouseenter = function (e) {
    mouseCursor.canvasMouseEnter(e);
  };
  document.onmouseup = function (e) {
    mouseCursor.documentMouseUp(e);
  };
  document.onmousedown = function (e) {
    mouseCursor.documentMouseDown(e);
  };
  document.onmousemove = function (e) {
    mouseCursor.documentMouseMove(e);
  };
  document.onkeydown = function (e) {
    mouseCursor.documentKeyDown(e);
  };
  document.onkeyup = function (e) {
    mouseCursor.documentKeyUp(e);
  };
  document.onvisibilitychange = function (e) {
    mouseCursor.documentVisibilityChange(e);
  };

  const touchCursor = new TouchCursor(onscreenCanvas);
  onscreenCanvas.addEventListener("touchstart", function (e) {
    touchCursor.canvasTouchStart(e);
  });
  onscreenCanvas.addEventListener("touchend", function (e) {
    touchCursor.canvasTouchEnd(e);
  });
  onscreenCanvas.addEventListener("touchmove", function (e) {
    touchCursor.canvasTouchMove(e);
  });

  CURSORS.push(mouseCursor);
  CURSORS.push(touchCursor);
  Object.freeze(CURSORS);
}

/* Draw the userstroke on the stroke canvas */
function updateUserStroke() {
  const numCursors = CURSORS.length;
  for (var i = 0; i !== numCursors; i++) {
    CURSORS[i].drawStroke();
  }
}
