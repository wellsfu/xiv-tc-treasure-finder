// 狀態管理
let selectedGrade = null;
let selectedMapId = null;
let selectedTreasure = null;

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
function init() {
    renderGradeButtons();
    bindEvents();
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

// 渲染地圖按鈕
function renderMapButtons() {
    mapGrid.innerHTML = '';

    const maps = getMapsForGrade(selectedGrade);

    maps.forEach(map => {
        const btn = document.createElement('button');
        btn.className = 'map-btn';
        btn.dataset.mapId = map.id;

        btn.innerHTML = `
            <div class="map-btn-image">
                <img src="${map.image}" alt="${map.name}" loading="lazy">
            </div>
            <div class="map-btn-info">
                <span class="map-btn-name">${map.name}</span>
                <span class="map-btn-count">${map.count} 個藏寶點</span>
            </div>
        `;

        btn.addEventListener('click', () => selectMap(map.id));
        mapGrid.appendChild(btn);
    });
}

// 選擇地圖
function selectMap(mapId) {
    selectedMapId = mapId;
    selectedMapName.textContent = getMapName(mapId);

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

    // 滾動到頂部
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

// 頁面載入時初始化
document.addEventListener('DOMContentLoaded', init);
