/*
 * Global game parameters for the primary canvas.
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

const __max_width = 560;
const __max_height = 480;

/* Need to use a smaller size when on mobile devices with small screens */
const width = Math.min(__max_width, Math.max(screen.width - 6, 1));
const height = Math.min(__max_height, Math.max(screen.height - 200, 100));

const MAX_FPS = 120;
const DEFAULT_FPS = 60;

const MAX_NUM_PARTICLES = 1000;

/*
 * The zombie animation speed is tied to the FPS setting of the game;
 * speeding or slowing the FPS will also change the zombie animation
 * speed. The following value provides the baseline speed, which then
 * becomes scaled by the FPS. Note that the animation engine has a limit
 * to how much it can simulate in each step, so the following value should
 * not be made too large.
 */
const ZOMBIE_ANIMATION_SPEED = 12;

const MAX_ZOMBIES = 100;
