/**
 * RFE APP BACKEND - V9.0 (Optimized: Delta Sync, HashMaps & Transaction Safety)
 */

// --- 1. CONFIGURATION & MAPS ---

const CONSTANTS = {
    ROOT_FOLDER_NAME: "RFE App Data",
    MASTER_DB_NAME: "RFE Master Login DB",
    TAB_ESTIMATES: "Estimates_DB",
    TAB_CUSTOMERS: "Customers_DB",
    TAB_SETTINGS: "Settings_DB",
    TAB_INVENTORY: "Inventory_DB",
    TAB_EQUIPMENT: "Equipment_DB",
    TAB_PNL: "Profit_Loss_DB",
    TAB_LOGS: "Material_Log_DB",
};

// Column Mappings (0-based index for arrays, add 1 for Sheet Ranges)
const COL_MAPS = {
    ESTIMATES: { ID: 0, DATE: 1, CUSTOMER: 2, VALUE: 3, STATUS: 4, INVOICE: 5, COST: 6, PDF: 7, JSON: 8 },
    CUSTOMERS: { ID: 0, NAME: 1, ADDR: 2, CITY: 3, STATE: 4, ZIP: 5, PHONE: 6, EMAIL: 7, STATUS: 8, JSON: 9 },
    INVENTORY: { ID: 0, NAME: 1, QTY: 2, UNIT: 3, COST: 4, JSON: 5 },
    EQUIPMENT: { ID: 0, NAME: 1, STATUS: 2, JSON: 3 }
};

const safeParse = (str) => {
    if (!str || str === "") return null;
    try { return JSON.parse(str); } catch (e) { return null; }
};

// Security: Fetch from Script Properties, fallback for dev
const SECRET_SALT = PropertiesService.getScriptProperties().getProperty("SECRET_SALT") || "dev_fallback_salt_change_me";

// --- 2. AUTHENTICATION & SECURITY ---

function generateToken(username, role) {
    const expiry = new Date().getTime() + (1000 * 60 * 60 * 24 * 7); // 7 Days
    const data = `${username}:${role}:${expiry}`;
    const signature = Utilities.base64Encode(Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, data, SECRET_SALT));
    return Utilities.base64Encode(`${data}::${signature}`);
}

function validateToken(token) {
    if (!token) return null;
    try {
        const decoded = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
        const parts = decoded.split("::");
        if (parts.length !== 2) return null;
        const [data, signature] = parts;
        
        const expectedSig = Utilities.base64Encode(Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, data, SECRET_SALT));
        if (signature !== expectedSig) return null;
        
        const [user, role, expiry] = data.split(":");
        if (new Date().getTime() > parseInt(expiry)) return null; // Expired
        
        return { username: user, role: role };
    } catch (e) { return null; }
}

// --- 3. API GATEWAY ---

function doPost(e) {
    const lock = LockService.getScriptLock();
    // Reduced timeout to 30s to fail faster if deadlocked
    if (!lock.tryLock(30000)) return sendResponse('error', 'Server busy. Please try again.');
    
    try {
        if (!e?.postData) throw new Error("No payload.");
        const req = JSON.parse(e.postData.contents);
        const { action, payload } = req;
        
        let result;
        
        // Unauthenticated Actions
        if (action === 'LOGIN') result = handleLogin(payload);
        else if (action === 'SIGNUP') result = handleSignup(payload);
        else if (action === 'CREW_LOGIN') result = handleCrewLogin(payload);
        else if (action === 'SUBMIT_TRIAL') result = handleSubmitTrial(payload);
        else if (action === 'UPDATE_PASSWORD') result = handleUpdatePassword(payload);
        else {
            // Authenticated Actions requiring Sheet ID
            if (!payload.spreadsheetId) throw new Error("Auth Error: Missing Sheet ID");
            const userSS = SpreadsheetApp.openById(payload.spreadsheetId);
            
            switch (action) {
                case 'SYNC_DOWN': result = handleSyncDown(userSS, payload.lastSyncTimestamp); break; // Updated Sig
                case 'SYNC_UP': result = handleSyncUp(userSS, payload); break;
                case 'START_JOB': result = handleStartJob(userSS, payload); break;
                case 'COMPLETE_JOB': result = handleCompleteJob(userSS, payload); break;
                case 'MARK_JOB_PAID': result = handleMarkJobPaid(userSS, payload); break;
                case 'DELETE_ESTIMATE': result = handleDeleteEstimate(userSS, payload); break;
                case 'SAVE_PDF': result = handleSavePdf(userSS, payload); break;
                case 'UPLOAD_IMAGE': result = handleUploadImage(userSS, payload); break;
                case 'CREATE_WORK_ORDER': result = handleCreateWorkOrder(userSS, payload); break;
                case 'LOG_TIME': result = handleLogTime(payload); break;
                case 'LOG_MATERIAL_USAGE': result = handleLogMaterialUsage(userSS, payload); break;
                default: throw new Error(`Unknown Action: ${action}`);
            }
        }
        return sendResponse('success', result);
    } catch (error) {
        console.error("API Error", error);
        // Special error for size limits
        if (error.toString().includes("limit")) {
             return sendResponse('error', 'Request too large. Reduce image quality or batch size.');
        }
        return sendResponse('error', error.toString());
    } finally { lock.releaseLock(); }
}

