let osc;
let isOn = false;
let handPose;
let video;
let hands = [];

let fireParticles = [];
let electricParticles = [];
let electricTrail = [];

let lastLeftTip = null;
let lastRightTip = null;
let lastLeftSeen = -1000;
let lastRightSeen = -1000;
const HOLD_FRAMES = 6;

const VID_W = 640;
const VID_H = 480;

let bgRect = { x: 0, y: 0, w: 0, h: 0 };
let fgRect = { x: 0, y: 0, w: 0, h: 0 };

function preload() {
  handPose = ml5.handPose();
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  video = createCapture(VIDEO);
  video.size(VID_W, VID_H);
  video.hide();

  handPose.detectStart(video, gotHands);

  osc = new p5.Oscillator(150);
  updateRects();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateRects();
}

function updateRects() {
  const vr = video.width / video.height;
  const cr = width / height;

  if (cr > vr) {
    bgRect.w = width;
    bgRect.h = width / vr;
    bgRect.x = 0;
    bgRect.y = (height - bgRect.h) / 2;
  } else {
    bgRect.h = height;
    bgRect.w = height * vr;
    bgRect.y = 0;
    bgRect.x = (width - bgRect.w) / 2;
  }

  const frameW = min(width * 0.85, 1100);
  const frameH = min(height * 0.85, 760);

  if (frameW / frameH > vr) {
    fgRect.h = frameH;
    fgRect.w = frameH * vr;
  } else {
    fgRect.w = frameW;
    fgRect.h = frameW / vr;
  }

  fgRect.x = (width - fgRect.w) / 2;
  fgRect.y = (height - fgRect.h) / 2;
}

function videoToFrameX(vx) {
  const nx = vx / video.width;
  const xOnFrame = fgRect.x + nx * fgRect.w;
  return width - xOnFrame;
}

function videoToFrameY(vy) {
  const ny = vy / video.height;
  return fgRect.y + ny * fgRect.h;
}

class FireParticle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = random(-1, 1);
    this.vy = random(-3, -0.5);
    this.size = random(8, 18);
    this.life = 255;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= 4;
  }
  show() {
    noStroke();
    fill(255, random(120, 180), 0, this.life);
    ellipse(this.x, this.y, this.size);
  }
  finished() {
    return this.life <= 0;
  }
}

class ElectricParticle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = random(-2, 2);
    this.vy = random(-2, 2);
    this.size = random(4, 8);
    this.life = 255;
  }
  update() {
    this.x += this.vx + random(-0.8, 0.8);
    this.y += this.vy + random(-0.8, 0.8);
    this.life -= 10;
  }
  show() {
    noStroke();
    fill(0, random(150, 255), 255, this.life);
    ellipse(this.x, this.y, this.size);
  }
  finished() {
    return this.life <= 0;
  }
}

function draw() {
  background(0);

  push();
  drawingContext.filter = "blur(18px)";
  tint(255, 160);
  translate(width, 0);
  scale(-1, 1);
  image(video, bgRect.x, bgRect.y, bgRect.w, bgRect.h);
  pop();

  fill(0, 120);
  noStroke();
  rect(0, 0, width, height);

  push();
  drawingContext.filter = "none";
  tint(255);
  translate(width, 0);
  scale(-1, 1);
  image(video, fgRect.x, fgRect.y, fgRect.w, fgRect.h);
  pop();

  let leftTipV = null;
  let rightTipV = null;

  if (hands.length >= 2) {
    let a = hands[0].index_finger_tip;
    let b = hands[1].index_finger_tip;
    if (a && b) {
      if (a.x < b.x) {
        leftTipV = a;
        rightTipV = b;
      } else {
        leftTipV = b;
        rightTipV = a;
      }
    }
  } else if (hands.length === 1) {
    let a = hands[0].index_finger_tip;
    if (a) {
      if (a.x < video.width / 2) leftTipV = a;
      else rightTipV = a;
    }
  }

  if (leftTipV) {
    lastLeftTip = { x: leftTipV.x, y: leftTipV.y };
    lastLeftSeen = frameCount;
  }
  if (rightTipV) {
    lastRightTip = { x: rightTipV.x, y: rightTipV.y };
    lastRightSeen = frameCount;
  }

  let useLeft =
    leftTipV || (lastLeftTip && frameCount - lastLeftSeen <= HOLD_FRAMES);
  let useRight =
    rightTipV || (lastRightTip && frameCount - lastRightSeen <= HOLD_FRAMES);

  if (useLeft) {
    let src = leftTipV ? leftTipV : lastLeftTip;
    let fx = videoToFrameX(src.x);
    let fy = videoToFrameY(src.y);

    let prev = electricTrail[electricTrail.length - 1];
    if (prev) {
      let d = dist(prev.x, prev.y, fx, fy);
      let steps = max(1, floor(d / 6));
      for (let s = 1; s <= steps; s++) {
        let ix = lerp(prev.x, fx, s / steps);
        let iy = lerp(prev.y, fy, s / steps);
        electricTrail.push({ x: ix, y: iy, life: 18 });
        for (let i = 0; i < 2; i++)
          electricParticles.push(new ElectricParticle(ix, iy));
      }
    } else {
      electricTrail.push({ x: fx, y: fy, life: 18 });
    }
  }

  for (let i = electricTrail.length - 1; i >= 0; i--) {
    let p = electricTrail[i];
    fill(0, 200, 255, p.life * 10);
    noStroke();
    ellipse(p.x, p.y, 14);
    p.life--;
    if (p.life <= 0) electricTrail.splice(i, 1);
  }

  for (let i = electricParticles.length - 1; i >= 0; i--) {
    electricParticles[i].update();
    electricParticles[i].show();
    if (electricParticles[i].finished()) electricParticles.splice(i, 1);
  }

  // FUEGO (der)
  if (useRight) {
    let src = rightTipV ? rightTipV : lastRightTip;
    let fx = videoToFrameX(src.x);
    let fy = videoToFrameY(src.y);
    for (let i = 0; i < 10; i++) {
      fireParticles.push(
        new FireParticle(fx + random(-6, 6), fy + random(-6, 6))
      );
    }
  }

  for (let i = fireParticles.length - 1; i >= 0; i--) {
    fireParticles[i].update();
    fireParticles[i].show();
    if (fireParticles[i].finished()) fireParticles.splice(i, 1);
  }

  if (hands.length > 0 && hands[0].index_finger_tip && hands[0].thumb_tip) {
    if (!isOn) {
      osc.start();
      isOn = true;
    }
    let finger = hands[0].index_finger_tip;
    let thumb = hands[0].thumb_tip;
    let pinch = dist(finger.x, finger.y, thumb.x, thumb.y);
    osc.freq(map(pinch, 0, 300, 150, 2000, true));
    osc.amp(0.15, 0.05);
  } else {
    if (isOn) {
      osc.stop();
      isOn = false;
    }
  }
}

function gotHands(results) {
  hands = results || [];
}
