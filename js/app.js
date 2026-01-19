// 狀態管理
let selectedGrade = null;
let selectedMapId = null;
let selectedTreasure = null;

// 隊伍狀態
let isFirebaseReady = false;
let partyMembers = {};
let partyTreasures = [];
let selectedRouteItem = null;
let isAddingTreasureMode = false;
let partyExpiryTimer = null;
let isReconnecting = false;

// DOM 元素
const stepGrade = document.getElementById('step-grade');
const stepMap = document.getElementById('step-map');
const stepTreasure = document.getElementById('step-treasure');
const gradeGrid = document.getElementById('grade-grid');
const mapGrid = document.getElementById('map-grid');
const selectedGradeName = document.getElementById('selected-grade-name');
const selectedMapName = document.getElementById('selected-map-name');
const backToGrade = document.getElementById('back-to-grade');
const backToMap = document.getElementById('back-to-map');
const mainMapImage = document.getElementById('main-map-image');
const mapMarkers = document.getElementById('map-markers');
const selectedMarker = document.getElementById('selected-marker');
const puzzleGrid = document.getElementById('puzzle-grid');
const treasureCount = document.getElementById('treasure-count');

// 初始化
async function init() {
    renderGradeButtons();
    bindEvents();
    await initializePartySystem();
}

// 渲染等級按鈕
function renderGradeButtons() {
    gradeGrid.innerHTML = '';

    GRADE_DATA.forEach(grade => {
        const btn = document.createElement('button');
        btn.className = `grade-btn ${grade.special ? 'special' : ''} ${grade.partySize === 8 ? 'party-8' : 'party-1'}`;
        btn.dataset.itemId = grade.itemId;

        btn.innerHTML = `
            <span class="grade-label">${grade.grade}</span>
            <span class="grade-name">${grade.name}</span>
            <span class="grade-meta">
                <span class="party-badge">${grade.partySize === 8 ? '8人' : '單人'}</span>
                <span class="expansion-badge">${grade.expansion}</span>
            </span>
        `;

        btn.addEventListener('click', () => selectGrade(grade));
        gradeGrid.appendChild(btn);
    });
}

// 選擇等級
function selectGrade(grade) {
    selectedGrade = grade;
    selectedGradeName.textContent = `${grade.grade} - ${grade.name}`;

    renderMapButtons();
    showStep('map');
}

// 字母編號轉換
function indexToLetter(index) {
    return String.fromCharCode(65 + index); // A=65
}

// 渲染地圖按鈕
function renderMapButtons() {
    mapGrid.innerHTML = '';

    const maps = getMapsForGrade(selectedGrade);

    maps.forEach((map, index) => {
        const letter = indexToLetter(index);
        const btn = document.createElement('button');
        btn.className = 'map-btn';
        btn.dataset.mapId = map.id;
        btn.dataset.mapLetter = letter;

        btn.innerHTML = `
            <div class="map-btn-image">
                <img src="${map.image}" alt="${map.name}" loading="lazy">
            </div>
            <div class="map-btn-info">
                <span class="map-btn-name"><span class="map-letter">${letter}</span> ${map.name}</span>
                <span class="map-btn-count">${map.count} 個藏寶點</span>
            </div>
        `;

        btn.addEventListener('click', () => selectMap(map.id, letter));
        mapGrid.appendChild(btn);
    });
}

// 儲存目前選擇的地圖字母
let selectedMapLetter = null;

// 選擇地圖
function selectMap(mapId, letter) {
    selectedMapId = mapId;
    selectedMapLetter = letter;
    selectedMapName.textContent = `${letter} ${getMapName(mapId)}`;

    const map = MAP_DATA[mapId];
    if (map) {
        mainMapImage.src = map.image;
    }

    renderTreasures();
    showStep('treasure');
}