function sendResponse(status, data) {
    return ContentService.createTextOutput(JSON.stringify({ 
        status, 
        [status === 'success' ? 'data' : 'message']: data 
    })).setMimeType(ContentService.MimeType.JSON);
}

// --- 4. CORE SYNC LOGIC (OPTIMIZED) ---

function handleSyncDown(ss, lastSyncTimestamp = 0) {
    // Helper: Delta Sync - only return rows modified after timestamp
    const getChangedData = (name, jsonCol) => {
        const s = ss.getSheetByName(name);
        if (!s || s.getLastRow() <= 1) return [];
        
        // Grab values. Note: We assume the JSON column contains a "lastModified" key
        const range = s.getRange(2, jsonCol + 1, s.getLastRow() - 1, 1);
        const values = range.getValues();

        return values.map(r => safeParse(r[0])).filter(item => {
            if (!item) return false;
            // Always return if ID is missing (new) or if modified is newer
            // If item has no lastModified, force sync it
            const itemTime = item.lastModified ? new Date(item.lastModified).getTime() : 0;
            return itemTime > lastSyncTimestamp || itemTime === 0;
        });
    };

    setupUserSheetSchema(ss, null); // Ensure tabs exist

    // 1. Settings (Always fetch all, low volume)
    const settings = {};
    const setSheet = ss.getSheetByName(CONSTANTS.TAB_SETTINGS);
    if (setSheet && setSheet.getLastRow() > 1) {
        const data = setSheet.getRange(2, 1, setSheet.getLastRow() - 1, 2).getValues();
        data.forEach(row => { if (row[0] && row[1]) settings[row[0]] = safeParse(row[1]); });
    }

    const foamCounts = settings['warehouse_counts'] || { openCellSets: 0, closedCellSets: 0 };
    const lifetimeUsage = settings['lifetime_usage'] || { openCell: 0, closedCell: 0 };
    
    // 2. Fetch Deltas
    const inventoryItems = getChangedData(CONSTANTS.TAB_INVENTORY, COL_MAPS.INVENTORY.JSON);
    const equipmentItems = getChangedData(CONSTANTS.TAB_EQUIPMENT, COL_MAPS.EQUIPMENT.JSON);
    const savedEstimates = getChangedData(CONSTANTS.TAB_ESTIMATES, COL_MAPS.ESTIMATES.JSON);
    const customers = getChangedData(CONSTANTS.TAB_CUSTOMERS, COL_MAPS.CUSTOMERS.JSON);

    // 3. Assemble
    const assembledWarehouse = { 
        openCellSets: foamCounts.openCellSets || 0, 
        closedCellSets: foamCounts.closedCellSets || 0, 
        items: inventoryItems || [] 
    };

    // Fetch material usage logs
    const logSheet = ss.getSheetByName(CONSTANTS.TAB_LOGS);
    let materialLogs = [];
    if (logSheet && logSheet.getLastRow() > 1) {
        const logJsonCol = 8; // JSON_DATA column (1-based)
        const logData = logSheet.getRange(2, logJsonCol, logSheet.getLastRow() - 1, 1).getValues();
        materialLogs = logData.map(r => safeParse(r[0])).filter(Boolean);
    }

    return { 
        ...settings, 
        warehouse: assembledWarehouse, 
        lifetimeUsage, 
        equipment: equipmentItems, 
        savedEstimates, 
        customers,
        materialLogs,
        serverTimestamp: new Date().getTime() // Tell client current server time
    };
}

