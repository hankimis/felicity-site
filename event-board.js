import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const eventList = document.getElementById('event-list');
const writeBtn = document.getElementById('write-event-btn');
const eventModal = document.getElementById('event-modal');
const closeEventModal = document.getElementById('close-event-modal');
const eventForm = document.getElementById('event-form');

// 이미지/로고 미리보기 및 유효성 안내
const eventImgInput = document.getElementById('event-img');
const eventLogoInput = document.getElementById('event-logo');
const previewEventImg = document.getElementById('preview-event-img');
const previewEventLogo = document.getElementById('preview-event-logo');
const eventFormMessage = document.getElementById('event-form-message');

let currentUser = null;
let isAdmin = false;

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  isAdmin = false;
  if (user) {
    const userDoc = await getDocs(query(collection(db, 'users')));
    userDoc.forEach(docSnap => {
      if (docSnap.id === user.uid && docSnap.data().role === 'admin') isAdmin = true;
    });
  }
  writeBtn.style.display = isAdmin ? 'inline-block' : 'none';
  renderEvents();
});

async function renderEvents() {
  eventList.innerHTML = '';
  const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <button class="event-card-btn" ${data.link ? `data-link="${data.link}"` : ''}>
        <div class="event-card-inner">
          <div class="event-card-left">
            <div>
              <div class="event-card-timer">
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20" color="#8b94a9"><path d="M3 7.02381C3 5.52475 4.20883 4.30952 5.7 4.30952H18.3C19.7912 4.30952 21 5.52475 21 7.02381V18.7857C21 20.2848 19.7912 21.5 18.3 21.5H5.7C4.20883 21.5 3 20.2848 3 18.7857V7.02381Z" fill="#E5E9EE"></path><path d="M7.5 3.85714C7.5 3.10761 8.10442 2.5 8.85 2.5C9.59558 2.5 10.2 3.10761 10.2 3.85714V5.66667C10.2 6.4162 9.59558 7.02381 8.85 7.02381C8.10442 7.02381 7.5 6.4162 7.5 5.66667V3.85714Z" fill="#151E42"></path><path d="M13.8 3.85714C13.8 3.10761 14.4044 2.5 15.15 2.5C15.8956 2.5 16.5 3.10761 16.5 3.85714V5.66667C16.5 6.4162 15.8956 7.02381 15.15 7.02381C14.4044 7.02381 13.8 6.4162 13.8 5.66667V3.85714Z" fill="#151E42"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M16.266 10.939C16.6003 11.3088 16.5732 11.881 16.2054 12.2171L10.9078 17.0586C10.7183 17.2318 10.4234 17.2113 10.2594 17.0135L7.70862 13.9364C7.39042 13.5525 7.44201 12.982 7.82386 12.6621C8.20571 12.3422 8.77321 12.3941 9.09142 12.7779L10.4391 14.4037C10.6031 14.6015 10.898 14.6221 11.0875 14.4489L14.9946 10.8782C15.3624 10.542 15.9316 10.5693 16.266 10.939Z" fill="#0067FF"></path></svg>
                <span>${data.period}</span>
              </div>
              <div class="event-card-title">${data.title}</div>
              <div class="event-card-desc">${data.desc}</div>
            </div>
            <div class="event-card-exchange-row">
              <img class="event-card-exchange-logo" src="${data.logo}" alt="${data.exchange}" />
              <span class="event-card-exchange-name">${data.exchange}</span>
              ${isAdmin ? `<button class="event-card-edit" data-id="${docSnap.id}" title="수정"><i class="fas fa-edit"></i></button><button class="event-card-delete" data-id="${docSnap.id}" title="삭제"><i class="fas fa-trash-alt"></i></button>` : ''}
            </div>
          </div>
          <div class="event-card-img-wrap">
            <img class="event-card-img" src="${data.img}" alt="${data.exchange} Event" />
          </div>
        </div>
      </button>
    `;
    eventList.appendChild(card);
  });
  // 카드 클릭 시 링크 이동
  document.querySelectorAll('.event-card-btn[data-link]').forEach(btn => {
    btn.addEventListener('click', e => {
      const link = btn.getAttribute('data-link');
      if (link) window.open(link, '_blank');
    });
  });
  // 삭제 버튼 이벤트
  if (isAdmin) {
    document.querySelectorAll('.event-card-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (confirm('정말로 삭제하시겠습니까?')) {
          await deleteDoc(doc(db, 'events', id));
          renderEvents();
        }
      });
    });
    // 수정 버튼 클릭 이벤트
    document.querySelectorAll('.event-card-edit').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const eventDoc = await getDoc(doc(db, 'events', id));
        if (!eventDoc.exists()) return alert('이벤트를 찾을 수 없습니다.');
        const data = eventDoc.data();
        document.getElementById('event-title').value = data.title;
        document.getElementById('event-desc').value = data.desc;
        document.getElementById('event-period').value = data.period;
        document.getElementById('event-exchange').value = data.exchange;
        document.getElementById('event-img').value = data.img;
        document.getElementById('event-logo').value = data.logo;
        document.getElementById('event-link').value = data.link;
        eventModal.setAttribute('data-edit-id', id);
        eventModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      });
    });
  }
}

writeBtn.addEventListener('click', () => {
  eventModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
});
closeEventModal.addEventListener('click', () => {
  eventModal.style.display = 'none';
  document.body.style.overflow = '';
  eventForm.reset();
  eventModal.removeAttribute('data-edit-id');
});

function showPreview(input, preview) {
  const url = input.value.trim();
  if (url && /^https?:\/\//.test(url)) {
    preview.src = url;
    preview.style.display = 'block';
  } else {
    preview.src = '';
    preview.style.display = 'none';
  }
}
if (eventImgInput && previewEventImg) {
  eventImgInput.addEventListener('input', () => showPreview(eventImgInput, previewEventImg));
}
if (eventLogoInput && previewEventLogo) {
  eventLogoInput.addEventListener('input', () => showPreview(eventLogoInput, previewEventLogo));
}

function showFormMessage(msg, color = '#ef5350') {
  if (eventFormMessage) {
    eventFormMessage.textContent = msg;
    eventFormMessage.style.color = color;
  }
}
function clearFormMessage() {
  if (eventFormMessage) eventFormMessage.textContent = '';
}

const eventFormSubmitHandler = async (e) => {
  e.preventDefault();
  if (!isAdmin) return;
  clearFormMessage();
  const title = document.getElementById('event-title').value.trim();
  const desc = document.getElementById('event-desc').value.trim();
  const period = document.getElementById('event-period').value.trim();
  const exchange = document.getElementById('event-exchange').value.trim();
  const img = document.getElementById('event-img').value.trim();
  const logo = document.getElementById('event-logo').value.trim();
  const link = document.getElementById('event-link').value.trim();
  if (!title || !desc || !period || !exchange || !img || !logo || !link) {
    showFormMessage('모든 항목을 입력해 주세요.');
    return;
  }
  if (title.length > 40 || desc.length > 120) {
    showFormMessage('제목/설명 글자 수를 확인해 주세요.');
    return;
  }
  showFormMessage('등록 중입니다...', '#1976d2');
  const editId = eventModal.getAttribute('data-edit-id');
  try {
    if (editId) {
      await updateDoc(doc(db, 'events', editId), { title, desc, period, exchange, img, logo, link });
      eventModal.removeAttribute('data-edit-id');
      showFormMessage('수정 완료!', '#388e3c');
    } else {
      await addDoc(collection(db, 'events'), { title, desc, period, exchange, img, logo, link, createdAt: serverTimestamp() });
      showFormMessage('등록 완료!', '#388e3c');
    }
    setTimeout(() => {
      eventModal.style.display = 'none';
      document.body.style.overflow = '';
      eventForm.reset();
      clearFormMessage();
      previewEventImg.style.display = 'none';
      previewEventLogo.style.display = 'none';
      renderEvents();
    }, 800);
  } catch (err) {
    showFormMessage('오류가 발생했습니다. 다시 시도해 주세요.');
  }
};
eventForm.removeEventListener('submit', eventFormSubmitHandler);
eventForm.addEventListener('submit', eventFormSubmitHandler); 