// 渲染藏寶點 (Teamcraft 風格)
function renderTreasures() {
    const treasures = getTreasuresForGradeAndMap(selectedGrade, selectedMapId);
    treasureCount.textContent = treasures.length;

    // 清除舊的標記
    mapMarkers.innerHTML = '';
    puzzleGrid.innerHTML = '';
    selectedMarker.classList.add('hidden');

    // 隱藏側邊資訊
    const sideMapInfo = document.getElementById('side-map-info');
    if (sideMapInfo) sideMapInfo.classList.add('hidden');

    treasures.forEach((treasure, index) => {
        // 添加側邊地圖標記
        const pos = coordsToPercent(treasure.coords, treasure.map);
        const marker = document.createElement('div');
        marker.className = 'map-marker';
        marker.style.left = `${pos.x}%`;
        marker.style.top = `${pos.y}%`;
        marker.dataset.treasureId = treasure.id;
        marker.textContent = index + 1;
        marker.addEventListener('click', () => selectTreasure(treasure, index));
        mapMarkers.appendChild(marker);

        // 計算 Teamcraft 風格的地圖偏移 (基於 2048px 地圖)
        const displayOffset = calcTeamcraftOffset(treasure.coords, treasure.map);

        // 創建 Teamcraft 風格的藏寶圖卡片
        const card = document.createElement('div');
        card.className = 'treasure-map';
        card.dataset.treasureId = treasure.id;

        const partySize = treasure.partySize || selectedGrade.partySize;

        card.innerHTML = `
            <div class="map-background-container">
                <img class="map-background"
                     src="${MAP_DATA[treasure.map]?.image}"
                     alt="地圖"
                     style="left: ${displayOffset.x}px; top: ${displayOffset.y}px;">
            </div>
            <div class="map-foreground"></div>
            <div class="treasure-marker-icon">
                <img src="assets/icons/treasure_marker.png" alt="標記">
            </div>
            <div class="card-number shadow-text">${index + 1}</div>
            <div class="position shadow-text">
                X: ${treasure.coords.x.toFixed(1)} Y: ${treasure.coords.y.toFixed(1)}
            </div>
            <div class="player-count">
                <div class="player-icon">
                    <img src="assets/icons/treasuremap_player.png" alt="玩家">
                </div>
                <span class="party-size shadow-text">${partySize}</span>
            </div>
            <button class="copy-pos-btn" data-pos="/pos ${treasure.coords.x.toFixed(1)} ${treasure.coords.y.toFixed(1)}" title="複製座標指令">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
            </button>
        `;

        card.addEventListener('click', (e) => {
            if (!e.target.closest('.copy-pos-btn')) {
                selectTreasure(treasure, index);
            }
        });

        // 複製座標按鈕事件
        const copyBtn = card.querySelector('.copy-pos-btn');
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const posCmd = copyBtn.dataset.pos;
            navigator.clipboard.writeText(posCmd).then(() => {
                copyBtn.classList.add('copied');
                setTimeout(() => copyBtn.classList.remove('copied'), 1500);
            });
        });

        puzzleGrid.appendChild(card);
    });

    // 更新隊伍按鈕狀態
    updateTreasureCardsPartyStatus();
}

// 計算 Teamcraft 風格的地圖偏移量 (像素)
// 讓目標藏寶點位於卡片中央
function calcTeamcraftOffset(coords, mapId) {
    const map = MAP_DATA[mapId];
    const sizeFactor = map?.size_factor || 100;
    const scale = sizeFactor / 100;

    // 遊戲座標轉換為百分比位置 (0-1)
    // FFXIV 地圖座標範圍是 1 到 (41*scale + 1)
    const posX = (coords.x - 1) / (41 * scale);
    const posY = (coords.y - 1) / (41 * scale);

    // 轉換為 2048x2048 地圖上的像素位置
    const pixelX = posX * 2048;
    const pixelY = posY * 2048;

    // 容器中央位置 (218*0.9/2 和 189*0.9/2)
    const centerX = 218 * 0.9 / 2;  // 98.1
    const centerY = 189 * 0.9 / 2;  // 85.05

    // 計算偏移：讓 pixelX 位置出現在容器中央
    const displayX = centerX - pixelX;
    const displayY = centerY - pixelY;

    return { x: displayX, y: displayY };
}