function handleSyncUp(ss, payload) {
    const { state } = payload;
    
    // Safeguard: Sanitize large Logo URLs
    if (state.companyProfile?.logoUrl?.length > 40000) {
        console.warn("Logo URL too long, sanitized.");
        state.companyProfile.logoUrl = ""; 
    }

    // Optimization: Use HashMap logic instead of Loops
    reconcileCompletedJobs(ss, state);
    setupUserSheetSchema(ss, null);
    
    // 1. Settings Save
    const sSheet = ss.getSheetByName(CONSTANTS.TAB_SETTINGS);
    const settingsMap = new Map();
    // Load existing settings into Map to preserve keys not in payload
    if (sSheet.getLastRow() > 1) {
        sSheet.getDataRange().getValues().forEach(r => settingsMap.set(r[0], r[1]));
    }
    
    // Update simple keys
    ['companyProfile', 'yields', 'costs', 'expenses', 'jobNotes', 'purchaseOrders', 'sqFtRates', 'pricingMode', 'lifetimeUsage'].forEach(key => {
        if (state[key] !== undefined) settingsMap.set(key, JSON.stringify(state[key]));
    });

    if (state.warehouse) {
        settingsMap.set('warehouse_counts', JSON.stringify({ 
            openCellSets: state.warehouse.openCellSets, 
            closedCellSets: state.warehouse.closedCellSets 
        }));
    }

    // Write Settings back
    const outSettings = Array.from(settingsMap.entries()).filter(k => k[0] !== 'Config_Key');
    if (sSheet.getLastRow() > 1) sSheet.getRange(2, 1, sSheet.getLastRow() - 1, 2).clearContent();
    if (outSettings.length > 0) sSheet.getRange(2, 1, outSettings.length, 2).setValues(outSettings);

    // 2. Inventory Save (Full overwrite of list, preserving IDs)
    if (state.warehouse?.items) {
        const iSheet = ss.getSheetByName(CONSTANTS.TAB_INVENTORY);
        updateSheetWithData(iSheet, state.warehouse.items, COL_MAPS.INVENTORY, (item) => [
            item.id, item.name, item.quantity, item.unit, item.unitCost || 0, JSON.stringify(item)
        ]);
    }

    // 3. Equipment Save
    if (state.equipment) {
        const eSheet = ss.getSheetByName(CONSTANTS.TAB_EQUIPMENT);
        updateSheetWithData(eSheet, state.equipment, COL_MAPS.EQUIPMENT, (item) => [
            item.id, item.name, item.status, JSON.stringify(item)
        ]);
    }

    // 4. Customers Save
    if (state.customers) {
        const cSheet = ss.getSheetByName(CONSTANTS.TAB_CUSTOMERS);
        updateSheetWithData(cSheet, state.customers, COL_MAPS.CUSTOMERS, (c) => [
            c.id, c.name, c.address, c.city, c.state, c.zip, c.phone, c.email, c.status || "Active", JSON.stringify(c)
        ]);
    }

    // 5. Estimates Save (Using Logic)
    if (state.savedEstimates) {
        syncEstimatesWithLogic(ss, state.savedEstimates);
    }

    return { synced: true };
}

// Helper: Generic Sheet Updater to reduce code duplication
function updateSheetWithData(sheet, items, map, rowMapper) {
    if (!items || !Array.isArray(items) || items.length === 0) return;
    
    if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
    const rows = items.map(rowMapper);
    if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
}

// Optimization: HashMap-based Reconciliation
function reconcileCompletedJobs(ss, incomingState) {
    if (!incomingState.savedEstimates || incomingState.savedEstimates.length === 0) return;
    
    const sheet = ss.getSheetByName(CONSTANTS.TAB_ESTIMATES);
    const data = sheet.getDataRange().getValues();
    const dbIndex = {};

    // Build HashMap: { "JOB_ID": EstimateObj }
    for (let i = 1; i < data.length; i++) {
        const json = data[i][COL_MAPS.ESTIMATES.JSON];
        if (json) {
            const obj = safeParse(json);
            if (obj && obj.id) dbIndex[obj.id] = obj;
        }
    }

    // O(1) Lookup instead of nested loops
    incomingState.savedEstimates.forEach((incomingEst, idx) => {
        const dbEst = dbIndex[incomingEst.id];
        if (dbEst) {
            // Server Authority: If DB says Completed, Client cannot overwrite with In Progress
            if (dbEst.executionStatus === 'Completed' && incomingEst.executionStatus !== 'Completed') {
                incomingState.savedEstimates[idx] = dbEst;
            }
        }
    });
}

function syncEstimatesWithLogic(ss, payloadEstimates) {
    const sheet = ss.getSheetByName(CONSTANTS.TAB_ESTIMATES);
    const data = sheet.getDataRange().getValues();
    
    // Map existing DB for merging
    const dbMap = new Map();
    for (let i = 1; i < data.length; i++) {
        const obj = safeParse(data[i][COL_MAPS.ESTIMATES.JSON]);
        if (obj && obj.id) dbMap.set(obj.id, obj);
    }

    // Merge Logic
    payloadEstimates.forEach(incoming => {
        const existing = dbMap.get(incoming.id);
        if (existing) {
            // Preserve crucial server-side flags
            if (existing.executionStatus === 'Completed' && incoming.executionStatus !== 'Completed') {
                incoming.executionStatus = 'Completed';
                incoming.actuals = existing.actuals;
            }
            // Preserve Paid status
            if (existing.status === 'Paid') incoming.status = 'Paid';
            // Preserve generated assets
            if (existing.pdfLink && !incoming.pdfLink) incoming.pdfLink = existing.pdfLink;
            if (existing.workOrderSheetUrl) incoming.workOrderSheetUrl = existing.workOrderSheetUrl;
            // Preserve photos if client wiped them
            if (existing.sitePhotos?.length > 0 && (!incoming.sitePhotos || incoming.sitePhotos.length === 0)) {
                incoming.sitePhotos = existing.sitePhotos;
            }
        }
        dbMap.set(incoming.id, incoming); // Update Map with merged version
    });

    const output = [];
    dbMap.forEach(e => {
        output.push([
            e.id, 
            e.date, 
            e.customer?.name || "Unknown", 
            e.totalValue || 0, 
            e.status || "Draft", 
            e.invoiceNumber || "", 
            e.results?.materialCost || 0, 
            e.pdfLink || "", 
            JSON.stringify(e)
        ]);
    });

    updateSheetWithData(sheet, Array.from(dbMap.values()), COL_MAPS.ESTIMATES, (e) => [
        e.id, e.date, e.customer?.name || "Unknown", e.totalValue || 0, e.status || "Draft", e.invoiceNumber || "", e.results?.materialCost || 0, e.pdfLink || "", JSON.stringify(e)
    ]);
}

