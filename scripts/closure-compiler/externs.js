/**
 * @externs
 *
 * See the README in this directory for more info.
 */

/** @const */
var Matter = {};

/**
 * @constructor
 */
Matter.Mouse = function() {};

/**
 * @param {!Matter.Mouse} mouse
 * @param {{x: number, y: number}} offset
 */
Matter.Mouse.setOffset = function(mouse, offset) {};

/**
 * @param {!Matter.Mouse} mouse
 * @param {{x: number, y: number}} scale
 */
Matter.Mouse.setScale = function(mouse, scale) {};

/**
 * @param {(!Element|null)} element
 * @return {!Matter.Mouse}
 */
Matter.Mouse.create = function(element) {};

/**
 * @type {{x: number, y: number}}
 */
Matter.Mouse.prototype.offset;

/**
 * @constructor
 */
Matter.Engine = function() {};

/**
 * @return {!Matter.Engine}
 */
Matter.Engine.create = function() {};

/**
 * @param {!Matter.Engine} engine
 * @param {number} delta
 */
Matter.Engine.update = function(engine, delta) {};

/**
 * @type {{scale: number}}
 */
Matter.Engine.prototype.gravity;

/**
 * @type {!Object}
 */
Matter.Engine.prototype.world;

/**
 * @constructor
 */
Matter.Body = function() {};

/**
 * @type {{x: number, y: number, angle: number}}
 */
Matter.Body.prototype.constraintImpulse;

/**
 * @type {{x: number, y: number}}
 */
Matter.Body.prototype.velocity;

/**
 * @type {number}
 */
Matter.Body.prototype.angularVelocity;

/**
 * @type {!Array<{x: number, y: number}>}
 */
Matter.Body.prototype.vertices;

/**
 * @return {number}
 */
Matter.Body.nextCategory = function() {};

/**
 * @param {boolean=} isNonColliding
 * @return {number}
 */
Matter.Body.nextGroup = function(isNonColliding) {};

/**
 * @param {!Object} body
 * @param {!Object} position
 * @param {!Object} force
 */
Matter.Body.applyForce = function(body, position, force) {};

/**
 * @param {!Object} body
 * @param {boolean} isStatic
 */
Matter.Body.setStatic = function(body, isStatic) {};

/**
 * @param {!Object} body
 * @param {number} velocity
 */
Matter.Body.setAngularVelocity = function(body, velocity) {};

/**
 * @param {!Object} body
 * @param {!Object} velocity
 */
Matter.Body.setVelocity = function(body, velocity) {};

/**
 * @const
 */
Matter.Bodies = {};

/**
 * @typedef {{
 *   isStatic: (boolean|undefined),
 *   restitution: (number|undefined),
 *   friction: (number|undefined),
 *   frictionAir: (number|undefined),
 *   density: (number|undefined),
 *   collisionFilter: (CollisionFilter|undefined),
 *   chamfer: ({
 *     radius: (number|undefined)
 *   }|undefined)
 * }}
 */
var BodyOptions;

/**
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {!BodyOptions=} options
 * @return {!Matter.Body}
 */
Matter.Bodies.rectangle = function(x, y, width, height, options) {};

/**
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {!BodyOptions=} options
 * @return {!Matter.Body}
 */
Matter.Bodies.circle = function(x, y, radius, options) {};

/**
 * @constructor
 */
Matter.Composite = function() {};

/**
 * @type {!Array<!Matter.Body>}
 */
Matter.Composite.prototype.bodies;

/**
 * @type {!Array<!Object>}
 */
Matter.Composite.prototype.constraints;

/**
 * @param {!Object} composite
 * @param {!Object|!Array<!Object>} bodyOrBodies
 */
Matter.Composite.add = function(composite, bodyOrBodies) {};

/**
 * @param {!Object} composite
 * @param {!Object|!Array<!Object>} bodyOrBodies
 */
Matter.Composite.remove = function(composite, bodyOrBodies) {};

/**
 * @param {!Object=} options
 * @return {!Matter.Composite}
 */
Matter.Composite.create = function(options) {};

/**
 * @const
 */
Matter.MouseConstraint = {};

/**
 * @typedef {{
 *   mouse: !Matter.Mouse,
 *   constraint: ({
 *     stiffness: (number|undefined),
 *     render: ({
 *       visible: (boolean|undefined)
 *     }|undefined)
 *   }|undefined),
 *   collisionFilter: (CollisionFilter|undefined),
 *   stiffness: (number|undefined),
 *   damping: (number|undefined)
 * }}
 */
var MouseConstraintOptions;

/**
 * @param {!Matter.Engine} engine
 * @param {!MouseConstraintOptions} options
 * @return {!Object}
 */
Matter.MouseConstraint.create = function(engine, options) {};

/**
 * @const
 */
Matter.Events = {};

/**
 * @param {!Object} object
 * @param {string} eventName
 * @param {function(!Object)} callback
 */
Matter.Events.on = function(object, eventName, callback) {};

/**
 * @const
 */
Matter.Constraint = {};

/**
 * @typedef {{
 *   bodyA: (!Object|undefined),
 *   bodyB: (!Object|undefined),
 *   pointA: ({x: number, y: number}|undefined),
 *   pointB: ({x: number, y: number}|undefined),
 *   length: (number|undefined),
 *   stiffness: (number|undefined),
 *   damping: (number|undefined),
 *   collisionFilter: (CollisionFilter|undefined)
 * }}
 */
var ConstraintOptions;

/**
 * @param {!ConstraintOptions} options
 * @return {!Object}
 */
Matter.Constraint.create = function(options) {};

/**
 * @typedef {{
 *   category: (number|undefined),
 *   mask: (number|undefined),
 *   group: (number|undefined)
 * }}
 */
var CollisionFilter;