// 遊戲座標轉換為地圖百分比位置
function coordsToPercent(coords, mapId) {
    const map = MAP_DATA[mapId];
    const sizeFactor = map?.size_factor || 100;
    const scale = sizeFactor / 100;
    const x = ((coords.x - 1) / (41 * scale)) * 100;
    const y = ((coords.y - 1) / (41 * scale)) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

// 選擇藏寶點
function selectTreasure(treasure, index) {
    selectedTreasure = treasure;

    // 更新側邊地圖標記高亮
    document.querySelectorAll('.map-marker').forEach(m => {
        m.classList.toggle('active', m.dataset.treasureId === treasure.id);
    });

    // 更新藏寶圖卡片高亮
    document.querySelectorAll('.treasure-map').forEach(c => {
        c.classList.toggle('active', c.dataset.treasureId === treasure.id);
    });

    // 顯示選中標記
    const pos = coordsToPercent(treasure.coords, treasure.map);
    selectedMarker.style.left = `${pos.x}%`;
    selectedMarker.style.top = `${pos.y}%`;
    selectedMarker.classList.remove('hidden');

    // 顯示側邊資訊
    showSideInfo(treasure);

    // 滾動到選中的卡片
    const activeCard = document.querySelector(`.treasure-map[data-treasure-id="${treasure.id}"]`);
    if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// 顯示側邊資訊
function showSideInfo(treasure) {
    const sideMapInfo = document.getElementById('side-map-info');
    if (!sideMapInfo) return;

    document.getElementById('detail-coords').textContent =
        `X: ${treasure.coords.x.toFixed(1)}, Y: ${treasure.coords.y.toFixed(1)}`;
    document.getElementById('detail-item').textContent = getItemName(treasure.item);

    sideMapInfo.classList.remove('hidden');
}

// 顯示步驟
function showStep(step) {
    stepGrade.classList.toggle('hidden', step !== 'grade');
    stepMap.classList.toggle('hidden', step !== 'map');
    stepTreasure.classList.toggle('hidden', step !== 'treasure');

    // 如果在隊伍模式，滾動到對應的步驟區塊
    if (PartyService && PartyService.isInParty()) {
        const targetStep = step === 'grade' ? stepGrade : step === 'map' ? stepMap : stepTreasure;
        if (targetStep) {
            targetStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } else {
        // 非隊伍模式，滾動到頂部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// 綁定事件
function bindEvents() {
    backToGrade.addEventListener('click', () => {
        selectedGrade = null;
        selectedMapId = null;
        selectedTreasure = null;
        showStep('grade');
    });

    backToMap.addEventListener('click', () => {
        selectedMapId = null;
        selectedTreasure = null;
        showStep('map');
    });
}

// ============================================
// 隊伍功能
// ============================================

// 初始化隊伍系統 (延遲連線模式 - 只綁定事件，不連接 Firebase)
async function initializePartySystem() {
    // 檢查 Firebase 是否已設定
    if (!window.FirebaseConfig || !window.FirebaseConfig.isConfigured()) {
        console.log('Firebase 尚未設定，隊伍功能將不可用');
        disablePartyButtons();
        return;
    }

    // 只綁定事件，不初始化 Firebase 連線
    // Firebase 連線會在使用者建立/加入隊伍時才建立
    bindPartyEvents();

    // 檢查是否有已儲存的隊伍狀態 (用於重連)
    if (PartyService.hasSavedPartyState()) {
        showReconnectPrompt();
    }

    console.log('隊伍系統就緒 (延遲連線模式)');
}

// 顯示重連提示
function showReconnectPrompt() {
    const btnCreate = document.getElementById('btn-create-party');
    const btnJoin = document.getElementById('btn-join-party');

    // 隱藏建立/加入按鈕，顯示重連按鈕
    if (btnCreate) btnCreate.classList.add('hidden');
    if (btnJoin) btnJoin.classList.add('hidden');

    // 創建重連按鈕
    const reconnectBtn = document.createElement('button');
    reconnectBtn.id = 'btn-reconnect-party';
    reconnectBtn.className = 'btn-header btn-party';
    reconnectBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
        </svg>
        重新連線
    `;
    reconnectBtn.addEventListener('click', handleReconnect);

    // 創建取消按鈕
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'btn-cancel-reconnect';
    cancelBtn.className = 'btn-header btn-secondary';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', cancelReconnect);

    // 插入按鈕
    const headerButtons = document.querySelector('.header-buttons');
    if (headerButtons) {
        headerButtons.insertBefore(reconnectBtn, headerButtons.firstChild);
        headerButtons.insertBefore(cancelBtn, reconnectBtn.nextSibling);
    }
}

// 處理重連
async function handleReconnect() {
    const reconnectBtn = document.getElementById('btn-reconnect-party');
    if (reconnectBtn) {
        reconnectBtn.disabled = true;
        reconnectBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="spin">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            重新連線中...
        `;
    }

    isReconnecting = true;

    try {
        // 確保 Firebase 已連線
        const connected = await ensureFirebaseConnected();
        if (!connected) {
            throw new Error('無法連接伺服器');
        }

        // 嘗試重新加入隊伍
        const partyCode = await PartyService.tryRejoinParty();

        if (partyCode) {
            // 重連成功
            SyncService.startSync(partyCode);
            updatePartyButtonsUI(true);
            document.getElementById('status-party-code').textContent = partyCode;
            removeReconnectButtons();
            console.log('重連成功:', partyCode);
        } else {
            // 重連失敗，隊伍可能已不存在
            cancelReconnect();
            alert('隊伍已不存在或已過期');
        }
    } catch (error) {
        console.error('重連失敗:', error);
        cancelReconnect();
        alert('重連失敗: ' + error.message);
    } finally {
        isReconnecting = false;
    }
}

// 取消重連
function cancelReconnect() {
    // 清除儲存的狀態
    PartyService.clearPartyState();
    removeReconnectButtons();

    // 顯示建立/加入按鈕
    const btnCreate = document.getElementById('btn-create-party');
    const btnJoin = document.getElementById('btn-join-party');
    if (btnCreate) btnCreate.classList.remove('hidden');
    if (btnJoin) btnJoin.classList.remove('hidden');
}

// 移除重連按鈕
function removeReconnectButtons() {
    const reconnectBtn = document.getElementById('btn-reconnect-party');
    const cancelBtn = document.getElementById('btn-cancel-reconnect');
    if (reconnectBtn) reconnectBtn.remove();
    if (cancelBtn) cancelBtn.remove();
}

// 確保 Firebase 已連線 (延遲初始化)
async function ensureFirebaseConnected() {
    if (isFirebaseReady) {
        return true;
    }

    try {
        // 初始化 Firebase
        isFirebaseReady = await window.FirebaseConfig.initialize();

        if (isFirebaseReady) {
            // 初始化認證
            await AuthService.initialize();

            // 設定同步回調
            setupSyncCallbacks();

            console.log('Firebase 連線已建立');
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error('Firebase 連線失敗:', error);
        return false;
    }
}

// 停用隊伍按鈕
function disablePartyButtons() {
    const btnCreate = document.getElementById('btn-create-party');
    const btnJoin = document.getElementById('btn-join-party');
    if (btnCreate) {
        btnCreate.disabled = true;
        btnCreate.title = 'Firebase 尚未設定';
    }
    if (btnJoin) {
        btnJoin.disabled = true;
        btnJoin.title = 'Firebase 尚未設定';
    }
}

// 設定同步回調
function setupSyncCallbacks() {
    SyncService.onMembersChange((members) => {
        partyMembers = members;
        updateMembersUI();
    });

    SyncService.onTreasuresChange((treasures) => {
        partyTreasures = treasures;
        updatePartyTreasuresUI();
        updateTreasureCardsPartyStatus();
    });

    SyncService.onConnectionChange((connected) => {
        updateConnectionUI(connected);
    });

    SyncService.onError((error) => {
        console.error('同步錯誤:', error);
    });

    SyncService.onMetaChange((meta) => {
        if (meta?.expiresAt) {
            PartyService.setExpiresAt(meta.expiresAt);
            startExpiryTimer();
        }
    });
}

// 綁定隊伍事件
function bindPartyEvents() {
    // 建立隊伍按鈕
    const btnCreateParty = document.getElementById('btn-create-party');
    if (btnCreateParty) {
        btnCreateParty.addEventListener('click', () => openModal('modal-create-party'));
    }

    // 加入隊伍按鈕
    const btnJoinParty = document.getElementById('btn-join-party');
    if (btnJoinParty) {
        btnJoinParty.addEventListener('click', () => openModal('modal-join-party'));
    }

    // 隊伍狀態按鈕
    const btnPartyStatus = document.getElementById('btn-party-status');
    if (btnPartyStatus) {
        btnPartyStatus.addEventListener('click', () => openModal('modal-party-status'));
    }

    // 確認建立隊伍
    const btnConfirmCreate = document.getElementById('btn-confirm-create');
    if (btnConfirmCreate) {
        btnConfirmCreate.addEventListener('click', handleCreateParty);
    }

    // 確認加入隊伍
    const btnConfirmJoin = document.getElementById('btn-confirm-join');
    if (btnConfirmJoin) {
        btnConfirmJoin.addEventListener('click', handleJoinParty);
    }

    // 離開隊伍 (Modal)
    const btnLeaveParty = document.getElementById('btn-leave-party');
    if (btnLeaveParty) {
        btnLeaveParty.addEventListener('click', handleLeaveParty);
    }

    // 離開隊伍 (面板)
    const btnLeavePartyPanel = document.getElementById('btn-leave-party-panel');
    if (btnLeavePartyPanel) {
        btnLeavePartyPanel.addEventListener('click', handleLeaveParty);
    }

    // 複製隊伍代碼
    const copyPartyCode = document.getElementById('copy-party-code');
    if (copyPartyCode) {
        copyPartyCode.addEventListener('click', () => {
            const code = document.getElementById('created-party-code').textContent;
            copyToClipboard(code, copyPartyCode);
        });
    }

    const copyStatusCode = document.getElementById('copy-status-code');
    if (copyStatusCode) {
        copyStatusCode.addEventListener('click', () => {
            const code = document.getElementById('status-party-code').textContent;
            copyToClipboard(code, copyStatusCode);
        });
    }

    // 面板複製代碼
    const btnCopyPanelCode = document.getElementById('btn-copy-panel-code');
    if (btnCopyPanelCode) {
        btnCopyPanelCode.addEventListener('click', () => {
            const code = document.getElementById('panel-party-code').textContent;
            copyToClipboard(code, btnCopyPanelCode);
        });
    }

    // 新增藏寶圖模式按鈕
    const btnAddTreasureMode = document.getElementById('btn-add-treasure-mode');
    if (btnAddTreasureMode) {
        btnAddTreasureMode.addEventListener('click', enterAddTreasureMode);
    }

    // 清除已完成
    const btnClearCompleted = document.getElementById('btn-clear-completed');
    if (btnClearCompleted) {
        btnClearCompleted.addEventListener('click', clearCompletedTreasures);
    }

    // 地圖選擇
    const previewMapSelect = document.getElementById('preview-map-select');
    if (previewMapSelect) {
        previewMapSelect.addEventListener('change', updateMapPreviewUI);
    }

    // Modal 關閉按鈕
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-overlay');
            if (modal) closeModal(modal.id);
        });
    });

    // 點擊背景關閉 Modal
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });

    // 加入隊伍代碼輸入自動轉大寫
    const joinCodeInput = document.getElementById('join-party-code');
    if (joinCodeInput) {
        joinCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }
}