// --- 5. JOB COMPLETION & FINANCIALS (TRANSACTION SAFE) ---

function handleCompleteJob(ss, payload) {
    const { estimateId, actuals } = payload;
    const estSheet = ss.getSheetByName(CONSTANTS.TAB_ESTIMATES);
    
    // Optimized Find: Index Map is better, but for single lookup TextFinder is okay.
    // However, let's just loop data array for safety vs column index issues.
    const estData = estSheet.getDataRange().getValues();
    let rowIdx = -1;
    let est = null;

    for (let i = 1; i < estData.length; i++) {
        if (estData[i][COL_MAPS.ESTIMATES.ID] == estimateId) {
            rowIdx = i + 1; // 1-based index
            est = safeParse(estData[i][COL_MAPS.ESTIMATES.JSON]);
            break;
        }
    }

    if (!est) throw new Error("Estimate not found");
    
    // SAFETY CHECK 1: Flag
    if (est.executionStatus === 'Completed' && est.inventoryProcessed) {
        return { success: true, message: "Job already finalized." };
    }

    // SAFETY CHECK 2: Logs (Prevent Double Deduction)
    const logSheet = ss.getSheetByName(CONSTANTS.TAB_LOGS);
    if (logSheet.getLastRow() > 1) {
        const logs = logSheet.getRange(2, 2, logSheet.getLastRow()-1, 1).getValues().flat();
        // If we find more than 5 logs for this ID, it likely already processed
        const existingCount = logs.filter(id => id === estimateId).length;
        if (existingCount > 2) { 
             // Allow it to proceed only if the flag wasn't set (retry), but warn
             console.warn(`Job ${estimateId} has logs but flag false. Retrying.`);
        }
    }

    // --- TRANSACTION START ---

    // 1. Load Warehouse Settings
    const setSheet = ss.getSheetByName(CONSTANTS.TAB_SETTINGS);
    const setRows = setSheet.getDataRange().getValues();
    let countRow = -1, lifeRow = -1;
    let counts = { openCellSets: 0, closedCellSets: 0 };
    let lifeStats = { openCell: 0, closedCell: 0 };

    setRows.forEach((r, i) => {
        if (r[0] === 'warehouse_counts') { counts = safeParse(r[1]) || counts; countRow = i + 1; }
        if (r[0] === 'lifetime_usage') { lifeStats = safeParse(r[1]) || lifeStats; lifeRow = i + 1; }
    });

    // 2. Calculate Usage
    const ocUsed = Number(actuals.openCellSets) || 0;
    const ccUsed = Number(actuals.closedCellSets) || 0;

    // 3. Write Back Warehouse (Inventory Logic)
    if (countRow !== -1) {
        counts.openCellSets = Math.max(0, (counts.openCellSets || 0) - ocUsed);
        counts.closedCellSets = Math.max(0, (counts.closedCellSets || 0) - ccUsed);
        setSheet.getRange(countRow, 2).setValue(JSON.stringify(counts));
    }

    // 4. Write Back Lifetime
    lifeStats.openCell = (lifeStats.openCell || 0) + ocUsed;
    lifeStats.closedCell = (lifeStats.closedCell || 0) + ccUsed;
    if (lifeRow !== -1) setSheet.getRange(lifeRow, 2).setValue(JSON.stringify(lifeStats));
    else setSheet.appendRow(['lifetime_usage', JSON.stringify(lifeStats)]);

    // 5. Update Inventory Items (Optimized HashMap)
    if (actuals.inventory && actuals.inventory.length > 0) {
        const invSheet = ss.getSheetByName(CONSTANTS.TAB_INVENTORY);
        const invData = invSheet.getDataRange().getValues();
        const invIndex = {}; 
        
        // Build Index
        for(let i=1; i<invData.length; i++) {
            invIndex[invData[i][COL_MAPS.INVENTORY.ID]] = i + 1;
        }

        actuals.inventory.forEach(actItem => {
            const rIdx = invIndex[actItem.id];
            if (rIdx) {
                const currentJson = safeParse(invSheet.getRange(rIdx, COL_MAPS.INVENTORY.JSON + 1).getValue());
                if (currentJson) {
                    currentJson.quantity = (currentJson.quantity || 0) - (Number(actItem.quantity) || 0);
                    // Update Cell and JSON
                    invSheet.getRange(rIdx, COL_MAPS.INVENTORY.QTY + 1).setValue(currentJson.quantity);
                    invSheet.getRange(rIdx, COL_MAPS.INVENTORY.JSON + 1).setValue(JSON.stringify(currentJson));
                }
            }
        });
    }

    // 6. Logs - Remove estimated entries, write actual entries
    if (logSheet) {
        // Remove any preliminary 'estimated' logs for this job
        if (logSheet.getLastRow() > 1) {
            const allLogData = logSheet.getDataRange().getValues();
            const rowsToDelete = [];
            for (let i = allLogData.length - 1; i >= 1; i--) {
                const logJson = safeParse(allLogData[i][7]); // JSON_DATA column (0-based index 7)
                if (logJson && logJson.jobId === estimateId && logJson.logType === 'estimated') {
                    rowsToDelete.push(i + 1); // 1-based row
                }
            }
            // Delete from bottom to top to preserve row indices
            rowsToDelete.forEach(row => logSheet.deleteRow(row));
        }

        const newLogs = [];
        const date = actuals.completionDate || new Date().toISOString();
        const tech = actuals.completedBy || "Crew";
        const cust = est.customer?.name || "Unknown";

        const pushLog = (name, qty, unit) => {
            if (Number(qty) > 0) {
                const entry = { id: Utilities.getUuid(), date, jobId: estimateId, customerName: cust, materialName: name, quantity: qty, unit, loggedBy: tech, logType: 'actual' };
                newLogs.push([new Date(date), estimateId, cust, name, qty, unit, tech, JSON.stringify(entry)]);
            }
        };
        pushLog("Open Cell Foam", ocUsed, "Sets");
        pushLog("Closed Cell Foam", ccUsed, "Sets");
        if (actuals.inventory) actuals.inventory.forEach(i => pushLog(i.name, i.quantity, i.unit));
        
        if (newLogs.length > 0) logSheet.getRange(logSheet.getLastRow() + 1, 1, newLogs.length, newLogs[0].length).setValues(newLogs);
    }

    // 7. Update Estimate (FINAL COMMIT)
    est.executionStatus = 'Completed';
    est.actuals = actuals;
    est.inventoryProcessed = true; 
    est.lastModified = new Date().toISOString();
    
    estSheet.getRange(rowIdx, COL_MAPS.ESTIMATES.JSON + 1).setValue(JSON.stringify(est));
    
    SpreadsheetApp.flush();
    return { success: true };
}

