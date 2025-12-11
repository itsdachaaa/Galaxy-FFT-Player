let sound;
let fft;

// HTML controls
let playButtonEl;
let backBtnEl;
let forwardBtnEl;
let volumeSliderEl;
let seekBarEl;
let timeLabelEl;
let trackSelectEl;

let isUserSeeking = false;

// Smoothed FFT bands (for nice motion)
let smoothBass = 0;
let smoothMid = 0;
let smoothTreble = 0;

// Orbiting particles
const NUM_PARTICLES = 50;
let particles = [];

// Default track
let currentTrackPath = "assets/hype.mp3";

function preload() {
  // Load default audio
  sound = loadSound(currentTrackPath);
}

function setup() {
  // Attach canvas to div in HTML 
  let cnv = createCanvas(500, 500);
  cnv.parent("visualizer-container");

  fft = new p5.FFT(0.8, 1024);
  fft.setInput(sound);
  sound.amp(0.7);

  angleMode(DEGREES);
  colorMode(HSB, 360, 100, 100, 100);

  // Initialize particles
  for (let i = 0; i < NUM_PARTICLES; i++) {
    const baseR = random(140, 220);
    particles.push({
      angle: random(360),
      baseRadius: baseR, 
      radius: baseR,
      size: random(3, 7),
      speedOffset: random(0.3, 1.2),
      wobbleOffset: random(360),
    });
  }

  setupUI();
}

// Setup HTML UI controls and event listeners
function setupUI() {
  playButtonEl = document.getElementById("playPause");
  backBtnEl = document.getElementById("backBtn");
  forwardBtnEl = document.getElementById("forwardBtn");
  volumeSliderEl = document.getElementById("volumeSlider");
  seekBarEl = document.getElementById("seekBar");
  timeLabelEl = document.getElementById("timeLabel");
  trackSelectEl = document.getElementById("trackSelect");

  // Play/Pause
  playButtonEl.addEventListener("click", togglePlay);

  // Back/Forward (30 seconds)
  backBtnEl.addEventListener("click", () => skipTime(-30));
  forwardBtnEl.addEventListener("click", () => skipTime(30));

  // Volume
  volumeSliderEl.addEventListener("input", () => {
    if (sound) {
      const vol = Number(volumeSliderEl.value);
      sound.setVolume(vol);
    }
  });

  // Time scrubber (seek bar)
  seekBarEl.addEventListener("input", () => {
    isUserSeeking = true;
    updateTimeLabelFromProgress(Number(seekBarEl.value));
  });
  
  // On change (user releases mouse), jump to new time
  seekBarEl.addEventListener("change", () => {
    if (sound && sound.isLoaded()) {
      const dur = sound.duration();
      const t = Number(seekBarEl.value) * dur;
      sound.jump(t);
    }
    isUserSeeking = false;
  });

  // Track selection
  trackSelectEl.addEventListener("change", () => {
    const newPath = trackSelectEl.value;
    switchTrack(newPath);
  });
}

// Load a new track and start playing it
function switchTrack(path) {
  currentTrackPath = path;

  // Stop current sound if playing
  if (sound && sound.isPlaying()) {
    sound.stop();
  }

  // Reset seek bar
  seekBarEl.value = 0;
  timeLabelEl.textContent = "0:00 / 0:00";

  // Load new sound
  sound = loadSound(
    currentTrackPath,
    () => {
      fft.setInput(sound);
      const vol = volumeSliderEl ? Number(volumeSliderEl.value) : 0.7;
      sound.setVolume(vol);
      sound.play();
      playButtonEl.textContent = "⏸";
    },
    (err) => {
      console.error("Error loading sound:", err);
    }
  );
}

// Skip forward/backward by delta seconds
function skipTime(delta) {
  if (!sound || !sound.isLoaded()) return;
  const dur = sound.duration();
  let t = sound.currentTime() + delta;
  t = constrain(t, 0, dur);
  sound.jump(t);
}

// Main draw loop
function draw() {
  background(0, 0, 4);
  
  // Update volume
  if (!sound) return;

  const vol = volumeSliderEl ? Number(volumeSliderEl.value) : 0.7;
  sound.setVolume(vol);

  // Analyze FFT
  if (sound.isLoaded()) {
    fft.analyze();
    let bass = fft.getEnergy("bass");
    let mid = fft.getEnergy("mid"); 
    let treble = fft.getEnergy("treble");

    // Smooth the FFT values for nicer motion
    smoothBass = lerp(smoothBass, bass, 0.3);
    smoothMid = lerp(smoothMid, mid, 0.4); 
    smoothTreble = lerp(smoothTreble, treble, 0.3);

    // Update seek bar + time label if user is NOT dragging
    if (!isUserSeeking) {
      const dur = sound.duration();
      const cur = sound.currentTime();
      if (dur > 0) {
        const progress = cur / dur;
        seekBarEl.value = progress;
        updateTimeLabel(cur, dur);
      }
    }
  }

  push();
  translate(width / 2, height / 2);

  drawBackgroundGlow();
  updateParticles();
  drawParticles();

  drawOuterLayerRing();
  drawInnerLayerRing();
  drawCore();

  pop();
}

// Update time label text
function updateTimeLabel(current, duration) {
  timeLabelEl.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
}

