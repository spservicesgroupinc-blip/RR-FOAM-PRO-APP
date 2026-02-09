
import { 
  CalculationMode, 
  CalculatorState, 
  CalculationResults, 
  FoamType,
  AreaType
} from '../types';

/**
 * Parses a pitch string into a slope factor.
 * Supports "X/12" or "Xdeg" / "X deg".
 * Default returns 1 (flat).
 */
export const parsePitch = (input: string): { factor: number; display: string } => {
  if (!input) return { factor: 1, display: 'Flat (1.0)' };
  
  const cleanInput = input.toLowerCase().trim();

  // Handle "X/12"
  const ratioMatch = cleanInput.match(/^(\d+(\.\d+)?)\/12$/);
  if (ratioMatch) {
    const rise = parseFloat(ratioMatch[1]);
    const factor = Math.sqrt(1 + Math.pow(rise / 12, 2));
    return { factor, display: `${rise}/12 (${factor.toFixed(3)})` };
  }

  // Handle Degree
  const degMatch = cleanInput.match(/^(\d+(\.\d+)?)\s*(deg|degrees?|°)$/);
  if (degMatch) {
    const deg = parseFloat(degMatch[1]);
    const rad = deg * (Math.PI / 180);
    const factor = 1 / Math.cos(rad); 
    return { factor, display: `${deg}° (${factor.toFixed(3)})` };
  }

  // Handle just a number (assume /12 pitch as default construction standard)
  const numMatch = cleanInput.match(/^(\d+(\.\d+)?)$/);
  if (numMatch) {
    const rise = parseFloat(numMatch[1]);
    const factor = Math.sqrt(1 + Math.pow(rise / 12, 2));
    return { factor, display: `${rise}/12 (${factor.toFixed(3)})` };
  }

  return { factor: 1, display: 'Invalid/Flat (1.0)' };
};

/**
 * Helper to round to 2 decimal places strictly
 */
const round2 = (num: number): number => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
};

/**
 * Core calculation engine.
 */