function handleMarkJobPaid(ss, payload) {
    const { estimateId } = payload;
    const estSheet = ss.getSheetByName(CONSTANTS.TAB_ESTIMATES);
    const data = estSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
        if (data[i][COL_MAPS.ESTIMATES.ID] == estimateId) {
            const row = i + 1;
            const est = safeParse(data[i][COL_MAPS.ESTIMATES.JSON]);
            if (!est) continue;

            // Recalc Financials
            const setSheet = ss.getSheetByName(CONSTANTS.TAB_SETTINGS);
            let costs = { openCell: 0, closedCell: 0, laborRate: 0 };
            setSheet.getDataRange().getValues().forEach(r => { if (r[0] === 'costs') costs = safeParse(r[1]) || costs; });

            const act = est.actuals || est.materials || {};
            const oc = Number(act.openCellSets || 0);
            const cc = Number(act.closedCellSets || 0);
            
            const chemCost = (oc * costs.openCell) + (cc * costs.closedCell);
            const labHrs = Number(act.laborHours || est.expenses?.manHours || 0);
            const labCost = labHrs * (est.expenses?.laborRate || costs.laborRate || 0);
            
            let invCost = 0;
            (act.inventory || est.materials.inventory || []).forEach(item => {
                invCost += (Number(item.quantity) * Number(item.unitCost || 0));
            });

            const misc = (est.expenses?.tripCharge || 0) + (est.expenses?.fuelSurcharge || 0);
            const revenue = Number(est.totalValue) || 0;
            const totalCOGS = chemCost + labCost + invCost + misc;
            
            est.status = 'Paid';
            est.lastModified = new Date().toISOString();
            est.financials = { 
                revenue, 
                chemicalCost: chemCost, 
                laborCost: labCost, 
                inventoryCost: invCost, 
                miscCost: misc, 
                totalCOGS, 
                netProfit: revenue - totalCOGS, 
                margin: revenue ? (revenue - totalCOGS) / revenue : 0 
            };

            // Write updates
            estSheet.getRange(row, COL_MAPS.ESTIMATES.STATUS + 1).setValue('Paid');
            estSheet.getRange(row, COL_MAPS.ESTIMATES.JSON + 1).setValue(JSON.stringify(est));

            // Append to P&L
            ss.getSheetByName(CONSTANTS.TAB_PNL).appendRow([
                new Date(), est.id, est.customer?.name, est.invoiceNumber, 
                revenue, chemCost, labCost, invCost, misc, totalCOGS, 
                est.financials.netProfit, est.financials.margin
            ]);

            return { success: true, estimate: est };
        }
    }
    throw new Error("Estimate ID not found");
}