// 進入新增藏寶圖模式
function enterAddTreasureMode() {
    isAddingTreasureMode = true;
    // 滾動到選擇等級區域
    const stepGrade = document.getElementById('step-grade');
    if (stepGrade) {
        stepGrade.scrollIntoView({ behavior: 'smooth' });
    }
}

// 開啟 Modal
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');

        // 如果是隊伍狀態 Modal，更新內容
        if (modalId === 'modal-party-status') {
            updatePartyStatusModal();
        }
    }
}

// 關閉 Modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// 處理建立隊伍
async function handleCreateParty() {
    const btn = document.getElementById('btn-confirm-create');
    const errorEl = document.getElementById('create-party-error');
    const resultEl = document.getElementById('create-party-result');
    const nicknameInput = document.getElementById('create-nickname');

    btn.disabled = true;
    btn.textContent = '連線中...';
    errorEl.classList.add('hidden');
    resultEl.classList.add('hidden');

    try {
        // 延遲連線：確保 Firebase 已連線
        const connected = await ensureFirebaseConnected();
        if (!connected) {
            throw new Error('無法連接伺服器，請稍後再試');
        }

        btn.textContent = '建立中...';
        const nickname = nicknameInput.value.trim() || null;
        const partyCode = await PartyService.createParty(nickname);

        // 顯示結果
        document.getElementById('created-party-code').textContent = partyCode;
        resultEl.classList.remove('hidden');
        btn.textContent = '已建立';

        // 開始同步
        SyncService.startSync(partyCode);

        // 更新 UI
        updatePartyButtonsUI(true);
        document.getElementById('status-party-code').textContent = partyCode;

    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = '建立隊伍';
    }
}

