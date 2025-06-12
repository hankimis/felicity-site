import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, increment, getDocs, collectionGroup, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const calendarTitle = document.getElementById('calendar-title');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const calendarEl = document.getElementById('attendance-calendar');
const attendanceMessage = document.getElementById('attendance-message');
const attendanceSubmit = document.getElementById('attendance-submit');
const userIpEl = document.getElementById('user-ip');
const streakCountEl = document.getElementById('streak-count');
const totalCountEl = document.getElementById('total-count');
const userLevelBadge = document.getElementById('user-level-badge');
const attendanceRewardEl = document.getElementById('attendance-reward');
const attendanceList = document.getElementById('attendance-list');
const commentsEl = document.getElementById('attendance-comments');
const commentForm = document.getElementById('attendance-comment-form');
const commentInput = document.getElementById('attendance-comment-input');

let currentUser = null;
let currentDate = new Date();
let attendanceData = {};

const mentalQuotes = [
  "목적이 그르면 언제든 실패할 것이요, 목적이 옳다면 언제든 성공할 것이다. - 도산 안창호",
  "포기하지 마라. 위대한 일은 시간이 걸린다.",
  "실패는 성공의 어머니다.",
  "오늘의 고통은 내일의 힘이 된다.",
  "할 수 있다고 믿는 순간, 절반은 이룬 것이다.",
  "노력은 배신하지 않는다.",
  "작은 성취도 소중히 여겨라.",
  "끝까지 해내는 사람이 결국 이긴다.",
  "자신을 믿어라. 당신은 생각보다 강하다.",
  "시작이 반이다.",
  "실패를 두려워하지 마라. 도전하지 않는 것이 진짜 실패다.",
  "가난하다고 해서 꿈마저 가난한 것은 아니다. - 서칭 포 슈가맨",
  "나는 실패한 게 아니다. 나는 잘 되지 않는 방법 1만 가지를 발견한 것이다. – 토마스 에디슨",
  "성공한 사람보다는 가치 있는 사람이 되려 하라. - 알버트 아인슈타인",
  "길가의 민들레는 밟혀도 꽃을 피운다. - 우장춘",
  "운은 계획에서 비롯된다. - 브랜치 리키",
  "사랑 받고 싶다면 사랑하라, 그리고 사랑스럽게 행동하라. - 벤자민 프랭클린",
  "인간은 살아있기 위해 무언가에 대한 열망을 간직해야 한다. - 마가렛 딜란드",
  "최선을 다하고 있다고 말해봤자 소용없다. 필요한 일을 함에 있어서는 반드시 성공해야 한다. - 윈스턴 처칠",
  "미래를 결정짓고 싶다면 과거를 공부하라. - 공자"
];

// --- 유저 IP 가져오기 ---
async function fetchUserIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    userIpEl.textContent = data.ip;
  } catch {
    userIpEl.textContent = '-';
  }
}
fetchUserIP();

// --- 달력 렌더링 ---
function renderCalendar(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  let html = '<table class="attendance-calendar-table"><thead><tr>';
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  weekDays.forEach(d => html += `<th>${d}</th>`);
  html += '</tr></thead><tbody><tr>';
  for (let i = 0; i < firstDay.getDay(); i++) html += '<td class="empty"></td>';
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    const checked = attendanceData[dateStr];
    html += `<td class="${checked ? 'checked' : ''} ${isToday ? 'today' : ''}">${d}${checked ? `<span class='calendar-dot'></span>` : ''}</td>`;
    if ((firstDay.getDay() + d) % 7 === 0) html += '</tr><tr>';
  }
  html += '</tr></tbody></table>';
  calendarEl.innerHTML = html;
  calendarTitle.textContent = `${year}-${String(month+1).padStart(2,'0')}`;
}

function updateCalendar() {
  renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
}

prevMonthBtn.addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  updateCalendar();
});
nextMonthBtn.addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  updateCalendar();
});

// --- 출석 데이터 불러오기 및 현황 ---
async function loadAttendance(user) {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  let userData = userSnap.exists() ? userSnap.data() : { level: 1, streak: 0, total: 0 };
  const todayStr = new Date().toISOString().slice(0,10);
  // 출석 데이터
  const attendanceRef = collection(db, `users/${user.uid}/attendance`);
  const snap = await getDocs(attendanceRef);
  attendanceData = {};
  snap.forEach(doc => {
    attendanceData[doc.id] = doc.data();
  });
  // streak, total 계산
  let streak = 0, total = 0;
  let prev = null;
  Object.keys(attendanceData).sort().forEach(date => {
    total++;
    if (prev) {
      const prevDate = new Date(prev);
      const curDate = new Date(date);
      const diff = (curDate - prevDate) / (1000*60*60*24);
      if (diff === 1) streak++;
      else streak = 1;
    } else {
      streak = 1;
    }
    prev = date;
  });
  streakCountEl.textContent = streak;
  totalCountEl.textContent = total;
  userLevelBadge.textContent = `Lv.${userData.level || 1}`;
  // 보상
  let reward = '-';
  if (streak % 30 === 0 && streak > 0) reward = '30일 연속 출석 보상!';
  else if (streak % 7 === 0 && streak > 0) reward = '7일 연속 출석 보상!';
  else if (streak === 1) reward = '첫 출석!';
  attendanceRewardEl.textContent = reward;
  updateCalendar();
}