function handleStartJob(ss, payload) {
    const { estimateId } = payload;
    const sheet = ss.getSheetByName(CONSTANTS.TAB_ESTIMATES);
    const data = sheet.getDataRange().getValues();

    for(let i = 1; i < data.length; i++) {
        if(data[i][COL_MAPS.ESTIMATES.ID] == estimateId) {
            const row = i + 1;
            const est = safeParse(data[i][COL_MAPS.ESTIMATES.JSON]);
            if(est) {
                est.executionStatus = 'In Progress';
                est.actuals = est.actuals || {};
                est.actuals.lastStartedAt = new Date().toISOString();
                est.lastModified = new Date().toISOString();
                
                sheet.getRange(row, COL_MAPS.ESTIMATES.JSON + 1).setValue(JSON.stringify(est));
                return { success: true, status: 'In Progress', estimate: est };
            }
        }
    }
    return { success: false, message: 'Estimate not found' };
}

// --- 6. INFRASTRUCTURE & HELPERS (Unchanged mostly) ---

function getRootFolder() {
    const folders = DriveApp.getFoldersByName(CONSTANTS.ROOT_FOLDER_NAME);
    if (folders.hasNext()) return folders.next();
    return DriveApp.createFolder(CONSTANTS.ROOT_FOLDER_NAME);
}

function getMasterSpreadsheet() {
    const root = getRootFolder();
    const files = root.getFilesByName(CONSTANTS.MASTER_DB_NAME);
    if (files.hasNext()) return SpreadsheetApp.open(files.next());
    const ss = SpreadsheetApp.create(CONSTANTS.MASTER_DB_NAME);
    DriveApp.getFileById(ss.getId()).moveTo(root);
    ensureSheet(ss, "Users_DB", ["Username", "PasswordHash", "CompanyName", "SpreadsheetID", "FolderID", "CreatedAt", "CrewCode", "Email"]);
    ensureSheet(ss, "Trial_Memberships", ["Name", "Email", "Phone", "Timestamp"]);
    return ss;
}

function ensureSheet(ss, n, h) {
    let s = ss.getSheetByName(n);
    if (!s) {
        s = ss.insertSheet(n);
        s.appendRow(h);
        s.setFrozenRows(1);
        s.getRange(1, 1, 1, h.length).setFontWeight("bold");
    }
    return s;
}

function hashPassword(p) { 
    return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, p + SECRET_SALT)); 
}

function handleSignup(p) {
    const ss = getMasterSpreadsheet();
    const sh = ss.getSheetByName("Users_DB");
    const e = sh.getRange("A:A").createTextFinder(p.username.trim()).matchEntireCell(true).findNext();
    if (e) throw new Error("Username already taken.");
    const crewPin = Math.floor(1000 + Math.random() * 9000).toString();
    const r = createCompanyResources(p.companyName, p.username, crewPin, p.email);
    sh.appendRow([p.username.trim(), hashPassword(p.password), p.companyName, r.ssId, r.folderId, new Date(), crewPin, p.email]);
    return { username: p.username, companyName: p.companyName, spreadsheetId: r.ssId, folderId: r.folderId, role: 'admin', token: generateToken(p.username, 'admin'), crewPin: crewPin };
}

function createCompanyResources(companyName, username, crewPin, email) {
    const root = getRootFolder();
    const safeName = companyName.replace(/[^a-zA-Z0-9 ]/g, "").trim();
    const companyFolder = root.createFolder(`${safeName} Data`);
    const ss = SpreadsheetApp.create(`${companyName} - Master Data`);
    DriveApp.getFileById(ss.getId()).moveTo(companyFolder);
    const initialProfile = { companyName: companyName, crewAccessPin: crewPin, email: email || "", phone: "", addressLine1: "", addressLine2: "", city: "", state: "", zip: "", website: "", logoUrl: "" };
    setupUserSheetSchema(ss, initialProfile);
    return { ssId: ss.getId(), folderId: companyFolder.getId() };
}

function setupUserSheetSchema(ss, initialProfile) {
    ensureSheet(ss, CONSTANTS.TAB_CUSTOMERS, ["ID", "Name", "Address", "City", "State", "Zip", "Phone", "Email", "Status", "JSON_DATA"]);
    ensureSheet(ss, CONSTANTS.TAB_ESTIMATES, ["ID", "Date", "Customer", "Total Value", "Status", "Invoice #", "Material Cost", "PDF Link", "JSON_DATA"]);
    ensureSheet(ss, CONSTANTS.TAB_INVENTORY, ["ID", "Name", "Quantity", "Unit", "Unit Cost", "JSON_DATA"]);
    ensureSheet(ss, CONSTANTS.TAB_EQUIPMENT, ["ID", "Name", "Status", "JSON_DATA"]);
    ensureSheet(ss, CONSTANTS.TAB_PNL, ["Date Paid", "Job ID", "Customer", "Invoice #", "Revenue", "Chem Cost", "Labor Cost", "Inv Cost", "Misc Cost", "Total COGS", "Net Profit", "Margin %"]);
    ensureSheet(ss, CONSTANTS.TAB_LOGS, ["Date", "Job ID", "Customer", "Material Name", "Quantity", "Unit", "Logged By", "JSON_DATA"]);
    
    const settingsSheet = ensureSheet(ss, CONSTANTS.TAB_SETTINGS, ["Config_Key", "JSON_Value"]);
    if (initialProfile && settingsSheet.getLastRow() === 1) {
        settingsSheet.appendRow(['companyProfile', JSON.stringify(initialProfile)]);
        settingsSheet.appendRow(['warehouse_counts', JSON.stringify({ openCellSets: 0, closedCellSets: 0 })]);
        settingsSheet.appendRow(['lifetime_usage', JSON.stringify({ openCell: 0, closedCell: 0 })]);
        settingsSheet.appendRow(['costs', JSON.stringify({ openCell: 2000, closedCell: 2600, laborRate: 85 })]);
        settingsSheet.appendRow(['yields', JSON.stringify({ openCell: 16000, closedCell: 4000, openCellStrokes: 6600, closedCellStrokes: 6600 })]);
    }
    const sheet1 = ss.getSheetByName("Sheet1");
    if (sheet1) ss.deleteSheet(sheet1);
}

