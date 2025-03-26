/*
 * Zombie implementation.
 *
 * Utilizes softBody.js (generic soft body support) and the third party
 * matter.js library.
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

const zombies = [];  /* Global list of all active zombies */

const DEFAULT_AIR_FRICTION = 0.015;  /* library default is 0.01 */
const ZOMBIE_BURNING_AIR_FRICTION = 0.125;

/*
 * DISCLAIMER: Not everything scales perfectly as zombie size is changed.
 */
const ZOMBIE_SIZE_SCALE = 0.75;

/* Zombie states */
const ZOMBIE_STATE_NORMAL = 0;
const ZOMBIE_STATE_BURNING = 1;
const ZOMBIE_STATE_WET = 2;
const ZOMBIE_STATE_FROZEN = 3;

/*
 * Set the total number of zombies to `count`. This will either create new zombies or
 * remove existing ones, depending on what the current zombie count is.
 */
function setZombieCount(count) {
  var delta = count - zombies.length;
  if (delta == 0) {
    return;
  }

  if (delta > 0) {
    for (var i = 0; i < delta; i++) {
      new Zombie();
    }
  } else {
    for (var i = delta; i < 0; i++) {
      popZombie();
    }
  }

  drawZombieCount(count);
}

/* Deletes the zombie at the end of the zombies list. */
function popZombie() {
  var zombie = zombies.pop();
  Matter.Composite.remove(softBodyEngine.world, [zombie.compositeBody]);
}

/* Replace the zombie at the given index with a new zombie. */
function replaceZombie(idx) {
  if (idx < 0 || idx >= zombies.length) {
    throw "invalid replace_idx";
  }

  var zombie = new Zombie();
  if (zombies.pop() !== zombie) {
    throw "bug in replace";
  }
  var oldZombie = zombies[idx];
  zombies[idx] = zombie;
  Matter.Composite.remove(softBodyEngine.world, [oldZombie.compositeBody]);
}

/*
 * Given a list of zombies, draw them to the main canvas using
 * the given color.
 */
function drawZombies(zombieList, color) {
  /* Clear the slate by first filling to black */
  softBodyCtx.beginPath();
  softBodyCtx.rect(0, 0, width, height);
  softBodyCtx.fillStyle = "rgba(0, 0, 0, 1)";
  softBodyCtx.fill();

  softBodyCtx.beginPath();

  const numZombies = zombieList.length;
  for (var i = 0; i < numZombies; i++) {
    var bodies = zombieList[i].compositeBody.bodies;
    const numBodies = bodies.length;
    for (var j = 0; j < numBodies; j++) {
      drawBody(softBodyCtx, bodies[j]);
    }
  }

  softBodyCtx.lineWidth = 1;
  softBodyCtx.strokeStyle = "#ffffff";
  softBodyCtx.stroke();

  const imgData = softBodyCtx.getImageData(0, 0, width, height);
  const imgData32 = new Uint32Array(imgData.data.buffer);
  for (var i = 0; i < MAX_IDX; i++) {
    if (imgData32[i] === 0xff000000) {
      continue;
    }
    gameImagedata32[i] = color;
  }
}

class Zombie {
  /*
   * Create a new zombie and add it to the simulation.
   */
  constructor() {
    /*
     * Use a new non colliding collision group for this zombie. This will
     * prevent collisions between any of the zombie's own body parts, while
     * still allowing collisions between this zombie and other soft bodies.
     */
    this.collisionGroup = Matter.Body.nextGroup(/*isNonColliding=*/true);
    const minWallOffset = 40;
    const zombieX = randomIntInRange(minWallOffset, width - minWallOffset);
    const zombieY = randomIntInRange(minWallOffset, height - minWallOffset);
    /* Create underlying physics body */
    this.compositeBody = Zombie.createZombieSoftBody(zombieX, zombieY,
                                                     ZOMBIE_SIZE_SCALE,
                                                     this.collisionGroup);

    /* Initialize properties */
    this.cooldown = 0;
    this.state = ZOMBIE_STATE_NORMAL;
    this.burnRespawnTime = 0;
    this.setAirFriction(DEFAULT_AIR_FRICTION);
    this.forceNonStatic = false;

    /*
     * Now add to our global list and our simulation.
     */
    zombies.push(this);
    Matter.Composite.add(softBodyEngine.world, [this.compositeBody]);
  }

