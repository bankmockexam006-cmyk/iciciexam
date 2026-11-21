// BUZZIELS World Class Assessment 2026
// Schedule uses India Standard Time (Asia/Kolkata). This is client-side time control only.
const EXAM_DATE = "2026-11-21";
const START_HOUR = 12, START_MINUTE = 15;
const END_HOUR = 13, END_MINUTE = 30;
const IST_OFFSET_MINUTES = 330;
const STORAGE_KEY = "buzziels_exam_candidate_v1";

const $ = (id) => document.getElementById(id);
const screens = ["loginScreen","instructionsScreen","examScreen","resultScreen"];
let candidate = null;
let answers = {};
let timerInterval = null;
let submitted = false;

function scheduledTimestamp(hour, minute) {
  // Convert the configured IST wall-clock time into an absolute UTC timestamp.
  return Date.parse(`${EXAM_DATE}T${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}:00+05:30`);
}
const startAt = scheduledTimestamp(START_HOUR, START_MINUTE);
const endAt = scheduledTimestamp(END_HOUR, END_MINUTE);

function showScreen(id) {
  screens.forEach(s => $(s).classList.toggle("hidden", s !== id));
}
function formatRemaining(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
}
function scheduleMessage(now = Date.now()) {
  if (now < startAt) {
    const diff = startAt - now;
    return `The examination opens at 12:15 PM IST. Time until opening: ${formatRemaining(diff)}.`;
  }
  if (now >= endAt) return "EXAMINATION EXPIRED. The scheduled exam window has ended.";
  return "The examination is open. You may enter now.";
}
function updateSchedule() {
  const now = Date.now();
  $("scheduleStatus").textContent = scheduleMessage(now);
  $("enterExamBtn").disabled = now < startAt || now >= endAt;
}
function loadCandidate() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; }
}
function saveCandidate() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({candidate,answers})); } catch {}
}
function restoreCandidate() {
  const saved = loadCandidate();
  if (saved && saved.candidate) {
    candidate = saved.candidate;
    answers = saved.answers || {};
    $("candidateName").value = candidate.name || "";
    $("candidateEmail").value = candidate.email || "";
    $("candidatePhone").value = candidate.phone || "";
  }
}
$("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  candidate = {
    name: $("candidateName").value.trim(),
    email: $("candidateEmail").value.trim(),
    phone: $("candidatePhone").value.trim()
  };
  if (!candidate.name || !$("candidateEmail").checkValidity() || candidate.phone.length < 8) {
    alert("Please enter a valid name, email address and phone number.");
    return;
  }
  saveCandidate();
  $("candidateSummary").textContent = `${candidate.name} · ${candidate.email} · ${candidate.phone}`;
  showScreen("instructionsScreen");
  updateSchedule();
  if (window.scheduleRefresh) clearInterval(window.scheduleRefresh);
  window.scheduleRefresh = setInterval(updateSchedule, 1000);
});
$("enterExamBtn").addEventListener("click", () => {
  const now = Date.now();
  if (now < startAt) return alert("The examination has not started yet.");
  if (now >= endAt) return expireExam();
  beginExam();
});