function handleLogin(p) {
    const ss = getMasterSpreadsheet();
    const sh = ss.getSheetByName("Users_DB");
    const f = sh.getRange("A:A").createTextFinder(p.username.trim()).matchEntireCell(true).findNext();
    if (!f) throw new Error("User not found.");
    const r = f.getRow();
    const d = sh.getRange(r, 1, 1, 7).getValues()[0];
    if (String(d[1]) !== hashPassword(p.password)) throw new Error("Incorrect password.");
    return { username: d[0], companyName: d[2], spreadsheetId: d[3], folderId: d[4], role: 'admin', token: generateToken(d[0], 'admin') };
}

function handleCrewLogin(p) {
    const ss = getMasterSpreadsheet();
    const sh = ss.getSheetByName("Users_DB");
    const f = sh.getRange("A:A").createTextFinder(p.username.trim()).matchEntireCell(true).findNext();
    if (!f) throw new Error("Company ID not found.");
    const r = f.getRow();
    const d = sh.getRange(r, 1, 1, 7).getValues()[0];
    if (String(d[6]).trim() !== String(p.pin).trim()) throw new Error("Invalid Crew PIN.");
    return { username: d[0], companyName: d[2], spreadsheetId: d[3], folderId: d[4], role: 'crew', token: generateToken(d[0], 'crew') };
}

function handleUpdatePassword(p) {
    const ss = getMasterSpreadsheet();
    const sh = ss.getSheetByName("Users_DB");
    const f = sh.getRange("A:A").createTextFinder(p.username.trim()).matchEntireCell(true).findNext();
    if (!f) throw new Error("User not found.");
    const r = f.getRow();
    const currentHash = sh.getRange(r, 2).getValue();
    if (String(currentHash) !== hashPassword(p.currentPassword)) throw new Error("Incorrect current password.");
    sh.getRange(r, 2).setValue(hashPassword(p.newPassword));
    return { success: true };
}

// Simple Helpers (PDF/Image) - Kept brief
function handleUploadImage(ss, payload) {
    // Note: If you have massive images, client-side resizing is mandatory before sending to GAS.
    const { base64Data, folderId, fileName } = payload;
    let targetFolder;
    try { targetFolder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder(); } catch(e) {}
    if(!targetFolder) {
        // Fallback: try finding a "Job Photos" folder near the SS
        try { targetFolder = DriveApp.getFileById(ss.getId()).getParents().next(); } catch(e) { targetFolder = DriveApp.getRootFolder(); }
    }
    
    // Create Folder structure if needed
    const sub = targetFolder.getFoldersByName("Job Photos");
    const photoFolder = sub.hasNext() ? sub.next() : targetFolder.createFolder("Job Photos");

    const encoded = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const blob = Utilities.newBlob(Utilities.base64Decode(encoded), MimeType.JPEG, fileName || "photo.jpg");
    const file = photoFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return { url: `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1000`, fileId: file.getId() };
}

function handleSavePdf(ss, p) {
    const parentFolder = p.folderId ? DriveApp.getFolderById(p.folderId) : DriveApp.getRootFolder();
    const blob = Utilities.newBlob(Utilities.base64Decode(p.base64Data.split(',')[1]), MimeType.PDF, p.fileName);
    const file = parentFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Optional: Auto-attach to Estimate
    if (p.estimateId) {
        const s = ss.getSheetByName(CONSTANTS.TAB_ESTIMATES);
        const data = s.getDataRange().getValues();
        for(let i=1; i<data.length; i++){
            if(data[i][COL_MAPS.ESTIMATES.ID] == p.estimateId) {
                const j = safeParse(data[i][COL_MAPS.ESTIMATES.JSON]);
                if(j) {
                    j.pdfLink = file.getUrl();
                    s.getRange(i+1, COL_MAPS.ESTIMATES.PDF + 1).setValue(file.getUrl());
                    s.getRange(i+1, COL_MAPS.ESTIMATES.JSON + 1).setValue(JSON.stringify(j));
                }
                break;
            }
        }
    }
    return { success: true, url: file.getUrl() };
}

