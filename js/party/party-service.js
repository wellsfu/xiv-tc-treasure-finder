// Party Service
// ==============
// 處理隊伍 CRUD 操作

const PartyService = (function() {
    // 隊伍代碼字元集 (避免混淆字元: 0O, 1lI)
    const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const CODE_LENGTH = 8;

    // 隊伍設定
    const MAX_MEMBERS = 8;
    const PARTY_EXPIRY_HOURS = 12;
    const PARTY_EXPIRY_MS = PARTY_EXPIRY_HOURS * 60 * 60 * 1000;
    const STORAGE_KEY = 'ffxiv_treasure_party';

    // 當前隊伍狀態
    let currentPartyCode = null;
    let currentMemberId = null;
    let memberNickname = null;
    let currentPartyExpiresAt = null;

    // ========== localStorage 管理 ==========

    // 儲存隊伍狀態到 localStorage
    function savePartyState() {
        if (!currentPartyCode || !memberNickname) return;
        try {
            const state = {
                partyCode: currentPartyCode,
                nickname: memberNickname,
                savedAt: Date.now()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            console.log('隊伍狀態已儲存');
        } catch (e) {
            console.warn('無法儲存隊伍狀態:', e);
        }
    }

    // 從 localStorage 載入隊伍狀態
    function loadPartyState() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) return null;
            const state = JSON.parse(data);
            // 檢查是否過期 (超過 12 小時的儲存視為無效)
            if (Date.now() - state.savedAt > PARTY_EXPIRY_MS) {
                clearPartyState();
                return null;
            }
            return state;
        } catch (e) {
            console.warn('無法載入隊伍狀態:', e);
            return null;
        }
    }

    // 清除 localStorage 中的隊伍狀態
    function clearPartyState() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            console.log('隊伍狀態已清除');
        } catch (e) {
            console.warn('無法清除隊伍狀態:', e);
        }
    }

    // 生成隊伍代碼
    function generatePartyCode() {
        let code = '';
        const array = new Uint8Array(CODE_LENGTH);
        crypto.getRandomValues(array);
        for (let i = 0; i < CODE_LENGTH; i++) {
            code += CODE_CHARS[array[i] % CODE_CHARS.length];
        }
        return code;
    }

    // 驗證隊伍代碼格式
    function isValidCodeFormat(code) {
        if (!code || typeof code !== 'string') return false;
        if (code.length !== CODE_LENGTH) return false;
        return /^[A-Z2-9]+$/.test(code.toUpperCase());
    }

    // 取得 Firebase 參考
    function getRef(path) {
        const sdk = window.FirebaseSDK;
        if (!sdk) throw new Error('Firebase SDK 尚未載入');
        return sdk.ref(sdk.db, path);
    }

    // 建立隊伍
    async function createParty(nickname = null) {
        const sdk = window.FirebaseSDK;
        if (!sdk) throw new Error('Firebase SDK 尚未載入');

        // 確保已登入
        await AuthService.ensureSignedIn();
        const userId = AuthService.getUserId();
        if (!userId) throw new Error('使用者未登入');

        // 生成唯一的隊伍代碼 (檢查是否已存在)
        let partyCode;
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            partyCode = generatePartyCode();
            const partyRef = getRef(`parties/${partyCode}`);
            const snapshot = await sdk.get(partyRef);
            if (!snapshot.exists()) {
                break;
            }
            attempts++;
        }

        if (attempts >= maxAttempts) {
            throw new Error('無法生成唯一的隊伍代碼，請稍後再試');
        }

        // 設定成員暱稱
        memberNickname = nickname || `玩家${userId.substring(0, 4)}`;

        // 建立隊伍資料
        const expiresAt = Date.now() + PARTY_EXPIRY_MS;
        const partyData = {
            meta: {
                createdAt: sdk.serverTimestamp(),
                createdBy: userId,
                expiresAt: expiresAt
            },
            members: {
                [userId]: {
                    joinedAt: sdk.serverTimestamp(),
                    nickname: memberNickname,
                    isLeader: true
                }
            },
            treasures: {}
        };
        currentPartyExpiresAt = expiresAt;

        // 寫入資料庫
        const partyRef = getRef(`parties/${partyCode}`);
        await sdk.set(partyRef, partyData);

        // 更新狀態
        currentPartyCode = partyCode;
        currentMemberId = userId;

        // 儲存到 localStorage (用於重連)
        savePartyState();

        console.log(`隊伍建立成功: ${partyCode}`);
        return partyCode;
    }

    // 加入隊伍
    async function joinParty(partyCode, nickname = null) {
        const sdk = window.FirebaseSDK;
        if (!sdk) throw new Error('Firebase SDK 尚未載入');

        // 標準化代碼格式
        partyCode = partyCode.toUpperCase().trim();

        // 驗證代碼格式
        if (!isValidCodeFormat(partyCode)) {
            throw new Error('隊伍代碼格式不正確');
        }

        // 確保已登入
        await AuthService.ensureSignedIn();
        const userId = AuthService.getUserId();
        if (!userId) throw new Error('使用者未登入');

        // 檢查隊伍是否存在
        const partyRef = getRef(`parties/${partyCode}`);
        const snapshot = await sdk.get(partyRef);

        if (!snapshot.exists()) {
            throw new Error('找不到此隊伍，請確認代碼是否正確');
        }

        const partyData = snapshot.val();

        // 檢查隊伍是否已過期
        if (partyData.meta?.expiresAt && Date.now() > partyData.meta.expiresAt) {
            // 刪除過期隊伍
            await sdk.remove(partyRef);
            throw new Error('此隊伍已過期');
        }

        // 檢查人數限制
        const membersSnapshot = await sdk.get(getRef(`parties/${partyCode}/members`));
        const memberCount = Object.keys(membersSnapshot.val() || {}).length;
        if (memberCount >= MAX_MEMBERS) {
            throw new Error(`隊伍已滿 (${MAX_MEMBERS}/${MAX_MEMBERS})`);
        }

        // 設定成員暱稱
        memberNickname = nickname || `玩家${userId.substring(0, 4)}`;

        // 加入成員列表
        const memberRef = getRef(`parties/${partyCode}/members/${userId}`);
        await sdk.set(memberRef, {
            joinedAt: sdk.serverTimestamp(),
            nickname: memberNickname,
            isLeader: false
        });

        // 記錄過期時間
        currentPartyExpiresAt = partyData.meta?.expiresAt || null;

        // 更新狀態
        currentPartyCode = partyCode;
        currentMemberId = userId;

        // 儲存到 localStorage (用於重連)
        savePartyState();

        console.log(`已加入隊伍: ${partyCode}`);
        return partyCode;
    }

    // 離開隊伍
    async function leaveParty() {
        const sdk = window.FirebaseSDK;
        if (!sdk) throw new Error('Firebase SDK 尚未載入');

        if (!currentPartyCode || !currentMemberId) {
            console.warn('目前不在任何隊伍中');
            return;
        }

        // 先停止同步
        if (window.SyncService) {
            window.SyncService.stopSync();
        }

        // 從成員列表移除
        const memberRef = getRef(`parties/${currentPartyCode}/members/${currentMemberId}`);
        await sdk.remove(memberRef);

        // 檢查是否還有其他成員，如果沒有則刪除整個隊伍
        const membersRef = getRef(`parties/${currentPartyCode}/members`);
        const snapshot = await sdk.get(membersRef);

        if (!snapshot.exists() || Object.keys(snapshot.val() || {}).length === 0) {
            // 沒有其他成員，刪除整個隊伍
            const partyRef = getRef(`parties/${currentPartyCode}`);
            await sdk.remove(partyRef);
            console.log(`隊伍 ${currentPartyCode} 已解散`);
        }

        // 清除狀態
        const oldCode = currentPartyCode;
        currentPartyCode = null;
        currentMemberId = null;
        memberNickname = null;
        currentPartyExpiresAt = null;

        // 清除 localStorage
        clearPartyState();

        console.log(`已離開隊伍: ${oldCode}`);
    }

    // 轉換 ID 為 Firebase 安全格式 (將 . 替換為 _)
    function toFirebaseKey(id) {
        return String(id).replace(/\./g, '_');
    }

    // 新增藏寶圖到隊伍 (允許重複新增同一藏寶點)
    async function addTreasure(treasure) {
        const sdk = window.FirebaseSDK;
        if (!sdk) throw new Error('Firebase SDK 尚未載入');

        if (!currentPartyCode) {
            throw new Error('尚未加入隊伍');
        }

        const userId = AuthService.getUserId();

        // 取得目前最大順序
        const treasuresRef = getRef(`parties/${currentPartyCode}/treasures`);
        const snapshot = await sdk.get(treasuresRef);
        let maxOrder = 0;
        if (snapshot.exists()) {
            Object.values(snapshot.val()).forEach(t => {
                if (t.order && t.order > maxOrder) maxOrder = t.order;
            });
        }

        // 建立藏寶圖資料
        const treasureData = {
            id: treasure.id,
            coords: treasure.coords,
            mapId: treasure.map,
            gradeItemId: treasure.item,
            partySize: treasure.partySize,
            addedBy: userId,
            addedByNickname: memberNickname,
            addedAt: sdk.serverTimestamp(),
            order: maxOrder + 1,
            completed: false
        };

        // 使用 push 生成唯一 key，允許同一藏寶點被多次新增
        const newTreasureRef = await sdk.push(treasuresRef);
        await sdk.set(newTreasureRef, treasureData);

        // 延長隊伍過期時間 (活動時更新)
        const newExpiresAt = Date.now() + PARTY_EXPIRY_MS;
        await sdk.set(getRef(`parties/${currentPartyCode}/meta/expiresAt`), newExpiresAt);
        currentPartyExpiresAt = newExpiresAt;

        console.log(`已新增藏寶圖: ${treasure.id}`);
        return treasure.id;
    }

    // 從隊伍移除藏寶圖
    async function removeTreasure(treasureId) {
        const sdk = window.FirebaseSDK;
        if (!sdk) throw new Error('Firebase SDK 尚未載入');

        if (!currentPartyCode) {
            throw new Error('尚未加入隊伍');
        }

        const firebaseKey = toFirebaseKey(treasureId);
        const treasureRef = getRef(`parties/${currentPartyCode}/treasures/${firebaseKey}`);
        await sdk.remove(treasureRef);

        console.log(`已移除藏寶圖: ${treasureId}`);
    }

    // 切換藏寶圖完成狀態
    async function toggleTreasureComplete(treasureId) {
        const sdk = window.FirebaseSDK;
        if (!sdk) throw new Error('Firebase SDK 尚未載入');

        if (!currentPartyCode) {
            throw new Error('尚未加入隊伍');
        }

        const firebaseKey = toFirebaseKey(treasureId);
        const treasureRef = getRef(`parties/${currentPartyCode}/treasures/${firebaseKey}`);
        const snapshot = await sdk.get(treasureRef);

        if (snapshot.exists()) {
            const current = snapshot.val().completed || false;
            await sdk.set(getRef(`parties/${currentPartyCode}/treasures/${firebaseKey}/completed`), !current);
            console.log(`藏寶圖 ${treasureId} 完成狀態: ${!current}`);
        }
    }

    // 更新藏寶圖順序
    async function updateTreasureOrder(treasureId, newOrder) {
        const sdk = window.FirebaseSDK;
        if (!sdk) throw new Error('Firebase SDK 尚未載入');

        if (!currentPartyCode) {
            throw new Error('尚未加入隊伍');
        }

        const firebaseKey = toFirebaseKey(treasureId);
        await sdk.set(getRef(`parties/${currentPartyCode}/treasures/${firebaseKey}/order`), newOrder);
    }

    // 交換兩個藏寶圖的順序 (使用 Transaction 確保並發安全)
    async function swapTreasureOrder(treasureId1, treasureId2, order1, order2) {
        const sdk = window.FirebaseSDK;
        if (!sdk) throw new Error('Firebase SDK 尚未載入');

        if (!currentPartyCode) {
            throw new Error('尚未加入隊伍');
        }

        const key1 = toFirebaseKey(treasureId1);
        const key2 = toFirebaseKey(treasureId2);
        const treasuresRef = getRef(`parties/${currentPartyCode}/treasures`);

        // 使用 Transaction 確保並發編輯安全
        await sdk.runTransaction(treasuresRef, (treasures) => {
            if (!treasures) return treasures;

            if (treasures[key1] && treasures[key2]) {
                const temp = treasures[key1].order;
                treasures[key1].order = treasures[key2].order;
                treasures[key2].order = temp;
            }

            return treasures;
        });
    }

    // 清除所有已完成的藏寶圖
    async function clearCompletedTreasures() {
        const sdk = window.FirebaseSDK;
        if (!sdk) throw new Error('Firebase SDK 尚未載入');

        if (!currentPartyCode) {
            throw new Error('尚未加入隊伍');
        }

        const treasuresRef = getRef(`parties/${currentPartyCode}/treasures`);
        const snapshot = await sdk.get(treasuresRef);

        if (snapshot.exists()) {
            const treasures = snapshot.val();
            for (const [key, treasure] of Object.entries(treasures)) {
                if (treasure.completed) {
                    await sdk.remove(getRef(`parties/${currentPartyCode}/treasures/${key}`));
                }
            }
        }
    }

    // 更新成員暱稱
    async function updateNickname(newNickname) {
        const sdk = window.FirebaseSDK;
        if (!sdk) throw new Error('Firebase SDK 尚未載入');

        if (!currentPartyCode || !currentMemberId) {
            throw new Error('尚未加入隊伍');
        }

        memberNickname = newNickname;

        const nicknameRef = getRef(`parties/${currentPartyCode}/members/${currentMemberId}/nickname`);
        await sdk.set(nicknameRef, newNickname);

        console.log(`暱稱已更新為: ${newNickname}`);
    }

    // 取得當前隊伍代碼
    function getCurrentPartyCode() {
        return currentPartyCode;
    }

    // 取得當前成員暱稱
    function getNickname() {
        return memberNickname;
    }

    // 檢查是否在隊伍中
    function isInParty() {
        return currentPartyCode !== null;
    }

    // 取得隊伍過期時間
    function getExpiresAt() {
        return currentPartyExpiresAt;
    }

    // 設定過期時間 (供同步服務使用)
    function setExpiresAt(expiresAt) {
        currentPartyExpiresAt = expiresAt;
    }

    // 取得最大成員數
    function getMaxMembers() {
        return MAX_MEMBERS;
    }

    // 取得隊伍資料 (一次性讀取)
    async function getPartyData() {
        const sdk = window.FirebaseSDK;
        if (!sdk) throw new Error('Firebase SDK 尚未載入');

        if (!currentPartyCode) return null;

        const partyRef = getRef(`parties/${currentPartyCode}`);
        const snapshot = await sdk.get(partyRef);

        if (!snapshot.exists()) return null;
        return snapshot.val();
    }

    // 嘗試重新加入隊伍 (從 localStorage 恢復)
    async function tryRejoinParty() {
        const savedState = loadPartyState();
        if (!savedState) {
            return null;
        }

        console.log('嘗試重新加入隊伍:', savedState.partyCode);

        try {
            // 嘗試重新加入
            await joinParty(savedState.partyCode, savedState.nickname);
            return savedState.partyCode;
        } catch (error) {
            console.log('重新加入失敗:', error.message);
            // 清除無效的儲存狀態
            clearPartyState();
            return null;
        }
    }

    // 檢查是否有已儲存的隊伍狀態
    function hasSavedPartyState() {
        return loadPartyState() !== null;
    }

    return {
        generatePartyCode,
        isValidCodeFormat,
        createParty,
        joinParty,
        leaveParty,
        addTreasure,
        removeTreasure,
        toggleTreasureComplete,
        updateTreasureOrder,
        swapTreasureOrder,
        clearCompletedTreasures,
        updateNickname,
        getCurrentPartyCode,
        getNickname,
        isInParty,
        getPartyData,
        getExpiresAt,
        setExpiresAt,
        getMaxMembers,
        // 重連相關
        tryRejoinParty,
        hasSavedPartyState,
        clearPartyState
    };
})();

// 匯出
window.PartyService = PartyService;