// Update time label based on progress
function updateTimeLabelFromProgress(progress) {
  if (!sound || !sound.isLoaded()) {
    timeLabelEl.textContent = "0:00 / 0:00";
    return;
  }
  const dur = sound.duration();
  const cur = progress * dur;
  updateTimeLabel(cur, dur);
}

// Format time in seconds to M:SS
function formatTime(t) {
  if (!isFinite(t)) return "0:00";
  const minutes = Math.floor(t / 60);
  const seconds = Math.floor(t % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Background glow effect
function drawBackgroundGlow() {
  let glowSize = map(smoothBass, 0, 255, 230, 320);
  let hueBG = map(smoothTreble, 0, 255, 210, 260);

  noStroke();
  for (let i = 0; i < 10; i++) {
    fill(hueBG, 30, 18, 16 - i);
    let r = glowSize + i * 30;
    ellipse(0, 0, r, r);
  }
}

// Outer ring layer
function drawOuterLayerRing() {
  const baseR = 150;
  const bassOffset = map(smoothBass, 0, 255, -50, 30);
  const pulsingR = baseR + bassOffset;

  const segmentCount = 10;
  const segmentAmp = map(smoothMid, 0, 100, 5, 15);
  const rippleAmp = map(smoothTreble, 0, 255, 0, 80);

  const hue = map(smoothBass, 0, 255, 240, 270);
  const sat = 90;
  const bri = map(smoothBass, 0, 255, 55, 100);

  noFill();
  for (let g = 0; g < 4; g++) {
    stroke(hue, 60, bri, 32 - g * 7);
    strokeWeight(10 - g * 2);
    drawRingSegment(
      pulsingR + g * 2,
      segmentCount,
      segmentAmp * 0.9,
      rippleAmp * 0.6
    );
  }

  stroke(hue, sat, bri);
  strokeWeight(3);
  drawRingSegment(pulsingR, segmentCount, segmentAmp, rippleAmp);
}

// A single deformed ring 
function drawRingSegment(baseR, segmentCount, segmentAmp, rippleAmp) {
  beginShape();
  for (let a = 0; a < 360; a += 3) {
    let petal = sin(a * segmentCount + frameCount * 0.6);
    let ripple = sin(a * segmentCount * 2 + frameCount * 1.1);

    let r = baseR + petal * segmentAmp + ripple * rippleAmp;
    let x = r * cos(a);
    let y = r * sin(a);
    vertex(x, y);
  }
  endShape(CLOSE);
}

// Inner ring layer
function drawInnerLayerRing() {
  const innerBase = map(smoothBass, 0, 255, 55, 115);

  const innerSegments = 5;
  const innerAmp = map(smoothBass, 0, 100, 8, 12);
  const hue = map(smoothMid, 0, 255, 250, 315);

  const waveSpeed = map(smoothMid, 0, 255, 0.3, 1);

  noFill();
  for (let g = 0; g < 4; g++) {
    stroke(hue, 60, 95, 30 - g * 6);
    strokeWeight(7 - g);
    beginShape();
    for (let a = 0; a < 360; a += 4) {
      let p = sin(a * innerSegments - frameCount * waveSpeed);
      let r = innerBase + p * innerAmp;
      let x = r * cos(a);
      let y = r * sin(a);
      vertex(x, y);
    }
    endShape(CLOSE);
  }
}

// Core 
function drawCore() {
  const coreR = map(smoothBass, 0, 255, 25, 70);
  const hue = map(smoothMid, 0, 255, 270, 330);

  noStroke();
  for (let i = 0; i < 6; i++) {
    fill(hue, 80, 100, 28 - i * 4);
    ellipse(0, 0, coreR * 1.7 + i * 8, coreR * 1.7 + i * 8);
  }

  fill(hue, 90, 100);
  ellipse(0, 0, coreR * 1.4, coreR * 1.4);
}

// Orbiting particles
function updateParticles() {
  const speedBase = map(smoothTreble, 0, 255, 0.3, 1.8);
  const bassPush = map(smoothBass, 0, 255, 0, 35);
  const midWobble = map(smoothMid, 0, 255, 0, 15);

  for (let p of particles) {
    p.angle += speedBase * p.speedOffset;
    let wobble = sin(frameCount * 1.2 + p.wobbleOffset) * midWobble;
    p.radius = p.baseRadius + bassPush + wobble;
  }
}

// Draw orbiting particles
function drawParticles() {
  const hue = map(smoothMid, 0, 255, 200, 260);
  const trebleSizeBoost = map(smoothTreble, 0, 255, 0, 5);

  noStroke();
  for (let p of particles) {
    let x = p.radius * cos(p.angle);
    let y = p.radius * sin(p.angle);
    let sz = p.size + trebleSizeBoost;

    for (let g = 0; g < 2; g++) {
      fill(hue, 40, 90, 20 - g * 8);
      ellipse(x, y, sz + g * 4, sz + g * 4);
    }

    fill(hue, 70, 100);
    ellipse(x, y, sz, sz);
  }
}

// Play/Pause controls
function togglePlay() {
  if (!sound) return;

  if (sound.isPlaying()) {
    sound.pause();
    playButtonEl.textContent = "▶";
  } else {
    sound.loop();
    playButtonEl.textContent = "⏸";
  }
}
