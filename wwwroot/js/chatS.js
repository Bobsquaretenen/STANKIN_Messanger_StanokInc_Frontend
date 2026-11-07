(function() {
    'use strict';

    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!user)                    { location.href = 'index.html'; return; }
    if (user.role === 'teacher')  { location.href = 'chatT.html';    return; }
    if (user.role === 'admin')    { location.href = 'adminPan.html'; return; }

    // ========== ХУК: настройки студента ==========
    window.onChatSelected = function(chat) {
        const footer = $('#chatFooter');
        const locked = $('#chatFooterLocked');
        if (chat.isOpen) {
            footer.classList.remove('hidden'); footer.classList.add('flex');
            locked.classList.add('hidden');    locked.classList.remove('flex');
        } else {
            footer.classList.add('hidden');    footer.classList.remove('flex');
            locked.classList.remove('hidden'); locked.classList.add('flex');
        }
    };

    // ========== INFO MODAL ==========
    function openInfoModal() {
        const c = window.chatState.chats.find(x => x.idChat === window.chatState.activeChatId);
        if (!c) return;
        $('#modalChatName').textContent = c.title;
        $('#modalMembers').textContent  = c.membersCount;
        $('#modalAccess').textContent   = c.isOpen ? 'разрешена' : 'запрещена';
        $('#infoModal').classList.add('visible');
    }

    $('#infoBtn').addEventListener('click', openInfoModal);

    $('#chatInfoTrigger').addEventListener('click', openInfoModal);

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