function beginExam() {
  showScreen("examScreen");
  $("welcomeLine").textContent = `Candidate: ${candidate.name} · 100 questions · +1 / −0.25 marking`;
  renderQuestions();
  startTimer();
}
function renderQuestions() {
  const root = $("questionContainer");
  root.innerHTML = "";
  let currentSection = "";
  QUESTION_BANK.forEach((q) => {
    if (q.section !== currentSection) {
      currentSection = q.section;
      const heading = document.createElement("h2");
      heading.className = "section-title";
      heading.textContent = currentSection;
      root.appendChild(heading);
    }
    const card = document.createElement("article");
    card.className = "question-card";
    card.id = `question-${q.id}`;
    const top = document.createElement("div");
    top.className = "q-top";
    const number = document.createElement("div");
    number.className = "q-number";
    number.textContent = q.id;
    const stem = document.createElement("div");
    stem.className = "q-text";
    stem.textContent = q.q;
    top.append(number, stem);
    const options = document.createElement("div");
    options.className = "options";
    q.options.forEach((value, index) => {
      const letter = "ABCD"[index];
      const label = document.createElement("label");
      label.className = "option" + (answers[q.id] === letter ? " selected" : "");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `q${q.id}`;
      radio.value = letter;
      radio.checked = answers[q.id] === letter;
      radio.addEventListener("change", () => {
        answers[q.id] = letter;
        options.querySelectorAll(".option").forEach(el => el.classList.remove("selected"));
        label.classList.add("selected");
        updateProgress();
        saveCandidate();
      });
      const letterNode = document.createElement("b");
      letterNode.textContent = `${letter})`;
      const textNode = document.createElement("span");
      textNode.textContent = value;
      label.append(radio, letterNode, textNode);
      options.appendChild(label);
    });
    card.append(top, options);
    root.appendChild(card);
  });
  updateProgress();
}
function updateProgress() {
  const count = Object.keys(answers).filter(id => answers[id]).length;
  $("answeredCount").textContent = `${count} of 100 answered`;
  $("progressPercent").textContent = `${count}%`;
  $("progressBar").style.width = `${count}%`;
}
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  function tick() {
    const remaining = endAt - Date.now();
    if (remaining <= 0) {
      $("timer").textContent = "00:00";
      $("timer").parentElement.classList.add("warning");
      expireExam();
      return;
    }
    $("timer").textContent = formatRemaining(remaining);
    if (remaining <= 5 * 60 * 1000) $("timer").parentElement.classList.add("warning");
  }
  tick();
  timerInterval = setInterval(tick, 250);
}
function calculateResult() {
  let correct = 0, wrong = 0, unanswered = 0;
  QUESTION_BANK.forEach(q => {
    const chosen = answers[q.id];
    if (!chosen) unanswered++;
    else if (q.answers.includes(chosen)) correct++;
    else wrong++;
  });
  const net = correct - wrong * 0.25;
  return {correct, wrong, unanswered, net};
}
function finishExam(expired = false) {
  if (submitted) return;
  submitted = true;
  if (timerInterval) clearInterval(timerInterval);
  if (window.scheduleRefresh) clearInterval(window.scheduleRefresh);
  const result = calculateResult();
  showScreen("resultScreen");
  $("resultTitle").textContent = expired ? "Examination expired" : "Examination submitted";
  $("resultCandidate").textContent = `${candidate?.name || "Candidate"} · ${candidate?.email || ""}`;
  $("netScore").textContent = result.net.toFixed(2);
  $("correctCount").textContent = result.correct;
  $("wrongCount").textContent = result.wrong;
  $("unansweredCount").textContent = result.unanswered;
  const passed = result.net >= 70;
  $("passStatus").textContent = passed ? "PASS · You achieved the qualifying score." : "NOT QUALIFIED · The qualifying score is 70 net marks.";
  $("passStatus").className = `pass-status ${passed ? "pass" : "fail"}`;
  try {
    const record = {candidate, result, submittedAt: new Date().toISOString(), expired};
    localStorage.setItem("buzziels_last_result_v1", JSON.stringify(record));
  } catch {}
}
function expireExam() {
  if (submitted) return;
  if (!candidate) {
    showScreen("loginScreen");
    alert("The scheduled examination window has expired.");
    return;
  }
  finishExam(true);
}
$("submitBtn").addEventListener("click", () => {
  if (Date.now() >= endAt) return expireExam();
  const unanswered = 100 - Object.keys(answers).filter(id => answers[id]).length;
  const message = unanswered
    ? `You have ${unanswered} unanswered question(s). Submit your examination now?`
    : "Are you sure you want to submit your examination?";
  if (confirm(message)) finishExam(false);
});
$("printBtn").addEventListener("click", () => window.print());

restoreCandidate();
updateSchedule();
setInterval(updateSchedule, 1000);

// Prevent a stale open exam tab from remaining active after the expiry time.
window.addEventListener("focus", () => {
  if (!submitted && document.getElementById("examScreen") && !$("examScreen").classList.contains("hidden") && Date.now() >= endAt) {
    expireExam();
  }
});
