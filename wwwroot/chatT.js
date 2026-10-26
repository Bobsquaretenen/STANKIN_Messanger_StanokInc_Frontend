(function() {
    'use strict';

    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!user)                    { location.href = 'index.html'; return; }
    if (user.role === 'student')  { location.href = 'chatS.html';    return; }
    if (user.role === 'admin')    { location.href = 'adminPan.html'; return; }

    const $  = s => document.querySelector(s);
    const escapeHtml = s => String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const plural = (n, one, few, many) => {
        const m10 = n % 10, m100 = n % 100;
        if (m10 === 1 && m100 !== 11) return one;
        if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
        return many;
    };

    let chats = [];
    let activeChatId = null;
    let studyGroupsCache = null;   // кэш загруженных учебных групп

    const chatListEl       = $('#chatList');
    const messagesAreaEl   = $('#messagesArea');
    const chatTitleEl      = $('#chatTitle');
    const chatSubtitleEl   = $('#chatSubtitle');
    const chatActions      = $('#chatActions');
    const chatFooter       = $('#chatFooter');
    const chatFooterEmpty  = $('#chatFooterEmpty');
    const searchInput      = $('#search');
    const messageInput     = $('#message');
    const sendBtn          = $('#sendBtn');

    // ============================================================
    //                     ЗАГРУЗКА ЧАТОВ
    // ============================================================
    async function loadChats() {
        try {
            const res = await fetch(`/api/users/${user.idUser}/chats`);
            chats = await res.json();
        } catch (e) { chats = []; }
        renderChatList();
    }

    function renderChatList(filter) {
        chatListEl.innerHTML = '';
        const q = (filter || '').toLowerCase();
        const list = chats.filter(c => !q || c.title.toLowerCase().includes(q));

        if (!list.length) {
            chatListEl.innerHTML =
                '<div class="text-center text-text-muted text-sm py-8 px-4 select-none">' +
                '<i class="ph ph-chats-circle text-3xl block mb-2 opacity-50"></i>' +
                '<div>Нет чатов</div>' +
                '<div class="text-xs mt-1 opacity-70">Нажмите «+» чтобы создать</div></div>';
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
                c.membersCount + ' ' + plural(c.membersCount,'участник','участника','участников') +
                (c.isOpen ? '' : ' • закрыт') + '</div>' +
                '</div>';
            item.addEventListener('click', () => selectChat(c.idChat));
            chatListEl.appendChild(item);
        });
    }

    // ============================================================
    //                     ВЫБОР ЧАТА
    // ============================================================
    async function selectChat(id) {
        const chat = chats.find(c => c.idChat === id);
        if (!chat) return;
        activeChatId = id;
        localStorage.setItem('activeChatId', String(id));

        chatTitleEl.textContent = chat.title;
        chatSubtitleEl.textContent = chat.membersCount + ' ' +
            plural(chat.membersCount,'участник','участника','участников') +
            (chat.isOpen ? '' : ' • студентам писать нельзя');
        chatActions.classList.remove('hidden'); chatActions.classList.add('flex');
        chatFooter.classList.remove('hidden');  chatFooter.classList.add('flex');
        chatFooterEmpty.classList.add('hidden'); chatFooterEmpty.classList.remove('flex');

        $('#accessToggle').checked = chat.isOpen;
        $('#accessLabel').textContent = chat.isOpen
            ? 'Студенты могут отправлять сообщения'
            : 'Студенты не могут отправлять сообщения';

        renderChatList(searchInput.value);
        await loadMessages(id);
    }

    function clearActiveChat() {
        activeChatId = null;
        chatTitleEl.textContent = '—';
        chatSubtitleEl.textContent = '';
        chatActions.classList.add('hidden'); chatActions.classList.remove('flex');
        chatFooter.classList.add('hidden');  chatFooter.classList.remove('flex');
        chatFooterEmpty.classList.remove('hidden'); chatFooterEmpty.classList.add('flex');
        messagesAreaEl.innerHTML =
            '<div class="flex-1 flex flex-col items-center justify-center text-text-muted select-none gap-2">' +
            '<i class="ph ph-chats-circle text-5xl opacity-40"></i>' +
            '<div class="text-base">Выберите или создайте чат</div></div>';
    }

    // ============================================================
    //                     СООБЩЕНИЯ
    // ============================================================
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
                '<div class="text-base">Чат пока пустой</div>' +
                '<div class="text-sm opacity-70">Напишите первое сообщение</div></div>';
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
                    escapeHtml(m.authorName || 'Студент') + '</div>' +
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

    // ============================================================
    //                     ОТПРАВКА СООБЩЕНИЯ
    // ============================================================
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

    // ============================================================
    //                     ПОИСК / SIDEBAR
    // ============================================================
    searchInput.addEventListener('input', e => renderChatList(e.target.value));

    $('#toggleSidebar').addEventListener('click', () => {
        const sb = $('#sidebar');
        sb.classList.toggle('sidebar-hidden');
        localStorage.setItem('sidebarHidden', sb.classList.contains('sidebar-hidden'));
    });
    if (localStorage.getItem('sidebarHidden') === 'true') $('#sidebar').classList.add('sidebar-hidden');

    // ============================================================
    //                     МЕНЮ НАСТРОЕК
    // ============================================================
    const settingsBtn  = $('#settingsBtn');
    const settingsMenu = $('#settingsMenu');
    const toggleMenu = force => {
        const open = typeof force === 'boolean' ? force : settingsMenu.classList.contains('hidden');
        settingsMenu.classList.toggle('hidden', !open);
    };
    settingsBtn.addEventListener('click', e => { e.stopPropagation(); toggleMenu(); });
    settingsMenu.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', () => toggleMenu(false));

    // Переключатель доступа студентов
    $('#accessToggle').addEventListener('change', async function() {
        if (!activeChatId) return;
        try {
            await fetch(`/api/chats/${activeChatId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isOpen: this.checked })
            });
            const c = chats.find(x => x.idChat === activeChatId);
            if (c) c.isOpen = this.checked;
            $('#accessLabel').textContent = this.checked
                ? 'Студенты могут отправлять сообщения'
                : 'Студенты не могут отправлять сообщения';
            chatSubtitleEl.textContent = c.membersCount + ' ' +
                plural(c.membersCount,'участник','участника','участников') +
                (c.isOpen ? '' : ' • студентам писать нельзя');
        } catch (e) {}
    });

    // ============================================================
    //        УЧЕБНЫЕ ГРУППЫ: загрузка и рендер селекторов
    // ============================================================
    async function fetchStudyGroups(forceReload) {
        if (!forceReload && studyGroupsCache) return studyGroupsCache;
        try {
            const res = await fetch('/api/study-groups');
            studyGroupsCache = await res.json();
        } catch (e) {
            studyGroupsCache = [];
        }
        return studyGroupsCache;
    }

    function renderGroupsPicker(wrapEl, infoEl, groups, checkedSet) {
        if (!wrapEl) return;

        if (!groups.length) {
            wrapEl.innerHTML =
                '<div class="p-4 text-center text-sm text-gray-400">' +
                'Учебных групп не найдено. Добавьте студентов с указанием группы через админ-панель.' +
                '</div>';
            if (infoEl) infoEl.textContent = '';
            return;
        }

        wrapEl.innerHTML = groups.map(g => {
            const checked = checkedSet && checkedSet.has(g.name) ? ' checked' : '';
            return '' +
                '<label class="pick-row">' +
                '<input type="checkbox" class="group-pick-checkbox" ' +
                'value="' + escapeHtml(g.name) + '" ' +
                'data-count="' + g.studentsCount + '"' + checked + '>' +
                '<div class="flex-1 min-w-0">' +
                '<div class="text-sm font-medium text-gray-800 truncate">' +
                escapeHtml(g.name) + '</div>' +
                '<div class="text-xs text-gray-500">' +
                g.studentsCount + ' ' +
                plural(g.studentsCount,'студент','студента','студентов') +
                '</div>' +
                '</div>' +
                '</label>';
        }).join('');

        wrapEl.querySelectorAll('.group-pick-checkbox').forEach(cb => {
            cb.addEventListener('change', () => updateGroupsInfo(wrapEl, infoEl));
        });
        updateGroupsInfo(wrapEl, infoEl);
    }

    function updateGroupsInfo(wrapEl, infoEl) {
        if (!infoEl) return;
        const checked = wrapEl.querySelectorAll('.group-pick-checkbox:checked');
        let total = 0;
        checked.forEach(cb => total += parseInt(cb.dataset.count || '0', 10));
        if (checked.length === 0) {
            infoEl.textContent = 'Ни одна группа не выбрана.';
        } else {
            infoEl.textContent =
                'Выбрано групп: ' + checked.length +
                '. Будет добавлено студентов: ' + total + '.';
        }
    }

    function collectCheckedGroups(wrapEl) {
        return Array.from(wrapEl.querySelectorAll('.group-pick-checkbox:checked'))
            .map(cb => cb.value);
    }

    // ============================================================
    //                     СОЗДАНИЕ ЧАТА
    // ============================================================
    const createModal    = $('#createModal');
    const createGroupsEl = $('#createGroupsPicker');
    const createInfoEl   = $('#createGroupsInfo');

    async function openCreateModal() {
        $('#newGroupName').value = '';
        $('#newGroupAccess').checked = true;
        $('#newGroupAccessLabel').textContent = 'Студенты смогут отправлять сообщения';

        createGroupsEl.innerHTML =
            '<div class="p-4 text-center text-sm text-gray-400">Загрузка...</div>';

        createModal.classList.add('visible');

        const groups = await fetchStudyGroups(true);
        renderGroupsPicker(createGroupsEl, createInfoEl, groups, null);

        setTimeout(() => $('#newGroupName').focus(), 50);
    }

    function closeCreateModalFn() { createModal.classList.remove('visible'); }

    $('#createGroupBtn').addEventListener('click', () => openCreateModal());
    $('#addGroupBtn').addEventListener('click', () => {
        toggleMenu(false);
        openCreateModal();
    });
    $('#closeCreateModal').addEventListener('click', closeCreateModalFn);
    createModal.addEventListener('click', e => {
        if (e.target === createModal) closeCreateModalFn();
    });

    $('#newGroupAccess').addEventListener('change', function() {
        $('#newGroupAccessLabel').textContent = this.checked
            ? 'Студенты смогут отправлять сообщения'
            : 'Студенты не смогут отправлять сообщения';
    });

    $('#refreshCreateGroupsBtn').addEventListener('click', async () => {
        const prev = new Set(collectCheckedGroups(createGroupsEl));
        createGroupsEl.innerHTML =
            '<div class="p-4 text-center text-sm text-gray-400">Загрузка...</div>';
        const groups = await fetchStudyGroups(true);
        renderGroupsPicker(createGroupsEl, createInfoEl, groups, prev);
    });

    $('#createGroupSubmit').addEventListener('click', async () => {
        const title = $('#newGroupName').value.trim();
        if (!title) { $('#newGroupName').focus(); return; }

        const isOpen = $('#newGroupAccess').checked;
        const groupNames = collectCheckedGroups(createGroupsEl);

        try {
            const res = await fetch('/api/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title:      title,
                    idOwner:    user.idUser,
                    isOpen:     isOpen,
                    groupNames: groupNames
                })
            });

            if (!res.ok) { alert('Не удалось создать чат'); return; }

            const created = await res.json();
            closeCreateModalFn();
            await loadChats();
            selectChat(created.idChat);

            if (created.addedStudents > 0) {
                // небольшое уведомление
                console.log('Добавлено студентов:', created.addedStudents);
            }
        } catch (e) {
            alert('Ошибка соединения с сервером');
        }
    });

    // ============================================================
    //     ДОБАВЛЕНИЕ ГРУПП В СУЩЕСТВУЮЩИЙ ЧАТ
    // ============================================================
    const addGroupsModal  = $('#addGroupsModal');
    const addGroupsEl     = $('#addGroupsPicker');
    const addGroupsInfoEl = $('#addGroupsInfo');

    async function openAddGroupsModal() {
        if (!activeChatId) return;
        const chat = chats.find(x => x.idChat === activeChatId);
        if (!chat) return;

        $('#addGroupsChatName').textContent = chat.title;
        addGroupsEl.innerHTML =
            '<div class="p-4 text-center text-sm text-gray-400">Загрузка...</div>';
        addGroupsModal.classList.add('visible');

        const groups = await fetchStudyGroups(true);
        renderGroupsPicker(addGroupsEl, addGroupsInfoEl, groups, null);
    }

    function closeAddGroupsModalFn() { addGroupsModal.classList.remove('visible'); }

    $('#addStudentsFromGroupsBtn').addEventListener('click', () => {
        toggleMenu(false);
        openAddGroupsModal();
    });
    $('#closeAddGroupsModal').addEventListener('click', closeAddGroupsModalFn);
    addGroupsModal.addEventListener('click', e => {
        if (e.target === addGroupsModal) closeAddGroupsModalFn();
    });

    $('#refreshAddGroupsBtn').addEventListener('click', async () => {
        const prev = new Set(collectCheckedGroups(addGroupsEl));
        addGroupsEl.innerHTML =
            '<div class="p-4 text-center text-sm text-gray-400">Загрузка...</div>';
        const groups = await fetchStudyGroups(true);
        renderGroupsPicker(addGroupsEl, addGroupsInfoEl, groups, prev);
    });

    $('#addGroupsSubmit').addEventListener('click', async () => {
        if (!activeChatId) return;
        const groupNames = collectCheckedGroups(addGroupsEl);
        if (groupNames.length === 0) {
            alert('Выберите хотя бы одну группу');
            return;
        }

        try {
            const res = await fetch(`/api/chats/${activeChatId}/study-groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupNames: groupNames })
            });
            if (!res.ok) { alert('Не удалось добавить группы'); return; }

            const result = await res.json();
            closeAddGroupsModalFn();

            // Перезагружаем чат, чтобы обновить количество участников
            await loadChats();
            selectChat(activeChatId);

            alert('Добавлено студентов: ' + result.added);
        } catch (e) {
            alert('Ошибка соединения с сервером');
        }
    });

    // ============================================================
    //                     INFO MODAL
    // ============================================================
    $('#infoBtn').addEventListener('click', async () => {
        const c = chats.find(x => x.idChat === activeChatId);
        if (!c) return;
        $('#modalChatName').textContent = c.title;
        $('#modalMembers').textContent  = c.membersCount;
        $('#modalAccess').textContent   = c.isOpen ? 'разрешена' : 'запрещена';

        // Покажем, какие учебные группы представлены среди участников
        try {
            const res = await fetch(`/api/chats/${c.idChat}/members`);
            const members = await res.json();
            const groupSet = new Set();
            members.forEach(m => { if (m.studyGroup) groupSet.add(m.studyGroup); });
            $('#modalGroups').textContent = groupSet.size
                ? Array.from(groupSet).sort().join(', ')
                : 'нет';
        } catch (e) {
            $('#modalGroups').textContent = '—';
        }

        $('#infoModal').classList.add('visible');
    });
    $('#closeModal').addEventListener('click',    () => $('#infoModal').classList.remove('visible'));
    $('#closeModalBtn').addEventListener('click', () => $('#infoModal').classList.remove('visible'));
    $('#infoModal').addEventListener('click', e => {
        if (e.target === $('#infoModal')) $('#infoModal').classList.remove('visible');
    });

    // ============================================================
    //                     ВЫХОД
    // ============================================================
    document.querySelectorAll('a[href="index.html"]').forEach(a => {
        a.addEventListener('click', () => localStorage.removeItem('currentUser'));
    });

    // ============================================================
    //                     ОФФЛАЙН БАННЕР
    // ============================================================
    function updateOnlineStatus() {
        $('#offlineBanner').classList.toggle('visible', !navigator.onLine);
    }
    window.addEventListener('online',  updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // ============================================================
    //                     СТАРТ
    // ============================================================
    (async function() {
        await loadChats();
        const saved = parseInt(localStorage.getItem('activeChatId') || '0', 10);
        if (saved && chats.some(c => c.idChat === saved)) selectChat(saved);
        else if (chats.length) selectChat(chats[0].idChat);
        else clearActiveChat();
    })();

    setInterval(() => { if (activeChatId) loadMessages(activeChatId); }, 5000);

})();