// --- 오늘의 출석 현황 목록 렌더링 ---
function renderAttendanceList(attendances) {
  attendanceList.innerHTML = ''; // 기존 목록 초기화
  if (!attendances || attendances.length === 0) {
    attendanceList.innerHTML = '<p>오늘 아직 출석한 사람이 없습니다.</p>';
    return;
  }

  // 시간 내림차순으로 정렬 (최신이 위로)
  attendances.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

  attendances.forEach(att => {
    const item = document.createElement('div');
    item.className = 'attendance-list-item';
    const a_time = att.createdAt.toDate().toLocaleTimeString('ko-KR');

    item.innerHTML = `
      <div class="att-item-main">
        <span class="level-badge">[Lv.${att.user.level || 1}]</span>
        <span class="display-name">${att.user.displayName}</span>
        <span class="attendance-time">${a_time}</span>
        <span class="att-item-quote">"${att.quote}"</span>
      </div>
    `;
    attendanceList.appendChild(item);
  });
}

// --- 실시간으로 오늘의 출석 현황 가져오기 ---
function subscribeToDailyAttendance() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Today at 00:00:00
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); // Tomorrow at 00:00:00

    const q = query(
        collectionGroup(db, 'attendance'),
        where('createdAt', '>=', today),
        where('createdAt', '<', tomorrow),
        orderBy('createdAt', 'desc')
    );

    onSnapshot(q, (snapshot) => {
        const attendances = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Ensure createdAt is a Firestore Timestamp object before processing
            if (data.createdAt) {
                attendances.push(data);
            }
        });
        renderAttendanceList(attendances);
    }, (error) => {
        console.error("오늘의 출석 현황 실시간 업데이트 중 오류:", error);
        if (error.code === 'failed-precondition') {
            alert("출석 현황을 불러오기 위한 데이터베이스 색인(index)이 필요합니다. 브라우저의 개발자 콘솔(F12)을 확인하여 색인 생성 링크를 클릭해주세요.");
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
  // 명언 입력란 항상 보이게
  if (attendanceMessage) {
    const randomQuote = mentalQuotes[Math.floor(Math.random() * mentalQuotes.length)];
    attendanceMessage.value = randomQuote;
  }
  // 달력은 페이지 로딩 시 바로 보이게
  updateCalendar();
  // 오늘의 출석 현황 실시간 구독 시작
  subscribeToDailyAttendance();
});

async function handleAttendanceSubmit(e) {
  e.preventDefault();
  if (!currentUser) {
    alert('로그인이 필요합니다.');
    return;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const attendanceRef = doc(db, `users/${currentUser.uid}/attendance`, todayStr);
  const attendanceSnap = await getDoc(attendanceRef);

  if (attendanceSnap.exists()) {
    alert('오늘은 이미 출석했습니다.');
    return;
  }

  const quote = attendanceMessage.value;
  if (!quote) {
    alert('출석 메시지가 없습니다.');
    return;
  }

  try {
    await setDoc(attendanceRef, {
      createdAt: serverTimestamp(),
      quote: quote,
      user: {
        displayName: currentUser.displayName,
        uid: currentUser.uid,
        level: currentUser.level || 1
      }
    });

    // Update user's total/streak counts
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
        total: increment(1),
        // Streak logic needs to be more robust, for now just incrementing
        streak: increment(1) 
    });

    alert('출석체크 완료!');
    await loadAttendance(currentUser); // Reload all data and re-render
  } catch (error) {
    console.error("출석체크 오류:", error);
    alert('출석체크 중 오류가 발생했습니다.');
  }
}

attendanceSubmit.addEventListener('click', handleAttendanceSubmit);

// Initial Load
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = {
      uid: user.uid,
      displayName: user.displayName,
    };
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if(userSnap.exists()) {
      currentUser = { ...currentUser, ...userSnap.data() };
    }
    await loadAttendance(currentUser);
    
    // 로그인 상태에서도 출석 현황을 표시
    const attendanceListSection = document.querySelector('.attendance-list-section');
    if (attendanceListSection) {
      attendanceListSection.style.display = 'block';
    }
  } else {
    currentUser = null;
    updateCalendar();
    
    // 로그아웃 상태에서도 출석 현황을 표시하되 메시지만 변경
    const attendanceListSection = document.querySelector('.attendance-list-section');
    if (attendanceListSection) {
      attendanceListSection.style.display = 'block';
    }
    attendanceList.innerHTML = '<p>오늘 아직 출석한 사람이 없습니다.</p>';
  }
});