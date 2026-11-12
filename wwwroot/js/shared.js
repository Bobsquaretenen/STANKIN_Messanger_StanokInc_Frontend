// ========== УТИЛИТЫ ==========
export const $ = s => document.querySelector(s);

export const escapeHtml = s => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
};

// Всплывающие уведомления (Toast)
export function showToast(message, type = 'error') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========== ГЛОБАЛЬНОЕ СОСТОЯНИЕ (внутри модуля) ==========
export const chatState = {
    chats: [],
    activeChatId: null,
    user: null
};

// Хук для специфики ролей (устанавливается из chatS.js или chatT.js)
let onChatSelectedHook = null;
export function setOnChatSelected(hook) {
    onChatSelectedHook = hook;
}

// ========== ОБЕРТКА API ==========
export async function apiFetch(url, options) {
    try {
        const res = await fetch(url, options);
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('activeChatId');
            location.href = 'index.html';
            throw new Error('Unauthorized');
        }
        return res;
    } catch (error) {
        if (error.message !== 'Unauthorized') {
            showToast('Ошибка соединения с сервером', 'error');
        }
        throw error;
    }
}

// ========== РЕНДЕР СПИСКА ЧАТОВ ==========
export function renderChatList(filter) {
    const chatListEl = $('#chatList');
    if (!chatListEl) return;
    const { chats, activeChatId } = chatState;
    chatListEl.innerHTML = '';
    const q = (filter || '').toLowerCase();
    const list = chats.filter(c => !q || c.title.toLowerCase().includes(q));

    if (!list.length) {
        chatListEl.innerHTML =
            '<div class="text-center text-text-muted text-sm py-8 px-4 select-none">' +
            '<i class="ph ph-chats-circle text-3xl block mb-2 opacity-50"></i>' +
            '<div>Нет чатов</div></div>';
        return;
    }

    list.forEach(c => {
        const isActive = c.idChat === activeChatId;
        const item = document.createElement('div');
        item.className =
            'chat-item flex items-center px-[15px] py-3 rounded-md-base cursor-pointer ' +
            'transition-colors duration-200 mb-[5px] relative hover:bg-[#f8f9fa]' +
            (isActive ? ' chat-item-active bg-[#eef2ff]' : '');

        const avatar = document.createElement('div');
        avatar.className = 'w-12 h-12 rounded-full bg-[#e5e7eb] flex items-center justify-center text-[#9ca3af] text-2xl mr-[15px] shrink-0';
        avatar.innerHTML = '<i class="ph ph-users-three"></i>';

        const infoWrap = document.createElement('div');
        infoWrap.className = 'flex-1 min-w-0';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'chat-name font-medium text-[15px] text-text-main mb-1 truncate';
        nameDiv.textContent = c.title;

        const lastDiv = document.createElement('div');
        lastDiv.className = 'chat-last text-[13px] text-text-muted truncate';
        lastDiv.textContent = c.membersCount + ' ' +
            plural(c.membersCount, 'участник', 'участника', 'участников') +
            (c.isOpen ? '' : ' • закрыт');

        infoWrap.appendChild(nameDiv);
        infoWrap.appendChild(lastDiv);
        item.appendChild(avatar);
        item.appendChild(infoWrap);

        item.addEventListener('click', () => selectChat(c.idChat));
        chatListEl.appendChild(item);
    });
}

// ========== ВЫБОР ЧАТА ==========
export async function selectChat(id) {
    const { chats } = chatState;
    const chat = chats.find(c => c.idChat === id);
    if (!chat) return;
    
    chatState.activeChatId = id;
    localStorage.setItem('activeChatId', String(id));

    $('#chatTitle').textContent = chat.title;
    $('#chatSubtitle').textContent = chat.membersCount + ' ' +
        plural(chat.membersCount,'участник','участника','участников') +
        (chat.isOpen ? '' : ' • студентам писать нельзя');

    $('#chatActions').classList.remove('hidden');
    $('#chatActions').classList.add('flex');
    $('#chatFooterEmpty').classList.add('hidden');
    $('#chatFooterEmpty').classList.remove('flex');

    renderChatList($('#search').value);
    await loadMessages(id);

    if (onChatSelectedHook) {
        onChatSelectedHook(chat);
    }
}

// ========== ОЧИСТКА АКТИВНОГО ЧАТА ==========
export function clearActiveChat() {
    chatState.activeChatId = null;
    $('#chatTitle').textContent = '—';
    $('#chatSubtitle').textContent = '';
    $('#chatActions').classList.add('hidden');
    $('#chatActions').classList.remove('flex');
    $('#chatFooter').classList.add('hidden');
    $('#chatFooter').classList.remove('flex');
    $('#chatFooterLocked')?.classList.add('hidden');
    $('#chatFooterLocked')?.classList.remove('flex');
    $('#chatFooterEmpty').classList.remove('hidden');
    $('#chatFooterEmpty').classList.add('flex');
    $('#messagesArea').innerHTML =
        '<div class="flex-1 flex flex-col items-center justify-center text-text-muted select-none gap-2">' +
        '<i class="ph ph-chats-circle text-5xl opacity-40"></i>' +
        '<div class="text-base">Выберите или создайте чат</div></div>';
}

