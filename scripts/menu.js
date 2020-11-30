/*
 * Code for the menu options.
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

/* Configuration of the menu */
const ELEMENT_MENU_ELEMENTS_PER_ROW = 4;
const PEN_SIZES = [2, 4, 8, 16, 32, 64];
const PEN_SIZE_LABELS = ["1px", "2px", "4px", "8px", "16px", "32px"];
const DEFAULT_PEN_IDX = 1;

/* Elements listed in the menu */
// prettier-ignore
const elementMenuItems = [
  WALL, SAND, WATER, PLANT,
  FIRE, SPOUT, WELL, SALT,
  OIL, WAX, TORCH, ICE,
  GUNPOWDER, NAPALM, NITRO, C4,
  LAVA, CRYO, FUSE, MYSTERY,
  CONCRETE, METHANE, SOIL, ACID,
  THERMITE, BACKGROUND,
];

const menuNames = {};
menuNames[WALL] = "WALL";
menuNames[SAND] = "SAND";
menuNames[WATER] = "WATER";
menuNames[PLANT] = "PLANT";
menuNames[FIRE] = "FIRE";
menuNames[SALT] = "SALT";
menuNames[OIL] = "OIL";
menuNames[SPOUT] = "SPOUT";
menuNames[WELL] = "WELL";
menuNames[TORCH] = "TORCH";
menuNames[GUNPOWDER] = "GUNPOWDER";
menuNames[WAX] = "WAX";
menuNames[NITRO] = "NITRO";
menuNames[NAPALM] = "NAPALM";
menuNames[C4] = "C-4";
menuNames[CONCRETE] = "CONCRETE";
menuNames[BACKGROUND] = "ERASER";
menuNames[FUSE] = "FUSE";
menuNames[ICE] = "ICE";
menuNames[LAVA] = "LAVA";
menuNames[METHANE] = "METHANE";
menuNames[CRYO] = "CRYO";
menuNames[MYSTERY] = "???";
menuNames[SOIL] = "SOIL";
menuNames[ACID] = "ACID";
menuNames[THERMITE] = "THERMITE";

/*
 * Some element colors do not have very good contrast against
 * the menu background. For these elements, we use a replacement
 * color for the menu text.
 */
const menuAltColors = {};
menuAltColors[WATER] = "rgb(0, 130, 255)";
menuAltColors[WALL] = "rgb(160, 160, 160)";
menuAltColors[BACKGROUND] = "rgb(200, 100, 200)";
menuAltColors[WELL] = "rgb(158, 13, 33)";
menuAltColors[SOIL] = "rgb(171, 110, 53)";

