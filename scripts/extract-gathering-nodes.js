/**
 * FFXIV 採集點資料提取腳本
 *
 * 從 datamining CSV 檔案提取採集點資料，生成 GATHERING_NODES_BY_LEVEL 格式的資料
 *
 * 使用方式:
 * 1. 下載以下 CSV 檔案到 data/datamining/ 目錄:
 *    - ExportedGatheringPoint.csv (座標)
 *    - GatheringPoint.csv (區域連結)
 *    - GatheringPointBase.csv (等級)
 *    - TerritoryType.csv (區域對照)
 *
 *    CSV 來源: https://github.com/xivapi/ffxiv-datamining/tree/master/csv
 *
 * 2. 執行此腳本:
 *    node scripts/extract-gathering-nodes.js
 *
 * 3. 將輸出的資料複製到 js/data.js 中的 GATHERING_NODES_BY_LEVEL
 */

const fs = require('fs');
const path = require('path');

// CSV 檔案路徑
const DATA_DIR = path.join(__dirname, '..', 'data', 'datamining');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'gathering-nodes-output.js');

// 目標採集等級
const TARGET_LEVELS = [60, 70, 80, 90, 100];

// GatheringType 對照 (0-3 為一般採集點，4-5 為特殊)
const GATHERING_TYPE_MAP = {
    0: { job: 'miner', nodeType: '礦脈' },     // Mining
    1: { job: 'miner', nodeType: '石場' },     // Quarrying
    2: { job: 'botanist', nodeType: '良材' },  // Logging
    3: { job: 'botanist', nodeType: '草叢' }   // Harvesting
};

/**
 * 解析 CSV 檔案
 */
function parseCSV(filename) {
    const filepath = path.join(DATA_DIR, filename);

    if (!fs.existsSync(filepath)) {
        console.error(`檔案不存在: ${filepath}`);
        console.log(`請從 https://github.com/xivapi/ffxiv-datamining/tree/master/csv 下載`);
        return null;
    }

    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n');

    // 第一行通常是欄位索引，第二行是欄位類型，第三行是欄位名稱
    // 第四行開始是資料
    const headers = lines[1].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = [];

    for (let i = 3; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // 處理 CSV 中的逗號（被引號包圍的欄位）
        const values = parseCSVLine(line);
        const row = { key: values[0] };

        for (let j = 1; j < headers.length && j < values.length; j++) {
            row[headers[j]] = values[j];
        }

        rows.push(row);
    }

    return rows;
}

