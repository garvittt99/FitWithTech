const movements = [
  {
    id: "squats",
    title: "Squat Tracker",
    label: "Squats",
    level: "Beginner",
    icon: "SQ",
    kind: "lower-angle",
    low: 108,
    high: 154,
    cue: "Drop your hips back, keep your chest lifted, and stand tall to count a rep.",
    fallbackCue: "Move down and up in the center of the frame for each squat."
  },
  {
    id: "push-ups",
    title: "Push-Up Tracker",
    label: "Push-ups",
    level: "Intermediate",
    icon: "PU",
    kind: "lower-angle",
    low: 96,
    high: 152,
    cue: "Lower with control, then fully press the floor away.",
    fallbackCue: "Keep your body side-on or diagonal so the camera can see the up-down motion."
  },
  {
    id: "lunges",
    title: "Lunge Tracker",
    label: "Lunges",
    level: "Intermediate",
    icon: "LG",
    kind: "lower-angle",
    low: 104,
    high: 150,
    cue: "Step long, lower straight down, then push back to standing.",
    fallbackCue: "Alternate legs and make each down-up cycle clear."
  },
  {
    id: "plank",
    title: "Plank Hold Tracker",
    label: "Hold",
    level: "Beginner",
    icon: "PL",
    kind: "hold",
    low: 68,
    high: 78,
    cue: "Keep shoulders, hips, and heels in one strong line.",
    fallbackCue: "Stay still in frame. Low motion adds to your hold time."
  },
  {
    id: "glute-bridges",
    title: "Glute Bridge Tracker",
    label: "Glute bridge",
    level: "Beginner",
    icon: "GB",
    kind: "raise",
    low: 0.03,
    high: 0.1,
    cue: "Lift your hips, squeeze at the top, then lower softly.",
    fallbackCue: "Use a side view so the camera can read your hip lift."
  },
  {
    id: "mountain-climbers",
    title: "Mountain Climber Tracker",
    label: "Climbers",
    level: "Intermediate",
    icon: "MC",
    kind: "burst",
    low: 0.04,
    high: 0.1,
    cue: "Drive one knee toward your chest while the other leg stays long.",
    fallbackCue: "Fast alternating knee drives count as motion bursts."
  },
  {
    id: "high-knees",
    title: "High Knee Tracker",
    label: "High knees",
    level: "Beginner",
    icon: "HK",
    kind: "burst",
    low: 0.04,
    high: 0.1,
    cue: "Lift each knee toward hip height and keep your torso tall.",
    fallbackCue: "Each strong knee-drive burst is counted."
  },
  {
    id: "burpees",
    title: "Burpee Tracker",
    label: "Burpees",
    level: "Advanced",
    icon: "BR",
    kind: "vertical-cycle",
    low: 0.48,
    high: 0.66,
    cue: "Hit the low position, pop back up, and finish tall.",
    fallbackCue: "The app counts a burpee when your body drops low and returns high."
  }
];

const accents = [
  ["rgba(15, 155, 142, 0.18)", "rgba(255, 115, 92, 0.12)"],
  ["rgba(244, 178, 63, 0.18)", "rgba(87, 165, 255, 0.12)"],
  ["rgba(119, 101, 255, 0.16)", "rgba(15, 155, 142, 0.12)"],
  ["rgba(87, 165, 255, 0.17)", "rgba(255, 115, 92, 0.12)"]
];

const video = document.querySelector("#video");
const videoStage = document.querySelector("#videoStage");
const canvas = document.querySelector("#overlayCanvas");
const ctx = canvas.getContext("2d");
const idleState = document.querySelector("#idleState");
const cameraStatus = document.querySelector("#cameraStatus");
const engineStatus = document.querySelector("#engineStatus");
const exerciseSelect = document.querySelector("#exerciseSelect");
const movementGrid = document.querySelector("#movementGrid");
const activeExerciseTitle = document.querySelector("#activeExerciseTitle");
const repLabel = document.querySelector("#repLabel");
const repCount = document.querySelector("#repCount");
const formScore = document.querySelector("#formScore");
const motionScore = document.querySelector("#motionScore");
const activeTime = document.querySelector("#activeTime");
const coachCue = document.querySelector("#coachCue");
const leftMotion = document.querySelector("#leftMotion");
const centerMotion = document.querySelector("#centerMotion");
const rightMotion = document.querySelector("#rightMotion");
const startCameraBtn = document.querySelector("#startCameraBtn");
const startTrackingBtn = document.querySelector("#startTrackingBtn");
const pauseTrackingBtn = document.querySelector("#pauseTrackingBtn");
const stopCameraBtn = document.querySelector("#stopCameraBtn");
const resetBtn = document.querySelector("#resetBtn");