function initMenu() {
  /* The wrapper div that holds the entire menu */
  const menu = document.getElementById("menuWrapper");

  /* Set up the wrapper div that holds the element selectors */
  const elementMenu = document.getElementById("elementTable");
  elementMenu.style.width =
    "50%"; /* force browser to scrunch the element menu */
  const numRows = Math.ceil(
    elementMenuItems.length / ELEMENT_MENU_ELEMENTS_PER_ROW
  );
  var elemIdx = 0;
  var i, k;
  for (i = 0; i < numRows; i++) {
    const row = elementMenu.insertRow(i);
    for (k = 0; k < ELEMENT_MENU_ELEMENTS_PER_ROW; k++) {
      if (elemIdx >= elementMenuItems.length) break;

      const cell = row.insertCell(k);
      const elemButton = document.createElement("input");
      cell.appendChild(elemButton);

      elemButton.type = "button";
      elemButton.className = "elementMenuButton";

      const elemType = elementMenuItems[elemIdx];
      if (!(elemType in menuNames))
        throw "element is missing a canonical name: " + elemType;
      elemButton.value = menuNames[elemType];

      const elemColorRGBA = elemType;
      elemButton.id = elemColorRGBA;

      var elemMenuColor;
      if (elemType in menuAltColors) elemMenuColor = menuAltColors[elemType];
      else
        elemMenuColor =
          "rgb(" +
          (elemColorRGBA & 0xff) +
          ", " +
          ((elemColorRGBA & 0xff00) >>> 8) +
          ", " +
          ((elemColorRGBA & 0xff0000) >>> 16) +
          ")";
      elemButton.style.color = elemMenuColor;

      elemButton.addEventListener("click", function () {
        document
          .getElementById(SELECTED_ELEM.toString())
          .classList.remove("selectedElementMenuButton");
        elemButton.classList.add("selectedElementMenuButton");
        SELECTED_ELEM = parseInt(elemButton.id, 10);
      });

      elemIdx++;
    }
  }
  document.getElementById(SELECTED_ELEM.toString()).click();

  /* Set up pensize options */
  const pensizes = document.getElementById("pensize");
  for (i = 0; i < PEN_SIZES.length; i++) {
    const p = document.createElement("option");
    p.value = PEN_SIZES[i];
    p.text = PEN_SIZE_LABELS[i];
    if (i === DEFAULT_PEN_IDX) {
      p.selected = "selected";
      PENSIZE = parseInt(p.value, 10);
    }
    pensizes.add(p);
  }
  pensizes.addEventListener("change", function () {
    PENSIZE = parseInt(pensizes.value, 10);
  });

  /* Set up spigot size options */
  const spigotTypes = [
    document.getElementById("spigot1Type"),
    document.getElementById("spigot2Type"),
    document.getElementById("spigot3Type"),
    document.getElementById("spigot4Type"),
  ];
  const spigotSizes = [
    document.getElementById("spigot1Size"),
    document.getElementById("spigot2Size"),
    document.getElementById("spigot3Size"),
    document.getElementById("spigot4Size"),
  ];
  if (spigotTypes.length !== spigotSizes.length) throw "should be same length";
  for (i = 0; i < spigotTypes.length; i++) {
    const typeSelector = spigotTypes[i];
    const sizeSelector = spigotSizes[i];
    for (k = 0; k < SPIGOT_ELEMENT_OPTIONS.length; k++) {
      const type = SPIGOT_ELEMENT_OPTIONS[k];
      const option = document.createElement("option");
      option.value = type;
      option.text = menuNames[type];
      if (i === k) {
        option.selected = "selected";
        SPIGOT_ELEMENTS[i] = type;
      }
      typeSelector.add(option);
    }
    for (k = 0; k < SPIGOT_SIZE_OPTIONS.length; k++) {
      const size = SPIGOT_SIZE_OPTIONS[k];
      const option = document.createElement("option");
      option.value = size;
      option.text = k.toString(10);
      if (k === DEFAULT_SPIGOT_SIZE_IDX) {
        option.selected = "selected";
        SPIGOT_SIZES[i] = size;
      }
      sizeSelector.add(option);
    }
  }
  spigotTypes[0].addEventListener("change", function () {
    SPIGOT_ELEMENTS[0] = parseInt(spigotTypes[0].value, 10);
  });
  spigotTypes[1].addEventListener("change", function () {
    SPIGOT_ELEMENTS[1] = parseInt(spigotTypes[1].value, 10);
  });
  spigotTypes[2].addEventListener("change", function () {
    SPIGOT_ELEMENTS[2] = parseInt(spigotTypes[2].value, 10);
  });
  spigotTypes[3].addEventListener("change", function () {
    SPIGOT_ELEMENTS[3] = parseInt(spigotTypes[3].value, 10);
  });
  spigotSizes[0].addEventListener("change", function () {
    SPIGOT_SIZES[0] = parseInt(spigotSizes[0].value, 10);
  });
  spigotSizes[1].addEventListener("change", function () {
    SPIGOT_SIZES[1] = parseInt(spigotSizes[1].value, 10);
  });
  spigotSizes[2].addEventListener("change", function () {
    SPIGOT_SIZES[2] = parseInt(spigotSizes[2].value, 10);
  });
  spigotSizes[3].addEventListener("change", function () {
    SPIGOT_SIZES[3] = parseInt(spigotSizes[3].value, 10);
  });

  /* 'overwrite' checkbox */
  const overwriteCheckbox = document.getElementById("overwriteCheckbox");
  overwriteCheckbox.checked = OVERWRITE_ENABLED;
  overwriteCheckbox.addEventListener("click", function () {
    OVERWRITE_ENABLED = overwriteCheckbox.checked;
  });

  /* speed slider */
  const speedSlider = document.getElementById("speedSlider");
  speedSlider.min = 0;
  speedSlider.max = MAX_FPS;
  speedSlider.value = DEFAULT_FPS;
  speedSlider.addEventListener("input", function () {
    const val = parseInt(speedSlider.value, 10);
    /* make 'magnetic' towards the default */
    if (Math.abs(val - DEFAULT_FPS) < 10) speedSlider.value = DEFAULT_FPS;
    setFPS(parseInt(speedSlider.value, 10));
  });

  /* clear button */
  const clearButton = document.getElementById("clearButton");
  clearButton.onclick = clearGameCanvas;

  /* save button */
  const saveButton = document.getElementById("saveButton");
  saveButton.onclick = saveGameCanvas;

  /* load button */
  const loadButton = document.getElementById("loadButton");
  loadButton.onclick = loadGameCanvas;
}

function drawFPSLabel(fps) {
  document.getElementById("fps-counter").innerText = "FPS: " + fps;
}
