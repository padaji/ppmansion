// Dormitory Billing System Application Logic

// ==========================================
// 1. Initial State & Data Generation
// ==========================================
let state = {
  settings: {
    dormName: "หอพักแสนสุข",
    dormPhone: "081-234-5678",
    dormAddress: "959 ม.5 ซ.ศรีด่าน19 ถ.ศรีนครินทร์ ต.สำโรงเหนือ อ.เมือง จ.สมุทรปราการ 10270",
    dormPayment: "พร้อมเพย์ 081-234-5678 (นายแสนสุข)",
    defaultRent: 4000,
    defaultCommonFee: 100,
    waterRate: 18,
    electricityRate: 7
  },
  rooms: [],
  billingHistory: [],
  
  // App filters and selections
  selectedMonthCycle: "", // YYYY-MM
  selectedFloor: "all",
  selectedStatus: "all",
  searchQuery: "",
  activeRoomNo: null
};

// Generate 75 rooms across 5 floors (15 rooms per floor: 101-115, ..., 501-515)
function generateRoomsList() {
  const rooms = [];
  for (let floor = 1; floor <= 5; floor++) {
    for (let roomIdx = 1; roomIdx <= 15; roomIdx++) {
      const roomNo = floor * 100 + roomIdx;
      rooms.push({
        roomNo: roomNo.toString(),
        floor: floor,
        lastWaterMeter: 0,
        lastElecMeter: 0
      });
    }
  }
  return rooms;
}

// Load and initialize app data from localStorage
function loadData() {
  const savedSettings = localStorage.getItem("dorm_settings");
  const savedRooms = localStorage.getItem("dorm_rooms");
  const savedBilling = localStorage.getItem("dorm_billing_history");

  if (savedSettings) {
    state.settings = JSON.parse(savedSettings);
  } else {
    localStorage.setItem("dorm_settings", JSON.stringify(state.settings));
  }

  if (savedRooms) {
    state.rooms = JSON.parse(savedRooms);
  } else {
    state.rooms = generateRoomsList();
    localStorage.setItem("dorm_rooms", JSON.stringify(state.rooms));
  }

  if (savedBilling) {
    state.billingHistory = JSON.parse(savedBilling);
  } else {
    state.billingHistory = [];
    localStorage.setItem("dorm_billing_history", JSON.stringify(state.billingHistory));
  }

  // Set default billing cycle to saved cycle or current month (YYYY-MM)
  const savedActiveCycle = localStorage.getItem("dorm_active_cycle");
  if (savedActiveCycle) {
    state.selectedMonthCycle = savedActiveCycle;
  } else {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    state.selectedMonthCycle = `${year}-${month}`;
    localStorage.setItem("dorm_active_cycle", state.selectedMonthCycle);
  }
}

// Save specific parts to LocalStorage
function saveData(key) {
  if (key === "settings") {
    localStorage.setItem("dorm_settings", JSON.stringify(state.settings));
  } else if (key === "rooms") {
    localStorage.setItem("dorm_rooms", JSON.stringify(state.rooms));
  } else if (key === "billingHistory") {
    localStorage.setItem("dorm_billing_history", JSON.stringify(state.billingHistory));
  }
}

// ==========================================
// 2. Thai Baht Text Converter (For Invoices)
// ==========================================
function bahtText(number) {
  if (number === 0) return 'ศูนย์บาทถ้วน';
  
  // Format to two decimal places
  let numberStr = parseFloat(number).toFixed(2);
  let parts = numberStr.split('.');
  let bahtPart = parts[0];
  let satangPart = parts[1];
  
  let bahtTextVal = convertIntegerToThaiText(bahtPart);
  let satangTextVal = '';
  
  if (parseInt(satangPart) === 0) {
    satangTextVal = 'ถ้วน';
  } else {
    satangTextVal = convertIntegerToThaiText(satangPart) + 'สตางค์';
  }
  
  return bahtTextVal + (parseInt(bahtPart) > 0 ? 'บาท' : '') + satangTextVal;
}

function convertIntegerToThaiText(numberStr) {
  let number = parseInt(numberStr);
  if (number === 0 || isNaN(number)) return '';
  
  const thNumbers = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const thPositions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  
  let text = '';
  let len = numberStr.length;
  
  if (len > 6) {
    let millionPart = numberStr.substring(0, len - 6);
    let remainingPart = numberStr.substring(len - 6);
    return convertIntegerToThaiText(millionPart) + 'ล้าน' + convertIntegerToThaiText(remainingPart);
  }
  
  for (let i = 0; i < len; i++) {
    let digit = parseInt(numberStr[i]);
    let pos = len - i - 1;
    
    if (digit !== 0) {
      if (pos === 0 && digit === 1 && len > 1) {
        text += 'เอ็ด';
      } else if (pos === 1 && digit === 2) {
        text += 'ยี่สิบ';
      } else if (pos === 1 && digit === 1) {
        text += 'สิบ';
      } else {
        text += thNumbers[digit] + thPositions[pos];
      }
    }
  }
  return text;
}

// Convert Cycle to Thai Month Name (e.g. "2026-07" -> "กรกฎาคม 2569")
function getThaiCycleName(cycleStr) {
  if (!cycleStr) return "";
  const parts = cycleStr.split('-');
  const yearEng = parseInt(parts[0]);
  const monthIdx = parseInt(parts[1]) - 1;
  const yearThai = yearEng + 543;
  
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  
  return `${thaiMonths[monthIdx]} ${yearThai}`;
}

// ==========================================
// 3. UI rendering logic
// ==========================================