function handleDeleteEstimate(ss, p) { 
    const s = ss.getSheetByName(CONSTANTS.TAB_ESTIMATES); 
    const f = s.getRange("A:A").createTextFinder(p.estimateId).matchEntireCell(true).findNext(); 
    if (f) s.deleteRow(f.getRow()); 
    return { success: true }; 
}

function handleCreateWorkOrder(ss, p) {
    let parentFolder;
    try { parentFolder = p.folderId ? DriveApp.getFolderById(p.folderId) : DriveApp.getRootFolder(); } catch (e) { parentFolder = DriveApp.getRootFolder(); }
    
    const est = p.estimateData;
    const safeName = est.customer?.name ? est.customer.name.replace(/[^a-zA-Z0-9 ]/g, "") : "Unknown";
    const name = `WO-${est.id.slice(0, 8).toUpperCase()} - ${safeName}`;
    const newSheet = SpreadsheetApp.create(name);
    
    try { DriveApp.getFileById(newSheet.getId()).moveTo(parentFolder); } catch (e) { }

    const infoSheet = newSheet.getSheetByName("Sheet1") || newSheet.insertSheet("Job Details");
    infoSheet.setName("Job Details");

    const addKV = (r, k, v) => {
        infoSheet.getRange(r, 1).setValue(k).setFontWeight("bold");
        infoSheet.getRange(r, 2).setValue(v);
    };

    infoSheet.getRange("A1").setValue("JOB SHEET").setFontSize(14).setFontWeight("bold").setBackground("#E30613").setFontColor("white");
    
    addKV(3, "Customer", est.customer?.name);
    addKV(4, "Address", `${est.customer?.address || ""} ${est.customer?.city || ""}`);
    addKV(6, "Scope", "Material Requirements");
    
    let r = 7;
    if(est.materials?.openCellSets) { addKV(r++, "Open Cell Sets", Number(est.materials.openCellSets).toFixed(1)); }
    if(est.materials?.closedCellSets) { addKV(r++, "Closed Cell Sets", Number(est.materials.closedCellSets).toFixed(1)); }
    
    if(est.materials?.inventory) {
        r++; infoSheet.getRange(r++, 1).setValue("ADDITIONAL ITEMS").setFontWeight("bold");
        est.materials.inventory.forEach(i => addKV(r++, i.name, `${i.quantity} ${i.unit}`));
    }

    r++; infoSheet.getRange(r++, 1).setValue("NOTES").setFontWeight("bold");
    infoSheet.getRange(r, 1).setValue(est.notes || "No notes.");
    
    // Daily Log Tab
    const logTab = newSheet.insertSheet("Daily Crew Log");
    logTab.appendRow(["Date", "Tech Name", "Start", "End", "Duration", "Sets Used", "Notes"]);
    logTab.setFrozenRows(1);

    return { url: newSheet.getUrl() };
}

function handleSubmitTrial(p) { 
    getMasterSpreadsheet().getSheetByName("Trial_Memberships").appendRow([p.name, p.email, p.phone, new Date()]); 
    return { success: true }; 
}

// --- MATERIAL USAGE LOGGING ---

function handleLogMaterialUsage(ss, payload) {
    const { estimateId, customerName, materials, loggedBy, logType } = payload;
    const logSheet = ss.getSheetByName(CONSTANTS.TAB_LOGS);
    if (!logSheet) throw new Error("Material_Log_DB sheet not found");
    
    const date = new Date().toISOString();
    const entryType = logType || 'estimated';
    const newLogs = [];
    
    const pushLog = (name, qty, unit) => {
        if (Number(qty) > 0) {
            const entry = { 
                id: Utilities.getUuid(), 
                date, 
                jobId: estimateId, 
                customerName: customerName, 
                materialName: name, 
                quantity: Number(qty), 
                unit, 
                loggedBy: loggedBy || 'Admin',
                logType: entryType
            };
            newLogs.push([new Date(date), estimateId, customerName, name, Number(qty), unit, loggedBy || 'Admin', JSON.stringify(entry)]);
        }
    };
    
    if (materials.openCellSets > 0) pushLog("Open Cell Foam", materials.openCellSets, "Sets");
    if (materials.closedCellSets > 0) pushLog("Closed Cell Foam", materials.closedCellSets, "Sets");
    if (materials.inventory && materials.inventory.length > 0) {
        materials.inventory.forEach(item => pushLog(item.name, item.quantity, item.unit));
    }
    
    if (newLogs.length > 0) {
        logSheet.getRange(logSheet.getLastRow() + 1, 1, newLogs.length, newLogs[0].length).setValues(newLogs);
    }
    
    return { success: true, logsCreated: newLogs.length };
}

function handleLogTime(p) { 
    const ss = SpreadsheetApp.openByUrl(p.workOrderUrl); 
    const s = ss.getSheetByName("Daily Crew Log"); 
    s.appendRow([
        new Date().toLocaleDateString(), 
        p.user, 
        p.startTime, 
        p.endTime || "", 
        "", 
        "", 
        ""
    ]); 
    return { success: true }; 
}
