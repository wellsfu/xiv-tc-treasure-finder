// 狀態管理
let selectedMapId = null;
let selectedItemId = null;
let selectedTreasure = null;

// DOM 元素
const mapSelect = document.getElementById('map-select');
const itemSelect = document.getElementById('item-select');
const resetBtn = document.getElementById('reset-btn');
const mapContainer = document.getElementById('map-container');
const mapImage = document.getElementById('map-image');
const mapMarkers = document.getElementById('map-markers');
const selectedMarker = document.getElementById('selected-marker');
const treasureItems = document.getElementById('treasure-items');
const resultPanel = document.getElementById('result-panel');
const findAnotherBtn = document.getElementById('find-another-btn');

// 初始化
function init() {
    populateMapSelect();
    populateItemSelect();
    bindEvents();
}

// 填充地圖選擇器
function populateMapSelect() {
    const mapIds = [...new Set(TREASURES.map(t => t.map))].sort((a, b) => a - b);

    mapIds.forEach(mapId => {
        const option = document.createElement('option');
        option.value = mapId;
        option.textContent = getMapName(mapId);
        mapSelect.appendChild(option);
    });
}

// 填充物品選擇器
function populateItemSelect() {
    const itemIds = [...new Set(TREASURES.map(t => t.item))].sort((a, b) => a - b);

    itemIds.forEach(itemId => {
        const option = document.createElement('option');
        option.value = itemId;
        option.textContent = getItemName(itemId);
        itemSelect.appendChild(option);
    });
}

// 綁定事件
function bindEvents() {
    mapSelect.addEventListener('change', onMapChange);
    itemSelect.addEventListener('change', onItemChange);
    resetBtn.addEventListener('click', reset);
    findAnotherBtn.addEventListener('click', () => {
        resultPanel.classList.add('hidden');
        selectedTreasure = null;
    });
}

// 地圖變更
function onMapChange() {
    selectedMapId = mapSelect.value ? parseInt(mapSelect.value) : null;
    updateDisplay();
}

// 物品變更
function onItemChange() {
    selectedItemId = itemSelect.value ? parseInt(itemSelect.value) : null;
    updateDisplay();
}

// 更新顯示
function updateDisplay() {
    if (selectedMapId) {
        showMap(selectedMapId);
        const treasures = getFilteredTreasures();
        showMarkers(treasures);
        showTreasureList(treasures);
    } else {
        hideMap();
        clearMarkers();
        showNoSelection();
    }
}

// 獲取過濾後的藏寶圖
function getFilteredTreasures() {
    return TREASURES.filter(t => {
        const mapMatch = !selectedMapId || t.map === selectedMapId;
        const itemMatch = !selectedItemId || t.item === selectedItemId;
        return mapMatch && itemMatch;
    });
}

// 顯示地圖
function showMap(mapId) {
    const map = MAP_DATA[mapId];
    if (map) {
        mapImage.src = map.image;
        mapImage.classList.remove('hidden');
        document.querySelector('.map-placeholder')?.classList.add('hidden');
    }
}

// 隱藏地圖
function hideMap() {
    mapImage.classList.add('hidden');
    const placeholder = document.querySelector('.map-placeholder');
    if (placeholder) {
        placeholder.classList.remove('hidden');
    }
}