/**
 * 解析單行 CSV（處理引號內的逗號）
 */
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim().replace(/"/g, ''));
            current = '';
        } else {
            current += char;
        }
    }

    values.push(current.trim().replace(/"/g, ''));
    return values;
}

/**
 * 將遊戲內部座標轉換為地圖座標
 * 公式: ((rawCoord / 1024) + 1) * (sizeFactor / 100) + 1
 */
function convertCoords(rawX, rawY, sizeFactor) {
    const scale = sizeFactor / 100;
    const x = ((parseFloat(rawX) / 1024) + 1) * scale + 1;
    const y = ((parseFloat(rawY) / 1024) + 1) * scale + 1;
    return {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10
    };
}

/**
 * 主要提取邏輯
 */
function extractGatheringNodes() {
    console.log('開始提取採集點資料...\n');

    // 1. 讀取 CSV 檔案
    console.log('讀取 CSV 檔案...');
    const gatheringPointBase = parseCSV('GatheringPointBase.csv');
    const gatheringPoint = parseCSV('GatheringPoint.csv');
    const exportedGatheringPoint = parseCSV('ExportedGatheringPoint.csv');
    const territoryType = parseCSV('TerritoryType.csv');

    if (!gatheringPointBase || !gatheringPoint || !exportedGatheringPoint || !territoryType) {
        console.error('\n缺少必要的 CSV 檔案，請確保以下檔案存在於 data/datamining/ 目錄:');
        console.error('- ExportedGatheringPoint.csv');
        console.error('- GatheringPoint.csv');
        console.error('- GatheringPointBase.csv');
        console.error('- TerritoryType.csv');
        return;
    }

    // 2. 建立查找表
    console.log('建立查找表...');

    // ExportedGatheringPoint 查找表 (key -> 座標資料)
    const exportedMap = new Map();
    exportedGatheringPoint.forEach(row => {
        exportedMap.set(row.key, {
            x: row['X'],
            y: row['Y'],
            radius: row['Radius'],
            gatheringType: parseInt(row['GatheringType'] || '0')
        });
    });

    // GatheringPointBase 查找表 (key -> 等級和類型)
    const baseMap = new Map();
    gatheringPointBase.forEach(row => {
        baseMap.set(row.key, {
            gatheringType: parseInt(row['GatheringType'] || '0'),
            gatheringLevel: parseInt(row['GatheringLevel'] || '0'),
            items: [
                row['Item[0]'], row['Item[1]'], row['Item[2]'], row['Item[3]'],
                row['Item[4]'], row['Item[5]'], row['Item[6]'], row['Item[7]']
            ].filter(item => item && item !== '0')
        });
    });

    // TerritoryType 查找表 (key -> PlaceName)
    const territoryMap = new Map();
    territoryType.forEach(row => {
        territoryMap.set(row.key, {
            placeName: row['PlaceName'],
            map: row['Map'],
            sizeFactor: parseInt(row['Map{SizeFactor}'] || '100')
        });
    });

    // 3. 按等級提取採集點
    console.log('提取採集點資料...\n');

    const result = {};
    TARGET_LEVELS.forEach(level => {
        result[level] = [];
    });

    // 用於去重
    const seenNodes = new Set();

    gatheringPoint.forEach(point => {
        const baseId = point['GatheringPointBase'];
        const base = baseMap.get(baseId);

        if (!base) return;
        if (!TARGET_LEVELS.includes(base.gatheringLevel)) return;
        if (base.gatheringType > 3) return; // 只處理 0-3 類型

        const exported = exportedMap.get(point.key);
        if (!exported) return;

        const territoryId = point['TerritoryType'];
        const territory = territoryMap.get(territoryId);
        const sizeFactor = territory?.sizeFactor || 100;

        // 轉換座標
        const coords = convertCoords(exported.x, exported.y, sizeFactor);

        // 使用 PlaceName (區域名稱 ID)
        const zoneId = parseInt(point['PlaceName'] || territory?.placeName || '0');
        if (zoneId === 0) return;

        // 去重 (同等級、同區域、同類型、相近座標)
        const nodeKey = `${base.gatheringLevel}-${zoneId}-${base.gatheringType}-${Math.floor(coords.x)}-${Math.floor(coords.y)}`;
        if (seenNodes.has(nodeKey)) return;
        seenNodes.add(nodeKey);

        result[base.gatheringLevel].push({
            gatheringType: base.gatheringType,
            zoneId: zoneId,
            coords: coords
        });
    });

    // 4. 排序並輸出
    console.log('各等級採集點數量:');
    TARGET_LEVELS.forEach(level => {
        // 按區域和類型排序
        result[level].sort((a, b) => {
            if (a.zoneId !== b.zoneId) return a.zoneId - b.zoneId;
            if (a.gatheringType !== b.gatheringType) return a.gatheringType - b.gatheringType;
            return a.coords.x - b.coords.x;
        });

        console.log(`  Lv.${level}: ${result[level].length} 個採集點`);
    });

    // 5. 生成輸出
    let output = `// 採集點資料 - 按採集等級分類
// 由 extract-gathering-nodes.js 自動生成
// 生成時間: ${new Date().toISOString()}

const GATHERING_NODES_BY_LEVEL = {
`;

    TARGET_LEVELS.forEach((level, idx) => {
        output += `    // Lv.${level}\n`;
        output += `    ${level}: [\n`;

        result[level].forEach((node, i) => {
            const typeInfo = GATHERING_TYPE_MAP[node.gatheringType];
            const comment = typeInfo ? `// ${typeInfo.nodeType}` : '';
            output += `        { gatheringType: ${node.gatheringType}, zoneId: ${node.zoneId}, coords: { x: ${node.coords.x}, y: ${node.coords.y} } }${i < result[level].length - 1 ? ',' : ''} ${comment}\n`;
        });

        output += `    ]${idx < TARGET_LEVELS.length - 1 ? ',' : ''}\n`;
        if (idx < TARGET_LEVELS.length - 1) output += '\n';
    });

    output += '};\n';

    // 寫入輸出檔案
    fs.writeFileSync(OUTPUT_FILE, output, 'utf8');
    console.log(`\n輸出已寫入: ${OUTPUT_FILE}`);
    console.log('\n請將內容複製到 js/data.js 中');
}

// 執行
extractGatheringNodes();