export const calculateResults = (state: CalculatorState): CalculationResults => {
  const { 
    mode, length, width, wallHeight, roofPitch, 
    includeGables, isMetalSurface, wallSettings, roofSettings, 
    additionalAreas, expenses, costs
  } = state;

  const pitchData = parsePitch(roofPitch);
  const slopeFactor = pitchData.factor;
  
  // Metal Surface Factor: Adds 15% to account for corrugation ridges
  const surfaceFactor = isMetalSurface ? 1.15 : 1.0;

  let perimeter = 0;
  let baseWallArea = 0;
  let gableArea = 0;
  let baseRoofArea = 0;

  // 1. Calculate Base Geometry based on Mode
  switch (mode) {
    case CalculationMode.BUILDING:
      perimeter = 2 * (length + width);
      baseWallArea = perimeter * wallHeight;
      baseRoofArea = (length * width) * slopeFactor;
      
      if (includeGables) {
        const riseOver12 = Math.sqrt(Math.pow(slopeFactor, 2) - 1);
        gableArea = width * ((width / 2) * riseOver12);
      }
      break;

    case CalculationMode.WALLS_ONLY:
      perimeter = length; 
      baseWallArea = length * wallHeight;
      baseRoofArea = 0;
      gableArea = 0;
      break;

    case CalculationMode.FLAT_AREA:
      perimeter = 2 * (length + width);
      baseWallArea = 0; 
      baseRoofArea = length * width; 
      baseRoofArea = baseRoofArea * slopeFactor;
      break;

    case CalculationMode.CUSTOM:
      break;
  }

  // 2. Add Additional Areas
  const additionalWallArea = additionalAreas
    .filter(a => a.type === AreaType.WALL)
    .reduce((sum, a) => sum + (a.length * a.width), 0);

  const additionalRoofArea = additionalAreas
    .filter(a => a.type === AreaType.ROOF)
    .reduce((sum, a) => sum + (a.length * a.width), 0); 

  // 3. Totals & Apply Surface Factor
  const totalWallArea = (baseWallArea + gableArea + additionalWallArea) * surfaceFactor;
  const totalRoofArea = (baseRoofArea + additionalRoofArea) * surfaceFactor;

  // 4. Board Feet Calculation
  const wallVolume = totalWallArea * wallSettings.thickness;
  const roofVolume = totalRoofArea * roofSettings.thickness;

  const wallBdFt = wallVolume * (1 + wallSettings.wastePercentage / 100);
  const roofBdFt = roofVolume * (1 + roofSettings.wastePercentage / 100);

  // 5. Aggregate by Foam Type
  let totalOpenCellBdFt = 0;
  let totalClosedCellBdFt = 0;

  if (wallSettings.type === FoamType.OPEN_CELL) {
    totalOpenCellBdFt += wallBdFt;
  } else {
    totalClosedCellBdFt += wallBdFt;
  }

  if (roofSettings.type === FoamType.OPEN_CELL) {
    totalOpenCellBdFt += roofBdFt;
  } else {
    totalClosedCellBdFt += roofBdFt;
  }

  // 6. Sets Required
  const openCellSets = totalOpenCellBdFt / state.yields.openCell;
  const closedCellSets = totalClosedCellBdFt / state.yields.closedCell;

  // 7. Calculate Strokes (New)
  const openCellStrokes = openCellSets * (state.yields.openCellStrokes || 6600); // Default fallback if config missing
  const closedCellStrokes = closedCellSets * (state.yields.closedCellStrokes || 6600);

  // 8. Costs (COGS Calculation)
  const openCellCost = openCellSets * state.costs.openCell;
  const closedCellCost = closedCellSets * state.costs.closedCell;
  
  // 8b. Prep/Inventory Cost
  let inventoryCost = 0;
  if (state.inventory && state.inventory.length > 0) {
      state.inventory.forEach(item => {
          if (item.unitCost && item.quantity) {
              inventoryCost += (item.quantity * item.unitCost);
          }
      });
  }

  // Material Cost = Chemicals + Inventory
  const materialCost = openCellCost + closedCellCost + inventoryCost;

  // 9. Expenses & Labor
  const activeLaborRate = (expenses.laborRate !== undefined && expenses.laborRate !== null) 
    ? expenses.laborRate 
    : (costs.laborRate || 0);
    
  const laborCost = (expenses.manHours || 0) * activeLaborRate;
  const miscExpenses = (expenses.tripCharge || 0) + (expenses.fuelSurcharge || 0) + (expenses.other?.amount || 0);

  // 10. Total Price Calculation
  let totalCost = 0;

  if (state.pricingMode === 'sqft_pricing') {
    const wallRevenue = totalWallArea * (state.sqFtRates?.wall || 0);
    const roofRevenue = totalRoofArea * (state.sqFtRates?.roof || 0);
    totalCost = wallRevenue + roofRevenue + inventoryCost + miscExpenses;
  } else {
    totalCost = materialCost + laborCost + miscExpenses;
  }

  return {
    perimeter: round2(perimeter),
    slopeFactor: slopeFactor, // Keep precision for internal math, display logic handles presentation
    baseWallArea: round2(baseWallArea),
    gableArea: round2(gableArea),
    totalWallArea: round2(totalWallArea),
    baseRoofArea: round2(baseRoofArea),
    totalRoofArea: round2(totalRoofArea),
    wallBdFt: round2(wallBdFt),
    roofBdFt: round2(roofBdFt),
    totalOpenCellBdFt: round2(totalOpenCellBdFt),
    totalClosedCellBdFt: round2(totalClosedCellBdFt),
    openCellSets: round2(openCellSets),
    closedCellSets: round2(closedCellSets),
    openCellStrokes: Math.round(openCellStrokes), // Integer
    closedCellStrokes: Math.round(closedCellStrokes), // Integer
    openCellCost: round2(openCellCost),
    closedCellCost: round2(closedCellCost),
    inventoryCost: round2(inventoryCost),
    laborCost: round2(laborCost),
    miscExpenses: round2(miscExpenses),
    materialCost: round2(materialCost), 
    totalCost: round2(totalCost),    
  };
};