// 遊戲座標轉換為地圖百分比位置
function coordsToPercent(coords, mapId) {
    // FFXIV 地圖座標系統：
    // 遊戲座標範圍通常是 1-42 (標準地圖)
    // 需要轉換為 0-100% 的百分比位置
    const map = MAP_DATA[mapId];
    const sizeFactor = map?.size_factor || 100;

    // 計算百分比位置
    // 座標 1 對應地圖邊緣，座標 42 對應另一邊
    // 調整公式以匹配遊戲內座標
    const scale = sizeFactor / 100;
    const x = ((coords.x - 1) / (41 * scale)) * 100;
    const y = ((coords.y - 1) / (41 * scale)) * 100;

    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

// 顯示標記
function showMarkers(treasures) {
    clearMarkers();

    treasures.forEach(treasure => {
        const pos = coordsToPercent(treasure.coords, treasure.map);

        const marker = document.createElement('div');
        marker.className = 'treasure-marker';
        marker.style.left = `${pos.x}%`;
        marker.style.top = `${pos.y}%`;
        marker.innerHTML = '<img src="https://xivapi.com/i/060000/060354_hr1.png" alt="寶藏">';
        marker.dataset.treasureId = treasure.id;

        marker.addEventListener('click', () => selectTreasure(treasure));

        mapMarkers.appendChild(marker);
    });
}

// 清除標記
function clearMarkers() {
    mapMarkers.innerHTML = '';
    selectedMarker.classList.add('hidden');
}

// 顯示藏寶圖列表
function showTreasureList(treasures) {
    treasureItems.innerHTML = '';

    if (treasures.length === 0) {
        treasureItems.innerHTML = '<p class="no-selection">此地圖沒有符合條件的藏寶點</p>';
        return;
    }

    treasures.forEach(treasure => {
        const item = document.createElement('div');
        item.className = 'treasure-item';
        item.dataset.treasureId = treasure.id;

        item.innerHTML = `
            <div class="treasure-item-icon">
                <img src="https://xivapi.com/i/060000/060354_hr1.png" alt="寶藏">
            </div>
            <div class="treasure-item-info">
                <div class="treasure-item-coords">X: ${treasure.coords.x.toFixed(1)}, Y: ${treasure.coords.y.toFixed(1)}</div>
                <div class="treasure-item-meta">
                    <span>${getItemName(treasure.item)}</span>
                    <span class="party-size">
                        ${treasure.partySize === 8 ? '8人' : '單人'}
                    </span>
                </div>
            </div>
        `;

        item.addEventListener('click', () => selectTreasure(treasure));

        treasureItems.appendChild(item);
    });
}

// 顯示無選擇狀態
function showNoSelection() {
    treasureItems.innerHTML = '<p class="no-selection">選擇地圖後將顯示藏寶點列表</p>';
}

// 選擇藏寶圖
function selectTreasure(treasure) {
    selectedTreasure = treasure;

    // 更新列表高亮
    document.querySelectorAll('.treasure-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.treasureId === treasure.id);
    });

    // 更新地圖標記
    document.querySelectorAll('.treasure-marker').forEach(marker => {
        if (marker.dataset.treasureId === treasure.id) {
            marker.style.transform = 'translate(-50%, -50%) scale(1.5)';
        } else {
            marker.style.transform = 'translate(-50%, -50%)';
        }
    });

    // 顯示選中標記
    const pos = coordsToPercent(treasure.coords, treasure.map);
    selectedMarker.style.left = `${pos.x}%`;
    selectedMarker.style.top = `${pos.y}%`;
    selectedMarker.classList.remove('hidden');

    // 顯示結果面板
    showResultPanel(treasure);
}

// 顯示結果面板
function showResultPanel(treasure) {
    const map = MAP_DATA[treasure.map];

    document.getElementById('result-map-image').src = map.image;
    document.getElementById('result-map-name').textContent = getMapName(treasure.map);
    document.getElementById('result-coords').textContent = `X: ${treasure.coords.x.toFixed(1)}, Y: ${treasure.coords.y.toFixed(1)}`;
    document.getElementById('result-item').textContent = getItemName(treasure.item);
    document.getElementById('result-party').textContent = treasure.partySize === 8 ? '8人組隊' : '單人';

    // 設置結果地圖上的標記位置
    const pos = coordsToPercent(treasure.coords, treasure.map);
    const resultMarker = document.getElementById('result-marker');
    resultMarker.style.left = `${pos.x}%`;
    resultMarker.style.top = `${pos.y}%`;

    resultPanel.classList.remove('hidden');

    // 滾動到結果面板
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 重置
function reset() {
    selectedMapId = null;
    selectedItemId = null;
    selectedTreasure = null;

    mapSelect.value = '';
    itemSelect.value = '';

    hideMap();
    clearMarkers();
    showNoSelection();
    resultPanel.classList.add('hidden');
}

// 頁面載入時初始化
document.addEventListener('DOMContentLoaded', init);
