(function() {
    'use strict';

    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!user)                    { location.href = 'index.html'; return; }
    if (user.role === 'student')  { location.href = 'chatS.html';    return; }
    if (user.role === 'admin')    { location.href = 'adminPan.html'; return; }

    let studyGroupsCache = null;

    // ========== ХУК: настройки преподавателя ==========
    window.onChatSelected = function(chat) {
        $('#chatFooter').classList.remove('hidden'); $('#chatFooter').classList.add('flex');
        $('#accessToggle').checked = chat.isOpen;
        $('#accessLabel').textContent = chat.isOpen
            ? 'Студенты могут отправлять сообщения'
            : 'Студенты не могут отправлять сообщения';
    };

    // ========== УЧЕБНЫЕ ГРУППЫ ==========
    async function fetchStudyGroups(forceReload) {
        if (!forceReload && studyGroupsCache) return studyGroupsCache;
        try {
            const res = await window.apiFetch('/api/study-groups');
            studyGroupsCache = await res.json();
        } catch (e) { studyGroupsCache = []; }
        return studyGroupsCache;
    }

    function renderGroupsPicker(wrapEl, infoEl, groups, checkedSet) {
        if (!wrapEl) return;
        if (!groups.length) {
            wrapEl.innerHTML = '<div class="p-4 text-center text-sm text-gray-400">Учебных групп не найдено.</div>';
            if (infoEl) infoEl.textContent = '';
            return;
        }
        wrapEl.innerHTML = '';
        groups.forEach(g => {
            const checked = checkedSet && checkedSet.has(g.name);
            const label = document.createElement('label');
            label.className = 'pick-row';
            const cb = document.createElement('input');
            cb.type = 'checkbox'; cb.className = 'group-pick-checkbox';
            cb.value = g.name; cb.dataset.count = g.studentsCount; cb.checked = checked;
            const textWrap = document.createElement('div');
            textWrap.className = 'flex-1 min-w-0';
            const nameDiv = document.createElement('div');
            nameDiv.className = 'text-sm font-medium text-gray-800 truncate';
            nameDiv.textContent = g.name;
            const countDiv = document.createElement('div');
            countDiv.className = 'text-xs text-gray-500';
            countDiv.textContent = g.studentsCount + ' ' + window.plural(g.studentsCount, 'студент', 'студента', 'студентов');
            textWrap.appendChild(nameDiv); textWrap.appendChild(countDiv);
            label.appendChild(cb); label.appendChild(textWrap);
            wrapEl.appendChild(label);
        });
        wrapEl.querySelectorAll('.group-pick-checkbox').forEach(cb => {
            cb.addEventListener('change', () => updateGroupsInfo(wrapEl, infoEl));
        });
        updateGroupsInfo(wrapEl, infoEl);
    }

    function updateGroupsInfo(wrapEl, infoEl) {
        if (!infoEl) return;
        const checked = wrapEl.querySelectorAll('.group-pick-checkbox:checked');
        let total = 0; checked.forEach(cb => total += parseInt(cb.dataset.count || '0', 10));
        infoEl.textContent = checked.length === 0
            ? 'Ни одна группа не выбрана.'
            : 'Выбрано групп: ' + checked.length + '. Будет добавлено студентов: ' + total + '.';
    }

    function collectCheckedGroups(wrapEl) {
        return Array.from(wrapEl.querySelectorAll('.group-pick-checkbox:checked')).map(cb => cb.value);
    }

    // ========== МЕНЮ НАСТРОЕК ==========
    const settingsBtn  = $('#settingsBtn');
    const settingsMenu = $('#settingsMenu');
    const toggleMenu = force => {
        const open = typeof force === 'boolean' ? force : settingsMenu.classList.contains('hidden');
        settingsMenu.classList.toggle('hidden', !open);
    };
    settingsBtn.addEventListener('click', e => { e.stopPropagation(); toggleMenu(); });
    settingsMenu.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', () => toggleMenu(false));

    $('#accessToggle').addEventListener('change', async function() {
        const id = window.chatState.activeChatId;
        if (!id) return;
        try {
            await window.apiFetch(`/api/chats/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isOpen: this.checked })
            });
            const c = window.chatState.chats.find(x => x.idChat === id);
            if (c) c.isOpen = this.checked;
            $('#accessLabel').textContent = this.checked
                ? 'Студенты могут отправлять сообщения'
                : 'Студенты не могут отправлять сообщения';
        } catch (e) {}
    });

    // ========== СОЗДАНИЕ ЧАТА ==========
    const createModal    = $('#createModal');
    const createGroupsEl = $('#createGroupsPicker');
    const createInfoEl   = $('#createGroupsInfo');

    async function openCreateModal() {
        $('#newGroupName').value = '';
        $('#newGroupAccess').checked = true;
        $('#newGroupAccessLabel').textContent = 'Студенты смогут отправлять сообщения';
        createGroupsEl.innerHTML = '<div class="p-4 text-center text-sm text-gray-400">Загрузка...</div>';
        createModal.classList.add('visible');
        const groups = await fetchStudyGroups(true);
        renderGroupsPicker(createGroupsEl, createInfoEl, groups, null);
        setTimeout(() => $('#newGroupName').focus(), 50);
    }
    const closeCreateModalFn = () => createModal.classList.remove('visible');

    $('#createGroupBtn').addEventListener('click', openCreateModal);
    $('#addGroupBtn').addEventListener('click', () => { toggleMenu(false); openCreateModal(); });
    $('#closeCreateModal').addEventListener('click', closeCreateModalFn);
    createModal.addEventListener('click', e => { if (e.target === createModal) closeCreateModalFn(); });

    $('#newGroupAccess').addEventListener('change', function() {
        $('#newGroupAccessLabel').textContent = this.checked
            ? 'Студенты смогут отправлять сообщения'
            : 'Студенты не смогут отправлять сообщения';
    });

    $('#refreshCreateGroupsBtn').addEventListener('click', async () => {
        const prev = new Set(collectCheckedGroups(createGroupsEl));
        createGroupsEl.innerHTML = '<div class="p-4 text-center text-sm text-gray-400">Загрузка...</div>';
        const groups = await fetchStudyGroups(true);
        renderGroupsPicker(createGroupsEl, createInfoEl, groups, prev);
    });

    $('#createGroupSubmit').addEventListener('click', async () => {
        const title = $('#newGroupName').value.trim();
        if (!title) { $('#newGroupName').focus(); alert('Введите название чата.'); return; }
        if (title.length < 2) { $('#newGroupName').focus(); alert('Название минимум 2 символа.'); return; }
        if (title.length > 50) { $('#newGroupName').focus(); alert('Название максимум 50 символов.'); return; }
        if (window.chatState.chats.some(c => c.title.toLowerCase() === title.toLowerCase())) {
            $('#newGroupName').focus(); alert('Чат с таким названием уже существует.'); return;
        }
        const groupNames = collectCheckedGroups(createGroupsEl);
        if (groupNames.length === 0) { alert('Выберите хотя бы одну группу.'); return; }

        try {
            const res = await window.apiFetch('/api/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, idOwner: user.idUser, isOpen: $('#newGroupAccess').checked, groupNames })
            });
            if (!res.ok) { alert('Не удалось создать чат'); return; }
            const created = await res.json();
            closeCreateModalFn();
            
            const r = await window.apiFetch(`/api/users/${user.idUser}/chats`);
            window.chatState.chats = await r.json();
            window.renderChatList();
            window.selectChat(created.idChat);
        } catch (e) {}
    });

    // ========== ДОБАВЛЕНИЕ ГРУПП В ЧАТ ==========
    const addGroupsModal  = $('#addGroupsModal');
    const addGroupsEl     = $('#addGroupsPicker');
    const addGroupsInfoEl = $('#addGroupsInfo');

    async function openAddGroupsModal() {
        const id = window.chatState.activeChatId;
        if (!id) return;
        const chat = window.chatState.chats.find(x => x.idChat === id);
        if (!chat) return;
        $('#addGroupsChatName').textContent = chat.title;
        addGroupsEl.innerHTML = '<div class="p-4 text-center text-sm text-gray-400">Загрузка...</div>';
        addGroupsModal.classList.add('visible');
        const groups = await fetchStudyGroups(true);
        renderGroupsPicker(addGroupsEl, addGroupsInfoEl, groups, null);
    }
    const closeAddGroupsModalFn = () => addGroupsModal.classList.remove('visible');

    $('#addStudentsFromGroupsBtn').addEventListener('click', () => { toggleMenu(false); openAddGroupsModal(); });
    $('#closeAddGroupsModal').addEventListener('click', closeAddGroupsModalFn);
    addGroupsModal.addEventListener('click', e => { if (e.target === addGroupsModal) closeAddGroupsModalFn(); });

    $('#refreshAddGroupsBtn').addEventListener('click', async () => {
        const prev = new Set(collectCheckedGroups(addGroupsEl));
        addGroupsEl.innerHTML = '<div class="p-4 text-center text-sm text-gray-400">Загрузка...</div>';
        const groups = await fetchStudyGroups(true);
        renderGroupsPicker(addGroupsEl, addGroupsInfoEl, groups, prev);
    });

    $('#addGroupsSubmit').addEventListener('click', async () => {
        const id = window.chatState.activeChatId;
        if (!id) return;
        const groupNames = collectCheckedGroups(addGroupsEl);
        if (groupNames.length === 0) { alert('Выберите хотя бы одну группу'); return; }
        try {
            const res = await window.apiFetch(`/api/chats/${id}/study-groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupNames })
            });
            if (!res.ok) { alert('Не удалось добавить группы'); return; }
            const result = await res.json();
            closeAddGroupsModalFn();
            const r = await window.apiFetch(`/api/users/${user.idUser}/chats`);
            window.chatState.chats = await r.json();
            window.renderChatList();
            window.selectChat(id);
            alert('Добавлено студентов: ' + result.added);
        } catch (e) {}
    });

    // ========== INFO MODAL ==========
    async function openChatInfoModal() {
        const id = window.chatState.activeChatId;
        if (!id) return;
        
        const c = window.chatState.chats.find(x => x.idChat === id);
        if (!c) return;

        $('#modalChatName').textContent = c.title;
        $('#modalMembers').textContent  = c.membersCount;
        $('#modalAccess').textContent   = c.isOpen ? 'разрешена' : 'запрещена';
        
        try {
            const res = await window.apiFetch(`/api/chats/${c.idChat}/members`);
            const members = await res.json();
            const groupSet = new Set();
            members.forEach(m => { if (m.studyGroup) groupSet.add(m.studyGroup); });
            $('#modalGroups').textContent = groupSet.size ? Array.from(groupSet).sort().join(', ') : 'нет';
        } catch (e) { 
            $('#modalGroups').textContent = '—'; 
        }
        
        $('#infoModal').classList.add('visible');
    }

    $('#chatInfoTrigger').addEventListener('click', openChatInfoModal);

    $('#menuInfoBtn').addEventListener('click', () => {
        toggleMenu(false);
        openChatInfoModal();
    });

    $('#closeModal').addEventListener('click',    () => $('#infoModal').classList.remove('visible'));
    $('#closeModalBtn').addEventListener('click', () => $('#infoModal').classList.remove('visible'));
    $('#infoModal').addEventListener('click', e => {
        if (e.target === $('#infoModal')) $('#infoModal').classList.remove('visible');
    });

    // ========== СТАРТ ==========
    (async function() {
        await window.initSharedChat(user);
        const saved = parseInt(localStorage.getItem('activeChatId') || '0', 10);
        if (saved && window.chatState.chats.some(c => c.idChat === saved)) window.selectChat(saved);
        else if (window.chatState.chats.length) window.selectChat(window.chatState.chats[0].idChat);
        else window.clearActiveChat();

        setInterval(() => {
            if (window.chatState.activeChatId) window.loadMessages(window.chatState.activeChatId);
        }, 5000);
    })();

})();