// 處理加入隊伍
async function handleJoinParty() {
    const btn = document.getElementById('btn-confirm-join');
    const errorEl = document.getElementById('join-party-error');
    const codeInput = document.getElementById('join-party-code');
    const nicknameInput = document.getElementById('join-nickname');

    const code = codeInput.value.trim();
    if (!code) {
        errorEl.textContent = '請輸入隊伍代碼';
        errorEl.classList.remove('hidden');
        return;
    }

    btn.disabled = true;
    btn.textContent = '連線中...';
    errorEl.classList.add('hidden');

    try {
        // 延遲連線：確保 Firebase 已連線
        const connected = await ensureFirebaseConnected();
        if (!connected) {
            throw new Error('無法連接伺服器，請稍後再試');
        }

        btn.textContent = '加入中...';
        const nickname = nicknameInput.value.trim() || null;
        await PartyService.joinParty(code, nickname);

        // 開始同步
        SyncService.startSync(code);

        // 更新 UI
        updatePartyButtonsUI(true);
        document.getElementById('status-party-code').textContent = code;

        // 關閉 Modal
        closeModal('modal-join-party');

        // 重置表單
        codeInput.value = '';
        nicknameInput.value = '';

    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = '加入隊伍';
    }
}

// 處理離開隊伍
async function handleLeaveParty() {
    if (!confirm('確定要離開隊伍嗎？')) return;

    try {
        await PartyService.leaveParty();

        // 重置狀態
        partyMembers = {};
        partyTreasures = [];

        // 停止過期倒數計時
        stopExpiryTimer();

        // 更新 UI
        updatePartyButtonsUI(false);
        updateMembersUI();
        updatePartyTreasuresUI();
        updateTreasureCardsPartyStatus();

        // 關閉 Modal
        closeModal('modal-party-status');

        // 重置建立隊伍 Modal
        resetCreatePartyModal();

    } catch (error) {
        alert('離開隊伍失敗: ' + error.message);
    }
}