// ========== ЗАГРУЗКА СООБЩЕНИЙ ==========
export async function loadMessages(chatId) {
    const messagesAreaEl = $('#messagesArea');
    let msgs = [];
    try {
        const res = await apiFetch(`/api/chats/${chatId}/messages`);
        msgs = await res.json();
    } catch (e) {}
    
    messagesAreaEl.innerHTML = '';

    if (!msgs || !msgs.length) {
        messagesAreaEl.innerHTML =
            '<div class="flex-1 flex flex-col items-center justify-center text-text-muted select-none gap-2">' +
            '<i class="ph ph-chat-circle-dots text-5xl opacity-40"></i>' +
            '<div class="text-base">Чат пока пустой</div></div>';
        return;
    }

    const user = chatState.user;
    const fragment = document.createDocumentFragment();

    msgs.forEach(m => {
        const isOwn = m.idUser === user.idUser;
        const wrap = document.createElement('div');

        if (isOwn) {
            wrap.className = 'flex items-end max-w-[440px] self-end flex-row-reverse max-md:max-w-[90%]';
            const bubble = document.createElement('div');
            bubble.className = 'px-4 py-3 rounded-md-base text-sm leading-snug bg-msg-own text-white rounded-br-[4px] shadow-bubble-other bubble-text';
            bubble.textContent = m.info;
            wrap.appendChild(bubble);
        } else {
            wrap.className = 'flex items-end max-w-[440px] self-start max-md:max-w-[90%]';
            const avatar = document.createElement('div');
            avatar.className = 'w-9 h-9 rounded-full bg-[#e5e7eb] flex items-center justify-center text-[#9ca3af] text-[22px] mr-[10px] mb-[2px] shrink-0';
            avatar.innerHTML = '<i class="ph ph-user"></i>';

            const col = document.createElement('div');
            col.className = 'flex flex-col';

            const author = document.createElement('div');
            author.className = 'text-xs text-text-muted mb-1 ml-1 leading-tight';
            author.textContent = m.authorName || 'Пользователь';

            const bubble = document.createElement('div');
            bubble.className = 'px-4 py-3 rounded-md-base text-sm leading-snug bg-white text-text-main rounded-bl-[4px] border border-[#f0f0f0] shadow-bubble-other bubble-text';
            bubble.textContent = m.info;

            col.appendChild(author);
            col.appendChild(bubble);
            wrap.appendChild(avatar);
            wrap.appendChild(col);
        }
        fragment.appendChild(wrap);
    });
    
    messagesAreaEl.appendChild(fragment);
    messagesAreaEl.scrollTop = messagesAreaEl.scrollHeight;
}

// ========== ОТПРАВКА СООБЩЕНИЯ ==========
export async function sendMessage() {
    const messageInput = $('#message');
    const text = messageInput.value.trim();
    const { activeChatId, user } = chatState;
    if (!text || !activeChatId) return;
    
    try {
        const res = await apiFetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idChat: activeChatId, idUser: user.idUser, info: text })
        });
        if (res.ok) {
            messageInput.value = '';
            messageInput.style.height = 'auto';
            await loadMessages(activeChatId);
        } else {
            showToast('Не удалось отправить сообщение');
        }
    } catch (e) {}
}

// ========== ЗАГЛУШКИ ==========
export const handleAttachFile = () => showToast('Загрузка файлов в разработке', 'info');
export const handleVoiceMessage = () => showToast('Голосовые сообщения в разработке', 'info');
export const handleVideoCall = () => showToast('Видеозвонки в разработке', 'info');

// ========== ОБЩИЕ ОБРАБОТЧИКИ ==========
export function setupSharedChatHandlers() {
    const sendBtn = $('#sendBtn');
    const messageInput = $('#message');
    const searchInput = $('#search');
    const toggleSidebar = $('#toggleSidebar');
    const attachBtn = $('#attachBtn');
    const voiceBtn = $('#voiceBtn');
    const videoBtn = $('#videoBtn');

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    
    if (messageInput) {
        messageInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                sendMessage(); 
            }
        });
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 140) + 'px';
        });
    }
    
    if (searchInput) searchInput.addEventListener('input', e => renderChatList(e.target.value));
    
    if (toggleSidebar) {
        toggleSidebar.addEventListener('click', () => {
            const sb = $('#sidebar');
            sb.classList.toggle('sidebar-hidden');
            localStorage.setItem('sidebarHidden', sb.classList.contains('sidebar-hidden'));
        });
        if (localStorage.getItem('sidebarHidden') === 'true') $('#sidebar').classList.add('sidebar-hidden');
    }

    if (attachBtn) attachBtn.addEventListener('click', handleAttachFile);
    if (voiceBtn) voiceBtn.addEventListener('click', handleVoiceMessage);
    if (videoBtn) videoBtn.addEventListener('click', handleVideoCall);

    const updateOnlineStatus = () => {
        const b = $('#offlineBanner');
        if (b) b.classList.toggle('visible', !navigator.onLine);
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    document.querySelectorAll('a[href="index.html"]').forEach(a => {
        a.addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('activeChatId');
            localStorage.removeItem('sidebarHidden');
        });
    });
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
export async function initSharedChat(user) {
    chatState.user = user;
    try {
        const res = await apiFetch(`/api/users/${user.idUser}/chats`);
        chatState.chats = await res.json();
    } catch (e) { 
        chatState.chats = []; 
    }
    renderChatList();
    setupSharedChatHandlers();
}