  setAirFriction(friction) {
    const bodies  = this.compositeBody.bodies;
    const numBodies = bodies.length;
    for (var i = 0; i < numBodies; i++) {
      bodies[i].frictionAir = friction;
    }
  }

  /* Returns true if the user is currently dragging this zombie */
  isDragging() {
    return softBodyDragStart &&
        softBodyMouseConstraint.body &&
        softBodyMouseConstraint.body.collisionFilter.group === this.collisionGroup;
  }

  /*
   * Advance the zombie animation by a single step. This single step
   * represents the given number of `milliseconds`.
   */
  animate(now, zombieIdx, milliseconds) {
    if (this.cooldown <= 0 && random() < 2) {
      this.cooldown = Math.round(Math.random() * 180);
    }
    this.cooldown -= 1;

    const oldState = this.state;
    if (oldState !== ZOMBIE_STATE_NORMAL) {
      /*
       * If wet or frozen, reset the state, since it might not longer
       * be applicable. We'll recheck below.
       */
      if (oldState === ZOMBIE_STATE_FROZEN ||
          oldState === ZOMBIE_STATE_WET) {
        this.state = ZOMBIE_STATE_NORMAL;
      } else if (oldState === ZOMBIE_STATE_BURNING) {
        this.burnRespawnTime -= milliseconds;
        if (this.burnRespawnTime <= 0) {
          replaceZombie(zombieIdx);
          return;
        }
      }
    }

    /* cache for performance */
    const isDragging = this.isDragging();

    const forceNonStatic = this.forceNonStatic;
    this.forceNonStatic = false;
    const maxStaticImpulse = 0.3;
    const maxVelocity = 500;

    const bodies = this.compositeBody.bodies;
    const numBodies = bodies.length;
    for (var j = 0; j < numBodies; j++) {
      var body = bodies[j];

      /*
       * Sometimes zombies get stuck in a stretched out position, with
       * static parts touching canvas elements. This tends to glitch
       * out, so detect this case and mitigate it.
       */
      const impulse = body.constraintImpulse;
      if (!this.forceNonStatic && random() < 15 &&
          (Math.abs(impulse.x) >= maxStaticImpulse ||
           Math.abs(impulse.y) >= maxStaticImpulse)) {
        this.forceNonStatic = true;
      }

      if (!this.forceNonStatic && !isDragging) {
        const velocity = body.velocity;

        if (Math.abs(velocity.x) > maxVelocity ||
            Math.abs(velocity.y) > maxVelocity) {
          var newVelocity = {
            x: clamp(velocity.x, -maxVelocity, maxVelocity),
            y: clamp(velocity.y, -maxVelocity, maxVelocity),
          };
          Matter.Body.setVelocity(body, newVelocity);
        }
      }

      /*
       * We use the head for self-righting and random jerk behavior.
       */
      if (body.__isHead && oldState !== ZOMBIE_STATE_FROZEN) {
        /* Zombies on cooldown are less aggressive about self-righting. */
        const onCooldown = (this.cooldown > 0);
        if (!onCooldown) {
          /* Try to the head up */
          if (Math.random() < 0.06) {
            Matter.Body.applyForce(body, body.position, {
              x: 0,
              y: -0.00001 - Math.random() * 0.00001,
            });
          }
          /* More aggressively try to get the head up */
          if (Math.random() < 0.03) {
            Matter.Body.applyForce(body, body.position, {
              x: 0,
              y: -0.00003 - Math.random() * 0.00005,
            });
          }
        }
        /* Knock the head side to side */
        if (Math.random() < 0.05) {
          Matter.Body.applyForce(body, body.position, {
            x: Math.random() * 0.00001 * (Math.random() < 0.5 ? 1 : -1),
            y: 0,
          });
        }
      }

      /* Handle collisions with elements on the main canvas */
      var makeStatic = false;
      if (body.__interactsWithMainCanvas) {
        /*
         * If we're colliding with something on the main canvas, we
         * should set the body part to static in order to anchor it
         * in place (barring some exceptions, as can be seen below).
         */
        makeStatic = this.handleCanvasCollisions(body, now, isDragging);

        if (makeStatic) {
          if (forceNonStatic) {
            makeStatic = false;
          } else if (this.state === ZOMBIE_STATE_BURNING) {
            makeStatic = false;
          } else if (body.__isFoot) {
            var head = bodies[0];
            if (!head.__isHead) {
              throw "head misordered"
            }
            /*
             * If we're upside down, make the feet less sticky.
             */
            if (random() < 5 && head.position.y > body.position.y) {
              makeStatic = false;
            }
          }
        }
      }

      if (makeStatic !== body.isStatic) {
        Matter.Body.setStatic(body, makeStatic);
      }

      /*
       * Prevent over-rotation. Without this damping, we can get body parts
       * spinning wildly out of control, due to the way the constraints work.
       */
      const maxAngularVelocity = 4;
      if (!isDragging && !body.isStatic &&
          Math.abs(body.angularVelocity) > maxAngularVelocity) {
        const dampenFactor = 0.5 + Math.random() / 3;
        const newVelocity = Math.max(body.angularVelocity * dampenFactor, maxAngularVelocity);
        Matter.Body.setAngularVelocity(body, newVelocity);
      }
    }

    /*
     * Simple check if a zombie has managed to clip through the bounding walls.
     * Just respawn it in this case.
     */
    if (bodies[0].position.y > height * 2) {
      replaceZombie(zombieIdx);
      return;
    }

    /*
     * Make zombies fall more slowly when on fire.
     */
    if (this.state === ZOMBIE_STATE_BURNING) {
      if (bodies[0].frictionAir !== ZOMBIE_BURNING_AIR_FRICTION) {
        this.setAirFriction(ZOMBIE_BURNING_AIR_FRICTION);
      }
    } else {
      if (bodies[0].frictionAir !== DEFAULT_AIR_FRICTION) {
        this.setAirFriction(DEFAULT_AIR_FRICTION);
      }
    }
  }