const motionCanvas = document.createElement("canvas");
motionCanvas.width = 160;
motionCanvas.height = 90;
const motionCtx = motionCanvas.getContext("2d", { willReadFrequently: true });

let viewWidth = 0;
let viewHeight = 0;
let activeMovement = movements[0];
let cameraReady = false;
let isTracking = false;
let animationId = 0;
let previousFrame = null;
let smoothedMotion = null;
let smoothedSample = null;
let reps = 0;
let phase = "ready";
let lastRepAt = 0;
let trail = [];
let elapsedBeforeStart = 0;
let trackingStartedAt = 0;
let holdSeconds = 0;
let lastFrameAt = 0;
let lastPoseVideoTime = -1;
let poseLandmarker = null;
let poseLoading = false;
let poseAvailable = false;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function setStatus(text, live = false) {
  cameraStatus.textContent = text;
  cameraStatus.classList.toggle("live", live);
}

function resizeCanvas() {
  const rect = videoStage.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const nextViewWidth = Math.max(1, Math.round(rect.width));
  const nextViewHeight = Math.max(1, Math.round(rect.height));
  const nextCanvasWidth = Math.max(1, Math.round(nextViewWidth * ratio));
  const nextCanvasHeight = Math.max(1, Math.round(nextViewHeight * ratio));

  if (canvas.width === nextCanvasWidth && canvas.height === nextCanvasHeight) {
    viewWidth = nextViewWidth;
    viewHeight = nextViewHeight;
    return;
  }

  viewWidth = nextViewWidth;
  viewHeight = nextViewHeight;
  canvas.width = nextCanvasWidth;
  canvas.height = nextCanvasHeight;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function getVideoRect() {
  if (!video.videoWidth || !video.videoHeight || !viewWidth || !viewHeight) {
    return { x: 0, y: 0, width: viewWidth, height: viewHeight };
  }

  const videoRatio = video.videoWidth / video.videoHeight;
  const stageRatio = viewWidth / viewHeight;
  let width = viewWidth;
  let height = viewHeight;

  if (videoRatio > stageRatio) {
    height = width / videoRatio;
  } else {
    width = height * videoRatio;
  }

  return {
    x: (viewWidth - width) / 2,
    y: (viewHeight - height) / 2,
    width,
    height
  };
}

function mapVideoPoint(point) {
  const rect = getVideoRect();
  return {
    x: rect.x + (1 - point.x) * rect.width,
    y: rect.y + point.y * rect.height
  };
}

function resetCounters() {
  reps = 0;
  phase = "ready";
  lastRepAt = 0;
  holdSeconds = 0;
  previousFrame = null;
  smoothedMotion = null;
  smoothedSample = null;
  trail = [];
  elapsedBeforeStart = 0;
  trackingStartedAt = isTracking ? performance.now() : 0;
  updateMetricText({ form: null, energy: 0, thirds: [0, 0, 0] });
}

function getElapsedSeconds(now = performance.now()) {
  if (!isTracking || !trackingStartedAt) return elapsedBeforeStart;
  return elapsedBeforeStart + (now - trackingStartedAt) / 1000;
}

function updateMetricText(sample) {
  repLabel.textContent = activeMovement.label;
  repCount.textContent = activeMovement.kind === "hold" ? formatTime(Math.floor(holdSeconds)) : reps;
  formScore.textContent = sample.form == null ? "--" : `${Math.round(sample.form)}%`;
  motionScore.textContent = `${Math.round(sample.energy || 0)}%`;
  activeTime.textContent = formatTime(Math.floor(getElapsedSeconds()));
  leftMotion.value = sample.thirds?.[0] || 0;
  centerMotion.value = sample.thirds?.[1] || 0;
  rightMotion.value = sample.thirds?.[2] || 0;
}

function smoothNumber(previous, next, alpha = 0.22) {
  if (next == null || Number.isNaN(next)) return previous ?? null;
  if (previous == null || Number.isNaN(previous)) return next;
  return previous + (next - previous) * alpha;
}

function smoothThirds(previous = [0, 0, 0], next = [0, 0, 0], alpha = 0.22) {
  return next.map((value, index) => smoothNumber(previous[index], value, alpha) ?? 0);
}

function smoothMotionFrame(motion) {
  if (!smoothedMotion) {
    smoothedMotion = {
      ...motion,
      thirds: [...(motion.thirds || [0, 0, 0])]
    };
    return smoothedMotion;
  }

  smoothedMotion = {
    energy: smoothNumber(smoothedMotion.energy, motion.energy) ?? 0,
    centroidX: smoothNumber(smoothedMotion.centroidX, motion.centroidX, 0.18) ?? 0.5,
    centroidY: smoothNumber(smoothedMotion.centroidY, motion.centroidY, 0.18) ?? 0.5,
    thirds: smoothThirds(smoothedMotion.thirds, motion.thirds),
    form: smoothNumber(smoothedMotion.form, motion.form, 0.16)
  };

  return smoothedMotion;
}

function smoothTrackingSample(sample) {
  if (!smoothedSample) {
    smoothedSample = {
      ...sample,
      thirds: [...(sample.thirds || [0, 0, 0])]
    };
    return smoothedSample;
  }

  smoothedSample = {
    ...sample,
    metric: sample.metric == null ? null : smoothNumber(smoothedSample.metric, sample.metric, 0.24),
    form: sample.form == null ? null : smoothNumber(smoothedSample.form, sample.form, 0.18),
    energy: smoothNumber(smoothedSample.energy, sample.energy) ?? 0,
    thirds: smoothThirds(smoothedSample.thirds, sample.thirds)
  };

  return smoothedSample;
}

function renderExerciseOptions() {
  exerciseSelect.innerHTML = movements
    .map((movement) => `<option value="${movement.id}">${movement.title}</option>`)
    .join("");
}

function renderMovementGrid() {
  movementGrid.innerHTML = movements
    .map((movement, index) => {
      const accent = accents[index % accents.length];
      return `
        <article class="movement-card reveal ${movement.id === activeMovement.id ? "active" : ""}" style="--i: ${index}; --accent-a: ${accent[0]}; --accent-b: ${accent[1]}">
          <div class="movement-content">
            <div class="movement-top">
              <span class="movement-icon">${movement.icon}</span>
              <span class="tag">${movement.level}</span>
            </div>
            <div>
              <h3>${movement.title}</h3>
              <p>${movement.cue}</p>
            </div>
            <button type="button" data-movement="${movement.id}">Track this</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function setActiveMovement(id) {
  activeMovement = movements.find((movement) => movement.id === id) || movements[0];
  exerciseSelect.value = activeMovement.id;
  activeExerciseTitle.textContent = activeMovement.title;
  coachCue.textContent = cameraReady ? activeMovement.cue : "Start the camera, then move through one clean rep.";
  resetCounters();
  renderMovementGrid();
}

function drawFrameGuides() {
  const rect = getVideoRect();
  const guideX = rect.x + rect.width * 0.16;
  const guideY = rect.y + rect.height * 0.07;
  const guideWidth = rect.width * 0.68;
  const guideHeight = rect.height * 0.86;
  const centerX = rect.x + rect.width * 0.5;

  ctx.clearRect(0, 0, viewWidth, viewHeight);
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.26)";
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 10]);
  ctx.strokeRect(guideX, guideY, guideWidth, guideHeight);
  ctx.beginPath();
  ctx.moveTo(centerX, guideY);
  ctx.lineTo(centerX, guideY + guideHeight);
  ctx.stroke();
  ctx.restore();
}

function drawMotionOverlay(motion) {
  drawFrameGuides();
  const rect = getVideoRect();

  if (motion.energy > 1.4) {
    const x = rect.x + (1 - motion.centroidX) * rect.width;
    const y = rect.y + motion.centroidY * rect.height;
    trail.push({ x, y, energy: motion.energy, age: 0 });
    if (trail.length > 34) trail.shift();
  }

  trail = trail
    .map((point) => ({ ...point, age: point.age + 1 }))
    .filter((point) => point.age < 34);

  ctx.save();
  for (const point of trail) {
    const alpha = 1 - point.age / 34;
    const radius = clamp(point.energy / 4, 5, 24);
    ctx.beginPath();
    ctx.fillStyle = `rgba(15, 155, 142, ${0.08 + alpha * 0.34})`;
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const bars = motion.thirds || [0, 0, 0];
  bars.forEach((value, index) => {
    const width = rect.width / 3;
    const height = clamp(value / 100, 0, 1) * 88;
    ctx.fillStyle = index === 1 ? "rgba(255, 115, 92, 0.26)" : "rgba(15, 155, 142, 0.22)";
    ctx.fillRect(rect.x + index * width, rect.y + rect.height - height, width - 2, height);
  });

  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.font = "700 13px Inter, system-ui, sans-serif";
  ctx.fillText(`${activeMovement.title} | ${poseAvailable ? "Pose AI" : "Motion"}`, rect.x + 18, rect.y + 28);
  ctx.restore();
}

function analyzeMotionFrame() {
  if (!cameraReady || video.readyState < 2) {
    return { energy: 0, centroidX: 0.5, centroidY: 0.5, thirds: [0, 0, 0], form: null };
  }

  motionCtx.drawImage(video, 0, 0, motionCanvas.width, motionCanvas.height);
  const current = motionCtx.getImageData(0, 0, motionCanvas.width, motionCanvas.height);
  const data = current.data;

  if (!previousFrame) {
    previousFrame = new Uint8ClampedArray(data);
    return { energy: 0, centroidX: 0.5, centroidY: 0.5, thirds: [0, 0, 0], form: null };
  }

  let changed = 0;
  let totalDiff = 0;
  let weightedX = 0;
  let weightedY = 0;
  const thirds = [0, 0, 0];
  const threshold = 28;
  const width = motionCanvas.width;
  const height = motionCanvas.height;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const diff =
        Math.abs(data[index] - previousFrame[index]) +
        Math.abs(data[index + 1] - previousFrame[index + 1]) +
        Math.abs(data[index + 2] - previousFrame[index + 2]);

      if (diff > threshold) {
        const weight = diff / 255;
        changed += 1;
        totalDiff += weight;
        weightedX += x * weight;
        weightedY += y * weight;
        thirds[Math.min(2, Math.floor((x / width) * 3))] += weight;
      }
    }
  }

  previousFrame = new Uint8ClampedArray(data);

  const energy = clamp((changed / (width * height)) * 350, 0, 100);
  const centroidX = totalDiff ? weightedX / totalDiff / width : 0.5;
  const centroidY = totalDiff ? weightedY / totalDiff / height : 0.5;
  const maxThird = Math.max(1, ...thirds);
  const normalizedThirds = thirds.map((value) => clamp((value / maxThird) * energy, 0, 100));

  return {
    energy,
    centroidX,
    centroidY,
    thirds: normalizedThirds,
    form: clamp(100 - Math.abs(normalizedThirds[0] - normalizedThirds[2]) * 0.42, 50, 100)
  };
}

function landmarkVisible(point) {
  return point && (point.visibility == null || point.visibility > 0.42);
}

function averagePoint(points) {
  const visible = points.filter(landmarkVisible);
  if (!visible.length) return null;
  return {
    x: visible.reduce((sum, point) => sum + point.x, 0) / visible.length,
    y: visible.reduce((sum, point) => sum + point.y, 0) / visible.length
  };
}

function distance(a, b) {
  if (!landmarkVisible(a) || !landmarkVisible(b)) return null;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angle(a, b, c) {
  if (!landmarkVisible(a) || !landmarkVisible(b) || !landmarkVisible(c)) return null;
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!mag) return null;
  return (Math.acos(clamp(dot / mag, -1, 1)) * 180) / Math.PI;
}

function averageNumbers(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function getPoseSample(landmarks, motion) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const shoulders = averagePoint([leftShoulder, rightShoulder]);
  const hips = averagePoint([leftHip, rightHip]);
  const knees = averagePoint([leftKnee, rightKnee]);
  const ankles = averagePoint([leftAnkle, rightAnkle]);
  const kneeAngle = averageNumbers([
    angle(leftHip, leftKnee, leftAnkle),
    angle(rightHip, rightKnee, rightAnkle)
  ]);
  const elbowAngle = averageNumbers([
    angle(leftShoulder, leftElbow, leftWrist),
    angle(rightShoulder, rightElbow, rightWrist)
  ]);

  let metric = null;
  let form = null;

  if (activeMovement.id === "squats") {
    metric = kneeAngle;
    form = metric == null ? null : clamp(100 - Math.max(0, metric - 175) * 1.3, 60, 100);
  } else if (activeMovement.id === "push-ups") {
    metric = elbowAngle;
    form = metric == null ? null : clamp(100 - Math.abs((shoulders?.y || 0) - (hips?.y || 0)) * 150, 55, 100);
  } else if (activeMovement.id === "lunges") {
    metric = Math.min(
      angle(leftHip, leftKnee, leftAnkle) || 180,
      angle(rightHip, rightKnee, rightAnkle) || 180
    );
    form = metric == null ? null : clamp(100 - Math.abs((leftKnee?.x || 0) - (leftAnkle?.x || 0)) * 80, 55, 100);
  } else if (activeMovement.id === "mountain-climbers" || activeMovement.id === "high-knees") {
    const leftLift = leftHip && leftKnee ? leftHip.y - leftKnee.y : 0;
    const rightLift = rightHip && rightKnee ? rightHip.y - rightKnee.y : 0;
    metric = Math.max(leftLift, rightLift);
    form = clamp(metric * 620, 45, 100);
  } else if (activeMovement.id === "burpees") {
    metric = hips?.y ?? motion.centroidY;
    form = clamp(motion.energy * 2.1, 52, 100);
  } else if (activeMovement.id === "plank") {
    if (shoulders && hips && ankles) {
      const lineError = Math.abs(shoulders.y - hips.y) + Math.abs(hips.y - ankles.y);
      metric = clamp(100 - lineError * 260, 0, 100);
      form = metric;
    }
  } else if (activeMovement.id === "glute-bridges") {
    metric = knees && hips ? knees.y - hips.y : null;
    form = metric == null ? null : clamp(metric * 600, 45, 100);
  }

  return {
    metric,
    form,
    energy: motion.energy,
    thirds: motion.thirds
  };
}

function processSample(sample, dt, now, fromPose) {
  if (!isTracking) return;

  if (activeMovement.kind === "hold") {
    const stableByPose = fromPose && sample.form != null && sample.form > activeMovement.high;
    const stableByMotion = !fromPose && sample.energy < 6;
    if (stableByPose || stableByMotion) {
      holdSeconds += dt;
      coachCue.textContent = activeMovement.cue;
    } else {
      coachCue.textContent = fromPose ? "Bring shoulders, hips, and heels back into one line." : activeMovement.fallbackCue;
    }
    return;
  }

  if (sample.metric == null && fromPose) return;

  const cooldown = activeMovement.id === "mountain-climbers" || activeMovement.id === "high-knees" ? 360 : 620;
  const canCount = now - lastRepAt > cooldown;

  if (activeMovement.kind === "lower-angle") {
    if (sample.metric < activeMovement.low) {
      phase = "loaded";
      coachCue.textContent = "Good depth. Drive back to the top.";
    }
    if (phase === "loaded" && sample.metric > activeMovement.high && canCount) {
      reps += 1;
      phase = "ready";
      lastRepAt = now;
      coachCue.textContent = activeMovement.cue;
    }
  } else if (activeMovement.kind === "raise" || activeMovement.kind === "burst") {
    if (sample.metric > activeMovement.high && phase !== "raised" && canCount) {
      reps += 1;
      phase = "raised";
      lastRepAt = now;
      coachCue.textContent = activeMovement.cue;
    }
    if (sample.metric < activeMovement.low) phase = "ready";
  } else if (activeMovement.kind === "vertical-cycle") {
    if (sample.metric > activeMovement.high) {
      phase = "low";
      coachCue.textContent = "Low position found. Finish tall.";
    }
    if (phase === "low" && sample.metric < activeMovement.low && canCount) {
      reps += 1;
      phase = "ready";
      lastRepAt = now;
      coachCue.textContent = activeMovement.cue;
    }
  }
}

function processFallback(motion, dt, now) {
  if (!isTracking) return;

  const sample = { ...motion, form: motion.form };

  if (activeMovement.kind === "hold") {
    processSample(sample, dt, now, false);
    return;
  }

  const canCount = now - lastRepAt > 760;
  const activeBurst = motion.energy > 8;

  if (activeMovement.kind === "burst") {
    if (activeBurst && canCount) {
      reps += 1;
      lastRepAt = now;
      coachCue.textContent = activeMovement.fallbackCue;
    }
    return;
  }

  if (activeBurst && motion.centroidY > 0.58) {
    phase = "loaded";
  }
  if (phase === "loaded" && activeBurst && motion.centroidY < 0.49 && canCount) {
    reps += 1;
    phase = "ready";
    lastRepAt = now;
    coachCue.textContent = activeMovement.fallbackCue;
  }
}

function drawPose(landmarks) {
  drawFrameGuides();

  const connectors = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
    [24, 26], [26, 28], [27, 31], [28, 32]
  ];

  ctx.save();
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(15, 155, 142, 0.92)";

  connectors.forEach(([start, end]) => {
    const a = landmarks[start];
    const b = landmarks[end];
    if (!landmarkVisible(a) || !landmarkVisible(b)) return;
    const startPoint = mapVideoPoint(a);
    const endPoint = mapVideoPoint(b);
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);
    ctx.lineTo(endPoint.x, endPoint.y);
    ctx.stroke();
  });

  landmarks.forEach((point, index) => {
    if (!landmarkVisible(point) || index > 32) return;
    const mappedPoint = mapVideoPoint(point);
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
    ctx.strokeStyle = "rgba(255, 115, 92, 0.92)";
    ctx.lineWidth = 2;
    ctx.arc(mappedPoint.x, mappedPoint.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  const rect = getVideoRect();
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.font = "700 13px Inter, system-ui, sans-serif";
  ctx.fillText(`${activeMovement.title} | Pose AI`, rect.x + 18, rect.y + 28);
  ctx.restore();
}

async function loadPoseEngine() {
  if (poseLoading || poseLandmarker) return;
  poseLoading = true;
  engineStatus.textContent = "Loading pose AI";

  try {
    const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs");
    const fileset = await vision.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    poseLandmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    poseAvailable = true;
    engineStatus.textContent = "Pose AI ready";
  } catch (error) {
    poseAvailable = false;
    engineStatus.textContent = "Motion engine";
    console.info("Pose AI model unavailable, using local motion engine.", error);
  } finally {
    poseLoading = false;
  }
}

function getPoseResults() {
  if (!poseLandmarker || !cameraReady || video.readyState < 2 || video.currentTime === lastPoseVideoTime) {
    return null;
  }

  lastPoseVideoTime = video.currentTime;
  try {
    return poseLandmarker.detectForVideo(video, performance.now());
  } catch (error) {
    poseAvailable = false;
    engineStatus.textContent = "Motion engine";
    return null;
  }
}

function trackingLoop(now) {
  animationId = requestAnimationFrame(trackingLoop);

  const dt = lastFrameAt ? Math.min(0.12, (now - lastFrameAt) / 1000) : 0;
  lastFrameAt = now;

  const rawMotion = analyzeMotionFrame();
  const motion = smoothMotionFrame(rawMotion);
  let sample = { ...motion, form: motion.form };
  let usedPose = false;

  const poseResults = getPoseResults();
  const landmarks = poseResults?.landmarks?.[0];

  if (landmarks) {
    usedPose = true;
    sample = smoothTrackingSample(getPoseSample(landmarks, rawMotion));
    drawPose(landmarks);
    processSample(sample, dt, now, true);
  } else {
    sample = smoothTrackingSample(sample);
    drawMotionOverlay(motion);
    processFallback(motion, dt, now);
  }

  if (usedPose) {
    engineStatus.textContent = "Pose AI tracking";
  } else if (!poseLoading) {
    engineStatus.textContent = poseLandmarker ? "Finding pose" : "Motion engine";
  }

  updateMetricText(sample);
}

async function startCamera() {
  if (cameraReady) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Camera unsupported");
    coachCue.textContent = "This browser does not expose webcam access.";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user"
      },
      audio: false
    });

    video.srcObject = stream;
    await video.play();
    cameraReady = true;
    idleState.classList.add("hidden");
    setStatus("Camera ready");
    coachCue.textContent = activeMovement.cue;
    startTrackingBtn.disabled = false;
    pauseTrackingBtn.disabled = false;
    stopCameraBtn.disabled = false;
    startCameraBtn.disabled = true;
    resizeCanvas();
    loadPoseEngine();

    if (!animationId) {
      lastFrameAt = performance.now();
      animationId = requestAnimationFrame(trackingLoop);
    }
  } catch (error) {
    setStatus("Camera blocked");
    coachCue.textContent = "Allow camera permission in the browser, then start the camera again.";
    console.error(error);
  }
}

function startTracking() {
  if (!cameraReady) {
    coachCue.textContent = "Start the camera first so movement can be tracked.";
    return;
  }
  if (isTracking) return;
  isTracking = true;
  trackingStartedAt = performance.now();
  setStatus("Tracking live", true);
}

function pauseTracking() {
  if (!isTracking) return;
  elapsedBeforeStart = getElapsedSeconds();
  trackingStartedAt = 0;
  isTracking = false;
  setStatus("Paused");
}

function stopCamera() {
  if (!cameraReady && !video.srcObject) return;

  if (isTracking) {
    elapsedBeforeStart = getElapsedSeconds();
  }

  isTracking = false;
  trackingStartedAt = 0;
  cameraReady = false;

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = 0;
  }

  const stream = video.srcObject;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }

  video.pause();
  video.srcObject = null;
  idleState.classList.remove("hidden");
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  previousFrame = null;
  smoothedMotion = null;
  smoothedSample = null;
  trail = [];
  resetCounters();
  setStatus("Camera off");
  engineStatus.textContent = poseLandmarker ? "Pose AI ready" : "Motion engine";
  coachCue.textContent = "Camera is off. Start the camera when you are ready to track again.";
  startTrackingBtn.disabled = true;
  pauseTrackingBtn.disabled = true;
  stopCameraBtn.disabled = true;
  startCameraBtn.disabled = false;
}

function resetTracking() {
  resetCounters();
  setStatus(cameraReady ? "Camera ready" : "Camera off");
  coachCue.textContent = cameraReady ? activeMovement.cue : "Start the camera, then move through one clean rep.";
}

startCameraBtn.addEventListener("click", startCamera);
startTrackingBtn.addEventListener("click", startTracking);
pauseTrackingBtn.addEventListener("click", pauseTracking);
stopCameraBtn.addEventListener("click", stopCamera);
resetBtn.addEventListener("click", resetTracking);

exerciseSelect.addEventListener("change", (event) => {
  setActiveMovement(event.target.value);
});

movementGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-movement]");
  if (!button) return;
  setActiveMovement(button.dataset.movement);
  document.querySelector("#tracker").scrollIntoView({ behavior: "smooth", block: "start" });
});

window.addEventListener("resize", resizeCanvas);
video.addEventListener("loadedmetadata", resizeCanvas);

if ("ResizeObserver" in window) {
  const stageResizeObserver = new ResizeObserver(resizeCanvas);
  stageResizeObserver.observe(videoStage);
}

startTrackingBtn.disabled = true;
pauseTrackingBtn.disabled = true;
stopCameraBtn.disabled = true;
renderExerciseOptions();
setActiveMovement(activeMovement.id);
resizeCanvas();
