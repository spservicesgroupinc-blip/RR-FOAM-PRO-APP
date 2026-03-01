import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const crewPinHash = await bcrypt.hash('1234', 12);
  const passwordHash = await bcrypt.hash('password123', 12);

  // Create demo organization
  const org = await prisma.organization.upsert({
    where: { companyName: 'Demo Foam Co' },
    update: {},
    create: {
      companyName: 'Demo Foam Co',
      crewPinHash,
      openCellSets: 10,
      closedCellSets: 8,
      yields: {
        openCell: 18000,
        closedCell: 5400,
        openCellStrokes: 10,
        closedCellStrokes: 10,
      },
      costs: {
        openCell: 650,
        closedCell: 750,
        laborRate: 45,
      },
      lifetimeUsage: {
        openCell: 25,
        closedCell: 18,
      },
    },
  });

  // Create admin user
  await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      email: 'admin@demo.com',
      passwordHash,
      username: 'Admin',
      organizationId: org.id,
      role: 'admin',
    },
  });

  // Create company profile
  await prisma.companyProfile.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      companyName: 'Demo Foam Co',
      addressLine1: '123 Insulation Way',
      city: 'Houston',
      state: 'TX',
      zip: '77001',
      phone: '(555) 123-4567',
      email: 'info@demofoam.com',
    },
  });

  // Create sample customers
  const customer1 = await prisma.customer.upsert({
    where: { id: 'seed-customer-1' },
    update: {},
    create: {
      id: 'seed-customer-1',
      organizationId: org.id,
      name: 'John Smith',
      address: '456 Oak Dr',
      city: 'Houston',
      state: 'TX',
      zip: '77002',
      phone: '(555) 987-6543',
      email: 'john@example.com',
      status: 'Active',
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { id: 'seed-customer-2' },
    update: {},
    create: {
      id: 'seed-customer-2',
      organizationId: org.id,
      name: 'ABC Construction',
      address: '789 Builder Blvd',
      city: 'Dallas',
      state: 'TX',
      zip: '75201',
      phone: '(555) 555-0199',
      email: 'info@abcconst.com',
      status: 'Active',
    },
  });

  // Create sample warehouse items
  await prisma.warehouseItem.createMany({
    skipDuplicates: true,
    data: [
      { organizationId: org.id, name: 'Spray Gun Tips', quantity: 24, unit: 'each', unitCost: 12.50 },
      { organizationId: org.id, name: 'Hose Fittings', quantity: 10, unit: 'each', unitCost: 35.00 },
      { organizationId: org.id, name: 'Transfer Pump Filters', quantity: 6, unit: 'each', unitCost: 28.00 },
      { organizationId: org.id, name: 'Safety Masks', quantity: 50, unit: 'each', unitCost: 8.00 },
    ],
  });

  // Create sample equipment
  await prisma.equipment.createMany({
    skipDuplicates: true,
    data: [
      { organizationId: org.id, name: 'Graco E-30 Rig', status: 'Available' },
      { organizationId: org.id, name: 'PMC PH-40 Proportioner', status: 'Available' },
      { organizationId: org.id, name: '200ft Heated Hose Set', status: 'Available' },
      { organizationId: org.id, name: 'Fusion AP Gun', status: 'Available' },
    ],
  });

  // Create a sample estimate
  await prisma.estimate.upsert({
    where: { id: 'seed-estimate-1' },
    update: {},
    create: {
      id: 'seed-estimate-1',
      organizationId: org.id,
      customerId: customer1.id,
      date: new Date().toISOString().split('T')[0],
      status: 'Draft',
      executionStatus: 'NotStarted',
      inputs: {
        mode: 'Building',
        length: 40,
        width: 30,
        wallHeight: 10,
        roofPitch: '4/12',
        includeGables: true,
        isMetalSurface: false,
        additionalAreas: [],
      },
      results: {},
      materials: { openCellSets: 2, closedCellSets: 0, inventory: [], equipment: [] },
      wallSettings: { type: 'Open Cell', thickness: 3.5, wastePercentage: 10 },
      roofSettings: { type: 'Open Cell', thickness: 5.5, wastePercentage: 15 },
      expenses: { manHours: 8, tripCharge: 150, fuelSurcharge: 75, other: { description: '', amount: 0 } },
      totalValue: 4500,
    },
  });

  console.log('✓ Seed complete');
  console.log('  Admin login: admin@demo.com / password123');
  console.log('  Crew login:  Company "Demo Foam Co", PIN 1234');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