  /*
   * Returns true if the given zombie body part is colliding with an element
   * on the main canvas.
   * This is only expected to be called for the special "detector" body parts,
   * such as hands and feet (or anything with __interactsWithMainCanvas = true).
   *
   * This function is not idempotent because it may mutate the canvas to
   * remove points of collision, or it may initiate free dragging (in which
   * all collisions are ignored).
   */
  handleCanvasCollisions(body, now, isDragging) {
    /*
     * If the user is trying to drag a zombie, stop enforcing collisions against
     * elements on the main canvas after a delay.
     */
    if (isDragging) {
      if (softBodyFreeDrag ||
          now - softBodyDragStart > Math.random() * 1000 + 1000) {
        softBodyFreeDrag = true;
        return false;
      }
    }

    const xBody = clamp(Math.floor(body.position.x), 0, width - 1);
    const yBody = clamp(Math.floor(body.position.y), 0, height - 1);
    const searchSize = body.__isNeck ? 3 : 2;
    const xStart = Math.max(0, xBody - searchSize);
    const xEnd = Math.min(width - 1, xBody + searchSize);
    const yStart = Math.max(0, yBody - searchSize);
    const yEnd = Math.min(height - 1, yBody + searchSize);

    var iBase = yStart * width;
    for (var y = yStart; y < yEnd; y++) {
      for (var x = xStart; x < xEnd; x++) {
        const elem = gameImagedata32[iBase + x];
        if (elem === ZOMBIE ||
            elem === ZOMBIE_WET ||
            elem === ZOMBIE_BURNING ||
            elem === ZOMBIE_FROZEN ||
            elem === BACKGROUND) {
          continue;
        }

        if (random() < 5 && (elem === FIRE || elem === LAVA)) {
          if (this.state !== ZOMBIE_STATE_WET &&
              this.state !== ZOMBIE_STATE_BURNING) {
            this.state = ZOMBIE_STATE_BURNING;
            this.burnRespawnTime = 700 + randomIntInRange(0, 500);
          }
        } else if (elem === WATER) {
          this.state = ZOMBIE_STATE_WET;
        } else if (elem === ICE || elem === CHILLED_ICE || elem === CRYO) {
          if (this.state === ZOMBIE_STATE_NORMAL) {
            this.state = ZOMBIE_STATE_FROZEN;
          }
        }

        /*
         * Give some opportunity to break free.
         *
         * This could certainly be tuned.
         */
        if (random() < 1 && elem !== ICE) {
          gameImagedata32[iBase + x] = BACKGROUND;
        }

        return true;
      }
      iBase += width;
    }

    return false;
  }

