/* Saeng: floor picker, amenities rail, rental calculator and presentation form.
   Plain JavaScript, no build step. */
(() => {
  "use strict";

  document.documentElement.classList.add("sg-js");

  const IMG_W = 2752;
  const IMG_H = 1536;
  const CLIP_WAIT_MS = 9000;
  const CLIP_WATCHDOG_MS = 11000;
  // The camera closes in on the chosen floor, and the living room starts fading in before
  // the zoom ends so the two read as one move.
  const ZOOM_MS = 1500;
  const ZOOM_HANDOFF_MS = 1050;
  const FOCUS_X = 1550;
  const FOCUS_W = 918;
  const STILL_SIZES = "(max-width: 1023px) 130vw, 100vw";
  const START_FLOOR = 4;
  // Rough exchange rate used for every złoty figure on the page.
  const THB_TO_PLN = 0.11;
  const INTRO_POINTER = "Najedź na piętro i kliknij, żeby wejść.";
  const INTRO_TOUCH = "Dotknij piętra albo przesuń suwak.";

  const clip = (name) => ({
    desktop: `assets/video/${name}.mp4`,
    mobile: `assets/video/${name}-m.mp4`,
    poster: `assets/video/${name}.webp`,
  });

  // Apartment types. Hotspot x and y are fractions of the interior photo.
  const ZONES = {
    a: {
      id: "a",
      type: "1 sypialnia",
      outdoor: "balkon",
      insideName: "jedna sypialnia",
      insideText: "Salon z aneksem otwiera się na balkon. Sypialnia jest tuż obok, za tekowymi drzwiami.",
      interior: "assets/picker/inside-a",
      roomImage: "assets/picker/room-a",
      room: { title: "Sypialnia", text: "Łóżko stoi naprzeciw okna. Rano widać palmy i pasek turkusowej wody." },
      move: clip("move-a"),
      hotspots: [
        { id: "room", label: "Sypialnia", x: 0.9, y: 0.5, move: true },
        { id: "kitchen", label: "Aneks kuchenny", x: 0.63, y: 0.36, note: "Fronty z teku, blat z trawertynu i sprzęt AGD w cenie apartamentu." },
        { id: "balcony", label: "Balkon", x: 0.19, y: 0.56, note: "Od 9 do 12 m². Szklana balustrada bez słupków, a między palmami prześwituje zatoka." },
      ],
    },
    b: {
      id: "b",
      type: "2 sypialnie, narożne",
      outdoor: "balkon",
      insideName: "dwie sypialnie",
      insideText: "Narożny salon ma szkło z dwóch stron. Z wyspy kuchennej widać zatokę, a na balkonie czeka jacuzzi.",
      interior: "assets/picker/inside-b",
      roomImage: "assets/picker/room-b",
      room: { title: "Balkon z jacuzzi", text: "Tekowy pokład, jacuzzi w trawertynie i cała zatoka Kamala przed Tobą." },
      move: clip("move-b"),
      hotspots: [
        { id: "room", label: "Balkon z jacuzzi", x: 0.21, y: 0.55, move: true },
        { id: "kitchen", label: "Wyspa kuchenna", x: 0.54, y: 0.56, note: "Wyspa z trawertynu ma 2,6 m długości. Nad nią wiszą dwie lampy z mosiądzu." },
        { id: "bedrooms", label: "Sypialnie", x: 0.75, y: 0.44, note: "Dwie sypialnie, każda z własną łazienką. Z głównej widać zatokę." },
      ],
    },
    c: {
      id: "c",
      type: "Penthouse z basenem",
      outdoor: "taras",
      insideName: "penthouse",
      insideText: "Salon ma prawie 6 m wysokości. Schody prowadzą na dach, a za szklanymi drzwiami po prawej jest prywatny basen.",
      interior: "assets/picker/inside-c",
      roomImage: "assets/picker/room-c",
      room: { title: "Prywatny basen", text: "Basen infinity tylko dla penthouse'u. Krawędź wody łączy się z horyzontem." },
      move: clip("move-c"),
      hotspots: [
        { id: "room", label: "Prywatny basen", x: 0.88, y: 0.72, move: true },
        { id: "stairs", label: "Schody na dach", x: 0.67, y: 0.4, note: "Prowadzą na prywatną część dachu z sauną i prysznicem pod gołym niebem." },
        { id: "wall", label: "Ściana z teku", x: 0.48, y: 0.5, note: "Listwy z teku i podświetlana wnęka z mosiądzu na ceramikę." },
      ],
    },
  };

  // Floors: area and balcony ranges in m², starting price in THB, free and total units.
  const FLOORS = [
    { n: 1, zone: "a", area: [42, 55], outdoor: [9, 12], from: 4690000, free: 4, total: 7 },
    { n: 2, zone: "a", area: [42, 55], outdoor: [9, 12], from: 4850000, free: 5, total: 7 },
    { n: 3, zone: "b", area: [78, 96], outdoor: [18, 24], from: 8900000, free: 3, total: 6 },
    { n: 4, zone: "b", area: [78, 96], outdoor: [18, 24], from: 9250000, free: 2, total: 6 },
    { n: 5, zone: "c", area: [168, 186], outdoor: [60, 72], from: 24500000, free: 1, total: 2 },
  ];

  // Lower edges of the white balcony slabs traced on the exterior photo (left end, nearest
  // corner, right end), from the roof slab down to the slab above the lobby. Floor n sits
  // between SLABS[5 - n] and SLABS[6 - n].
  const SLABS = [
    [[1188, 482], [2300, 205], [2550, 378]],
    [[1188, 601], [2300, 425], [2550, 534]],
    [[1188, 719], [2300, 643], [2550, 689]],
    [[1188, 836], [2300, 856], [2550, 843]],
    [[1188, 955], [2300, 1068], [2550, 993]],
    [[1188, 1072], [2300, 1276], [2550, 1155]],
  ];

  const ZONE_IDS = ["a", "b", "c"];

  function floorPolygon(n) {
    const up = SLABS[5 - n];
    const lo = SLABS[6 - n];
    return [...up, ...lo.slice().reverse()].map((point) => point.join(",")).join(" ");
  }

  // Where the floor number sits: just right of the building, level with the floor.
  function floorTag(n) {
    const up = SLABS[5 - n];
    const lo = SLABS[6 - n];
    return { x: ((up[2][0] + 36) / IMG_W) * 100, y: ((up[2][1] + lo[2][1]) / 2 / IMG_H) * 100 };
  }

  const groups = (value) => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const thb = (value) => `${groups(value)} THB`;
  function pln(valueThb) {
    const zl = valueThb * THB_TO_PLN;
    if (zl >= 1e6) return `≈ ${(zl / 1e6).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} mln zł`;
    return `≈ ${groups(zl / 1000)} tys. zł`;
  }
  const areaText = (f, zone) => `${f.area[0]}–${f.area[1]} m² · ${zone.outdoor} ${f.outdoor[0]}–${f.outdoor[1]} m²`;
  const still = (base) => ({ src: `${base}-2752.webp`, srcset: `${base}-1440.webp 1440w, ${base}-2752.webp 2752w` });

  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compactQuery = window.matchMedia("(max-width: 1023px)");
  const fineQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  const motionOk = () => !reducedQuery.matches;

  // Start buffering a clip that was created with preload="none".
  function warm(video) {
    if (!video || !video.getAttribute("src")) return;
    if (video.preload !== "auto") video.preload = "auto";
    if (video.readyState === 0 && video.networkState !== HTMLMediaElement.NETWORK_LOADING) video.load();
  }

  // Resolves when the clip can play through, or with whatever is buffered at the deadline.
  function waitReady(video, ms) {
    return new Promise((resolve, reject) => {
      if (video.readyState >= 4) {
        resolve();
        return;
      }
      const finish = (ok) => {
        window.clearTimeout(timer);
        video.removeEventListener("canplaythrough", onReady);
        video.removeEventListener("error", onError);
        if (ok) resolve();
        else reject(new Error("clip unavailable"));
      };
      const onReady = () => finish(true);
      const onError = () => finish(false);
      const timer = window.setTimeout(() => finish(video.readyState >= 3), ms);
      video.addEventListener("canplaythrough", onReady);
      video.addEventListener("error", onError);
    });
  }

  // outside: the building and the panel. zooming: the camera closes in on the chosen floor.
  // inside: the living room with hotspots. moving: the film to the second room is playing.
  // room: the second room after the camera move.
  function initPicker() {
    const section = document.getElementById("apartamenty");
    if (!section) return;
    const pick = (selector) => section.querySelector(selector);
    const scene = pick(".pk-scene");
    const ext = pick(".pk-ext");
    const svg = pick(".pk-floors");
    const tag = pick(".pk-tag");
    const scrim = pick(".pk-scrim");
    const spots = pick(".pk-spots");
    const panel = pick(".pk-panel");
    const caption = pick(".pk-caption");
    const range = pick("[data-range]");
    const ticks = Array.from(pick(".pk-ticks").children);
    const numEl = pick("[data-num]");
    const enterButton = pick("[data-enter]");
    const backButton = pick("[data-back]");
    const backLabel = pick("[data-back-label]");
    const capTitle = pick("[data-cap-title]");
    const capText = pick("[data-cap-text]");
    const spotList = pick("[data-spot-list]");
    const floorSelect = document.getElementById("f-floor");

    const state = { selected: START_FLOOR, hover: null, phase: "outside", entered: START_FLOOR, note: null, loading: false };
    const primed = new Set();
    let busy = false;
    let warmedOnce = false;
    let warmTimer = 0;
    let watchdog = 0;
    let unzoomTimer = 0;
    let shownActive = START_FLOOR;
    let warmZone = null;
    let spotsKey = "";

    const svgNs = "http://www.w3.org/2000/svg";
    const polygons = FLOORS.map((floor) => {
      const shape = document.createElementNS(svgNs, "polygon");
      shape.setAttribute("class", "pk-floor");
      shape.setAttribute("points", floorPolygon(floor.n));
      shape.addEventListener("pointerenter", () => {
        if (fineQuery.matches && state.phase === "outside" && state.hover !== floor.n) update({ hover: floor.n });
      });
      shape.addEventListener("click", () => onFloorClick(floor.n));
      svg.appendChild(shape);
      return shape;
    });
    svg.addEventListener("pointerleave", () => {
      if (state.hover !== null) update({ hover: null });
    });

    function makeVideo(className, onEnded) {
      const video = document.createElement("video");
      video.className = `pk-layer ${className}`;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("disablepictureinpicture", "");
      video.setAttribute("aria-hidden", "true");
      video.preload = "none";
      video.tabIndex = -1;
      video.addEventListener("ended", onEnded);
      return video;
    }

    function makeStill(className, alt) {
      const img = document.createElement("img");
      img.className = `pk-layer ${className}`;
      img.alt = alt;
      img.width = IMG_W;
      img.height = IMG_H;
      img.decoding = "async";
      img.sizes = STILL_SIZES;
      return img;
    }

    // Layers per apartment type, stacked: living room, film to the room, room.
    const layers = {};
    for (const id of ZONE_IDS) {
      const zone = ZONES[id];
      const group = {
        inside: makeStill("pk-inside", `Salon w apartamencie: ${zone.type}`),
        move: makeVideo("pk-move", () => {
          if (state.phase === "moving") setPhase("room");
        }),
        room: makeStill("pk-room", zone.room.title),
      };
      for (const el of [group.inside, group.move, group.room]) scene.insertBefore(el, scrim);
      layers[id] = group;
    }

    function applySources() {
      const compact = compactQuery.matches;
      for (const id of ZONE_IDS) {
        const zone = ZONES[id];
        const moveSrc = compact ? zone.move.mobile : zone.move.desktop;
        if (layers[id].move.getAttribute("src") !== moveSrc) layers[id].move.setAttribute("src", moveSrc);
      }
    }

    // Stills and posters load only once a visitor looks at that apartment type.
    function prime(id) {
      if (primed.has(id)) return;
      primed.add(id);
      const zone = ZONES[id];
      const inside = still(zone.interior);
      const room = still(zone.roomImage);
      layers[id].inside.srcset = inside.srcset;
      layers[id].inside.src = inside.src;
      layers[id].room.srcset = room.srcset;
      layers[id].room.src = room.src;
      layers[id].move.poster = zone.move.poster;
    }

    const activeFloor = () => (state.phase === "outside" ? (state.hover ?? state.selected) : state.entered);
    const enteredZone = () => ZONES[FLOORS[state.entered - 1].zone];

    function update(patch) {
      Object.assign(state, patch);
      render();
    }

    function restartAnimation(el, text) {
      el.textContent = text;
      el.style.animation = "none";
      void el.offsetWidth;
      el.style.animation = "";
    }

    function render() {
      const phase = state.phase;
      const active = activeFloor();
      const floor = FLOORS[active - 1];
      const activeZone = ZONES[floor.zone];
      const zone = enteredZone();
      const inView = phase === "inside" || phase === "moving" || phase === "room";
      const captionOn = phase === "inside" || phase === "room";

      section.dataset.phase = phase;
      scene.style.setProperty("--fx", phase === "outside" || phase === "zooming" ? "0.66" : "0.5");
      polygons.forEach((shape, index) => shape.setAttribute("data-on", String(phase === "outside" && active === index + 1)));

      const place = floorTag(active);
      tag.style.left = `${place.x}%`;
      tag.style.top = `${place.y}%`;

      if (active !== shownActive) {
        shownActive = active;
        restartAnimation(numEl, String(active));
        restartAnimation(tag.firstElementChild, String(active));
        pick("[data-type]").textContent = activeZone.type;
        pick("[data-desc]").textContent = areaText(floor, activeZone);
        pick("[data-price]").textContent = thb(floor.from);
        pick("[data-pln]").textContent = pln(floor.from);
        pick("[data-free]").textContent = `${floor.free} z ${floor.total}`;
        range.setAttribute("aria-valuetext", `Piętro ${active}, ${activeZone.type}`);
        ticks.forEach((tick, index) => tick.setAttribute("data-on", String(index + 1 === active)));
      }
      if (range.value !== String(active)) range.value = String(active);

      panel.dataset.on = String(phase === "outside");
      panel.inert = phase !== "outside";
      pick("[data-intro]").textContent = fineQuery.matches ? INTRO_POINTER : INTRO_TOUCH;
      enterButton.dataset.loading = String(state.loading);
      enterButton.setAttribute("aria-busy", String(state.loading));
      pick("[data-enter-label]").textContent = state.loading ? "Wczytuję" : "Wejdź do środka";
      pick("[data-enter-sr]").textContent = ` na piętro ${state.selected}`;

      for (const id of ZONE_IDS) {
        const here = zone.id === id;
        layers[id].inside.dataset.on = String(here && inView);
        layers[id].move.dataset.on = String(here && (phase === "moving" || phase === "room"));
        layers[id].room.dataset.on = String(here && phase === "room");
      }

      backLabel.textContent = phase === "room" ? "Wróć do salonu" : "Wróć do budynku";

      caption.dataset.on = String(captionOn);
      caption.inert = !captionOn;
      if (phase === "room") {
        capTitle.textContent = zone.room.title;
        capText.textContent = zone.room.text;
      } else {
        capTitle.textContent = `Piętro ${state.entered}, ${zone.insideName}`;
        capText.textContent = zone.insideText;
      }
      spotList.hidden = phase === "room";
      spots.dataset.on = String(phase === "inside");
      renderSpots(zone);

      if (phase === "outside" && activeZone.id !== warmZone) {
        warmZone = activeZone.id;
        scheduleWarm(activeZone.id);
      }
    }

    function renderSpots(zone) {
      const key = `${zone.id}|${state.note}|${state.phase === "inside"}`;
      if (key === spotsKey) return;
      spotsKey = key;
      const focused = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.spot : undefined;
      spots.replaceChildren(...zone.hotspots.map(hotspot));
      spotList.replaceChildren(...zone.hotspots.map(listItem));
      if (focused) {
        const again = section.querySelector(`[data-spot="${focused}"]`);
        if (again) again.focus({ preventScroll: true });
      }
    }

    function noteEl(text, className) {
      const note = document.createElement("p");
      if (className) note.className = className;
      note.textContent = text;
      return note;
    }

    function hotspot(h) {
      const wrap = document.createElement("div");
      wrap.className = "pk-spot";
      wrap.dataset.side = h.x > 0.7 ? "left" : "right";
      wrap.style.left = `${h.x * 100}%`;
      wrap.style.top = `${h.y * 100}%`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pk-spot-btn";
      button.dataset.kind = h.move ? "move" : "info";
      button.dataset.spot = `spot-${h.id}`;
      button.tabIndex = state.phase === "inside" ? 0 : -1;
      if (!h.move) button.setAttribute("aria-expanded", String(state.note === h.id));
      const ring = document.createElement("span");
      ring.className = "pk-spot-ring";
      ring.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = "pk-spot-label";
      label.textContent = h.label;
      if (h.move) {
        const go = document.createElement("span");
        go.className = "pk-spot-go";
        go.setAttribute("aria-hidden", "true");
        go.textContent = "→";
        label.appendChild(go);
      }
      button.append(ring, label);
      button.addEventListener("click", () => (h.move ? goRoom() : toggleNote(h.id)));
      wrap.appendChild(button);
      if (!h.move && state.note === h.id) wrap.appendChild(noteEl(h.note, "pk-note"));
      return wrap;
    }

    function listItem(h) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.kind = h.move ? "move" : "info";
      button.dataset.spot = `list-${h.id}`;
      if (!h.move) button.setAttribute("aria-expanded", String(state.note === h.id));
      button.textContent = h.label;
      if (h.move) {
        const go = document.createElement("span");
        go.setAttribute("aria-hidden", "true");
        go.textContent = " →";
        button.appendChild(go);
      }
      button.addEventListener("click", () => (h.move ? goRoom() : toggleNote(h.id)));
      item.appendChild(button);
      if (!h.move && state.note === h.id) item.appendChild(noteEl(h.note));
      return item;
    }

    function setPhase(phase) {
      state.phase = phase;
      if (phase === "outside" || phase === "inside" || phase === "room") busy = false;
      window.clearTimeout(watchdog);
      // A stalled film never traps the visitor: move on after a generous deadline.
      if (phase === "moving") {
        watchdog = window.setTimeout(() => {
          if (state.phase === "moving") setPhase("room");
        }, CLIP_WATCHDOG_MS);
      }
      window.clearTimeout(unzoomTimer);
      if (phase === "outside") unzoom();
      // Reset the zoomed building only once the living room has fully covered it.
      if (phase === "inside")
        unzoomTimer = window.setTimeout(() => {
          if (state.phase !== "outside" && state.phase !== "zooming") unzoom();
        }, 1200);
      render();
      if (phase === "inside" || phase === "room") capTitle.focus({ preventScroll: true });
      if (phase === "inside" && motionOk()) warm(layers[enteredZone().id].move);
      if (phase === "outside") applySources();
    }

    // Load the stills of whatever floor the visitor is looking at.
    function scheduleWarm(id) {
      window.clearTimeout(warmTimer);
      warmTimer = window.setTimeout(
        () => {
          warmedOnce = true;
          prime(id);
        },
        warmedOnce ? 350 : 1600,
      );
    }

    async function playClip(video, during, after) {
      if (!motionOk() || !video) {
        setPhase(after);
        return;
      }
      update({ loading: true });
      try {
        warm(video);
        await waitReady(video, CLIP_WAIT_MS);
        video.currentTime = 0;
        state.loading = false;
        setPhase(during);
        await video.play();
      } catch {
        state.loading = false;
        setPhase(after);
      }
    }

    // Scale the exterior photo so a window around floor n fills the scene. The window sits
    // on the left half of the facade, centred on the floor's balconies.
    function zoomTo(n) {
      const up = SLABS[5 - n];
      const lo = SLABS[6 - n];
      const at = (slab) => slab[0][1] + ((slab[1][1] - slab[0][1]) * (FOCUS_X - slab[0][0])) / (slab[1][0] - slab[0][0]);
      const h = (FOCUS_W * IMG_H) / IMG_W;
      const x = FOCUS_X - FOCUS_W / 2;
      const y = (at(up) + at(lo)) / 2 - h / 2;
      ext.style.transformOrigin = "0 0";
      ext.style.transition = `transform ${ZOOM_MS}ms cubic-bezier(0.55, 0, 0.25, 1), filter ${ZOOM_MS}ms ease-in`;
      ext.style.transform = `scale(${IMG_W / FOCUS_W}) translate(${(-x / IMG_W) * 100}%, ${(-y / IMG_H) * 100}%)`;
      ext.style.filter = "brightness(1.08)";
    }

    function unzoom() {
      ext.style.transition = "none";
      ext.style.transform = "";
      ext.style.transformOrigin = "";
      ext.style.filter = "";
    }

    // The camera closes in on the chosen floor and the living room fades in over the end of
    // the move, as if stepping through the balcony door.
    async function zoomIn(n) {
      if (!motionOk()) {
        setPhase("inside");
        return;
      }
      setPhase("zooming");
      zoomTo(n);
      await new Promise((resolve) => window.setTimeout(resolve, ZOOM_HANDOFF_MS));
      if (state.phase === "zooming") setPhase("inside");
    }

    function enter(n) {
      if (busy || state.phase !== "outside") return;
      busy = true;
      const id = FLOORS[n - 1].zone;
      Object.assign(state, { selected: n, hover: null, entered: n, note: null });
      if (floorSelect) floorSelect.value = String(n);
      prime(id);
      if (Math.abs(section.getBoundingClientRect().top) > 2) {
        section.scrollIntoView({ behavior: motionOk() ? "smooth" : "auto", block: "start" });
      }
      render();
      zoomIn(n);
    }

    function goRoom() {
      if (busy || state.phase !== "inside") return;
      busy = true;
      state.note = null;
      playClip(layers[enteredZone().id].move, "moving", "room");
    }

    function rewind(videos) {
      window.setTimeout(() => {
        for (const video of videos) {
          video.pause();
          if (video.readyState > 0) video.currentTime = 0;
        }
      }, 700);
    }

    function backToLiving() {
      if (state.phase !== "room") return;
      setPhase("inside");
      rewind([layers[enteredZone().id].move]);
    }

    function backToBuilding() {
      if (state.phase !== "inside" && state.phase !== "room") return;
      state.note = null;
      if (motionOk()) {
        section.dataset.settling = "true";
        window.setTimeout(() => {
          section.dataset.settling = "false";
        }, 1000);
      }
      setPhase("outside");
      rewind(ZONE_IDS.map((id) => layers[id].move));
      window.setTimeout(() => enterButton.focus({ preventScroll: true }), 80);
    }

    function toggleNote(id) {
      update({ note: state.note === id ? null : id });
    }

    // Mouse: a click goes straight in. Touch: the first tap picks the floor, the second enters.
    function onFloorClick(n) {
      if (state.phase !== "outside") return;
      if (fineQuery.matches || state.selected === n) enter(n);
      else update({ selected: n });
    }

    range.addEventListener("input", () => update({ hover: null, selected: Number(range.value) }));
    range.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        enter(state.selected);
      }
    });
    enterButton.addEventListener("click", () => enter(state.selected));
    backButton.addEventListener("click", () => (state.phase === "room" ? backToLiving() : backToBuilding()));
    scene.addEventListener("pointerdown", (event) => {
      if (state.note && !event.target.closest(".pk-spot")) update({ note: null });
    });
    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || (state.phase !== "inside" && state.phase !== "room")) return;
      if (state.note) update({ note: null });
      else if (state.phase === "room") backToLiving();
      else backToBuilding();
    });
    compactQuery.addEventListener("change", () => {
      if (state.phase === "outside") applySources();
    });
    fineQuery.addEventListener("change", render);

    applySources();
    render();
  }

  // The gold marker tracks how far the amenities rail has been scrolled.
  function initRail() {
    const rail = document.querySelector("[data-rail]");
    const marker = document.querySelector("[data-rail-marker]");
    if (!rail || !marker) return;
    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      marker.style.setProperty("--p", (max > 0 ? rail.scrollLeft / max : 0).toFixed(3));
    };
    update();
    rail.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    document.querySelectorAll("[data-rail-step]").forEach((button) => {
      button.addEventListener("click", () => {
        const card = rail.querySelector(".am-card");
        const distance = (card ? card.offsetWidth : rail.clientWidth * 0.8) + 24;
        rail.scrollBy({ left: Number(button.dataset.railStep) * distance, behavior: motionOk() ? "smooth" : "auto" });
      });
    });
  }

  // Rental calculator: nightly rate times occupied nights, minus the operator's share
  // and the monthly common-area fee. The yield is against the lowest price of that type.
  const OPERATOR_SHARE = 0.35;
  const CAM_THB_PER_M2_MONTH = 60;
  const CALC = {
    a: { area: 48, rate: { min: 1500, max: 5000, step: 100, value: 2600 }, occ: 65 },
    b: { area: 88, rate: { min: 3000, max: 9000, step: 100, value: 5200 }, occ: 65 },
    c: { area: 176, rate: { min: 9000, max: 30000, step: 500, value: 16000 }, occ: 55 },
  };

  function initCalc() {
    const form = document.querySelector("[data-calc]");
    if (!form) return;
    const rate = form.elements.namedItem("rate");
    const occ = form.elements.namedItem("occ");
    const out = (name) => form.querySelector(`[data-out="${name}"]`);
    const cheapest = (zone) => Math.min(...FLOORS.filter((f) => f.zone === zone).map((f) => f.from));
    const type = () => form.elements.namedItem("type").value;

    function compute() {
      const t = CALC[type()];
      const price = cheapest(type());
      const gross = Number(rate.value) * 365 * (Number(occ.value) / 100);
      const fee = Math.round(gross * OPERATOR_SHARE);
      const cam = t.area * CAM_THB_PER_M2_MONTH * 12;
      const net = gross - fee - cam;
      out("rate").textContent = thb(Number(rate.value));
      out("occ").textContent = `${occ.value}%`;
      out("gross").textContent = thb(gross);
      out("fee").textContent = `− ${thb(fee)}`;
      out("cam").textContent = `− ${thb(cam)}`;
      out("net").textContent = thb(net);
      out("netPln").textContent = pln(net);
      out("yield").textContent = `${((net / price) * 100).toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
      out("yieldNote").textContent = `rocznie od ceny ${thb(price)}`;
    }

    function setType() {
      const t = CALC[type()];
      Object.assign(rate, { min: t.rate.min, max: t.rate.max, step: t.rate.step });
      rate.value = String(t.rate.value);
      occ.value = String(t.occ);
      compute();
    }

    form.addEventListener("submit", (event) => event.preventDefault());
    form.querySelectorAll('input[name="type"]').forEach((input) => input.addEventListener("change", setType));
    rate.addEventListener("input", compute);
    occ.addEventListener("input", compute);
    setType();
  }

  // Concept version: the form checks the fields and shows the thank-you state, but sends nothing.
  function initForm() {
    const form = document.querySelector("[data-form]");
    const done = document.querySelector("[data-form-done]");
    if (!form || !done) return;
    const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const PHONE = /^[+\d\s()-]{9,20}$/;
    const CHECKED = ["name", "email", "phone", "consent"];
    const CHANNELS = {
      whatsapp: "na WhatsAppie",
      wideo: "e-mailem z linkiem do wideorozmowy",
      telefon: "telefonicznie",
      email: "e-mailem",
    };
    const field = (name) => form.elements.namedItem(name);
    const value = (name) => (field(name).value || "").trim();

    function check() {
      const errors = {};
      const channel = field("channel").value;
      if (value("name").length < 2) errors.name = "Wpisz imię i nazwisko.";
      if (!EMAIL.test(value("email"))) errors.email = "Wpisz poprawny adres e-mail.";
      if (value("phone") && !PHONE.test(value("phone"))) errors.phone = "Numer może mieć cyfry, spacje i znak +.";
      else if (!value("phone") && (channel === "whatsapp" || channel === "telefon"))
        errors.phone = channel === "whatsapp" ? "Podaj numer, żebyśmy mogli napisać na WhatsAppie." : "Podaj numer, żebyśmy mogli zadzwonić.";
      if (!field("consent").checked) errors.consent = "Bez tej zgody nie możemy odpowiedzieć.";
      return errors;
    }

    function showError(name, message) {
      const wrap = form.querySelector(`[data-field="${name}"]`);
      const input = field(name);
      const error = document.getElementById(`f-${name}-error`);
      wrap.dataset.invalid = String(Boolean(message));
      input.setAttribute("aria-invalid", String(Boolean(message)));
      if (message) {
        error.textContent = message;
        error.hidden = false;
        input.setAttribute("aria-describedby", error.id);
      } else {
        error.hidden = true;
        input.removeAttribute("aria-describedby");
      }
    }

    for (const name of CHECKED) {
      field(name).addEventListener(name === "consent" ? "change" : "input", () => showError(name, ""));
    }
    form.querySelectorAll('input[name="channel"]').forEach((input) => input.addEventListener("change", () => showError("phone", "")));

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const errors = check();
      for (const name of CHECKED) showError(name, errors[name] || "");
      const first = CHECKED.find((name) => errors[name]);
      if (first) {
        field(first).focus();
        return;
      }
      const firstName = value("name").split(/\s+/)[0];
      const floor = field("floor").value;
      done.querySelector("[data-done-title]").textContent = `Dziękujemy, ${firstName}.`;
      done.querySelector("[data-done-text]").textContent =
        `Odezwiemy się ${CHANNELS[field("channel").value]} w ciągu jednego dnia roboczego, żeby umówić prezentację${floor ? ` piętra ${floor}` : ""}.`;
      form.hidden = true;
      done.hidden = false;
    });
  }

  function initReveal() {
    const items = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.setAttribute("data-shown", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-shown", "");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    items.forEach((el) => io.observe(el));
  }

  initPicker();
  initRail();
  initCalc();
  initForm();
  initReveal();
})();
