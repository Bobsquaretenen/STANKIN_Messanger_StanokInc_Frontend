import * as Shared from './shared.js';

(function() {
    'use strict';

    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!user)                    { location.href = 'index.html'; return; }
    if (user.role === 'teacher')  { location.href = 'chatT.html';    return; }
    if (user.role === 'admin')    { location.href = 'adminPan.html'; return; }

    // Устанавливаем хук для студента
    Shared.setOnChatSelected((chat) => {
        const footer = Shared.$('#chatFooter');
        const locked = Shared.$('#chatFooterLocked');
        if (chat.isOpen) {
            footer.classList.remove('hidden'); footer.classList.add('flex');
            locked.classList.add('hidden');    locked.classList.remove('flex');
        } else {
            footer.classList.add('hidden');    footer.classList.remove('flex');
            locked.classList.remove('hidden'); locked.classList.add('flex');
        }
    });

    // Info modal
    function openInfoModal() {
        const c = Shared.chatState.chats.find(x => x.idChat === Shared.chatState.activeChatId);
        if (!c) return;
        Shared.$('#modalChatName').textContent = c.title;
        Shared.$('#modalMembers').textContent  = c.membersCount;
        Shared.$('#modalAccess').textContent   = c.isOpen ? 'разрешена' : 'запрещена';
        Shared.$('#infoModal').classList.add('visible');
    }

    Shared.$('#infoBtn').addEventListener('click', openInfoModal);
    Shared.$('#chatInfoTrigger').addEventListener('click', openInfoModal);

    Shared.$('#closeModal').addEventListener('click',    () => Shared.$('#infoModal').classList.remove('visible'));
    Shared.$('#closeModalBtn').addEventListener('click', () => Shared.$('#infoModal').classList.remove('visible'));
    Shared.$('#infoModal').addEventListener('click', e => {
        if (e.target === Shared.$('#infoModal')) Shared.$('#infoModal').classList.remove('visible');
    });

    // Старт
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

        setInterval(() => {
            if (Shared.chatState.activeChatId) {
                Shared.loadMessages(Shared.chatState.activeChatId);
            }
        }, 5000);
    })();

})();