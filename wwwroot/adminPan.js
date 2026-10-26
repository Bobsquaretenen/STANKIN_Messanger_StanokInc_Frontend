(function() {
    'use strict';

    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!user || user.role !== 'admin') { location.href = 'index.html'; return; }

    const $  = s => document.querySelector(s);
    const escapeHtml = s => String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    let teachersData = [];
    let groupsData   = [];
    let currentGroupName = null;
    let recentActions = [];

    // ---------- Утилиты ----------
    function plural(n, one, few, many) {
        const m10 = n % 10, m100 = n % 100;
        if (m10 === 1 && m100 !== 11) return one;
        if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
        return many;
    }

    function logAction(type, title, subtitle) {
        recentActions.unshift({ type, title, subtitle: subtitle || '' });
        recentActions = recentActions.slice(0, 10);
        renderRecentActions();
    }

    function renderRecentActions() {
        const wrap = $('#recent-actions');
        if (!wrap) return;
        if (!recentActions.length) {
            wrap.innerHTML = '<div class="text-xs text-gray-400 px-1">Пока нет действий</div>';
            return;
        }
        const icons = {
            add:    { sym:'+', cls:'text-green-500' },
            edit:   { sym:'✎', cls:'text-blue-500' },
            delete: { sym:'−', cls:'text-red-500' }
        };
        wrap.innerHTML = recentActions.map(a => {
            const ic = icons[a.type] || icons.edit;
            return '<div class="flex items-start gap-2">' +
                '<span class="' + ic.cls + ' mt-0.5 text-base">' + ic.sym + '</span>' +
                '<div class="min-w-0">' +
                '<p class="font-medium text-gray-800 truncate">' + escapeHtml(a.title) + '</p>' +
                (a.subtitle ? '<p class="text-gray-400 text-xs truncate">' + escapeHtml(a.subtitle) + '</p>' : '') +
                '</div></div>';
        }).join('');
    }

    // ---------- Вкладки ----------
    window.switchTab = function(tabId) {
        document.querySelectorAll('.tab-content').forEach(el => {
            el.classList.add('hidden'); el.classList.remove('block');
        });
        const target = document.getElementById('tab-' + tabId);
        if (target) { target.classList.remove('hidden'); target.classList.add('block'); }

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('bg-primary','text-white','shadow-md');
            btn.classList.add('text-gray-700','hover:bg-white/50');
        });
        const active = document.getElementById('btn-' + tabId);
        if (active) {
            active.classList.remove('text-gray-700','hover:bg-white/50');
            active.classList.add('bg-primary','text-white','shadow-md');
        }

        if (tabId === 'groups')    renderGroupsTable();
        if (tabId === 'users')     renderTeachersTable();
        if (tabId === 'dashboard') loadStats();
    };

    // ---------- Дашборд ----------
    async function loadStats() {
        try {
            const res = await fetch('/api/admin/stats');
            const s = await res.json();
            $('#stat-students').textContent = s.students;
            $('#stat-groups').textContent   = s.groups;
            $('#stat-teachers').textContent = s.teachers;
        } catch (e) {}
    }

    // ---------- Учебные группы ----------
    async function loadStudyGroups() {
        try {
            const res = await fetch('/api/admin/study-groups');
            groupsData = await res.json();
        } catch (e) { groupsData = []; }
    }

    function renderGroupsTable() {
        const tbody = $('#groups-table-body');
        const count = $('#groups-count');
        tbody.innerHTML = '';

        const q = ($('#group-search').value || '').toLowerCase();
        const filtered = groupsData.filter(g => !q || g.name.toLowerCase().includes(q));

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-gray-400 text-sm">Групп нет</td></tr>';
        } else {
            filtered.forEach(g => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-white/30 hover:bg-white/40 transition-colors cursor-pointer';
                tr.innerHTML =
                    '<td class="p-4"><input type="checkbox" class="group-checkbox rounded"></td>' +
                    '<td class="p-4 font-medium text-primary">' + escapeHtml(g.name) + '</td>' +
                    '<td class="p-4 text-green-700">' + g.studentsCount + ' студентов</td>' +
                    '<td class="p-4 text-gray-600">—</td>';
                tr.addEventListener('click', ev => {
                    if (ev.target.type !== 'checkbox') openGroupEdit(g.name);
                });
                tbody.appendChild(tr);
            });
        }
        count.textContent = filtered.length + ' ' +
            plural(filtered.length, 'группа', 'группы', 'групп');
    }

    async function openGroupEdit(name) {
        currentGroupName = name;
        $('#edit-group-name').textContent = name;
        $('#edit-group-input').value = name;

        let students = [];
        try {
            const res = await fetch('/api/admin/study-groups/' + encodeURIComponent(name) + '/students');
            students = await res.json();
        } catch (e) {}

        const tbody = $('#students-table-body');
        tbody.innerHTML = '';

        if (!students.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-gray-400 text-sm">В группе нет студентов</td></tr>';
        } else {
            students.forEach(s => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-white/30 hover:bg-white/40 transition-colors';

                // 4 ячейки: логин, ФИО, пароль, действие
                tr.innerHTML =
                    '<td class="p-4 font-mono text-gray-800"></td>' +
                    '<td class="p-4 text-gray-600"></td>' +
                    '<td class="p-4 text-gray-600"></td>' +
                    '<td class="p-4 text-right"></td>';

                const cells = tr.querySelectorAll('td');

                // Логин
                cells[0].textContent = s.login || '—';

                // ФИО
                cells[1].textContent = s.fullName || '—';

                // Пароль + кнопка показать/скрыть
                const passWrap = document.createElement('div');
                passWrap.className = 'flex items-center gap-2';

                const passSpan = document.createElement('span');
                passSpan.className = 'password-display font-mono';
                passSpan.dataset.real = s.password || '';
                passSpan.textContent = '••••••';
                passWrap.appendChild(passSpan);

                const toggleBtn = document.createElement('button');
                toggleBtn.type = 'button';
                toggleBtn.className = 'toggle-password-btn text-primary hover:text-primary-hover transition-colors flex items-center';
                toggleBtn.title = 'Показать пароль';
                toggleBtn.dataset.visible = 'false';
                toggleBtn.innerHTML =
                    '<svg class="eye-open w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" ' +
                    'viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' +
                    '<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />' +
                    '<path stroke-linecap="round" stroke-linejoin="round" ' +
                    'd="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 ' +
                    '4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />' +
                    '</svg>' +
                    '<svg class="eye-closed w-4 h-4 hidden" xmlns="http://www.w3.org/2000/svg" fill="none" ' +
                    'viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' +
                    '<path stroke-linecap="round" stroke-linejoin="round" ' +
                    'd="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 ' +
                    '9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 ' +
                    '9.88L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 ' +
                    '0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />' +
                    '</svg>';

                toggleBtn.addEventListener('click', () => {
                    const isVisible  = toggleBtn.dataset.visible === 'true';
                    const openIcon   = toggleBtn.querySelector('.eye-open');
                    const closedIcon = toggleBtn.querySelector('.eye-closed');

                    if (isVisible) {
                        passSpan.textContent = '••••••';
                        toggleBtn.dataset.visible = 'false';
                        toggleBtn.title = 'Показать пароль';
                        openIcon.classList.remove('hidden');
                        closedIcon.classList.add('hidden');
                    } else {
                        passSpan.textContent = passSpan.dataset.real || '(пусто)';
                        toggleBtn.dataset.visible = 'true';
                        toggleBtn.title = 'Скрыть пароль';
                        openIcon.classList.add('hidden');
                        closedIcon.classList.remove('hidden');
                    }
                });

                passWrap.appendChild(toggleBtn);
                cells[2].appendChild(passWrap);

                // Кнопка удаления
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'text-red-500 hover:text-red-700 text-xs font-medium';
                delBtn.textContent = 'Удалить';
                delBtn.addEventListener('click', () => removeStudent(s.idUser));
                cells[3].appendChild(delBtn);

                tbody.appendChild(tr);
            });
        }

        $('#students-count').textContent = students.length + ' ' +
            plural(students.length, 'студент', 'студента', 'студентов');

        switchTab('edit-group');
    }

    async function removeStudent(idUser) {
        if (!confirm('Удалить студента из системы?')) return;
        try {
            await fetch('/api/admin/users/' + idUser, { method: 'DELETE' });
            logAction('delete', 'Удалён студент', '');
            await loadStudyGroups();
            if (currentGroupName) openGroupEdit(currentGroupName);
            loadStats();
        } catch (e) {}
    }

    window.deleteCurrentGroup = async function() {
        if (!currentGroupName) return;
        if (!confirm('Удалить группу «' + currentGroupName + '» и всех её студентов?')) return;

        try {
            const res = await fetch('/api/admin/study-groups/' + encodeURIComponent(currentGroupName) + '/students');
            const students = await res.json();
            for (const s of students) {
                await fetch('/api/admin/users/' + s.idUser, { method: 'DELETE' });
            }
            logAction('delete', 'Удалена группа', currentGroupName);
            currentGroupName = null;
            await loadStudyGroups();
            switchTab('groups');
            loadStats();
        } catch (e) {}
    };

    window.saveAndReturn = async function() {
        const newName = $('#edit-group-input').value.trim();
        if (newName && currentGroupName && newName !== currentGroupName) {
            logAction('edit', 'Изменена группа', currentGroupName + ' → ' + newName);
            // Переименование реализовать можно отдельным эндпоинтом.
            // Пока просто обновляем состояние.
        }
        await loadStudyGroups();
        switchTab('groups');
    };

    // ---------- Преподаватели ----------
    async function loadTeachers() {
        try {
            const res = await fetch('/api/admin/users?role=teacher');
            teachersData = await res.json();
        } catch (e) { teachersData = []; }
    }

    function renderTeachersTable() {
        const tbody = $('#teachers-table-body');
        const count = $('#teachers-count');
        if (!tbody) return;
        tbody.innerHTML = '';

        const q = ($('#teacher-search').value || '').toLowerCase();
        const filtered = teachersData.filter(t => {
            if (!q) return true;
            return (t.fullName || '').toLowerCase().includes(q) ||
                (t.login    || '').toLowerCase().includes(q);
        });

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-gray-400 text-sm">Преподаватели не найдены</td></tr>';
        } else {
            filtered.forEach(t => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-white/30 hover:bg-white/40 transition-colors';

                tr.innerHTML =
                    '<td class="p-4 font-medium text-gray-800"></td>' +
                    '<td class="p-4 text-gray-600"></td>' +
                    '<td class="p-4 text-gray-600"></td>' +
                    '<td class="p-4 text-right"></td>';

                const cells = tr.querySelectorAll('td');

                cells[0].textContent = t.fullName || '—';
                cells[1].textContent = t.login || '—';

                const passWrap = document.createElement('div');
                passWrap.className = 'flex items-center gap-2';

                const passSpan = document.createElement('span');
                passSpan.className = 'password-display font-mono';
                passSpan.dataset.real = t.password || '';
                passSpan.textContent = '••••••';
                passWrap.appendChild(passSpan);

                const toggleBtn = document.createElement('button');
                toggleBtn.type = 'button';
                toggleBtn.className = 'toggle-password-btn text-primary hover:text-primary-hover transition-colors flex items-center';
                toggleBtn.title = 'Показать пароль';
                toggleBtn.dataset.visible = 'false';
                toggleBtn.innerHTML =
                    '<svg class="eye-open w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" ' +
                    'viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' +
                    '<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />' +
                    '<path stroke-linecap="round" stroke-linejoin="round" ' +
                    'd="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 ' +
                    '4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />' +
                    '</svg>' +
                    '<svg class="eye-closed w-4 h-4 hidden" xmlns="http://www.w3.org/2000/svg" fill="none" ' +
                    'viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' +
                    '<path stroke-linecap="round" stroke-linejoin="round" ' +
                    'd="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 ' +
                    '9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 ' +
                    '9.88L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 ' +
                    '0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />' +
                    '</svg>';

                toggleBtn.addEventListener('click', () => {
                    const isVisible  = toggleBtn.dataset.visible === 'true';
                    const openIcon   = toggleBtn.querySelector('.eye-open');
                    const closedIcon = toggleBtn.querySelector('.eye-closed');

                    if (isVisible) {
                        passSpan.textContent = '••••••';
                        toggleBtn.dataset.visible = 'false';
                        toggleBtn.title = 'Показать пароль';
                        openIcon.classList.remove('hidden');
                        closedIcon.classList.add('hidden');
                    } else {
                        passSpan.textContent = passSpan.dataset.real || '(пусто)';
                        toggleBtn.dataset.visible = 'true';
                        toggleBtn.title = 'Скрыть пароль';
                        openIcon.classList.add('hidden');
                        closedIcon.classList.remove('hidden');
                    }
                });

                passWrap.appendChild(toggleBtn);
                cells[2].appendChild(passWrap);

                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'text-red-500 hover:text-red-700 text-xs font-medium';
                delBtn.textContent = 'Удалить';
                delBtn.addEventListener('click', () => removeTeacher(t.idUser, t.fullName));
                cells[3].appendChild(delBtn);

                tbody.appendChild(tr);
            });
        }

        count.textContent = filtered.length + ' ' +
            plural(filtered.length, 'преподаватель', 'преподавателя', 'преподавателей');
    }

    async function removeTeacher(id, name) {
        if (!confirm('Удалить преподавателя «' + (name || '') + '»?')) return;
        try {
            await fetch('/api/admin/users/' + id, { method: 'DELETE' });
            logAction('delete', 'Удалён преподаватель', name || '');
            await loadTeachers();
            renderTeachersTable();
            loadStats();
        } catch (e) {}
    }

    // ---------- Модалка: добавить преподавателя ---------- 

    function showAddTeacherError(message) {
        const el = $('#addTeacherError');
        if (!el) return;
        el.textContent = message;
        el.classList.remove('hidden');
    }

    function hideAddTeacherError() {
        const el = $('#addTeacherError');
        if (!el) return;
        el.textContent = '';
        el.classList.add('hidden');
    }
    
    $('#addTeacherBtn').addEventListener('click', () => {
        $('#teacherName').value = '';
        $('#teacherLogin').value = '';
        $('#teacherPassword').value = '';
        $('#teacherDept').value = '';
        hideAddTeacherError();
        $('#addTeacherModal').classList.add('visible');
        setTimeout(() => $('#teacherName').focus(), 50);
    });
    window.closeAddTeacherModal = () => $('#addTeacherModal').classList.remove('visible');
    
    window.submitAddTeacher = async function() {
        const fullName = $('#teacherName').value.trim();
        const login    = $('#teacherLogin').value.trim();
        const password = $('#teacherPassword').value.trim();
        const dept     = $('#teacherDept').value.trim();

        hideAddTeacherError();

        if (!fullName) { $('#teacherName').focus();     showAddTeacherError('Укажите ФИО.'); return; }
        if (!login)    { $('#teacherLogin').focus();    showAddTeacherError('Укажите логин.'); return; }
        if (!password) { $('#teacherPassword').focus(); showAddTeacherError('Укажите пароль.'); return; }

        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    login:      login,
                    password:   password,
                    fullName:   fullName,
                    studyGroup: null,
                    role:       'teacher'
                })
            });

            if (!res.ok) {
                let msg = 'Не удалось добавить преподавателя';
                try {
                    const err = await res.json();
                    if (err && err.error) msg = err.error;
                } catch (e) {}
                showAddTeacherError(msg);
                return;
            }

            $('#addTeacherModal').classList.remove('visible');
            await loadTeachers();
            renderTeachersTable();
            loadStats();
            logAction('add', 'Создан преподаватель', fullName + ' (логин: ' + login + ')');
        } catch (e) {
            showAddTeacherError('Ошибка соединения с сервером');
        }
    };

    ['#teacherName', '#teacherLogin', '#teacherPassword'].forEach(sel => {
        const el = $(sel);
        if (el) el.addEventListener('input', hideAddTeacherError);
    });

    // ---------- Импорт группы ----------
    window.closeImportGroupModal = () => $('#importGroupModal').classList.remove('visible');
    window.submitImportGroup = () => {
        alert('Импорт из Excel в демо-версии не реализован. Добавьте студентов через API /api/admin/users.');
        $('#importGroupModal').classList.remove('visible');
    };
    if ($('#importGroupBtn')) {
        $('#importGroupBtn').addEventListener('click', () => $('#importGroupModal').classList.add('visible'));
    }

    // ---------- Поиск ----------
    $('#group-search').addEventListener('input', renderGroupsTable);
    $('#teacher-search').addEventListener('input', renderTeachersTable);

    // ---------- Выход ----------
    document.querySelectorAll('a[href="index.html"]').forEach(a => {
        a.addEventListener('click', () => localStorage.removeItem('currentUser'));
    });

    // ---------- Модалка группы (удалена из HTML, но кнопки могут пригодиться) ----------
    window.closeAddGroupModal = () => {
        const m = $('#addGroupModal');
        if (m) m.classList.remove('visible');
    };

    // ---------- Старт ----------
    (async function init() {
        renderRecentActions();
        await Promise.all([loadStats(), loadStudyGroups(), loadTeachers()]);
        switchTab('dashboard');
    })();

})();