// Dashboard Counters and Progress Bar
function updateDashboard() {
  const currentMonthBills = state.billingHistory.filter(b => b.cycle === state.selectedMonthCycle);
  const totalRoomsCount = state.rooms.length; // 75
  
  const billedCount = currentMonthBills.length;
  const unbilledCount = totalRoomsCount - billedCount;
  
  const paidBills = currentMonthBills.filter(b => b.status === "paid");
  const unpaidBills = currentMonthBills.filter(b => b.status === "pending");
  
  const paidCount = paidBills.length;
  const unpaidCount = unpaidBills.length;
  
  const totalBilledRevenue = currentMonthBills.reduce((sum, b) => sum + b.totalAmount, 0);
  const collectedRevenue = paidBills.reduce((sum, b) => sum + b.totalAmount, 0);
  const remainingRevenue = unpaidBills.reduce((sum, b) => sum + b.totalAmount, 0);
  
  // Update elements
  document.getElementById("stat-unbilled").textContent = `${unbilledCount} ห้อง`;
  document.getElementById("stat-pending").textContent = `${unpaidCount} ห้อง`;
  document.getElementById("stat-pending-amount").textContent = `${remainingRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`;
  document.getElementById("stat-paid").textContent = `${paidCount} ห้อง`;
  document.getElementById("stat-paid-amount").textContent = `${collectedRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`;
  
  document.getElementById("total-billed-revenue").textContent = `${totalBilledRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;
  document.getElementById("collected-revenue").textContent = `${collectedRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;
  document.getElementById("remaining-revenue").textContent = `${remainingRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;
  
  // Progress Bar
  const progressPercent = totalBilledRevenue > 0 ? Math.round((collectedRevenue / totalBilledRevenue) * 100) : 0;
  document.getElementById("billing-progress-percent").textContent = `${progressPercent}%`;
  document.getElementById("billing-progress-bar").style.width = `${progressPercent}%`;
  
  // Set summary label under headers
  document.getElementById("current-month-display").textContent = `ประจำเดือน ${getThaiCycleName(state.selectedMonthCycle)}`;
  
  // Calculate Billed Breakdown:
  const sumBilledRent = currentMonthBills.reduce((sum, b) => sum + b.rent, 0);
  const sumBilledCommon = currentMonthBills.reduce((sum, b) => sum + b.commonFee, 0);
  const sumBilledWater = currentMonthBills.reduce((sum, b) => sum + b.waterAmount, 0);
  const sumBilledElec = currentMonthBills.reduce((sum, b) => sum + b.elecAmount, 0);
  const sumBilledCustom = currentMonthBills.reduce((sum, b) => {
    return sum + (b.customItems ? b.customItems.reduce((s, item) => s + item.amount, 0) : 0);
  }, 0);
  const sumBilledTotal = totalBilledRevenue;
  
  // Calculate Floor Breakdown:
  let sumFloor1 = 0;
  let sumFloor2 = 0;
  let sumFloor3 = 0;
  let sumFloor4 = 0;
  let sumFloor5 = 0;
  let sumFloorOther = 0;
  
  currentMonthBills.forEach(b => {
    const room = state.rooms.find(r => r.roomNo === b.roomNo);
    if (room && room.isCustomItem) {
      sumFloorOther += b.totalAmount;
    } else {
      const floorNum = Math.floor(parseInt(b.roomNo) / 100);
      if (floorNum === 1) sumFloor1 += b.totalAmount;
      else if (floorNum === 2) sumFloor2 += b.totalAmount;
      else if (floorNum === 3) sumFloor3 += b.totalAmount;
      else if (floorNum === 4) sumFloor4 += b.totalAmount;
      else if (floorNum === 5) sumFloor5 += b.totalAmount;
      else sumFloorOther += b.totalAmount;
    }
  });
  
  const sumFloorTotal = sumFloor1 + sumFloor2 + sumFloor3 + sumFloor4 + sumFloor5 + sumFloorOther;
  
  // Render Billed Breakdown in DOM:
  document.getElementById("sum-billed-rent").textContent = `${sumBilledRent.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;
  document.getElementById("sum-billed-common").textContent = `${sumBilledCommon.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;
  document.getElementById("sum-billed-water").textContent = `${sumBilledWater.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;
  document.getElementById("sum-billed-elec").textContent = `${sumBilledElec.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;
  document.getElementById("sum-billed-custom").textContent = `${sumBilledCustom.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;
  document.getElementById("sum-billed-total").textContent = `${sumBilledTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;
  
  // Render Floor Breakdown in DOM:
  document.getElementById("sum-floor-1").textContent = `${sumFloor1.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;
  document.getElementById("sum-floor-2").textContent = `${sumFloor2.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;
  document.getElementById("sum-floor-3").textContent = `${sumFloor3.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;
  document.getElementById("sum-floor-4").textContent = `${sumFloor4.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;
  document.getElementById("sum-floor-5").textContent = `${sumFloor5.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;
  document.getElementById("sum-floor-other").textContent = `${sumFloorOther.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;
  document.getElementById("sum-floor-total").textContent = `${sumFloorTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;
}

// Generate Room Cards Grid
function renderRoomGrid() {
  const container = document.getElementById("room-cards-grid");
  container.innerHTML = "";
  
  // Filter rooms
  let filteredRooms = state.rooms;
  
  // Filter by Floor
  if (state.selectedFloor === "other") {
    filteredRooms = filteredRooms.filter(r => r.isCustomItem === true);
  } else if (state.selectedFloor !== "all") {
    const floorInt = parseInt(state.selectedFloor);
    filteredRooms = filteredRooms.filter(r => r.floor === floorInt && !r.isCustomItem);
  } else {
    // Hide custom items from standard "All" dashboard rooms grid
    filteredRooms = filteredRooms.filter(r => !r.isCustomItem);
  }
  
  // Filter by Search Query (Room No)
  if (state.searchQuery.trim() !== "") {
    filteredRooms = filteredRooms.filter(r => r.roomNo.includes(state.searchQuery.trim()));
  }
  
  // Filter by Status & Display
  if (state.selectedFloor === "other") {
    const addCard = document.createElement("div");
    addCard.className = "room-card add-custom-card";
    addCard.style.cssText = "border: 2px dashed var(--primary); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--primary); font-weight: 600; cursor: pointer; min-height: 110px; background-color: var(--primary-light);";
    addCard.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
      <span>เพิ่มบริการ / ที่จอดรถ</span>
    `;
    addCard.addEventListener("click", addNewCustomServiceItem);
    container.appendChild(addCard);
  }
  
  filteredRooms.forEach(room => {
    // Check if billing exists for current cycle
    const bill = state.billingHistory.find(b => b.roomNo === room.roomNo && b.cycle === state.selectedMonthCycle);
    
    let statusClass = "unbilled";
    let statusLabel = "ยังไม่บันทึกบิล";
    let amountText = "—";
    
    if (bill) {
      if (bill.status === "paid") {
        statusClass = "paid";
        statusLabel = "จ่ายเงินแล้ว";
      } else {
        statusClass = "pending";
        statusLabel = "ค้างชำระ";
      }
      amountText = `${bill.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`;
    }
    
    // Status Select Filter override
    if (state.selectedStatus !== "all" && statusClass !== state.selectedStatus) {
      return; // Skip rendering
    }
    
    const isSpecialRoom = room.isSpecial === true;
    const specialStar = isSpecialRoom ? `<span class="special-star" title="ห้องพิเศษ" style="color: var(--warning); margin-left: 4px;">★</span>` : '';
    
    const card = document.createElement("div");
    card.className = `room-card ${statusClass}`;
    card.innerHTML = `
      <div class="room-no">${room.roomNo}${specialStar}</div>
      <div class="room-status-badge">${statusLabel}</div>
      <div class="room-amount">${amountText}</div>
    `;
    
    card.addEventListener("click", () => openBillingModal(room.roomNo));
    container.appendChild(card);
  });
  
  if (container.children.length === 0) {
    container.innerHTML = `<div class="no-records" style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">ไม่พบข้อมูลห้องพักตามตัวเลือก</div>`;
  }
}

// ==========================================
// 4. Modal Billing Form Logic
// ==========================================
let customItemIndex = 0;

function createCustomItemRow(name = "", amount = 0) {
  const container = document.getElementById("custom-items-container");
  const rowId = `custom-row-${customItemIndex++}`;
  
  const row = document.createElement("div");
  row.className = "custom-item-row";
  row.id = rowId;
  row.innerHTML = `
    <input type="text" class="form-control desc-input" placeholder="ระบุรายการ เช่น ค่าเช่าตู้เย็น, ปรับค่าเสียหาย" value="${name}" required>
    <input type="number" class="form-control amount-input" placeholder="จำนวนเงิน" value="${amount > 0 ? amount : ''}" min="0" required>
    <button type="button" class="btn-remove-item" title="ลบรายการ">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
    </button>
  `;
  
  // Attach events for real-time calculations
  row.querySelector(".desc-input").addEventListener("input", calculateFormTotal);
  row.querySelector(".amount-input").addEventListener("input", calculateFormTotal);
  
  row.querySelector(".btn-remove-item").addEventListener("click", () => {
    row.remove();
    calculateFormTotal();
  });
  
  container.appendChild(row);
}

// Perform Live Bill calculation
function calculateFormTotal() {
  const rent = parseFloat(document.getElementById("bill-rent-input").value) || 0;
  const common = parseFloat(document.getElementById("bill-common-input").value) || 0;
  
  const waterPrev = parseFloat(document.getElementById("bill-water-prev").value) || 0;
  const waterCurr = parseFloat(document.getElementById("bill-water-curr").value) || 0;
  const waterRate = parseFloat(document.getElementById("bill-water-rate").value) || 0;
  
  const elecPrev = parseFloat(document.getElementById("bill-elec-prev").value) || 0;
  const elecCurr = parseFloat(document.getElementById("bill-elec-curr").value) || 0;
  const elecRate = parseFloat(document.getElementById("bill-elec-rate").value) || 0;
  
  // Check if room type is special
  const isSpecialToggle = document.querySelector('input[name="room-type-toggle"]:checked')?.value === "special";
  
  // Water calculation
  const waterUnits = Math.max(0, waterCurr - waterPrev);
  let waterChargedUnits = waterUnits;
  let waterCost = waterUnits * waterRate;
  let waterFormulaText = "";
  
  if (isSpecialToggle) {
    const waterMinUnits = parseFloat(document.getElementById("bill-water-min-units").value) || 0;
    const waterMinAmount = parseFloat(document.getElementById("bill-water-min-amount").value) || 0;
    
    if (waterUnits < waterMinUnits) {
      waterChargedUnits = waterMinUnits;
      waterCost = waterChargedUnits * waterRate;
      waterFormulaText = `${waterChargedUnits} หน่วย (ขั้นต่ำ) × ${waterRate} ฿ = ${waterCost.toFixed(2)} ฿`;
    } else {
      waterFormulaText = `${waterUnits} หน่วย × ${waterRate} ฿ = ${waterCost.toFixed(2)} ฿`;
    }
    
    if (waterCost < waterMinAmount) {
      waterCost = waterMinAmount;
      waterFormulaText = `ขั้นต่ำเหมาจ่าย ${waterMinAmount.toFixed(2)} ฿`;
    }
  } else {
    waterFormulaText = `${waterUnits} หน่วย × ${waterRate} ฿ = ${waterCost.toFixed(2)} ฿`;
  }
  
  // Electricity calculation
  const elecUnits = Math.max(0, elecCurr - elecPrev);
  let elecChargedUnits = elecUnits;
  let elecCost = elecUnits * elecRate;
  let elecFormulaText = "";
  
  if (isSpecialToggle) {
    const elecMinUnits = parseFloat(document.getElementById("bill-elec-min-units").value) || 0;
    const elecMinAmount = parseFloat(document.getElementById("bill-elec-min-amount").value) || 0;
    
    if (elecUnits < elecMinUnits) {
      elecChargedUnits = elecMinUnits;
      elecCost = elecChargedUnits * elecRate;
      elecFormulaText = `${elecChargedUnits} หน่วย (ขั้นต่ำ) × ${elecRate} ฿ = ${elecCost.toFixed(2)} ฿`;
    } else {
      elecFormulaText = `${elecUnits} หน่วย × ${elecRate} ฿ = ${elecCost.toFixed(2)} ฿`;
    }
    
    if (elecCost < elecMinAmount) {
      elecCost = elecMinAmount;
      elecFormulaText = `ขั้นต่ำเหมาจ่าย ${elecMinAmount.toFixed(2)} ฿`;
    }
  } else {
    elecFormulaText = `${elecUnits} หน่วย × ${elecRate} ฿ = ${elecCost.toFixed(2)} ฿`;
  }
  
  // Update UI indicators
  document.getElementById("water-calc-summary").textContent = waterFormulaText;
  document.getElementById("elec-calc-summary").textContent = elecFormulaText;
  
  // Custom items sum
  let customSum = 0;
  const rows = document.querySelectorAll(".custom-item-row");
  rows.forEach(row => {
    const amountVal = parseFloat(row.querySelector(".amount-input").value) || 0;
    customSum += amountVal;
  });
  
  const total = rent + common + waterCost + elecCost + customSum;
  document.getElementById("bill-total-amount").textContent = `${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`;
  
  return {
    rent,
    commonFee: common,
    waterPrev,
    waterCurr,
    waterUnits,
    waterRate,
    waterCost,
    elecPrev,
    elecCurr,
    elecUnits,
    elecRate,
    elecCost,
    customSum,
    total
  };
}

function openBillingModal(roomNo) {
  state.activeRoomNo = roomNo;
  document.getElementById("bill-room-no").textContent = roomNo;
  document.getElementById("billing-modal-title").textContent = `บันทึกบิลห้อง ${roomNo}`;
  document.getElementById("bill-month-cycle").textContent = getThaiCycleName(state.selectedMonthCycle);
  
  // Clear previous dynamic items
  document.getElementById("custom-items-container").innerHTML = "";
  
  const roomInfo = state.rooms.find(r => r.roomNo === roomNo);
  const isRoomSpecial = roomInfo.isSpecial === true;
  
  // Setup room type toggle values and section visibility
  if (isRoomSpecial) {
    document.querySelector('input[name="room-type-toggle"][value="special"]').checked = true;
    document.getElementById("water-special-config").style.display = "block";
    document.getElementById("elec-special-config").style.display = "block";
    
    document.getElementById("bill-water-min-units").value = roomInfo.specialWaterMinUnits || 0;
    document.getElementById("bill-water-min-amount").value = roomInfo.specialWaterMinAmount || 0;
    document.getElementById("bill-elec-min-units").value = roomInfo.specialElecMinUnits || 0;
    document.getElementById("bill-elec-min-amount").value = roomInfo.specialElecMinAmount || 0;
  } else {
    document.querySelector('input[name="room-type-toggle"][value="normal"]').checked = true;
    document.getElementById("water-special-config").style.display = "none";
    document.getElementById("elec-special-config").style.display = "none";
    
    document.getElementById("bill-water-min-units").value = "";
    document.getElementById("bill-water-min-amount").value = "";
    document.getElementById("bill-elec-min-units").value = "";
    document.getElementById("bill-elec-min-amount").value = "";
  }
  
  // Search if bill exists
  const bill = state.billingHistory.find(b => b.roomNo === roomNo && b.cycle === state.selectedMonthCycle);
  
  if (bill) {
    // Fill with saved data
    document.getElementById("bill-tenant-input").value = bill.tenantName || "";
    document.getElementById("bill-address-input").value = bill.tenantAddress || "";
    document.getElementById("bill-rent-input").value = bill.rent;
    document.getElementById("bill-common-input").value = bill.commonFee;
    
    document.getElementById("bill-water-prev").value = bill.waterPrev;
    document.getElementById("bill-water-curr").value = bill.waterCurr;
    document.getElementById("bill-water-rate").value = bill.waterRate;
    
    document.getElementById("bill-elec-prev").value = bill.elecPrev;
    document.getElementById("bill-elec-curr").value = bill.elecCurr;
    document.getElementById("bill-elec-rate").value = bill.elecRate;
    
    // Add custom items
    if (bill.customItems && bill.customItems.length > 0) {
      bill.customItems.forEach(item => {
        createCustomItemRow(item.name, item.amount);
      });
    }
    
    // If bill itself is marked special, sync input min values from bill
    if (bill.isSpecial) {
      document.querySelector('input[name="room-type-toggle"][value="special"]').checked = true;
      document.getElementById("water-special-config").style.display = "block";
      document.getElementById("elec-special-config").style.display = "block";
      
      document.getElementById("bill-water-min-units").value = bill.waterMinUnits || 0;
      document.getElementById("bill-water-min-amount").value = bill.waterMinAmount || 0;
      document.getElementById("bill-elec-min-units").value = bill.elecMinUnits || 0;
      document.getElementById("bill-elec-min-amount").value = bill.elecMinAmount || 0;
    }
    
    // Payment status
    if (bill.status === "paid") {
      document.querySelector('input[name="payment-status"][value="paid"]').checked = true;
    } else {
      document.querySelector('input[name="payment-status"][value="pending"]').checked = true;
    }
    
    document.getElementById("btn-delete-bill").style.display = "block";
    document.getElementById("btn-preview-invoice").style.display = "block";
  } else {
    // No bill: Pre-fill defaults
    document.getElementById("bill-tenant-input").value = roomInfo.tenantName || "";
    document.getElementById("bill-address-input").value = roomInfo.tenantAddress || "";
    const baseRent = isRoomSpecial && roomInfo.specialRent !== undefined ? roomInfo.specialRent : state.settings.defaultRent;
    document.getElementById("bill-rent-input").value = baseRent;
    document.getElementById("bill-common-input").value = state.settings.defaultCommonFee;
    
    // Load rates: If special room, use saved room special rates, else use global settings rates
    document.getElementById("bill-water-rate").value = isRoomSpecial ? (roomInfo.specialWaterRate || state.settings.waterRate) : state.settings.waterRate;
    document.getElementById("bill-elec-rate").value = isRoomSpecial ? (roomInfo.specialElecRate || state.settings.electricityRate) : state.settings.electricityRate;
    
    // Attempt to load previous cycle's meters to save typing
    const prevCycle = getPreviousMonthCycle(state.selectedMonthCycle);
    const lastMonthBill = state.billingHistory.find(b => b.roomNo === roomNo && b.cycle === prevCycle);
    
    if (lastMonthBill) {
      document.getElementById("bill-water-prev").value = lastMonthBill.waterCurr;
      document.getElementById("bill-elec-prev").value = lastMonthBill.elecCurr;
    } else {
      // Fallback to room's saved meters
      document.getElementById("bill-water-prev").value = roomInfo.lastWaterMeter || 0;
      document.getElementById("bill-elec-prev").value = roomInfo.lastElecMeter || 0;
    }
    
    document.getElementById("bill-water-curr").value = "";
    document.getElementById("bill-elec-curr").value = "";
    
    document.querySelector('input[name="payment-status"][value="pending"]').checked = true;
    
    document.getElementById("btn-delete-bill").style.display = "none";
    document.getElementById("btn-preview-invoice").style.display = "none";
  }
  
  // Show delete custom room button if it's a custom service item
  document.getElementById("btn-delete-custom-room").style.display = roomInfo.isCustomItem ? "block" : "none";
  
  calculateFormTotal();
  document.getElementById("billing-modal").classList.add("open");
}

function closeBillingModal() {
  document.getElementById("billing-modal").classList.remove("open");
  state.activeRoomNo = null;
}

// Get previous month (YYYY-MM -> YYYY-MM)
function getPreviousMonthCycle(cycleStr) {
  const parts = cycleStr.split('-');
  let year = parseInt(parts[0]);
  let month = parseInt(parts[1]);
  
  month--;
  if (month === 0) {
    month = 12;
    year--;
  }
  
  return `${year}-${String(month).padStart(2, '0')}`;
}

// Save Bill Handler
function saveBillFromModal() {
  const form = document.getElementById("billing-entry-form");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  const roomNo = state.activeRoomNo;
  const billCalc = calculateFormTotal();
  const tenantName = document.getElementById("bill-tenant-input").value.trim();
  const tenantAddress = document.getElementById("bill-address-input").value.trim();
  
  const isSpecial = document.querySelector('input[name="room-type-toggle"]:checked').value === "special";
  
  // Custom items list parser
  const customItems = [];
  const rows = document.querySelectorAll(".custom-item-row");
  rows.forEach(row => {
    const name = row.querySelector(".desc-input").value.trim();
    const amount = parseFloat(row.querySelector(".amount-input").value) || 0;
    if (name) {
      customItems.push({ name, amount });
    }
  });
  
  const status = document.querySelector('input[name="payment-status"]:checked').value;
  const billId = `${roomNo}-${state.selectedMonthCycle}`;
  
  // Existing check to maintain creation date
  const existingBillIndex = state.billingHistory.findIndex(b => b.id === billId);
  const billedDate = existingBillIndex >= 0 ? state.billingHistory[existingBillIndex].billedDate : new Date().toISOString();
  const paidDate = status === "paid" ? new Date().toISOString() : null;
  
  const newBillObj = {
    id: billId,
    roomNo: roomNo,
    tenantName: tenantName,
    tenantAddress: tenantAddress,
    cycle: state.selectedMonthCycle,
    rent: billCalc.rent,
    commonFee: billCalc.commonFee,
    waterPrev: billCalc.waterPrev,
    waterCurr: billCalc.waterCurr,
    waterUnits: billCalc.waterUnits,
    waterRate: billCalc.waterRate,
    waterAmount: billCalc.waterCost,
    elecPrev: billCalc.elecPrev,
    elecCurr: billCalc.elecCurr,
    elecUnits: billCalc.elecUnits,
    elecRate: billCalc.elecRate,
    elecAmount: billCalc.elecCost,
    customItems: customItems,
    totalAmount: billCalc.total,
    status: status,
    billedDate: billedDate,
    paidDate: paidDate,
    
    // Add special room settings on the bill
    isSpecial: isSpecial,
    waterMinUnits: isSpecial ? (parseFloat(document.getElementById("bill-water-min-units").value) || 0) : 0,
    waterMinAmount: isSpecial ? (parseFloat(document.getElementById("bill-water-min-amount").value) || 0) : 0,
    elecMinUnits: isSpecial ? (parseFloat(document.getElementById("bill-elec-min-units").value) || 0) : 0,
    elecMinAmount: isSpecial ? (parseFloat(document.getElementById("bill-elec-min-amount").value) || 0) : 0
  };
  
  if (existingBillIndex >= 0) {
    state.billingHistory[existingBillIndex] = newBillObj;
  } else {
    state.billingHistory.push(newBillObj);
  }
  
  // Also update latest room meter readings & tenant name & special config
  const roomIndex = state.rooms.findIndex(r => r.roomNo === roomNo);
  if (roomIndex >= 0) {
    state.rooms[roomIndex].tenantName = tenantName;
    state.rooms[roomIndex].tenantAddress = tenantAddress;
    state.rooms[roomIndex].lastWaterMeter = billCalc.waterCurr;
    state.rooms[roomIndex].lastElecMeter = billCalc.elecCurr;
    
    // Update persistent room special status
    state.rooms[roomIndex].isSpecial = isSpecial;
    if (isSpecial) {
      state.rooms[roomIndex].specialWaterRate = billCalc.waterRate;
      state.rooms[roomIndex].specialWaterMinUnits = newBillObj.waterMinUnits;
      state.rooms[roomIndex].specialWaterMinAmount = newBillObj.waterMinAmount;
      state.rooms[roomIndex].specialElecRate = billCalc.elecRate;
      state.rooms[roomIndex].specialElecMinUnits = newBillObj.elecMinUnits;
      state.rooms[roomIndex].specialElecMinAmount = newBillObj.elecMinAmount;
    } else {
      // Clear special settings
      delete state.rooms[roomIndex].specialWaterRate;
      delete state.rooms[roomIndex].specialWaterMinUnits;
      delete state.rooms[roomIndex].specialWaterMinAmount;
      delete state.rooms[roomIndex].specialElecRate;
      delete state.rooms[roomIndex].specialElecMinUnits;
      delete state.rooms[roomIndex].specialElecMinAmount;
    }
    saveData("rooms");
  }
  
  saveData("billingHistory");
  updateDashboard();
  renderRoomGrid();
  closeBillingModal();
}

// Delete Bill Handler
function deleteBill() {
  const roomNo = state.activeRoomNo;
  const billId = `${roomNo}-${state.selectedMonthCycle}`;
  
  if (confirm(`คุณต้องการยืนยันการลบบิลของห้อง ${roomNo} ใช่หรือไม่? ข้อมูลจะถูกลบและไม่สามารถเรียกคืนได้`)) {
    state.billingHistory = state.billingHistory.filter(b => b.id !== billId);
    saveData("billingHistory");
    updateDashboard();
    renderRoomGrid();
    closeBillingModal();
  }
}

// ==========================================
// 5. Invoice Preview & Print Engine
// ==========================================

// Create HTML content for single invoice/receipt
function generateInvoiceHTML(bill) {
  const thaiCycle = getThaiCycleName(bill.cycle);
  const todayStr = new Date(bill.billedDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const docTitle = bill.status === "paid" ? "ใบรับเงิน / ใบเสร็จรับเงิน (Receipt)" : "ใบแจ้งหนี้ / ใบเรียกเก็บเงิน (Invoice)";
  const isPaid = bill.status === "paid";
  
  // Generate Table Rows
  
  // Water
  let waterDesc = `ค่าน้ำประปา (Water)<br><span>เลขมิเตอร์: ครั้งล่าสุด (${bill.waterCurr}) - ครั้งก่อนหน้า (${bill.waterPrev}) = ใช้ไป ${bill.waterUnits} หน่วย</span>`;
  let waterQty = bill.waterUnits.toString();
  let waterRateText = bill.waterRate.toFixed(2);
  
  if (bill.isSpecial) {
    if (bill.waterUnits < (bill.waterMinUnits || 0)) {
      waterDesc = `ค่าน้ำประปา (Water)<br><span>เลขมิเตอร์: ใช้จริง ${bill.waterUnits} หน่วย (คิดขั้นต่ำ ${bill.waterMinUnits} หน่วย)</span>`;
      waterQty = bill.waterMinUnits.toString();
    } else if (bill.waterAmount === bill.waterMinAmount) {
      waterDesc = `ค่าน้ำประปา (Water)<br><span>ค่าน้ำประปา (คิดราคาเหมาจ่ายขั้นต่ำ)</span>`;
      waterQty = "—";
      waterRateText = "—";
    }
  }
  
  // Electricity
  let elecDesc = `ค่าไฟฟ้า (Electricity)<br><span>เลขมิเตอร์: ครั้งล่าสุด (${bill.elecCurr}) - ครั้งก่อนหน้า (${bill.elecPrev}) = ใช้ไป ${bill.elecUnits} หน่วย</span>`;
  let elecQty = bill.elecUnits.toString();
  let elecRateText = bill.elecRate.toFixed(2);
  
  if (bill.isSpecial) {
    if (bill.elecUnits < (bill.elecMinUnits || 0)) {
      elecDesc = `ค่าไฟฟ้า (Electricity)<br><span>เลขมิเตอร์: ใช้จริง ${bill.elecUnits} หน่วย (คิดขั้นต่ำ ${bill.elecMinUnits} หน่วย)</span>`;
      elecQty = bill.elecMinUnits.toString();
    } else if (bill.elecAmount === bill.elecMinAmount) {
      elecDesc = `ค่าไฟฟ้า (Electricity)<br><span>ค่าไฟฟ้า (คิดราคาเหมาจ่ายขั้นต่ำ)</span>`;
      elecQty = "—";
      elecRateText = "—";
    }
  }

  let tableRows = "";
  let rowIdx = 1;
  
  // Room Rent row
  if (bill.rent > 0) {
    tableRows += `
      <tr>
        <td>${rowIdx++}</td>
        <td class="desc">ค่าเช่าห้องพัก (Room Rent)</td>
        <td class="num">—</td>
        <td class="num">—</td>
        <td class="num">${bill.rent.toFixed(2)}</td>
      </tr>
    `;
  }
  
  // Common Fee row
  if (bill.commonFee > 0) {
    tableRows += `
      <tr>
        <td>${rowIdx++}</td>
        <td class="desc">ค่าบริการส่วนกลาง (Common Fee)</td>
        <td class="num">—</td>
        <td class="num">—</td>
        <td class="num">${bill.commonFee.toFixed(2)}</td>
      </tr>
    `;
  }
  
  // Water row
  if (bill.waterAmount > 0) {
    tableRows += `
      <tr>
        <td>${rowIdx++}</td>
        <td class="desc">${waterDesc}</td>
        <td class="num">${waterQty}</td>
        <td class="num">${waterRateText}</td>
        <td class="num">${bill.waterAmount.toFixed(2)}</td>
      </tr>
    `;
  }
  
  // Electricity row
  if (bill.elecAmount > 0) {
    tableRows += `
      <tr>
        <td>${rowIdx++}</td>
        <td class="desc">${elecDesc}</td>
        <td class="num">${elecQty}</td>
        <td class="num">${elecRateText}</td>
        <td class="num">${bill.elecAmount.toFixed(2)}</td>
      </tr>
    `;
  }
  
  // Custom items rows
  if (bill.customItems && bill.customItems.length > 0) {
    bill.customItems.forEach(item => {
      if (item.amount > 0) {
        tableRows += `
          <tr>
            <td>${rowIdx++}</td>
            <td class="desc">${item.name}</td>
            <td class="num">—</td>
            <td class="num">—</td>
            <td class="num">${item.amount.toFixed(2)}</td>
          </tr>
        `;
      }
    });
  }
  
  const bahtTextString = bahtText(bill.totalAmount);
  
  return `
    <div class="print-bill-wrapper">
      <div class="inv-header" style="display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 12px; align-items: flex-end;">
        <div>
          <h1 style="font-size: 20px; font-weight: 700; margin-bottom: 2px; line-height: 1.2;">${state.settings.dormName}</h1>
          ${state.settings.dormAddress ? `<p style="font-size: 12px; color: #444; margin-bottom: 0; line-height: 1.3;">${state.settings.dormAddress}</p>` : ''}
        </div>
        <div class="inv-title-box" style="text-align: right;">
          <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 2px; line-height: 1.2;">${docTitle}</h2>
          <p style="font-size: 12px; color: #444; margin-bottom: 0;">วันที่เอกสาร: ${todayStr}</p>
        </div>
      </div>
      
      <div class="inv-meta-rows" style="margin-bottom: 12px; font-size: 13px; line-height: 1.4; color: #000;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
          <div><strong>ผู้เช่า:</strong> ${bill.tenantName || "—"}</div>
          <div style="text-align: right;"><strong>รอบบิลประจำเดือน:</strong> ${thaiCycle}</div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <div><strong>ที่อยู่:</strong> ${bill.tenantAddress || `ชั้น ${Math.floor(parseInt(bill.roomNo)/100)} ${state.settings.dormName}`}</div>
          <div style="text-align: right;"><strong>ห้อง:</strong> ${bill.roomNo}</div>
        </div>
      </div>
      
      <table class="inv-table">
        <thead>
          <tr>
            <th style="width: 50px;">ลำดับ</th>
            <th>รายละเอียดรายการ</th>
            <th style="width: 80px;" class="num">หน่วยที่ใช้</th>
            <th style="width: 100px;" class="num">ราคา/หน่วย</th>
            <th style="width: 120px;" class="num">จำนวนเงิน (บาท)</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      
      <div class="inv-totals-box">
        <div class="inv-baht-text">(${bahtTextString})</div>
        <div class="inv-total-amount">ยอดรวมสุทธิ: ${bill.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</div>
      </div>
      
      ${!isPaid ? `
      <div class="inv-payment-info" style="display: flex; gap: 20px; align-items: center; border: 1px dashed #ccc; padding: 12px; background-color: #fafafa; border-radius: 4px; margin-bottom: 24px;">
        ${state.settings.dormQrCode ? `
          <div style="flex-shrink: 0;">
            <img src="${state.settings.dormQrCode}" style="width: 100px; height: 100px; object-fit: contain; border: 1px solid #ccc; padding: 4px; background: white; display: block;">
          </div>
        ` : ''}
        <div>
          <p><strong>ช่องทางการชำระเงิน: สามารถชำระได้ทั้งเงินสดและเงินโอน ไม่เกินวันที่ 5 ของทุกเดือน</strong></p>
          <p style="margin-top: 4px; white-space: pre-line;">${state.settings.dormPayment}</p>
        </div>
      </div>
      ` : ''}
      
      ${isPaid ? `
      <div class="inv-signatures">
        <div class="inv-sig-box">
          <div class="inv-sig-line"></div>
          <p>ผู้จัดทำ</p>
        </div>
        <div class="inv-sig-box">
          <div class="inv-sig-line"></div>
          <p>ผู้รับเงิน</p>
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

// Show Preview Modal
function openInvoicePreview() {
  const roomNo = state.activeRoomNo;
  const bill = state.billingHistory.find(b => b.roomNo === roomNo && b.cycle === state.selectedMonthCycle);
  
  if (!bill) return;
  
  const contentContainer = document.getElementById("invoice-preview-content");
  contentContainer.innerHTML = generateInvoiceHTML(bill);
  
  // Hide billing input modal
  document.getElementById("billing-modal").classList.remove("open");
  // Open preview modal
  document.getElementById("invoice-preview-modal").classList.add("open");
}

function closeInvoicePreview() {
  document.getElementById("invoice-preview-modal").classList.remove("open");
  // Re-open billing input modal for user convenience
  if (state.activeRoomNo) {
    document.getElementById("billing-modal").classList.add("open");
  }
}

// Print single active bill
function printActiveInvoice() {
  const roomNo = state.activeRoomNo;
  const bill = state.billingHistory.find(b => b.roomNo === roomNo && b.cycle === state.selectedMonthCycle);
  
  if (!bill) return;
  
  const printTemplate = document.getElementById("print-template");
  printTemplate.innerHTML = generateInvoiceHTML(bill);
  
  window.print();
}

// Print all unpaid bills of the month sequentially
function printAllUnpaidInvoices() {
  const unpaidBills = state.billingHistory.filter(b => b.cycle === state.selectedMonthCycle && b.status === "pending");
  
  if (unpaidBills.length === 0) {
    alert(`ไม่มีรายการค้างชำระสำหรับรอบเดือน ${getThaiCycleName(state.selectedMonthCycle)}`);
    return;
  }
  
  if (confirm(`พบรายการค้างชำระ ${unpaidBills.length} ห้อง ต้องการพิมพ์ใบแจ้งหนี้ทั้งหมดพร้อมกันหรือไม่?`)) {
    const printTemplate = document.getElementById("print-template");
    printTemplate.innerHTML = "";
    
    unpaidBills.forEach(bill => {
      printTemplate.innerHTML += generateInvoiceHTML(bill);
    });
    
    window.print();
  }
}

// ==========================================
// 6. Settings Panel & Defaults Logic
// ==========================================
function loadSettingsToForm() {
  document.getElementById("cfg-dorm-name").value = state.settings.dormName;
  document.getElementById("cfg-dorm-phone").value = state.settings.dormPhone;
  document.getElementById("cfg-dorm-address").value = state.settings.dormAddress || "";
  document.getElementById("cfg-dorm-payment").value = state.settings.dormPayment;
  document.getElementById("cfg-default-rent").value = state.settings.defaultRent;
  document.getElementById("cfg-default-common").value = state.settings.defaultCommonFee;
  document.getElementById("cfg-water-rate").value = state.settings.waterRate;
  document.getElementById("cfg-electricity-rate").value = state.settings.electricityRate;
  
  // Set tab title to ppmansion for print layouts
  document.title = "ppmansion";

  // Set sidebar name preview
  document.getElementById("sidebar-dorm-name").textContent = state.settings.dormName;

  // Set values to Quick Rate bar inputs
  document.getElementById("quick-rent-rate").value = state.settings.defaultRent;
  document.getElementById("quick-common-rate").value = state.settings.defaultCommonFee;
  document.getElementById("quick-water-rate").value = state.settings.waterRate;
  document.getElementById("quick-elec-rate").value = state.settings.electricityRate;

  // Handle QR image preview
  const qrPreview = document.getElementById("cfg-dorm-qr-preview");
  const clearQrBtn = document.getElementById("btn-clear-qr");
  if (state.settings.dormQrCode) {
    qrPreview.src = state.settings.dormQrCode;
    qrPreview.style.display = "block";
    clearQrBtn.style.display = "block";
  } else {
    qrPreview.src = "";
    qrPreview.style.display = "none";
    clearQrBtn.style.display = "none";
    document.getElementById("cfg-dorm-qr").value = "";
  }
}

function saveSettingsForm(e) {
  e.preventDefault();
  
  state.settings.dormName = document.getElementById("cfg-dorm-name").value.trim();
  state.settings.dormPhone = document.getElementById("cfg-dorm-phone").value.trim();
  state.settings.dormAddress = document.getElementById("cfg-dorm-address").value.trim();
  state.settings.dormPayment = document.getElementById("cfg-dorm-payment").value.trim();
  state.settings.defaultRent = parseFloat(document.getElementById("cfg-default-rent").value) || 0;
  state.settings.defaultCommonFee = parseFloat(document.getElementById("cfg-default-common").value) || 0;
  state.settings.waterRate = parseFloat(document.getElementById("cfg-water-rate").value) || 0;
  state.settings.electricityRate = parseFloat(document.getElementById("cfg-electricity-rate").value) || 0;
  
  saveData("settings");
  loadSettingsToForm();
  updateDashboard();
  renderRoomGrid();
  
  alert("บันทึกข้อมูลค่าเริ่มต้นเรียบร้อยแล้ว!");
}

// ==========================================
// 7. Backup and Data Portability Logic
// ==========================================
function exportBackupJSON() {
  const backupObj = {
    settings: state.settings,
    rooms: state.rooms,
    billingHistory: state.billingHistory,
    exportDate: new Date().toISOString()
  };
  
  const jsonStr = JSON.stringify(backupObj, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = `dormitory_backup_${state.selectedMonthCycle}_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function importBackupJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      
      if (!data.settings || !data.rooms || !data.billingHistory) {
        alert("โครงสร้างไฟล์นำเข้าไม่ถูกต้อง กรุณาใช้ไฟล์สำรองข้อมูลที่ดาวน์โหลดจากระบบนี้");
        return;
      }
      
      if (confirm("การนำเข้าข้อมูลจะเขียนทับข้อมูลทั้งหมดในปัจจุบัน คุณต้องการดำเนินการต่อใช่หรือไม่?")) {
        state.settings = data.settings;
        state.rooms = data.rooms;
        state.billingHistory = data.billingHistory;
        
        localStorage.setItem("dorm_settings", JSON.stringify(state.settings));
        localStorage.setItem("dorm_rooms", JSON.stringify(state.rooms));
        localStorage.setItem("dorm_billing_history", JSON.stringify(state.billingHistory));
        
        // Reload UI
        loadSettingsToForm();
        updateDashboard();
        renderRoomGrid();
        
        alert("นำเข้าข้อมูลสำเร็จ!");
      }
    } catch (err) {
      alert("ไม่สามารถอ่านไฟล์ได้ เนื่องจากรูปแบบ JSON ไม่ถูกต้อง: " + err.message);
    }
  };
  reader.readAsText(file);
}

function resetEntireSystem() {
  if (confirm("!!! คำเตือน: คุณต้องการรีเซ็ตล้างข้อมูลระบบทั้งหมดใช่หรือไม่? ข้อมูลประวัติบิลและการตั้งค่าจะหายไปทั้งหมดและเริ่มจากศูนย์")) {
    const doubleConfirm = prompt("กรุณาพิมพ์คำว่า 'ลบข้อมูล' เพื่อยืนยันการลบ:");
    if (doubleConfirm === "ลบข้อมูล") {
      localStorage.clear();
      loadData();
      loadSettingsToForm();
      updateDashboard();
      renderRoomGrid();
      alert("ล้างข้อมูลระบบสำเร็จ เริ่มต้นระบบใหม่เรียบร้อย");
    } else {
      alert("ยกเลิกการล้างข้อมูล");
    }
  }
}

// Function to rollover and start a new month cycle
function startNewMonthCycle() {
  const currentThaiCycle = getThaiCycleName(state.selectedMonthCycle);
  const parts = state.selectedMonthCycle.split('-');
  let year = parseInt(parts[0]);
  let month = parseInt(parts[1]);
  
  month++;
  if (month > 12) {
    month = 1;
    year++;
  }
  
  const nextMonthCycle = `${year}-${String(month).padStart(2, '0')}`;
  const nextThaiCycle = getThaiCycleName(nextMonthCycle);
  
  if (confirm(`คุณต้องการปิดรอบบิลเดือน "${currentThaiCycle}"\nและต้องการเริ่มต้นรอบบิลใหม่สำหรับเดือน "${nextThaiCycle}" ใช่หรือไม่?\n\n* ข้อมูลเลขมิเตอร์จดล่าสุดในเดือนเก่าของทุกห้อง จะกลายเป็นเลขมิเตอร์เริ่มต้นครั้งก่อนของเดือนใหม่โดยอัตโนมัติ`)) {
    state.selectedMonthCycle = nextMonthCycle;
    localStorage.setItem("dorm_active_cycle", state.selectedMonthCycle);
    
    // Update input picker
    document.getElementById("billing-cycle-select").value = state.selectedMonthCycle;
    
    // Sync values in settings forms
    loadSettingsToForm();
    
    // Refresh dashboard and room grids
    updateDashboard();
    renderRoomGrid();
    
    alert(`เริ่มรอบบิลประจำเดือน ${nextThaiCycle} เรียบร้อยแล้ว!`);
  }
}

// ==========================================
// 8. Custom Miscellaneous Services Logic
// ==========================================
function addNewCustomServiceItem() {
  const code = prompt("ระบุรหัสเรียกเก็บ / หมายเลขที่จอดรถ (เช่น P-01, SHOP-A, อื่นๆ-01):");
  if (!code) return;
  
  const trimmedCode = code.trim();
  if (trimmedCode === "") return;
  
  // Check if roomNo already exists
  const exists = state.rooms.some(r => r.roomNo.toLowerCase() === trimmedCode.toLowerCase());
  if (exists) {
    alert("รหัสเรียกเก็บ / เลขห้องนี้มีอยู่แล้วในระบบ! กรุณากรอกรหัสอื่น");
    return;
  }
  
  const name = prompt("ระบุชื่อผู้ใช้บริการ / ลูกค้า:");
  const address = prompt("ระบุที่อยู่ผู้รับบริการ / ข้อมูลรถ (ถ้ามี):");
  const rentVal = parseFloat(prompt("ระบุค่าบริการเหมาจ่ายรายเดือน (บาท):")) || 0;
  
  const newService = {
    roomNo: trimmedCode,
    tenantName: name || "",
    tenantAddress: address || "",
    isCustomItem: true,
    isSpecial: true, // Custom items behave like special rooms by default
    specialRent: rentVal,
    specialWaterRate: 0,
    specialWaterMinUnits: 0,
    specialWaterMinAmount: 0,
    specialElecRate: 0,
    specialElecMinUnits: 0,
    specialElecMinAmount: 0
  };
  
  state.rooms.push(newService);
  saveData("rooms");
  renderRoomGrid();
  
  alert(`เพิ่มบริการ ${trimmedCode} เรียบร้อยแล้ว!`);
}

function deleteCustomRoom() {
  const roomNo = state.activeRoomNo;
  if (!roomNo) return;
  
  if (confirm(`คุณต้องการยืนยันการลบข้อมูลบริการ / ที่จอดรถ ${roomNo} นี้ใช่หรือไม่? ประวัติบิลทั้งหมดและผู้ใช้บริการของรหัสนี้จะถูกลบออกจากระบบ`)) {
    state.rooms = state.rooms.filter(r => r.roomNo !== roomNo);
    state.billingHistory = state.billingHistory.filter(b => b.roomNo !== roomNo);
    
    saveData("rooms");
    saveData("billingHistory");
    updateDashboard();
    renderRoomGrid();
    closeBillingModal();
    alert(`ลบข้อมูลบริการ ${roomNo} เรียบร้อยแล้ว`);
  }
}

// ==========================================
// 8. Quick Meter Entry Sheet Logic
// ==========================================
function renderQuickMeterGrid() {
  const container = document.getElementById("quick-meter-grid-container");
  if (!container) return;
  container.innerHTML = "";
  
  // Read current utility type (water vs elec)
  const utility = document.querySelector('input[name="quick-meter-utility"]:checked')?.value || "water";
  
  // We have 5 floors, 15 rooms per floor. We'll render 5 column sheets side-by-side.
  for (let floor = 1; floor <= 5; floor++) {
    const colCard = document.createElement("div");
    colCard.style.cssText = "background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--border-radius-lg); padding: 16px; box-shadow: var(--box-shadow);";
    
    colCard.innerHTML = `<h4 style="margin-bottom: 12px; border-bottom: 2px solid var(--primary); padding-bottom: 6px; font-size: 14.5px; font-weight: 700; color: var(--gray-900);">ชั้นที่ ${floor}</h4>`;
    
    const table = document.createElement("table");
    table.style.cssText = "width: 100%; font-size: 13px; border-collapse: collapse;";
    
    // Table Header
    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <th style="text-align: left; padding: 6px 0; color: var(--text-muted);">ห้อง</th>
        <th style="text-align: right; padding: 6px 4px; color: var(--text-muted);">เก่า</th>
        <th style="text-align: right; padding: 6px 0; color: var(--text-muted); width: 85px;">ใหม่</th>
      </tr>
    `;
    table.appendChild(thead);
    
    const tbody = document.createElement("tbody");
    
    // Loop through 15 rooms on this floor
    for (let rNum = 1; rNum <= 15; rNum++) {
      const roomNo = String(floor * 100 + rNum);
      const roomInfo = state.rooms.find(r => r.roomNo === roomNo);
      if (!roomInfo) continue;
      
      const bill = state.billingHistory.find(b => b.roomNo === roomNo && b.cycle === state.selectedMonthCycle);
      
      let oldVal = 0;
      let newVal = "";
      
      if (bill) {
        if (utility === "water") {
          oldVal = bill.waterPrev;
          newVal = bill.waterCurr;
        } else {
          oldVal = bill.elecPrev;
          newVal = bill.elecCurr;
        }
      } else {
        // Find previous month's final meter reading
        const prevCycle = getPreviousMonthCycle(state.selectedMonthCycle);
        const lastMonthBill = state.billingHistory.find(b => b.roomNo === roomNo && b.cycle === prevCycle);
        
        if (lastMonthBill) {
          oldVal = utility === "water" ? lastMonthBill.waterCurr : lastMonthBill.elecCurr;
        } else {
          oldVal = utility === "water" ? (roomInfo.lastWaterMeter || 0) : (roomInfo.lastElecMeter || 0);
        }
      }
      
      const row = document.createElement("tr");
      row.style.cssText = "border-bottom: 1px solid var(--border-color);";
      
      // Star badge for special room indicator
      const star = roomInfo.isSpecial ? `<span style="color: var(--warning); margin-left: 2px;">★</span>` : '';
      
      row.innerHTML = `
        <td style="padding: 6px 0; font-weight: 600; color: var(--gray-800);">${roomNo}${star}</td>
        <td style="padding: 6px 4px; text-align: right; color: var(--text-muted); font-family: monospace;">${oldVal}</td>
        <td style="padding: 6px 0; text-align: right;">
          <input type="number" 
                 class="quick-meter-input form-control-sm" 
                 data-room="${roomNo}" 
                 data-utility="${utility}"
                 style="width: 75px; text-align: right; padding: 2px 6px; font-size: 13px; font-family: monospace; border: 1px solid var(--border-color); border-radius: var(--border-radius-sm);" 
                 value="${newVal !== undefined && newVal !== null && newVal !== "" ? newVal : ""}" 
                 placeholder="${oldVal}"
                 min="${oldVal}">
        </td>
      `;
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    colCard.appendChild(table);
    container.appendChild(colCard);
  }
  
  // Enter key navigation between quick meter inputs (moves down the column)
  const quickInputs = container.querySelectorAll(".quick-meter-input");
  quickInputs.forEach((input, index) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const nextInput = quickInputs[index + 1];
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
    });
  });
}

function saveQuickMeters() {
  const inputs = document.querySelectorAll(".quick-meter-input");
  const utility = document.querySelector('input[name="quick-meter-utility"]:checked')?.value || "water";
  let countSaved = 0;
  
  inputs.forEach(input => {
    const roomNo = input.getAttribute("data-room");
    const valStr = input.value.trim();
    if (valStr === "") return; // Skip if blank
    
    const newVal = parseFloat(valStr);
    const roomInfo = state.rooms.find(r => r.roomNo === roomNo);
    if (!roomInfo) return;
    
    // Search if bill exists for current cycle
    let bill = state.billingHistory.find(b => b.roomNo === roomNo && b.cycle === state.selectedMonthCycle);
    
    if (bill) {
      // Update existing bill values
      if (utility === "water") {
        bill.waterCurr = newVal;
      } else {
        bill.elecCurr = newVal;
      }
      
      // Recalculate bill costs
      const waterPrev = bill.waterPrev;
      const waterCurr = bill.waterCurr;
      const waterRate = bill.waterRate;
      let waterUnits = Math.max(0, waterCurr - waterPrev);
      let waterCost = waterUnits * waterRate;
      
      if (bill.isSpecial) {
        const waterMinUnits = bill.waterMinUnits || 0;
        const waterMinAmount = bill.waterMinAmount || 0;
        if (waterUnits < waterMinUnits) {
          waterCost = waterMinUnits * waterRate;
        }
        if (waterCost < waterMinAmount) {
          waterCost = waterMinAmount;
        }
      }
      bill.waterUnits = waterUnits;
      bill.waterAmount = waterCost;
      
      const elecPrev = bill.elecPrev;
      const elecCurr = bill.elecCurr;
      const elecRate = bill.elecRate;
      let elecUnits = Math.max(0, elecCurr - elecPrev);
      let elecCost = elecUnits * elecRate;
      
      if (bill.isSpecial) {
        const elecMinUnits = bill.elecMinUnits || 0;
        const elecMinAmount = bill.elecMinAmount || 0;
        if (elecUnits < elecMinUnits) {
          elecCost = elecMinUnits * elecRate;
        }
        if (elecCost < elecMinAmount) {
          elecCost = elecMinAmount;
        }
      }
      bill.elecUnits = elecUnits;
      bill.elecAmount = elecCost;
      
      const customSum = bill.customItems ? bill.customItems.reduce((sum, item) => sum + item.amount, 0) : 0;
      bill.totalAmount = bill.rent + bill.commonFee + bill.waterAmount + bill.elecAmount + customSum;
      
    } else {
      // Create new bill
      const isRoomSpecial = roomInfo.isSpecial === true;
      const rent = isRoomSpecial ? (roomInfo.specialRent || state.settings.defaultRent) : state.settings.defaultRent;
      const common = state.settings.defaultCommonFee;
      
      const waterRate = isRoomSpecial ? (roomInfo.specialWaterRate || state.settings.waterRate) : state.settings.waterRate;
      const elecRate = isRoomSpecial ? (roomInfo.specialElecRate || state.settings.electricityRate) : state.settings.electricityRate;
      
      // Determine previous meters
      let waterPrev = 0;
      let elecPrev = 0;
      const prevCycle = getPreviousMonthCycle(state.selectedMonthCycle);
      const lastMonthBill = state.billingHistory.find(b => b.roomNo === roomNo && b.cycle === prevCycle);
      
      if (lastMonthBill) {
        waterPrev = lastMonthBill.waterCurr;
        elecPrev = lastMonthBill.elecCurr;
      } else {
        waterPrev = roomInfo.lastWaterMeter || 0;
        elecPrev = roomInfo.lastElecMeter || 0;
      }
      
      const waterCurr = utility === "water" ? newVal : waterPrev;
      const elecCurr = utility === "elec" ? newVal : elecPrev;
      
      // Math:
      let waterUnits = Math.max(0, waterCurr - waterPrev);
      let waterCost = waterUnits * waterRate;
      const waterMinUnits = isRoomSpecial ? (roomInfo.specialWaterMinUnits || 0) : 0;
      const waterMinAmount = isRoomSpecial ? (roomInfo.specialWaterMinAmount || 0) : 0;
      
      if (isRoomSpecial) {
        if (waterUnits < waterMinUnits) {
          waterCost = waterMinUnits * waterRate;
        }
        if (waterCost < waterMinAmount) {
          waterCost = waterMinAmount;
        }
      }
      
      let elecUnits = Math.max(0, elecCurr - elecPrev);
      let elecCost = elecUnits * elecRate;
      const elecMinUnits = isRoomSpecial ? (roomInfo.specialElecMinUnits || 0) : 0;
      const elecMinAmount = isRoomSpecial ? (roomInfo.specialElecMinAmount || 0) : 0;
      
      if (isRoomSpecial) {
        if (elecUnits < elecMinUnits) {
          elecCost = elecMinUnits * elecRate;
        }
        if (elecCost < elecMinAmount) {
          elecCost = elecMinAmount;
        }
      }
      
      const total = rent + common + waterCost + elecCost;
      const billId = `${roomNo}-${state.selectedMonthCycle}`;
      
      bill = {
        id: billId,
        roomNo: roomNo,
        tenantName: roomInfo.tenantName || "",
        tenantAddress: roomInfo.tenantAddress || "",
        cycle: state.selectedMonthCycle,
        rent: rent,
        commonFee: common,
        waterPrev: waterPrev,
        waterCurr: waterCurr,
        waterUnits: waterUnits,
        waterRate: waterRate,
        waterAmount: waterCost,
        elecPrev: elecPrev,
        elecCurr: elecCurr,
        elecUnits: elecUnits,
        elecRate: elecRate,
        elecAmount: elecCost,
        customItems: [],
        totalAmount: total,
        status: "pending",
        billedDate: new Date().toISOString(),
        paidDate: null,
        
        isSpecial: isRoomSpecial,
        waterMinUnits: waterMinUnits,
        waterMinAmount: waterMinAmount,
        elecMinUnits: elecMinUnits,
        elecMinAmount: elecMinAmount
      };
      
      state.billingHistory.push(bill);
    }
    
    // Also save readings to the room object
    if (utility === "water") {
      roomInfo.lastWaterMeter = newVal;
    } else {
      roomInfo.lastElecMeter = newVal;
    }
    
    countSaved++;
  });
  
  if (countSaved > 0) {
    saveData("billingHistory");
    saveData("rooms");
    updateDashboard();
    renderRoomGrid();
    renderQuickMeterGrid();
    
    const statusMsg = document.getElementById("quick-meter-status-msg");
    statusMsg.textContent = `บันทึกมิเตอร์ทั้งหมดเรียบร้อยแล้ว (${countSaved} ห้อง)`;
    setTimeout(() => {
      statusMsg.textContent = "";
    }, 4000);
    
    alert(`บันทึกข้อมูลมิเตอร์เรียบร้อยแล้วทั้งหมด ${countSaved} ห้อง!`);
  } else {
    alert("ไม่พบข้อมูลมิเตอร์ใหม่ที่กรอก กรุณากรอกเลขจดครั้งใหม่เพื่อบันทึก");
  }
}

// ==========================================
// 8. Navigation & Event Attachments
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  
  // Set Month Selector to match active cycle
  const cycleSelect = document.getElementById("billing-cycle-select");
  cycleSelect.value = state.selectedMonthCycle;
  cycleSelect.addEventListener("change", (e) => {
    state.selectedMonthCycle = e.target.value;
    localStorage.setItem("dorm_active_cycle", state.selectedMonthCycle);
    
    loadSettingsToForm();
    updateDashboard();
    renderRoomGrid();
  });
  
  // Link event for the rollover button
  document.getElementById("btn-next-month").addEventListener("click", startNewMonthCycle);

  // Link events for Quick Rate input boxes
  const quickRentInput = document.getElementById("quick-rent-rate");
  const quickCommonInput = document.getElementById("quick-common-rate");
  const quickWaterInput = document.getElementById("quick-water-rate");
  const quickElecInput = document.getElementById("quick-elec-rate");

  const syncQuickRates = () => {
    state.settings.defaultRent = parseFloat(quickRentInput.value) || 0;
    state.settings.defaultCommonFee = parseFloat(quickCommonInput.value) || 0;
    state.settings.waterRate = parseFloat(quickWaterInput.value) || 0;
    state.settings.electricityRate = parseFloat(quickElecInput.value) || 0;
    
    saveData("settings");
    
    // Sync to main settings form
    document.getElementById("cfg-default-rent").value = state.settings.defaultRent;
    document.getElementById("cfg-default-common").value = state.settings.defaultCommonFee;
    document.getElementById("cfg-water-rate").value = state.settings.waterRate;
    document.getElementById("cfg-electricity-rate").value = state.settings.electricityRate;
  };

  quickRentInput.addEventListener("input", syncQuickRates);
  quickCommonInput.addEventListener("input", syncQuickRates);
  quickWaterInput.addEventListener("input", syncQuickRates);
  quickElecInput.addEventListener("input", syncQuickRates);
  
  // Sidebar Navigation Tabs
  const navItems = document.querySelectorAll(".nav-item");
  const contentSections = document.querySelectorAll(".content-section");
  const pageTitle = document.getElementById("page-title");
  
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      navItems.forEach(nav => nav.classList.remove("active"));
      contentSections.forEach(sec => sec.classList.remove("active"));
      
      item.classList.add("active");
      const targetId = item.getAttribute("data-target");
      document.getElementById(targetId).classList.add("active");
      
      // Update header title based on view
      if (targetId === "dashboard-section") pageTitle.textContent = "แดชบอร์ดสรุปรายเดือน";
      else if (targetId === "rooms-section") pageTitle.textContent = "จัดการค่าห้องพัก";
      else if (targetId === "quick-meter-section") {
        pageTitle.textContent = "จดมิเตอร์ด่วน";
        renderQuickMeterGrid();
      }
      else if (targetId === "settings-section") pageTitle.textContent = "ตั้งค่า & สำรองข้อมูล";
    });
  });
  
  // Floor Filter Buttons
  const floorBtns = document.querySelectorAll(".floor-btn");
  floorBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      floorBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.selectedFloor = btn.getAttribute("data-floor");
      renderRoomGrid();
    });
  });
  
  // Status Selector filter
  document.getElementById("status-filter").addEventListener("change", (e) => {
    state.selectedStatus = e.target.value;
    renderRoomGrid();
  });
  
  // Search Box filter
  document.getElementById("search-room-input").addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderRoomGrid();
  });
  
  // Quick Dashboard Navigation triggers
  document.getElementById("quick-go-billing").addEventListener("click", () => {
    document.querySelector('.nav-item[data-target="rooms-section"]').click();
  });
  
  document.getElementById("quick-print-all-unpaid").addEventListener("click", printAllUnpaidInvoices);
  document.getElementById("quick-export-data").addEventListener("click", exportBackupJSON);
  
  // Modal Buttons
  document.getElementById("close-billing-modal-btn").addEventListener("click", closeBillingModal);
  document.getElementById("btn-add-custom-item").addEventListener("click", () => createCustomItemRow("", 0));
  document.getElementById("btn-save-bill").addEventListener("click", saveBillFromModal);
  document.getElementById("btn-delete-bill").addEventListener("click", deleteBill);
  document.getElementById("btn-delete-custom-room").addEventListener("click", deleteCustomRoom);
  document.getElementById("btn-preview-invoice").addEventListener("click", openInvoicePreview);
  
  // Modal Room Type Toggle radio listener
  const roomTypeRadios = document.querySelectorAll('input[name="room-type-toggle"]');
  roomTypeRadios.forEach(radio => {
    radio.addEventListener("change", (e) => {
      const isSpecial = e.target.value === "special";
      document.getElementById("water-special-config").style.display = isSpecial ? "block" : "none";
      document.getElementById("elec-special-config").style.display = isSpecial ? "block" : "none";
      calculateFormTotal();
    });
  });

  // Attach calculation events to the special minimum inputs
  document.getElementById("bill-water-min-units").addEventListener("input", calculateFormTotal);
  document.getElementById("bill-water-min-amount").addEventListener("input", calculateFormTotal);
  document.getElementById("bill-elec-min-units").addEventListener("input", calculateFormTotal);
  document.getElementById("bill-elec-min-amount").addEventListener("input", calculateFormTotal);
  
  // Invoice Modal Buttons
  document.getElementById("close-invoice-modal-btn").addEventListener("click", closeInvoicePreview);
  document.getElementById("btn-back-to-edit").addEventListener("click", closeInvoicePreview);
  document.getElementById("btn-trigger-print").addEventListener("click", printActiveInvoice);
  
  // Settings Form
  document.getElementById("settings-form").addEventListener("submit", saveSettingsForm);
  
  // Backup / Restore Panel Buttons
  document.getElementById("btn-export-json").addEventListener("click", exportBackupJSON);
  document.getElementById("import-file-input").addEventListener("change", importBackupJSON);
  document.getElementById("btn-reset-system").addEventListener("click", resetEntireSystem);
  
  // Sync to main settings form
  loadSettingsToForm();
  updateDashboard();
  renderRoomGrid();

  // QR Code Image Upload and Clear handlers
  const qrFileInput = document.getElementById("cfg-dorm-qr");
  const qrPreviewImage = document.getElementById("cfg-dorm-qr-preview");
  const clearQrImageBtn = document.getElementById("btn-clear-qr");

  qrFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      state.settings.dormQrCode = event.target.result;
      saveData("settings");
      
      qrPreviewImage.src = state.settings.dormQrCode;
      qrPreviewImage.style.display = "block";
      clearQrImageBtn.style.display = "block";
    };
    reader.readAsDataURL(file);
  });

  clearQrImageBtn.addEventListener("click", () => {
    state.settings.dormQrCode = null;
    saveData("settings");
    
    qrPreviewImage.src = "";
    qrPreviewImage.style.display = "none";
    clearQrImageBtn.style.display = "none";
    qrFileInput.value = "";
  });

  // Quick Meter Entry Tab and Save Event triggers
  const quickUtilityRadios = document.querySelectorAll('input[name="quick-meter-utility"]');
  quickUtilityRadios.forEach(radio => {
    radio.addEventListener("change", renderQuickMeterGrid);
  });

  document.getElementById("btn-save-quick-meters").addEventListener("click", saveQuickMeters);
});
