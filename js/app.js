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
const detailPanel = document.getElementById('detail-panel');

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

// 渲染藏寶點
function renderTreasures() {
    const treasures = getTreasuresForGradeAndMap(selectedGrade, selectedMapId);
    treasureCount.textContent = treasures.length;

    // 清除舊的標記
    mapMarkers.innerHTML = '';
    puzzleGrid.innerHTML = '';
    selectedMarker.classList.add('hidden');
    detailPanel.classList.add('hidden');

    treasures.forEach((treasure, index) => {
        // 添加地圖標記
        const pos = coordsToPercent(treasure.coords, treasure.map);
        const marker = document.createElement('div');
        marker.className = 'treasure-marker';
        marker.style.left = `${pos.x}%`;
        marker.style.top = `${pos.y}%`;
        marker.dataset.treasureId = treasure.id;
        marker.dataset.index = index + 1;
        marker.innerHTML = `<span class="marker-number">${index + 1}</span>`;
        marker.addEventListener('click', () => selectTreasure(treasure, index));
        mapMarkers.appendChild(marker);

        // 添加謎題卡片
        const card = document.createElement('div');
        card.className = 'puzzle-card';
        card.dataset.treasureId = treasure.id;

        card.innerHTML = `
            <div class="puzzle-number">${index + 1}</div>
            <div class="puzzle-preview">
                <img src="${MAP_DATA[treasure.map]?.image}" alt="預覽">
                <div class="puzzle-marker" style="left: ${pos.x}%; top: ${pos.y}%;"></div>
            </div>
            <div class="puzzle-coords">X: ${treasure.coords.x.toFixed(1)}, Y: ${treasure.coords.y.toFixed(1)}</div>
        `;

        card.addEventListener('click', () => selectTreasure(treasure, index));
        puzzleGrid.appendChild(card);
    });
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

    // 更新標記高亮
    document.querySelectorAll('.treasure-marker').forEach(m => {
        m.classList.toggle('active', m.dataset.treasureId === treasure.id);
    });

    // 更新卡片高亮
    document.querySelectorAll('.puzzle-card').forEach(c => {
        c.classList.toggle('active', c.dataset.treasureId === treasure.id);
    });

    // 顯示選中標記
    const pos = coordsToPercent(treasure.coords, treasure.map);
    selectedMarker.style.left = `${pos.x}%`;
    selectedMarker.style.top = `${pos.y}%`;
    selectedMarker.classList.remove('hidden');

    // 顯示詳情面板
    showDetailPanel(treasure);

    // 滾動到選中的卡片
    const activeCard = document.querySelector(`.puzzle-card[data-treasure-id="${treasure.id}"]`);
    if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// 顯示詳情面板
function showDetailPanel(treasure) {
    const map = MAP_DATA[treasure.map];
    const pos = coordsToPercent(treasure.coords, treasure.map);

    document.getElementById('detail-map-image').src = map.image;
    document.getElementById('detail-coords').textContent = `X: ${treasure.coords.x.toFixed(1)}, Y: ${treasure.coords.y.toFixed(1)}`;
    document.getElementById('detail-map-name').textContent = getMapName(treasure.map);
    document.getElementById('detail-item').textContent = getItemName(treasure.item);
    document.getElementById('detail-party').textContent = treasure.partySize === 8 ? '8人組隊' : '單人';

    const detailMarker = document.getElementById('detail-marker');
    detailMarker.style.left = `${pos.x}%`;
    detailMarker.style.top = `${pos.y}%`;

    detailPanel.classList.remove('hidden');
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