// 重置建立隊伍 Modal
function resetCreatePartyModal() {
    const btn = document.getElementById('btn-confirm-create');
    const resultEl = document.getElementById('create-party-result');
    const nicknameInput = document.getElementById('create-nickname');

    btn.disabled = false;
    btn.textContent = '建立隊伍';
    resultEl.classList.add('hidden');
    nicknameInput.value = '';
}

// 更新隊伍按鈕 UI
function updatePartyButtonsUI(inParty) {
    const btnCreate = document.getElementById('btn-create-party');
    const btnJoin = document.getElementById('btn-join-party');
    const btnStatus = document.getElementById('btn-party-status');
    const partyPanel = document.getElementById('party-mode-panel');

    if (inParty) {
        btnCreate.classList.add('hidden');
        btnJoin.classList.add('hidden');
        btnStatus.classList.remove('hidden');
        partyPanel.classList.remove('hidden');

        // 更新面板中的隊伍代碼
        const code = PartyService.getCurrentPartyCode();
        document.getElementById('panel-party-code').textContent = code;

        // 開始過期倒數計時
        startExpiryTimer();
    } else {
        btnCreate.classList.remove('hidden');
        btnJoin.classList.remove('hidden');
        btnStatus.classList.add('hidden');
        partyPanel.classList.add('hidden');
        isAddingTreasureMode = false;

        // 停止過期倒數計時
        stopExpiryTimer();
    }
}

// 更新成員 UI
function updateMembersUI() {
    const membersList = document.getElementById('members-list');
    const memberCount = document.getElementById('member-count');
    const panelMembersList = document.getElementById('panel-members-list');
    const currentUserId = AuthService.getUserId();

    const members = Object.entries(partyMembers);
    const maxMembers = PartyService.getMaxMembers();

    // 顯示人數格式: (X/8)
    if (memberCount) memberCount.textContent = `${members.length}/${maxMembers}`;

    const membersHtml = members.map(([id, member]) => {
        const isSelf = id === currentUserId;
        const isLeader = member.isLeader;
        return `
            <span class="member-tag ${isSelf ? 'is-self' : ''} ${isLeader ? 'is-leader' : ''}">
                ${escapeHtml(member.nickname)}
            </span>
        `;
    }).join('');

    if (membersList) membersList.innerHTML = membersHtml;
    if (panelMembersList) panelMembersList.innerHTML = membersHtml;
}

// 開始過期倒數計時
function startExpiryTimer() {
    // 清除舊的計時器
    if (partyExpiryTimer) {
        clearInterval(partyExpiryTimer);
    }

    updateExpiryDisplay();
    partyExpiryTimer = setInterval(updateExpiryDisplay, 1000);
}

// 停止過期倒數計時
function stopExpiryTimer() {
    if (partyExpiryTimer) {
        clearInterval(partyExpiryTimer);
        partyExpiryTimer = null;
    }
}