  /*
   * Utility method to create the physics simulation elements
   * for the zombie soft body.
   */
  static createZombieSoftBody(x, y, scale, collisionGroup) {
    const headSize = 6 * scale;
    const chestWidth = 2 * scale;
    const chestHeight = 25 * scale;
    const armWidth = 2 * scale;
    const upperArmHeight = 7 * scale;
    const lowerArmHeight = 9 * scale;
    const legWidth = 2 * scale;
    const upperLegHeight = 9 * scale;
    const lowerLegHeight = 13 * scale;

    /*
     * The default density for bodies is 0.001. We use a value much smaler than
     * that for the upper body in order to improve the ability of zombies to stand
     * upright.
     */
    const upperBodyDensity = 0.0001;

    /*
     * =====================================
     * First, create each of the body parts.
     * =====================================
     */

    var head = Matter.Bodies.circle(
      x,
      y - chestHeight / 2.0 - headSize,
      headSize,
      {
        collisionFilter: {
          /*
           * Note: It is possible that using a new collision group could
           * result in better behavior, to prevent the head from passing
           * through body parts. Currently it seems the existing behavior
           * is good as-is.
           */
          group: collisionGroup,
        },
        label: "head",
        density: upperBodyDensity,
      }
    );

    const chestX = x;
    const chestY = y;
    var chest = Matter.Bodies.rectangle(
      chestX,
      chestY,
      chestWidth,
      chestHeight,
      {
        collisionFilter: {
          group: collisionGroup,
        },
        chamfer: {
          radius: chestWidth / 2.0,
        },
        density: upperBodyDensity,
        label: "chest",
      }
    );

    /* Used for collisions with elements on the main canvas */
    var neck = Matter.Bodies.circle(
      chestX,
      chestY - chestHeight / 2.0,
      1,
      {
        collisionFilter: {
          group: collisionGroup,
        },
        label: "neck",
        density: 0.000000001,
      }
    );

    /* Used for collisions with elements on the main canvas */
    var midChestLeft = Matter.Bodies.circle(
      chestX - chestWidth / 2.0,
      chestY,
      1,
      {
        collisionFilter: {
          group: collisionGroup,
        },
        label: "midChestLeft",
        density: 0.000000001,
      }
    );

    /* Used for collisions with elements on the main canvas */
    var midChestRight = Matter.Bodies.circle(
      chestX + chestWidth / 2.0,
      chestY,
      1,
      {
        collisionFilter: {
          group: collisionGroup,
        },
        label: "midChestRight",
        density: 0.000000001,
      }
    );

    var rightUpperArm = Matter.Bodies.rectangle(
      x + chestWidth / 2.0 + armWidth / 2.0,
      y - chestHeight / 2.0 + upperArmHeight + 1 * scale,
      armWidth,
      upperArmHeight,
      {
        collisionFilter: {
          group: collisionGroup,
        },
        chamfer: {
          radius: armWidth * 0.5,
        },
        density: upperBodyDensity,
      }
    );

    const rightLowerArmX = x + chestWidth / 2.0 + armWidth / 2.0;
    const rightLowerArmY = y - chestHeight / 2.0 + upperArmHeight + lowerArmHeight;
    var rightLowerArm = Matter.Bodies.rectangle(
      rightLowerArmX,
      rightLowerArmY,
      armWidth,
      lowerArmHeight,
      {
        collisionFilter: {
          group: collisionGroup,
        },
        chamfer: {
          radius: armWidth * 0.5,
        },
        density: upperBodyDensity,
      }
    );

    var leftUpperArm = Matter.Bodies.rectangle(
      x - chestWidth / 2.0 - armWidth / 2.0,
      y - chestHeight / 2.0 + upperArmHeight + 1 * scale,
      armWidth,
      upperArmHeight,
      {
        collisionFilter: {
          group: collisionGroup,
        },
        chamfer: {
          radius: armWidth * 0.5,
        },
        density: upperBodyDensity,
      }
    );

    const leftLowerArmX = x - chestWidth / 2.0 - armWidth / 2.0;
    const leftLowerArmY = y - chestHeight / 2.0 + upperArmHeight + lowerArmHeight;
    var leftLowerArm = Matter.Bodies.rectangle(
      leftLowerArmX,
      leftLowerArmY,
      armWidth,
      lowerArmHeight,
      {
        collisionFilter: {
          group: collisionGroup,
        },
        chamfer: {
          radius: armWidth * 0.5,
        },
        density: upperBodyDensity,
      }
    );

    /* Used for collisions with elements on the main canvas */
    var rightHand = Matter.Bodies.circle(
      rightLowerArmX,
      rightLowerArmY + lowerArmHeight / 2,
      1,
      {
        collisionFilter: {
          group: collisionGroup,
        },
        label: "rightHand",
        density: 0.000000001,
      }
    );

    /* Used for collisions with elements on the main canvas */
    var leftHand = Matter.Bodies.circle(
      leftLowerArmX,
      leftLowerArmY + lowerArmHeight / 2,
      1,
      {
        collisionFilter: {
          group: collisionGroup,
        },
        label: "leftHand",
        density: 0.000000001,
      }
    );

    var leftUpperLeg = Matter.Bodies.rectangle(
      x - chestWidth / 3.0,
      y + chestHeight / 2.0 + upperLegHeight / 2.0,
      legWidth,
      upperLegHeight,
      {
        collisionFilter: {
          group: collisionGroup,
        },
        chamfer: {
          radius: legWidth / 2.0,
        },
      }
    );

    const leftLowerLegX = x - chestWidth / 3.0;
    const leftLowerLegY = y + chestHeight / 2.0 + upperLegHeight + lowerLegHeight / 2.0;
    var leftLowerLeg = Matter.Bodies.rectangle(
      leftLowerLegX,
      leftLowerLegY,
      legWidth,
      lowerLegHeight,
      {
        collisionFilter: {
          group: collisionGroup,
        },
        chamfer: {
          radius: legWidth / 2.0,
        },
        label: "leftLowerLeg",
      }
    );

    var rightUpperLeg = Matter.Bodies.rectangle(
      x + chestWidth / 3.0,
      y + chestHeight / 2.0 + upperLegHeight / 2.0,
      legWidth,
      upperLegHeight,
      {
        collisionFilter: {
          group: collisionGroup,
        },
        chamfer: {
          radius: legWidth / 2.0,
        },
      }
    );

    const rightLowerLegX = x + chestWidth / 3.0;
    const rightLowerLegY = y + chestHeight / 2.0 + upperLegHeight + lowerLegHeight / 2.0;
    var rightLowerLeg = Matter.Bodies.rectangle(
      rightLowerLegX,
      rightLowerLegY,
      legWidth,
      lowerLegHeight,
      {
        collisionFilter: {
          group: collisionGroup,
        },
        chamfer: {
          radius: legWidth / 2.0,
        },
        label: "rightLowerLeg",
      }
    );

    /* Used for collisions with elements on the main canvas */
    var rightFoot = Matter.Bodies.circle(
      rightLowerLegX,
      rightLowerLegY + lowerLegHeight / 2,
      1,
      {
        collisionFilter: {
          group: collisionGroup,
        },
        label: "rightFoot",
        density: 0.000000001,
      }
    );

    /* Used for collisions with elements on the main canvas */
    var leftFoot = Matter.Bodies.circle(
      leftLowerLegX,
      leftLowerLegY + lowerLegHeight / 2,
      1,
      {
        collisionFilter: {
          group: collisionGroup,
        },
        label: "leftFoot",
        density: 0.000000001,
      }
    );

    /*
     * ===================================================================
     * Now, create the constraints that will hold the body parts together.
     * ===================================================================
     */

    var chestToNeck = Matter.Constraint.create({
      bodyA: chest,
      pointA: {
        x: 0,
        y: -chestHeight / 2.0,
      },
      bodyB: neck,
      pointB: {
        x: 0,
        y: 0,
      },
      stiffness: 1,
      length: 0,
    });

    var midChestLeftToChest = Matter.Constraint.create({
      bodyA: chest,
      pointA: {
        x: -chestWidth / 2.0,
        y: 0,
      },
      bodyB: midChestLeft,
      pointB: {
        x: 0,
        y: 0,
      },
      stiffness: 1,
      length: 0,
    });

    var midChestRightToChest = Matter.Constraint.create({
      bodyA: chest,
      pointA: {
        x: chestWidth / 2.0,
        y: 0,
      },
      bodyB: midChestRight,
      pointB: {
        x: 0,
        y: 0,
      },
      stiffness: 1,
      length: 0,
    });

    var chestToRightUpperArm = Matter.Constraint.create({
      bodyA: chest,
      pointA: {
        x: chestWidth / 2.0,
        y: -chestHeight / 4.0 - 3 * scale,
      },
      bodyB: rightUpperArm,
      pointB: {
        x: 0,
        y: -upperArmHeight / 2.0,
      },
      stiffness: 0.5,
      length: 0,
      damping: 0.2,
    });

    var chestToLeftUpperArm = Matter.Constraint.create({
      bodyA: chest,
      pointA: {
        x: -chestWidth / 2.0,
        y: -chestHeight / 4.0 - 3 * scale,
      },
      bodyB: leftUpperArm,
      pointB: {
        x: 0,
        y: -upperArmHeight / 2.0,
      },
      stiffness: 0.5,
      length: 0,
      damping: 0.2,
    });

    var leftArmAngle = Matter.Constraint.create({
      bodyA: chest,
      pointA: {
        x: -chestWidth / 2.0 - chestWidth / 2.0 - armWidth,
        y: -chestHeight / 2.0 + upperArmHeight,
      },
      bodyB: leftUpperArm,
      pointB: {
        x: 0,
        y: 0,
      },
      stiffness: 0.2,
      length: 0,
      damping: 0.2,
    });

    var rightArmAngle = Matter.Constraint.create({
      bodyA: chest,
      pointA: {
        x: chestWidth / 2.0 + chestWidth / 2.0 + armWidth,
        y: -chestHeight / 2.0 + upperArmHeight,
      },
      bodyB: rightUpperArm,
      pointB: {
        x: 0,
        y: 0,
      },
      stiffness: 0.2,
      length: 0,
      damping: 0.2,
    });

    var chestToLeftUpperLeg = Matter.Constraint.create({
      bodyA: chest,
      pointA: {
        x: -chestWidth / 6.0,
        y: chestHeight / 2.0,
      },
      bodyB: leftUpperLeg,
      pointB: {
        x: 0,
        y: -upperLegHeight / 2.0,
      },
      stiffness: 0.5,
      length: 0,
    });

    var chestToRightUpperLeg = Matter.Constraint.create({
      bodyA: chest,
      pointA: {
        x: chestWidth / 6.0,
        y: chestHeight / 2.0,
      },
      bodyB: rightUpperLeg,
      pointB: {
        x: 0,
        y: -upperLegHeight / 2.0,
      },
      stiffness: 0.5,
      length: 0,
    });

    var leftLegAngle = Matter.Constraint.create({
      bodyA: chest,
      pointA: {
        x: -chestWidth * 1.5,
        y: chestHeight * 0.75,
      },
      bodyB: leftUpperLeg,
      pointB: {
        x: 0,
        y: 0,
      },
      stiffness: 0.02,
      length: 0,
    });

    var rightLegAngle = Matter.Constraint.create({
      bodyA: chest,
      pointA: {
        x: chestWidth * 1.5,
        y: chestHeight * 0.75,
      },
      bodyB: rightUpperLeg,
      pointB: {
        x: 0,
        y: 0,
      },
      stiffness: 0.02,
      length: 0,
    });

    var upperToLowerRightArm = Matter.Constraint.create({
      bodyA: rightUpperArm,
      pointA: {
        x: 0,
        y: upperArmHeight * 0.5,
      },
      bodyB: rightLowerArm,
      pointB: {
        x: 0,
        y: -lowerArmHeight * 0.5,
      },
      stiffness: 0.5,
      length: 0,
    });

    var upperToLowerLeftArm = Matter.Constraint.create({
      bodyA: leftUpperArm,
      pointA: {
        x: 0,
        y: upperArmHeight * 0.5,
      },
      bodyB: leftLowerArm,
      pointB: {
        x: 0,
        y: -lowerArmHeight * 0.5,
      },
      stiffness: 0.5,
      length: 0,
    });

    var rightArmToHand = Matter.Constraint.create({
      bodyA: rightLowerArm,
      pointA: {
        x: 0,
        y: lowerArmHeight / 2.0,
      },
      bodyB: rightHand,
      pointB: {
        x: 0,
        y: 0,
      },
      stiffness: 1,
      length: 0,
    });

    var leftArmToHand = Matter.Constraint.create({
      bodyA: leftLowerArm,
      pointA: {
        x: 0,
        y: lowerArmHeight / 2.0,
      },
      bodyB: leftHand,
      pointB: {
        x: 0,
        y: 0,
      },
      stiffness: 1,
      length: 0,
    });

    var upperToLowerLeftLeg = Matter.Constraint.create({
      bodyA: leftUpperLeg,
      pointA: {
        x: 0,
        y: upperLegHeight / 2.0,
      },
      bodyB: leftLowerLeg,
      pointB: {
        x: 0,
        y: -lowerLegHeight / 2.0,
      },
      stiffness: 0.5,
      length: 0,
      damping: 0.2,
    });

    var upperToLowerRightLeg = Matter.Constraint.create({
      bodyA: rightUpperLeg,
      pointA: {
        x: 0,
        y: upperLegHeight / 2.0,
      },
      bodyB: rightLowerLeg,
      pointB: {
        x: 0,
        y: -lowerLegHeight / 2.0,
      },
      stiffness: 0.5,
      length: 0,
      damping: 0.2,
    });

    var rightLegToFoot = Matter.Constraint.create({
      bodyA: rightLowerLeg,
      pointA: {
        x: 0,
        y: lowerLegHeight / 2.0,
      },
      bodyB: rightFoot,
      pointB: {
        x: 0,
        y: 0,
      },
      stiffness: 1,
      length: 0,
    });

    var leftLegToFoot = Matter.Constraint.create({
      bodyA: leftLowerLeg,
      pointA: {
        x: 0,
        y: lowerLegHeight / 2.0,
      },
      bodyB: leftFoot,
      pointB: {
        x: 0,
        y: 0,
      },
      stiffness: 1,
      length: 0,
    });

    var interKneeStiffness = Matter.Constraint.create({
      bodyA: leftUpperLeg,
      pointA: {
        x: 0,
        y: upperLegHeight / 2.0,
      },
      bodyB: rightUpperLeg,
      pointB: {
        x: 0,
        y: upperLegHeight / 2.0,
      },
      stiffness: 0.9,
      length: legWidth * 5,
      damping: 0.2,
    });

    var interFootStiffness = Matter.Constraint.create({
      bodyA: leftLowerLeg,
      pointA: {
        x: 0,
        y: lowerLegHeight / 2.0,
      },
      bodyB: rightLowerLeg,
      pointB: {
        x: 0,
        y: lowerLegHeight / 2.0,
      },
      stiffness: 0.01,
      length: legWidth * 7,
    });

    var leftLegStraightness = Matter.Constraint.create({
      bodyA: leftUpperLeg,
      pointA: {
        x: 0,
        y: 0,
      },
      bodyB: leftLowerLeg,
      pointB: {
        x: 0,
        y: 0,
      },
      stiffness: 0.6,
      length: lowerLegHeight / 2.0 + upperLegHeight / 2.0,
      damping: 0.2,
    });

    var rightLegStraightness = Matter.Constraint.create({
      bodyA: rightUpperLeg,
      pointA: {
        x: 0,
        y: 0,
      },
      bodyB: rightLowerLeg,
      pointB: {
        x: 0,
        y: 0,
      },
      stiffness: 0.6,
      length: lowerLegHeight / 2.0 + upperLegHeight / 2.0,
      damping: 0.2,
    });

    /* Keep the head close to the body */
    var headContraint = Matter.Constraint.create({
      bodyA: head,
      pointA: {
        x: 0,
        y: headSize,
      },
      bodyB: chest,
      pointB: {
        x: 0,
        y: -chestHeight / 2.0,
      },
      stiffness: 0.4,
      length: 0,
      damping: 0.5,
    });

    /* Keep the head upright rather than falling to the side */
    var headUpright = Matter.Constraint.create({
      bodyA: head,
      pointA: {
        x: 0,
        y: -headSize,
      },
      bodyB: chest,
      pointB: {
        x: 0,
        y: chestHeight / 2.0,
      },
      stiffness: 0.5,
      length: chestHeight + 2 * headSize,
      damping: 0.2,
    });

    /*
     * All bodies and constraints have been created, now we can return
     * the composite entity that represents an individual zombie.
     */

    var zombie = Matter.Composite.create({
      bodies: [
        head,  /* order the head first to make it easy to find */
        chest,
        midChestLeft,
        midChestRight,
        neck,
        leftLowerArm,
        leftUpperArm,
        rightLowerArm,
        rightUpperArm,
        leftHand,
        rightHand,
        leftLowerLeg,
        rightLowerLeg,
        leftFoot,
        rightFoot,
        leftUpperLeg,
        rightUpperLeg,
      ],
      constraints: [
        upperToLowerLeftArm,
        upperToLowerRightArm,
        leftArmToHand,
        rightArmToHand,
        chestToLeftUpperArm,
        chestToRightUpperArm,
        headContraint,
        upperToLowerLeftLeg,
        upperToLowerRightLeg,
        rightLegToFoot,
        leftLegToFoot,
        chestToLeftUpperLeg,
        chestToRightUpperLeg,
        chestToNeck,
        midChestLeftToChest,
        midChestRightToChest,
        leftArmAngle,
        rightArmAngle,
        leftLegAngle,
        rightLegAngle,
        interKneeStiffness,
        interFootStiffness,
        leftLegStraightness,
        rightLegStraightness,
        headUpright,
      ],
    });

    const numBodies = zombie.bodies.length;
    for (var i = 0; i < numBodies; i++) {
      var body = zombie.bodies[i];

      body.__isHead = (body === head);

      body.__interactsWithMainCanvas =
        (body === rightFoot ||
         body === leftFoot ||
         body === rightHand ||
         body === leftHand ||
         body === neck);

      body.__isFoot =
        (body === rightFoot ||
         body === leftFoot);

      body.__isNeck = (body === neck);

      body.__isArm =
        (body === leftUpperArm ||
         body === rightUpperArm ||
         body === leftLowerArm ||
         body === rightLowerArm);

      body.__isLeg =
        (body === leftUpperLeg ||
         body === rightUpperLeg ||
         body === leftLowerLeg ||
         body === rightLowerLeg);
    }

    return zombie;
  }
}

