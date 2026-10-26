(function() {
    'use strict';

    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!user)                    { location.href = 'index.html'; return; }
    if (user.role === 'teacher')  { location.href = 'chatT.html';    return; }
    if (user.role === 'admin')    { location.href = 'adminPan.html'; return; }

    const $  = s => document.querySelector(s);
    const escapeHtml = s => String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    let chats = [];
    let activeChatId = null;

    const chatListEl       = $('#chatList');
    const messagesAreaEl   = $('#messagesArea');
    const chatTitleEl      = $('#chatTitle');
    const chatSubtitleEl   = $('#chatSubtitle');
    const chatActions      = $('#chatActions');
    const chatFooter       = $('#chatFooter');
    const chatFooterLocked = $('#chatFooterLocked');
    const chatFooterEmpty  = $('#chatFooterEmpty');
    const searchInput      = $('#search');
    const messageInput     = $('#message');
    const sendBtn          = $('#sendBtn');

    // ---------- Загрузка чатов ----------
    async function loadChats() {
        try {
            const res = await fetch(`/api/users/${user.idUser}/chats`);
            chats = await res.json();
        } catch (e) {
            chats = [];
        }
        renderChatList();
        if (chats.length) {
            const target = chats.find(c => c.idChat === activeChatId) || chats[0];
            selectChat(target.idChat);
        } else {
            clearActiveChat();
        }
    }

    function renderChatList(filter) {
        chatListEl.innerHTML = '';
        const q = (filter || '').toLowerCase();
        const list = chats.filter(c => !q || c.title.toLowerCase().includes(q));

        if (!list.length) {
            chatListEl.innerHTML =
                '<div class="text-center text-text-muted text-sm py-8 px-4 select-none">' +
                '<i class="ph ph-chats-circle text-3xl block mb-2 opacity-50"></i>' +
                '<div>Нет добавленных групп</div>' +
                '<div class="text-xs mt-1 opacity-70">Обратитесь к преподавателю</div></div>';
            return;
        }

        list.forEach(c => {
            const isActive = c.idChat === activeChatId;
            const item = document.createElement('div');
            item.className =
                'chat-item flex items-center px-[15px] py-3 rounded-md-base cursor-pointer ' +
                'transition-colors duration-200 mb-[5px] relative hover:bg-[#f8f9fa]' +
                (isActive ? ' chat-item-active bg-[#eef2ff]' : '');
            item.innerHTML =
                '<div class="w-12 h-12 rounded-full bg-[#e5e7eb] flex items-center justify-center ' +
                'text-[#9ca3af] text-2xl mr-[15px] shrink-0"><i class="ph ph-users-three"></i></div>' +
                '<div class="flex-1 min-w-0">' +
                '<div class="chat-name font-medium text-[15px] text-text-main mb-1 truncate">' +
                escapeHtml(c.title) + '</div>' +
                '<div class="chat-last text-[13px] text-text-muted truncate">' +
                c.membersCount + ' участников</div>' +
                '</div>';
            item.addEventListener('click', () => selectChat(c.idChat));
            chatListEl.appendChild(item);
        });
    }

    // ---------- Выбор чата ----------
    async function selectChat(id) {
        const chat = chats.find(c => c.idChat === id);
        if (!chat) return;
        activeChatId = id;
        localStorage.setItem('activeChatId', String(id));

        chatTitleEl.textContent = chat.title;
        chatSubtitleEl.textContent = chat.membersCount + ' участников' +
            (chat.isOpen ? '' : ' • отправка закрыта');
        chatActions.classList.remove('hidden');
        chatActions.classList.add('flex');

        if (chat.isOpen) {
            chatFooter.classList.remove('hidden');       chatFooter.classList.add('flex');
            chatFooterLocked.classList.add('hidden');    chatFooterLocked.classList.remove('flex');
        } else {
            chatFooter.classList.add('hidden');          chatFooter.classList.remove('flex');
            chatFooterLocked.classList.remove('hidden'); chatFooterLocked.classList.add('flex');
        }
        chatFooterEmpty.classList.add('hidden');
        chatFooterEmpty.classList.remove('flex');

        renderChatList(searchInput.value);
        await loadMessages(id);
    }

    function clearActiveChat() {
        activeChatId = null;
        chatTitleEl.textContent = '—';
        chatSubtitleEl.textContent = '';
        chatActions.classList.add('hidden');
        chatActions.classList.remove('flex');
        chatFooter.classList.add('hidden');
        chatFooter.classList.remove('flex');
        chatFooterLocked.classList.add('hidden');
        chatFooterLocked.classList.remove('flex');
        chatFooterEmpty.classList.remove('hidden');
        chatFooterEmpty.classList.add('flex');
        messagesAreaEl.innerHTML =
            '<div class="flex-1 flex flex-col items-center justify-center text-text-muted select-none gap-2">' +
            '<i class="ph ph-chats-circle text-5xl opacity-40"></i>' +
            '<div class="text-base">Выберите группу</div></div>';
    }

    // ---------- Сообщения ----------
    async function loadMessages(chatId) {
        let msgs = [];
        try {
            const res = await fetch(`/api/chats/${chatId}/messages`);
            msgs = await res.json();
        } catch (e) {}
        messagesAreaEl.innerHTML = '';

        if (!msgs.length) {
            messagesAreaEl.innerHTML =
                '<div class="flex-1 flex flex-col items-center justify-center text-text-muted select-none gap-2">' +
                '<i class="ph ph-chat-circle-dots text-5xl opacity-40"></i>' +
                '<div class="text-base">Чат пока пустой</div></div>';
            return;
        }

        msgs.forEach(m => {
            const isOwn = m.idUser === user.idUser;
            const wrap = document.createElement('div');

            if (isOwn) {
                wrap.className = 'flex items-end max-w-[440px] self-end flex-row-reverse max-md:max-w-[90%]';
                wrap.innerHTML =
                    '<div class="flex flex-col">' +
                    '<div class="px-4 py-3 rounded-md-base text-sm leading-snug ' +
                    'bg-msg-own text-white rounded-br-[4px] shadow-bubble-other bubble-text">' +
                    escapeHtml(m.info) + '</div></div>';
            } else {
                wrap.className = 'flex items-end max-w-[440px] self-start max-md:max-w-[90%]';
                wrap.innerHTML =
                    '<div class="w-9 h-9 rounded-full bg-[#e5e7eb] flex items-center justify-center ' +
                    'text-[#9ca3af] text-[22px] mr-[10px] mb-[2px] shrink-0">' +
                    '<i class="ph ph-user"></i></div>' +
                    '<div class="flex flex-col">' +
                    '<div class="text-xs text-text-muted mb-1 ml-1 leading-tight">' +
                    escapeHtml(m.authorName || 'Преподаватель') + '</div>' +
                    '<div class="px-4 py-3 rounded-md-base text-sm leading-snug ' +
                    'bg-white text-text-main rounded-bl-[4px] border border-[#f0f0f0] ' +
                    'shadow-bubble-other bubble-text">' +
                    escapeHtml(m.info) + '</div>' +
                    '</div>';
            }
            messagesAreaEl.appendChild(wrap);
        });
        messagesAreaEl.scrollTop = messagesAreaEl.scrollHeight;
    }

    // ---------- Отправка ----------
    async function sendMessage() {
        const text = messageInput.value.trim();
        if (!text || !activeChatId) return;

        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idChat: activeChatId, idUser: user.idUser, info: text })
            });
            if (res.ok) {
                messageInput.value = '';
                await loadMessages(activeChatId);
            }
        } catch (e) {}
    }
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 140) + 'px';
    });

    // ---------- Поиск ----------
    searchInput.addEventListener('input', e => renderChatList(e.target.value));

    // ---------- Sidebar ----------
    $('#toggleSidebar').addEventListener('click', () => {
        const sb = $('#sidebar');
        sb.classList.toggle('sidebar-hidden');
        localStorage.setItem('sidebarHidden', sb.classList.contains('sidebar-hidden'));
    });
    if (localStorage.getItem('sidebarHidden') === 'true') $('#sidebar').classList.add('sidebar-hidden');

    // ---------- Info modal ----------
    $('#infoBtn').addEventListener('click', () => {
        const c = chats.find(x => x.idChat === activeChatId);
        if (!c) return;
        $('#modalChatName').textContent = c.title;
        $('#modalMembers').textContent  = c.membersCount;
        $('#modalAccess').textContent   = c.isOpen ? 'разрешена' : 'запрещена';
        $('#infoModal').classList.add('visible');
    });
    $('#closeModal').addEventListener('click',    () => $('#infoModal').classList.remove('visible'));
    $('#closeModalBtn').addEventListener('click', () => $('#infoModal').classList.remove('visible'));
    $('#infoModal').addEventListener('click', e => {
        if (e.target === $('#infoModal')) $('#infoModal').classList.remove('visible');
    });

    // ---------- Выход ----------
    document.querySelectorAll('a[href="index.html"]').forEach(a => {
        a.addEventListener('click', () => localStorage.removeItem('currentUser'));
    });

    // ---------- Оффлайн баннер ----------
    function updateOnlineStatus() {
        $('#offlineBanner').classList.toggle('visible', !navigator.onLine);
    }
    window.addEventListener('online',  updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // ---------- Старт ----------
    loadChats();
    setInterval(() => { if (activeChatId) loadMessages(activeChatId); }, 5000);

})();