// 更新過期時間顯示
function updateExpiryDisplay() {
    const expiresAt = PartyService.getExpiresAt();
    const expiryDisplay = document.getElementById('party-expiry-display');

    if (!expiresAt || !expiryDisplay) return;

    const now = Date.now();
    const remaining = expiresAt - now;

    if (remaining <= 0) {
        expiryDisplay.innerHTML = '<span class="expiry-expired">已過期</span>';
        stopExpiryTimer();
        return;
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // 如果剩餘時間少於 1 小時，顯示警告樣式
    const warningClass = remaining < 60 * 60 * 1000 ? 'expiry-warning' : '';

    expiryDisplay.innerHTML = `<span class="expiry-time ${warningClass}">${timeStr}</span>`;
}

// 更新隊伍藏寶圖 UI
function updatePartyTreasuresUI() {
    // 更新舊版 Modal 的列表 (如果還有用到)
    const oldList = document.getElementById('party-treasures-list');
    const oldCount = document.getElementById('party-treasure-count');
    if (oldCount) oldCount.textContent = partyTreasures.length;

    // 更新新版路線列表
    updateRouteListUI();
    updateMapPreviewUI();
}

// 更新路線列表 UI
function updateRouteListUI() {
    const routeItems = document.getElementById('route-items');
    const routeCount = document.getElementById('route-count');

    if (!routeItems) return;

    // 按順序排序
    const sortedTreasures = [...partyTreasures].sort((a, b) => (a.order || 0) - (b.order || 0));

    if (routeCount) routeCount.textContent = sortedTreasures.length;

    if (sortedTreasures.length === 0) {
        routeItems.innerHTML = `
            <div class="route-empty">
                <p>尚未新增藏寶圖</p>
                <p class="hint">從下方選擇藏寶圖後點擊 + 加入</p>
            </div>
        `;
        return;
    }

    routeItems.innerHTML = sortedTreasures.map((treasure, index) => {
        const mapName = getMapName(treasure.mapId);
        const isActive = selectedRouteItem === treasure.id;
        const isCompleted = treasure.completed;

        return `
            <div class="route-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}"
                 data-treasure-id="${treasure.id}"
                 onclick="selectRouteItem('${treasure.id}')">
                <div class="route-item-order">
                    <div class="route-item-number"><span>${index + 1}</span></div>
                </div>
                <div class="route-item-info">
                    <div class="route-item-map">${escapeHtml(mapName)}</div>
                    <div class="route-item-details">
                        <span class="route-item-coords">X: ${treasure.coords.x.toFixed(1)} Y: ${treasure.coords.y.toFixed(1)}</span>
                        <span class="route-item-adder">${escapeHtml(treasure.addedByNickname || '未知')}</span>
                    </div>
                </div>
                <div class="route-item-actions">
                    <div class="route-order-btns">
                        <button onclick="event.stopPropagation(); moveRouteItem('${treasure.id}', 'up')" title="上移">▲</button>
                        <button onclick="event.stopPropagation(); moveRouteItem('${treasure.id}', 'down')" title="下移">▼</button>
                    </div>
                    <button class="btn-complete" onclick="event.stopPropagation(); toggleRouteComplete('${treasure.id}')" title="${isCompleted ? '標記未完成' : '標記完成'}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                    </button>
                    <button onclick="event.stopPropagation(); copyTreasureCoords('${treasure.coords.x.toFixed(1)}', '${treasure.coords.y.toFixed(1)}')" title="複製座標">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                        </svg>
                    </button>
                    <button class="btn-remove" onclick="event.stopPropagation(); removeTreasureFromParty('${treasure.id}')" title="移除">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// 更新地圖預覽 UI
function updateMapPreviewUI() {
    const mapSelect = document.getElementById('preview-map-select');
    const mapImage = document.getElementById('preview-map-image');
    const markersContainer = document.getElementById('preview-map-markers');
    const previewInfo = document.getElementById('preview-info');

    if (!mapSelect) return;

    // 收集所有地圖
    const mapIds = [...new Set(partyTreasures.map(t => t.mapId))];

    // 更新下拉選單
    const currentValue = mapSelect.value;
    mapSelect.innerHTML = '<option value="">全部地圖</option>' +
        mapIds.map(id => `<option value="${id}">${getMapName(id)}</option>`).join('');

    // 恢復選擇或選擇第一個
    if (currentValue && mapIds.includes(parseInt(currentValue))) {
        mapSelect.value = currentValue;
    } else if (mapIds.length > 0) {
        mapSelect.value = mapIds[0];
    }

    // 顯示地圖
    const selectedMapId = mapSelect.value ? parseInt(mapSelect.value) : (mapIds[0] || null);

    if (selectedMapId && MAP_DATA[selectedMapId]) {
        mapImage.src = MAP_DATA[selectedMapId].image;

        // 篩選該地圖的藏寶圖
        const treasuresOnMap = partyTreasures
            .filter(t => t.mapId === selectedMapId)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        // 繪製標記
        markersContainer.innerHTML = treasuresOnMap.map((treasure, idx) => {
            const pos = coordsToPercent(treasure.coords, treasure.mapId);
            const globalIndex = partyTreasures.sort((a, b) => (a.order || 0) - (b.order || 0)).findIndex(t => t.id === treasure.id) + 1;
            const isActive = selectedRouteItem === treasure.id;
            const isCompleted = treasure.completed;

            return `
                <div class="preview-marker ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}"
                     style="left: ${pos.x}%; top: ${pos.y}%;"
                     onclick="selectRouteItem('${treasure.id}')"
                     title="${getMapName(treasure.mapId)} - X: ${treasure.coords.x.toFixed(1)} Y: ${treasure.coords.y.toFixed(1)}">
                    ${globalIndex}
                </div>
            `;
        }).join('');
    } else {
        mapImage.src = '';
        markersContainer.innerHTML = '';
    }

    // 更新資訊
    if (selectedRouteItem) {
        const treasure = partyTreasures.find(t => t.id === selectedRouteItem);
        if (treasure) {
            previewInfo.innerHTML = `
                <strong>${getMapName(treasure.mapId)}</strong><br>
                座標: X: ${treasure.coords.x.toFixed(1)} Y: ${treasure.coords.y.toFixed(1)}<br>
                新增者: ${escapeHtml(treasure.addedByNickname || '未知')}
            `;
        }
    } else {
        previewInfo.innerHTML = '<p>選擇藏寶圖查看詳情</p>';
    }
}

// 選擇路線項目
function selectRouteItem(treasureId) {
    selectedRouteItem = treasureId;
    updateRouteListUI();
    updateMapPreviewUI();

    // 如果該藏寶圖在不同地圖，切換地圖顯示
    const treasure = partyTreasures.find(t => t.id === treasureId);
    if (treasure) {
        const mapSelect = document.getElementById('preview-map-select');
        if (mapSelect && mapSelect.value != treasure.mapId) {
            mapSelect.value = treasure.mapId;
            updateMapPreviewUI();
        }
    }
}

// 移動路線項目
async function moveRouteItem(treasureId, direction) {
    const sortedTreasures = [...partyTreasures].sort((a, b) => (a.order || 0) - (b.order || 0));
    const currentIndex = sortedTreasures.findIndex(t => t.id === treasureId);

    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= sortedTreasures.length) return;

    const current = sortedTreasures[currentIndex];
    const target = sortedTreasures[targetIndex];

    try {
        await PartyService.swapTreasureOrder(current.id, target.id, current.order, target.order);
    } catch (error) {
        console.error('移動失敗:', error);
    }
}

// 切換完成狀態
async function toggleRouteComplete(treasureId) {
    try {
        await PartyService.toggleTreasureComplete(treasureId);
    } catch (error) {
        console.error('切換狀態失敗:', error);
    }
}

// 複製藏寶圖座標
function copyTreasureCoords(x, y) {
    const posCmd = `/pos ${x} ${y}`;
    navigator.clipboard.writeText(posCmd).then(() => {
        // 可以加個提示
        console.log('已複製座標:', posCmd);
    });
}

// 清除已完成的藏寶圖
async function clearCompletedTreasures() {
    const completed = partyTreasures.filter(t => t.completed);
    if (completed.length === 0) {
        alert('沒有已完成的藏寶圖');
        return;
    }

    if (!confirm(`確定要清除 ${completed.length} 個已完成的藏寶圖嗎？`)) return;

    try {
        await PartyService.clearCompletedTreasures();
    } catch (error) {
        alert('清除失敗: ' + error.message);
    }
}

// 更新連線狀態 UI
function updateConnectionUI(connected) {
    const indicator = document.getElementById('connection-indicator');
    const modalStatus = document.getElementById('modal-connection-status');
    const modalText = document.getElementById('modal-connection-text');
    const panelStatus = document.getElementById('panel-connection-status');

    const statusClass = `connection-status ${connected ? 'connected' : 'disconnected'}`;
    const statusText = connected ? '已連線' : '離線';

    if (indicator) {
        indicator.className = statusClass;
    }

    if (modalStatus) {
        modalStatus.className = statusClass;
    }

    if (modalText) {
        modalText.textContent = statusText;
    }

    if (panelStatus) {
        panelStatus.className = statusClass;
        panelStatus.querySelector('span:last-child').textContent = statusText;
    }
}

// 更新隊伍狀態 Modal
function updatePartyStatusModal() {
    const code = PartyService.getCurrentPartyCode();
    if (code) {
        document.getElementById('status-party-code').textContent = code;
    }
    updateMembersUI();
    updatePartyTreasuresUI();
}

// 更新藏寶圖卡片的隊伍狀態
function updateTreasureCardsPartyStatus() {
    const inParty = PartyService.isInParty();

    document.querySelectorAll('.treasure-map').forEach(card => {
        const treasureId = card.dataset.treasureId;
        let btn = card.querySelector('.add-to-party-btn');

        if (inParty) {
            // 如果按鈕不存在，創建它
            if (!btn) {
                btn = document.createElement('button');
                btn.className = 'add-to-party-btn';
                btn.title = '加入隊伍清單';
                btn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                `;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    addTreasureToParty(treasureId);
                });
                card.appendChild(btn);
            }
            // 按鈕永遠可用 (允許重複新增)
        } else {
            // 如果不在隊伍中，移除按鈕
            if (btn) {
                btn.remove();
            }
        }
    });
}

// 新增藏寶圖到隊伍
async function addTreasureToParty(treasureId) {
    // 找到對應的藏寶圖資料
    const treasure = TREASURES.find(t => t.id === treasureId);
    if (!treasure) {
        console.error('找不到藏寶圖:', treasureId);
        return;
    }

    try {
        await PartyService.addTreasure(treasure);
    } catch (error) {
        alert('新增失敗: ' + error.message);
    }
}

// 從隊伍移除藏寶圖
async function removeTreasureFromParty(treasureId) {
    try {
        await PartyService.removeTreasure(treasureId);
    } catch (error) {
        alert('移除失敗: ' + error.message);
    }
}

// 複製到剪貼簿
function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        btn.classList.add('copied');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> 已複製';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = originalText;
        }, 2000);
    }).catch(err => {
        console.error('複製失敗:', err);
    });
}

// HTML 轉義
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 頁面載入時初始化
document.addEventListener('DOMContentLoaded', init);
