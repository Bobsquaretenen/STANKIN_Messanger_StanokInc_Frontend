import * as Shared from './shared.js';

(function() {
    'use strict';

    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!user)                    { location.href = 'index.html'; return; }
    if (user.role === 'student')  { location.href = 'chatS.html';    return; }
    if (user.role === 'admin')    { location.href = 'adminPan.html'; return; }

    let studyGroupsCache = null;

    // ========== ХУК: настройки преподавателя ==========
    Shared.setOnChatSelected((chat) => {
        Shared.$('#chatFooter').classList.remove('hidden'); 
        Shared.$('#chatFooter').classList.add('flex');
        Shared.$('#accessToggle').checked = chat.isOpen;
        Shared.$('#accessLabel').textContent = chat.isOpen
            ? 'Студенты могут отправлять сообщения'
            : 'Студенты не могут отправлять сообщения';
    });

    // ========== УЧЕБНЫЕ ГРУППЫ ==========
    async function fetchStudyGroups(forceReload) {
        if (!forceReload && studyGroupsCache) return studyGroupsCache;
        try {
            const res = await Shared.apiFetch('/api/study-groups');
            studyGroupsCache = await res.json();
        } catch (e) { 
            studyGroupsCache = []; 
        }
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
            cb.type = 'checkbox'; 
            cb.className = 'group-pick-checkbox';
            cb.value = g.name; 
            cb.dataset.count = g.studentsCount; 
            cb.checked = checked;
            
            const textWrap = document.createElement('div');
            textWrap.className = 'flex-1 min-w-0';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'text-sm font-medium text-gray-800 truncate';
            nameDiv.textContent = g.name;
            
            const countDiv = document.createElement('div');
            countDiv.className = 'text-xs text-gray-500';
            countDiv.textContent = g.studentsCount + ' ' + Shared.plural(g.studentsCount, 'студент', 'студента', 'студентов');
            
            textWrap.appendChild(nameDiv); 
            textWrap.appendChild(countDiv);
            label.appendChild(cb); 
            label.appendChild(textWrap);
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
        let total = 0; 
        checked.forEach(cb => total += parseInt(cb.dataset.count || '0', 10));
        infoEl.textContent = checked.length === 0
            ? 'Ни одна группа не выбрана.'
            : 'Выбрано групп: ' + checked.length + '. Будет добавлено студентов: ' + total + '.';
    }

    function collectCheckedGroups(wrapEl) {
        return Array.from(wrapEl.querySelectorAll('.group-pick-checkbox:checked')).map(cb => cb.value);
    }

    // ========== МЕНЮ НАСТРОЕК ==========
    const settingsBtn  = Shared.$('#settingsBtn');
    const settingsMenu = Shared.$('#settingsMenu');
    
    const toggleMenu = force => {
        const open = typeof force === 'boolean' ? force : settingsMenu.classList.contains('hidden');
        settingsMenu.classList.toggle('hidden', !open);
    };
    
    if (settingsBtn) {
        settingsBtn.addEventListener('click', e => { 
            e.stopPropagation(); 
            toggleMenu(); 
        });
    }
    if (settingsMenu) {
        settingsMenu.addEventListener('click', e => e.stopPropagation());
    }
    document.addEventListener('click', () => toggleMenu(false));

    Shared.$('#accessToggle').addEventListener('change', async function() {
        const id = Shared.chatState.activeChatId;
        if (!id) return;
        try {
            await Shared.apiFetch(`/api/chats/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isOpen: this.checked })
            });
            const c = Shared.chatState.chats.find(x => x.idChat === id);
            if (c) c.isOpen = this.checked;
            
            Shared.$('#accessLabel').textContent = this.checked
                ? 'Студенты могут отправлять сообщения'
                : 'Студенты не могут отправлять сообщения';
        } catch (e) {
            // Ошибка обработана в apiFetch
        }
    });

    // ========== СОЗДАНИЕ ЧАТА ==========
    const createModal    = Shared.$('#createModal');
    const createGroupsEl = Shared.$('#createGroupsPicker');
    const createInfoEl   = Shared.$('#createGroupsInfo');

    async function openCreateModal() {
        Shared.$('#newGroupName').value = '';
        Shared.$('#newGroupAccess').checked = true;
        Shared.$('#newGroupAccessLabel').textContent = 'Студенты смогут отправлять сообщения';
        createGroupsEl.innerHTML = '<div class="p-4 text-center text-sm text-gray-400">Загрузка...</div>';
        createModal.classList.add('visible');
        
        const groups = await fetchStudyGroups(true);
        renderGroupsPicker(createGroupsEl, createInfoEl, groups, null);
        setTimeout(() => Shared.$('#newGroupName').focus(), 50);
    }
    const closeCreateModalFn = () => createModal.classList.remove('visible');

    Shared.$('#createGroupBtn').addEventListener('click', openCreateModal);
    Shared.$('#addGroupBtn').addEventListener('click', () => { toggleMenu(false); openCreateModal(); });
    Shared.$('#closeCreateModal').addEventListener('click', closeCreateModalFn);
    createModal.addEventListener('click', e => { if (e.target === createModal) closeCreateModalFn(); });

    Shared.$('#newGroupAccess').addEventListener('change', function() {
        Shared.$('#newGroupAccessLabel').textContent = this.checked
            ? 'Студенты смогут отправлять сообщения'
            : 'Студенты не смогут отправлять сообщения';
    });

    Shared.$('#refreshCreateGroupsBtn').addEventListener('click', async () => {
        const prev = new Set(collectCheckedGroups(createGroupsEl));
        createGroupsEl.innerHTML = '<div class="p-4 text-center text-sm text-gray-400">Загрузка...</div>';
        const groups = await fetchStudyGroups(true);
        renderGroupsPicker(createGroupsEl, createInfoEl, groups, prev);
    });

    Shared.$('#createGroupSubmit').addEventListener('click', async () => {
        const title = Shared.$('#newGroupName').value.trim();
        if (!title) { Shared.$('#newGroupName').focus(); Shared.showToast('Введите название чата.'); return; }
        if (title.length < 2) { Shared.$('#newGroupName').focus(); Shared.showToast('Название минимум 2 символа.'); return; }
        if (title.length > 50) { Shared.$('#newGroupName').focus(); Shared.showToast('Название максимум 50 символов.'); return; }
        
        if (Shared.chatState.chats.some(c => c.title.toLowerCase() === title.toLowerCase())) {
            Shared.$('#newGroupName').focus(); 
            Shared.showToast('Чат с таким названием уже существует.'); 
            return;
        }
        
        const groupNames = collectCheckedGroups(createGroupsEl);
        if (groupNames.length === 0) { 
            Shared.showToast('Выберите хотя бы одну группу.'); 
            return; 
        }

        try {
            const res = await Shared.apiFetch('/api/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, idOwner: user.idUser, isOpen: Shared.$('#newGroupAccess').checked, groupNames })
            });
            if (!res.ok) { Shared.showToast('Не удалось создать чат'); return; }
            const created = await res.json();
            closeCreateModalFn();
            
            const r = await Shared.apiFetch(`/api/users/${user.idUser}/chats`);
            Shared.chatState.chats = await r.json();
            Shared.renderChatList();
            Shared.selectChat(created.idChat);
        } catch (e) {}
    });

    // ========== ДОБАВЛЕНИЕ ГРУПП В ЧАТ ==========
    const addGroupsModal  = Shared.$('#addGroupsModal');
    const addGroupsEl     = Shared.$('#addGroupsPicker');
    const addGroupsInfoEl = Shared.$('#addGroupsInfo');

    async function openAddGroupsModal() {
        const id = Shared.chatState.activeChatId;
        if (!id) return;
        const chat = Shared.chatState.chats.find(x => x.idChat === id);
        if (!chat) return;
        
        Shared.$('#addGroupsChatName').textContent = chat.title;
        addGroupsEl.innerHTML = '<div class="p-4 text-center text-sm text-gray-400">Загрузка...</div>';
        addGroupsModal.classList.add('visible');
        
        const groups = await fetchStudyGroups(true);
        renderGroupsPicker(addGroupsEl, addGroupsInfoEl, groups, null);
    }
    const closeAddGroupsModalFn = () => addGroupsModal.classList.remove('visible');

    Shared.$('#addStudentsFromGroupsBtn').addEventListener('click', () => { toggleMenu(false); openAddGroupsModal(); });
    Shared.$('#closeAddGroupsModal').addEventListener('click', closeAddGroupsModalFn);
    addGroupsModal.addEventListener('click', e => { if (e.target === addGroupsModal) closeAddGroupsModalFn(); });

    Shared.$('#refreshAddGroupsBtn').addEventListener('click', async () => {
        const prev = new Set(collectCheckedGroups(addGroupsEl));
        addGroupsEl.innerHTML = '<div class="p-4 text-center text-sm text-gray-400">Загрузка...</div>';
        const groups = await fetchStudyGroups(true);
        renderGroupsPicker(addGroupsEl, addGroupsInfoEl, groups, prev);
    });

    Shared.$('#addGroupsSubmit').addEventListener('click', async () => {
        const id = Shared.chatState.activeChatId;
        if (!id) return;
        const groupNames = collectCheckedGroups(addGroupsEl);
        if (groupNames.length === 0) { 
            Shared.showToast('Выберите хотя бы одну группу'); 
            return; 
        }
        
        try {
            const res = await Shared.apiFetch(`/api/chats/${id}/study-groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupNames })
            });
            if (!res.ok) { Shared.showToast('Не удалось добавить группы'); return; }
            const result = await res.json();
            closeAddGroupsModalFn();
            
            const r = await Shared.apiFetch(`/api/users/${user.idUser}/chats`);
            Shared.chatState.chats = await r.json();
            Shared.renderChatList();
            Shared.selectChat(id);
            Shared.showToast('Добавлено студентов: ' + result.added, 'info');
        } catch (e) {}
    });

    // ========== INFO MODAL ==========
    async function openChatInfoModal() {
        const id = Shared.chatState.activeChatId;
        if (!id) return;
        
        const c = Shared.chatState.chats.find(x => x.idChat === id);
        if (!c) return;

        Shared.$('#modalChatName').textContent = c.title;
        Shared.$('#modalMembers').textContent  = c.membersCount;
        Shared.$('#modalAccess').textContent   = c.isOpen ? 'разрешена' : 'запрещена';
        
        try {
            const res = await Shared.apiFetch(`/api/chats/${c.idChat}/members`);
            const members = await res.json();
            const groupSet = new Set();
            members.forEach(m => { if (m.studyGroup) groupSet.add(m.studyGroup); });
            Shared.$('#modalGroups').textContent = groupSet.size ? Array.from(groupSet).sort().join(', ') : 'нет';
        } catch (e) { 
            Shared.$('#modalGroups').textContent = '—'; 
        }
        
        Shared.$('#infoModal').classList.add('visible');
    }

    Shared.$('#chatInfoTrigger').addEventListener('click', openChatInfoModal);

    Shared.$('#menuInfoBtn').addEventListener('click', () => {
        toggleMenu(false);
        openChatInfoModal();
    });

    Shared.$('#closeModal').addEventListener('click',    () => Shared.$('#infoModal').classList.remove('visible'));
    Shared.$('#closeModalBtn').addEventListener('click', () => Shared.$('#infoModal').classList.remove('visible'));
    Shared.$('#infoModal').addEventListener('click', e => {
        if (e.target === Shared.$('#infoModal')) Shared.$('#infoModal').classList.remove('visible');
    });

    // ========== СТАРТ ==========
    (async function() {
        await Shared.initSharedChat(user);
        
        const saved = parseInt(localStorage.getItem('activeChatId') || '0', 10);
        if (saved && Shared.chatState.chats.some(c => c.idChat === saved)) {
            Shared.selectChat(saved);
        } else if (Shared.chatState.chats.length) {
            Shared.selectChat(Shared.chatState.chats[0].idChat);
        } else {
            Shared.clearActiveChat();
        }

        // Поллинг для обновления сообщений
        setInterval(() => {
            if (Shared.chatState.activeChatId) {
                Shared.loadMessages(Shared.chatState.activeChatId);
            }
        }, 5000);
    })();

})();