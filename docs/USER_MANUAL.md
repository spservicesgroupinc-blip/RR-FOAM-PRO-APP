# RFE Foam Pro — User Manual

**Enterprise Spray Foam Estimation & Rig Management Suite**
*Version 2.0 — February 2026*

---

## Table of Contents

1. [Overview](#1-overview)
2. [Getting Started](#2-getting-started)
   - [Installing the App (PWA)](#21-installing-the-app-pwa)
   - [Creating an Account](#22-creating-an-account)
   - [Logging In — Admin vs Crew](#23-logging-in--admin-vs-crew)
   - [First-Time Setup & Guided Tour](#24-first-time-setup--guided-tour)
3. [Navigation & App Layout](#3-navigation--app-layout)
   - [Desktop Sidebar](#31-desktop-sidebar)
   - [Mobile Bottom Navigation](#32-mobile-bottom-navigation)
   - [Quick Action Menu](#33-quick-action-menu)
   - [Notifications & Sync Status](#34-notifications--sync-status)
4. [Dashboard](#4-dashboard)
   - [Inventory Health Banner](#41-inventory-health-banner)
   - [Lifetime Usage Card](#42-lifetime-usage-card)
   - [Operations Tab — Job Pipeline](#43-operations-tab--job-pipeline)
   - [Profit & Loss Tab — Financials](#44-profit--loss-tab--financials)
5. [Estimate Calculator](#5-estimate-calculator)
   - [Selecting a Customer](#51-selecting-a-customer)
   - [Calculation Modes](#52-calculation-modes)
   - [Building Dimensions](#53-building-dimensions)
   - [Insulation Specifications](#54-insulation-specifications)
   - [Prep & Inventory](#55-prep--inventory)
   - [Equipment / Tools](#56-equipment--tools)
   - [Labor & Fees](#57-labor--fees)
   - [Results Summary](#58-results-summary)
   - [Saving an Estimate](#59-saving-an-estimate)
6. [Job Workflow — Estimate to Payment](#6-job-workflow--estimate-to-payment)
   - [Step 1: Draft Estimate](#61-step-1-draft-estimate)
   - [Step 2: Finalize Estimate (PDF)](#62-step-2-finalize-estimate-pdf)
   - [Step 3: Mark Sold → Work Order](#63-step-3-mark-sold--work-order)
   - [Step 4: Finalize Work Order (PDF)](#64-step-4-finalize-work-order-pdf)
   - [Step 5: Generate Invoice (PDF)](#65-step-5-generate-invoice-pdf)
   - [Step 6: Record Payment](#66-step-6-record-payment)
   - [Job Progress Indicator](#67-job-progress-indicator)
7. [PDF Document Builder](#7-pdf-document-builder)
   - [Document Types](#71-document-types)
   - [Editing Document Fields](#72-editing-document-fields)
   - [Line Items](#73-line-items)
   - [Exporting & Downloading](#74-exporting--downloading)
   - [Cloud Document Storage](#75-cloud-document-storage)
8. [Customer Database (CRM)](#8-customer-database-crm)
   - [Adding a Customer](#81-adding-a-customer)
   - [Customer Detail View](#82-customer-detail-view)
   - [Job History](#83-job-history)
   - [Document Library](#84-document-library)
   - [Archiving Customers](#85-archiving-customers)
9. [Warehouse & Inventory](#9-warehouse--inventory)
   - [Chemical Sets (Foam Stock)](#91-chemical-sets-foam-stock)
   - [General Inventory Items](#92-general-inventory-items)
   - [Tracked Equipment](#93-tracked-equipment)
   - [Automatic Deductions](#94-automatic-deductions)
10. [Material Orders & Purchase Orders](#10-material-orders--purchase-orders)
    - [Shortage Detection](#101-shortage-detection)
    - [Creating a Purchase Order](#102-creating-a-purchase-order)
    - [Auto-Restocking Warehouse](#103-auto-restocking-warehouse)
11. [Material Usage Report](#11-material-usage-report)
    - [Viewing the Ledger](#111-viewing-the-ledger)
    - [Filtering by Period](#112-filtering-by-period)
    - [Exporting to PDF](#113-exporting-to-pdf)
12. [Equipment Tracker](#12-equipment-tracker)
    - [Last-Known Location](#121-last-known-location)
13. [Equipment Maintenance](#13-equipment-maintenance)
    - [Adding Equipment](#131-adding-equipment)
    - [Service Items & Intervals](#132-service-items--intervals)
    - [Logging Service](#133-logging-service)
    - [Job Usage Sync](#134-job-usage-sync)
    - [Service History](#135-service-history)
14. [Crew Dashboard (Field Technician View)](#14-crew-dashboard-field-technician-view)
    - [Logging In as Crew](#141-logging-in-as-crew)
    - [Viewing Work Orders](#142-viewing-work-orders)
    - [Starting a Job & Time Clock](#143-starting-a-job--time-clock)
    - [Completing a Job](#144-completing-a-job)
    - [GPS Navigation](#145-gps-navigation)
15. [Settings](#15-settings)
    - [Material Yields & Strokes](#151-material-yields--strokes)
    - [Unit Costs](#152-unit-costs)
16. [Company Profile](#16-company-profile)
    - [Company Branding & Logo](#161-company-branding--logo)
    - [Crew Access Credentials](#162-crew-access-credentials)
    - [Security — Password Change](#163-security--password-change)
17. [Cloud Sync & Offline Support](#17-cloud-sync--offline-support)
    - [Real-Time Sync](#171-real-time-sync)
    - [Manual Sync](#172-manual-sync)
    - [Offline Fallback](#173-offline-fallback)
18. [Subscription Plans](#18-subscription-plans)
19. [Tips & Best Practices](#19-tips--best-practices)
20. [Troubleshooting](#20-troubleshooting)

---

## 1. Overview

**RFE Foam Pro** is an enterprise-grade Progressive Web App (PWA) designed for spray foam insulation contractors. It provides a complete business management suite — from estimation and scheduling through invoicing and financial reporting — all in one installable application that works on desktop, tablet, and mobile.

### What You Can Do

- **Estimate jobs** using a geometry-based spray foam calculator (board footage, chemical sets, stroke counts)
- **Manage customers** with a built-in CRM (leads, contacts, job history, documents)
- **Track inventory** — chemical sets, supplies, and equipment with automatic deductions when jobs are sold
- **Generate professional PDFs** — estimates, work orders, invoices, receipts, and purchase orders
- **Dispatch work to crews** — crew members log in with a simple PIN, see their work orders, clock time, and report actuals
- **Track profitability** — per-job P&L, gross margin analysis, estimated vs. actual comparison
- **Maintain equipment** — interval-based maintenance tracking tied to chemical sets sprayed
- **Order materials** — auto-detect shortages and generate purchase orders
- **Sync everything to the cloud** — real-time data sync via Supabase with offline fallback

### Two User Roles

| Role | Access | Description |
|------|--------|-------------|
| **Admin** | Full access | Business owners and office staff. See all pricing, financials, and management tools. |
| **Crew** | Work orders only | Field technicians. Touch-optimized view. **No pricing visible.** Can start/stop jobs, log material usage, and submit completion reports. |

---

## 2. Getting Started

### 2.1 Installing the App (PWA)

RFE Foam Pro is a Progressive Web App — it works in your browser but can be **installed** like a native app for the best experience.

**Desktop (Chrome / Edge):**
1. Visit the app URL in your browser
2. Look for the **"Install Now"** button (pulsing red) in the sidebar or a browser install icon in the address bar
3. Click **Install** in the prompt
4. The app opens in its own window — no browser tabs needed

**Mobile (Android):**
1. Open the app in Chrome
2. Tap the **"Install Now"** button or use Chrome's **"Add to Home Screen"** option from the menu
3. The app icon appears on your home screen

**Mobile (iOS / iPadOS):**
1. Open the app in **Safari**
2. Tap the **Share** button (square with arrow)
3. Tap **"Add to Home Screen"**
4. The app runs in full-screen standalone mode

> **Tip:** Installing the app gives you faster load times, offline access, and a native app experience.

### 2.2 Creating an Account

1. On the login screen, click **"Don't have an account? Sign up"**
2. Fill in:
   - **Company Name** — your business name (appears on PDFs)
   - **Full Name** — your personal name
   - **Email** — your login email
   - **Password** — minimum 6 characters
3. Click **"Create Account"**
4. Your organization is automatically created with a unique Company ID and default settings

### 2.3 Logging In — Admin vs Crew

The login screen has **two tabs**:

#### Admin Access
- Enter your **Email** and **Password**
- Click **"Sign In"**
- Full access to all features

#### Crew Login
- Enter the **Company Name** (provided by your admin)
- Enter the **Crew Access PIN** (a 6-digit code set by the admin)
- Click **"Access Jobs"**
- Opens the simplified Crew Dashboard (no pricing, work orders only)

> **Note:** Crew members do not need individual accounts. All crew share the same PIN within an organization.

### 2.4 First-Time Setup & Guided Tour

When you first log in, the app launches an **11-step guided walkthrough** that introduces every section:

1. **Welcome** — Overview of the app
2. **Dashboard** — Your operations hub
3. **Create New** — Quick actions
4. **Customers** — CRM module
5. **Calculator** — The estimation engine
6. **Warehouse** — Inventory management
7. **Workflow** — Estimate → Work Order → Invoice → Paid
8. **Settings** — Configure yields and costs
9. **Profile** — Company branding
10. **Sync** — Cloud synchronization
11. **Complete** — You're ready to go!

You can **skip** the tour at any time or **replay** it later from **Settings → "Replay App Tour"**.

---

## 3. Navigation & App Layout

### 3.1 Desktop Sidebar

The left sidebar (270px) is your primary navigation. It includes:

- **RFE Logo** — Click to return to the Dashboard
- **"Create New" button** — Opens the Quick Action menu
- **Navigation sections** (collapsible):
  - **Main:** Dashboard, Estimate Calculator
  - **Jobs & CRM:** Customers
  - **Inventory & Equipment:** Warehouse, Material Report, Equipment Tracker, Equipment Maintenance
  - **Account:** Settings, Profile
- **Install App button** — Appears when the PWA install prompt is available
- **User footer:**
  - Company name display
  - **Company ID** — click to copy (used for crew login)
  - **Sync status indicator** (Syncing… / Synced / Offline / Active)
  - **Sign Out** button

### 3.2 Mobile Bottom Navigation

On mobile, a 5-tab bottom bar provides quick access:

| Tab | Icon | Destination |
|-----|------|-------------|
| Home | House | Dashboard |
| CRM | Users | Customers |
| **+** | Plus (raised FAB) | Quick Action Menu |
| Equip | Box | Warehouse |
| More | Menu | Full navigation drawer |

The **center FAB** (floating action button) is a raised circular button that opens the Quick Action menu.

The **"More" drawer** slides up from the bottom and contains all navigation items grouped by section, plus user info and sign out.

### 3.3 Quick Action Menu

Accessed via the **"Create New"** button (desktop) or center **FAB** (mobile):

| Action | Description |
|--------|-------------|
| **New Customer** | Opens the CRM with the add-customer modal |
| **New Estimate** | Resets the calculator to a blank state |
| **Generate Invoice** | Navigates to the Dashboard filtered to completed work orders ready for invoicing |

### 3.4 Notifications & Sync Status

- **Toast Notifications** appear in the top-right corner (desktop) or top-center (mobile)
- Green for success, red for errors
- Auto-dismiss after 2 seconds or click to dismiss manually
- **Sync Status** in the sidebar/header shows: Syncing…, Synced, Offline, or Active

---

## 4. Dashboard

The Dashboard is your operations command center. It consists of a header area with key metrics and two tabs: **Operations** and **Profit & Loss**.

### 4.1 Inventory Health Banner

A prominent banner at the top shows your current chemical stock:

- **Open Cell Sets** — current stock level
- **Closed Cell Sets** — current stock level
- **Pipeline Demand** — how many sets your draft estimates will consume

**Color Alerts:**
- **Green** — Stock levels are healthy (5+ sets)
- **Amber** — Getting low (<5 sets)
- **Red with pulsing alert** — CRITICAL SHORTAGE DETECTED (negative or zero stock)

Click the banner to navigate directly to the **Warehouse**.

### 4.2 Lifetime Usage Card

Displays your all-time cumulative chemical usage:
- Total Open Cell sets sprayed
- Total Closed Cell sets sprayed

Click to navigate to the Warehouse for details.

### 4.3 Operations Tab — Job Pipeline

#### Filter Cards
Four clickable filter cards at the top let you quickly focus your job list:

| Filter | What It Shows |
|--------|---------------|
| **Active Pipeline** | All non-archived jobs with total dollar value |
| **Review Needed** | Completed work orders awaiting invoice (crew finished but not yet invoiced) |
| **In Progress** | Jobs currently being worked on by a crew |
| **Pending Payment** | Invoiced jobs that haven't been paid yet |

#### Jobs Table
A paginated list of all your jobs with:

| Column | Description |
|--------|-------------|
| **Customer** | Customer name |
| **Status** | Dynamic badge: Draft, Work Order, Crew Started, In Progress, Review Needed, Invoiced, Paid |
| **Value** | Total estimate/invoice value |
| **Actions** | Click row to edit; "Mark Paid" button for invoiced jobs; Delete button |

**Status Badges Explained:**
- **Draft** — Estimate created but not yet sold
- **Work Order** — Sold and ready for scheduling/dispatch
- **Crew Started** — A crew member has clocked in (shows crew name and start time)
- **In Progress** — Work is actively underway
- **Review Needed** — Crew completed the job; admin needs to review actuals and create invoice
- **Invoiced** — Invoice has been sent to customer
- **Paid** — Payment received; job is closed

**Actions:**
- Click any row to open the estimate for editing
- **"Mark Paid"** (green button on invoiced jobs) — records payment and generates a receipt PDF
- **Delete** (trash icon) — permanently removes the job
- **"+ New Estimate"** — creates a new blank estimate
- **"Sync Updates"** — forces a manual sync with the cloud

### 4.4 Profit & Loss Tab — Financials

#### Metric Cards
Four top-level financial metrics:

| Metric | Description |
|--------|-------------|
| **Total Sold Revenue** | Sum of all sold/invoiced/paid jobs |
| **Est. Net Profit** | Revenue minus all costs (green if positive, red if negative) |
| **Gross Margin** | Profit as a percentage of revenue (target: 40%+) |
| **Cost Breakdown** | Visual bar comparing Materials vs. Labor costs |

**Margin Color Coding:**
- **Green** — 30%+ (healthy)
- **Amber** — 15–30% (watch closely)
- **Red** — Below 15% (needs attention)

#### Job P&L Table
Per-job profitability breakdown:

| Column | Description |
|--------|-------------|
| **Job / Customer** | Customer name and job reference |
| **Status** | "Realized" (paid, using actuals) or "Projected" (estimated data) |
| **Revenue** | Total job value |
| **Costs (COGS)** | Total cost of goods sold |
| **Net Profit** | Revenue minus costs |
| **Margin** | Profit percentage, color-coded |

---

## 5. Estimate Calculator

The Calculator is the core tool for building spray foam job estimates. It calculates spray area, board footage, chemical sets required, stroke counts, and total costs.

### 5.1 Selecting a Customer

At the top of the calculator:
- **Dropdown** — Select an existing customer from your CRM
- **"+ Create New Customer"** option — Opens the CRM to add a new lead
- Only active (non-archived) customers are shown

### 5.2 Calculation Modes

Choose how to define the job scope:

| Mode | Use Case | Inputs |
|------|----------|--------|
| **Full Building** | Complete structure (walls + roof) | Length, Width, Wall Height, Roof Pitch |
| **Walls Only** | Wall insulation jobs | Length (linear feet), Wall Height |
| **Flat Area** | Attics, slabs, flat surfaces | Length, Width, optional Pitch |

### 5.3 Building Dimensions

Depending on the mode, you'll enter:

- **Length** (ft) — Building length
- **Width** (ft) — Building width
- **Wall Height** (ft) — Wall height
- **Roof Pitch** — Enter as "X/12" (e.g., "4/12") or degrees

**Options:**
- **Include Gable Ends** — Adds triangular gable wall area to the calculation (Full Building mode). Shows the live calculated gable area.
- **Metal Surface** — Applies a +15% area increase for corrugated metal ridges

**Additional Sections:**
Click **"Add Section"** to add extra wall or roof areas beyond the main structure:
- Choose type: **Wall** or **Roof**
- Enter Length × Width
- Each section shows its live square footage
- Remove with the trash button

### 5.4 Insulation Specifications

#### Pricing Mode Toggle
Switch between two pricing strategies:
- **Cost Plus** — Price = Material cost + Labor + Expenses (calculates from your cost inputs)
- **SqFt Price** — Price = Area × rate per square foot (common for customer-facing quotes)

#### Wall Settings
- **Foam Type** — Open Cell or Closed Cell
- **Depth** (inches) — Spray thickness
- **Waste %** — Overspray/waste factor (added to calculated board footage)
- **Price Per Sq Ft** (SqFt pricing mode only)

#### Roof/Ceiling Settings
- Same fields as walls, configured independently
- Different foam type and thickness than walls is fully supported

### 5.5 Prep & Inventory

Add job-specific supplies and materials:

1. Click **"Add Item"**
2. Choose from:
   - **Quick Add from Warehouse** — Select an existing warehouse item (auto-fills name, unit, cost)
   - **"+ Create New Item"** — Define a new item (name, unit, cost) that's also added to your warehouse
3. Set the **Quantity** needed for this job
4. Each item shows its line cost (Qty × Unit Cost)
5. Remove items with the trash button

### 5.6 Equipment / Tools

Assign tracked equipment to the job:

1. Select tools from the **equipment dropdown**
2. Assigned equipment shows the tool name and its last-known location
3. When the job is sold (Work Order), equipment status automatically updates to "In Use" with the customer's info as the last-seen location

### 5.7 Labor & Fees

- **Est. Man Hours** — Expected labor hours (multiplied by the labor rate in Settings)
- **Trip / Fuel ($)** — Travel and fuel costs

### 5.8 Results Summary

The dark results card shows calculations in real time:

| Metric | Description |
|--------|-------------|
| **Total Spray Area** | Combined wall + roof square footage |
| **Total Volume** | Board footage (area × thickness × waste) |
| **Chemical Sets** | Open Cell and Closed Cell sets required (with stroke counts) |
| **Total Estimate** | Final price for the customer |
| **COGS Material** | Your material cost |
| **COGS Labor & Misc** | Labor hours × rate + trip/fuel + other fees |
| **Projected Margin** | (Revenue - Costs) / Revenue × 100% |

**Margin Color Coding:**
- **Green** — 40%+ (excellent)
- **Amber** — 20–40% (acceptable)
- **Red** — Below 20% (low margin)

### 5.9 Saving an Estimate

Click **"Save / Update"** to save the estimate as a Draft. The estimate appears in your Dashboard job list and is synced to the cloud.

---

## 6. Job Workflow — Estimate to Payment

Every job follows a consistent lifecycle shown by the **Job Progress** indicator:

```
Estimate → Sold → Scheduled → Invoiced → Paid
```

### 6.1 Step 1: Draft Estimate

- Build the estimate in the Calculator
- Click **"Save / Update"** — saves as a **Draft**
- The job appears on your Dashboard

### 6.2 Step 2: Finalize Estimate (PDF)

- From the Calculator or Dashboard, click **"Finalize & Send"**
- Opens the **Estimate Stage** editor:
  - Auto-generated line items from your calculation (wall insulation, roof insulation, inventory, labor, travel)
  - **Edit any line item** — change descriptions, quantities, amounts
  - **Add custom line items** — for items not in the calculator
  - **Delete line items** — remove anything you don't want on the document
  - **Live summary sidebar** — running total updates as you edit
- Click **"Save & Continue"** to generate the Estimate PDF
- The PDF is automatically saved to the customer's document library in the cloud

### 6.3 Step 3: Mark Sold → Work Order

- Once the customer accepts, click **"Mark Sold"** from the Estimate Detail view
- The status advances to **Work Order**
- **What happens automatically:**
  - Chemical sets are **deducted from warehouse** (Open Cell and Closed Cell)
  - Inventory items are **deducted from warehouse**
  - Equipment is marked as **"In Use"** with the customer's info
  - Material usage is **logged** for reporting

### 6.4 Step 4: Finalize Work Order (PDF)

- Click **"Schedule Job"** or **"Edit Work Order"**
- Opens the **Work Order Stage** editor:
  - **Scheduled Date** — pick the installation date
  - **Crew Instructions** — gate codes, hazards, special notes
  - **Job Scope & Load List** — auto-populated with:
    - Wall/roof specifications (foam type, thickness, sqft)
    - Chemical sets with stroke counts
    - Inventory items to load on the truck
    - Equipment to bring
  - **Edit any line** or **add custom items**
  - **No pricing shown** — this document is for crew use
- Click **"Generate Work Order"** to create the Work Order PDF
- The PDF is saved to the cloud and available for the crew

### 6.5 Step 5: Generate Invoice (PDF)

- After work is completed, click **"Generate Invoice"**
- Opens the **Invoice Stage** editor:
  - **Crew Actuals panel** (if crew submitted a completion report):
    - Actual labor hours worked
    - Actual chemical sets used (Open Cell / Closed Cell)
    - Crew notes from the field
  - **Invoice Details:**
    - Invoice Number (auto-generated, editable)
    - Invoice Date
    - Payment Terms (Due on Receipt, Net 15, Net 30)
  - **Editable line items** — same editing capability as the Estimate Stage
  - **Summary sidebar** — total due
- Click **"Save & Generate Invoice"** to create the Invoice PDF

### 6.6 Step 6: Record Payment

- From the Dashboard, click **"Mark Paid"** on an invoiced job
- Or from the Invoice Stage, click **"Mark as Paid"** (with confirmation dialog)
- **What happens:**
  - Status changes to **Paid**
  - Financials are calculated:
    - Revenue, total COGS (chemical + labor + inventory + misc), net profit, margin %
  - A **Receipt PDF** is generated (Invoice with "PAID IN FULL" stamp)
  - The job appears in the P&L tab with realized financials

### 6.7 Job Progress Indicator

A visual stepper appears at the top of the Calculator showing the current job's lifecycle:

```
[Estimate] ── [Sold] ── [Scheduled] ── [Invoiced] ── [Paid]
    ●────────────●──────────○─────────────○──────────○
                 ▲
           Current Step
```

- **Completed steps** — filled red circles
- **Current step** — enlarged with ring highlight
- **Future steps** — grey outline circles
- The connecting line fills progressively to show advancement

---

## 7. PDF Document Builder

The PDF Preview Modal is a full-featured document builder accessible from multiple workflows.

### 7.1 Document Types

| Type | Color | Use Case |
|------|-------|----------|
| **Estimate** | Blue | Customer-facing price quotes |
| **Work Order** | Amber | Crew dispatch documents (no pricing) |
| **Invoice** | Green | Payment requests |

Toggle between types using the three buttons at the top of the modal.

### 7.2 Editing Document Fields

The builder has **four tabs**:

#### Tab 1: Document Info
- Document number, date, and type-specific fields:
  - Estimate: "Valid Until" date
  - Work Order: Scheduled date, work scope notes
  - Invoice: PO number, payment terms (Net 30/15/60, Due on Receipt, 50/50)
- Company details (auto-filled from Profile)
- Company logo preview

#### Tab 2: Customer / Job
- Customer name, company, address, city/state/ZIP, phone, email
- Job site name and address

#### Tab 3: Line Items
- Editable table with Description, Qty, Unit, Unit Price, Total per line
- Add or remove line items
- Auto-calculated Subtotal, Tax (with editable label and rate), and Total

#### Tab 4: Notes & Terms
- Notes (general comments)
- Terms & Conditions
- Thank You message

### 7.3 Line Items

Line items can be:
- **Auto-generated** from calculator results (wall insulation, roof insulation, inventory, labor, fees)
- **Manually entered** — add custom items with any description and amount
- **Fully editable** — change any field before exporting

### 7.4 Exporting & Downloading

Click **"Export [Estimate/Work Order/Invoice]"** to generate and download the PDF. The document includes:
- Branded header bar with your company color
- Company logo and contact information
- Document type badge
- Bill-to and job-site addresses
- Line items table with alternating row colors
- Subtotal, tax, and total
- Notes, terms, and type-specific footer content
- Signature/acceptance lines (estimates and work orders)

### 7.5 Cloud Document Storage

Every generated PDF is **automatically saved** to Supabase cloud storage:
- Organized by organization → customer → document type
- Accessible from the customer's detail view in the CRM
- Includes metadata: type, date, file size, associated estimate

---

## 8. Customer Database (CRM)

### 8.1 Adding a Customer

1. Navigate to **Customers** from the sidebar
2. Click **"Add Lead"** (or use the Quick Action → New Customer)
3. Fill in:
   - **Full Name** (required)
   - **Address**
   - **Phone**
   - **Email**
4. Click **Save**

### 8.2 Customer Detail View

Click any customer to see their full profile:
- Contact information (name, phone, email, address)
- **"Edit Lead"** button — modify customer details
- **"Start Estimate"** button — jump directly to the Calculator with this customer selected

### 8.3 Job History

The detail view shows a table of all jobs associated with this customer:

| Column | Description |
|--------|-------------|
| **Date** | When the estimate was created |
| **Status** | Current job status (Draft, Work Order, Invoiced, Paid) |
| **Quote** | Estimate/invoice value |
| **Action** | "Open Quote" to edit or view the job |

### 8.4 Document Library

Below the job history, a **Documents** section lists all PDFs generated for this customer:
- Type badge (Estimate, Invoice, Work Order, Receipt, Purchase Order)
- Filename and date
- File size
- **Actions:** Open PDF (in new tab), Download, Delete

### 8.5 Archiving Customers

- Click **"Archive"** on a customer to remove them from active lists
- Archived customers don't appear in dropdown selectors
- Archiving preserves all job history and documents

---

## 9. Warehouse & Inventory

The Warehouse manages your physical stock of chemicals, supplies, and equipment.

### 9.1 Chemical Sets (Foam Stock)

Two prominent controls for your chemical stock:

#### Open Cell Stock
- Current set count displayed prominently
- **+/−** buttons to adjust by 0.25 sets
- Direct number input for exact values
- Color-coded badges:
  - **Green** — 5+ sets in stock
  - **Amber** — Less than 5 sets
  - **Red** — Zero or negative (shortage!)

#### Closed Cell Stock
- Same controls and indicators as Open Cell

**"View Usage Ledger"** — links to the Material Report for detailed usage history.

### 9.2 General Inventory Items

A list of consumable supplies (plastic sheeting, tape, nozzles, etc.):

| Field | Description |
|-------|-------------|
| **Name** | Item description |
| **Qty** | Current quantity (red if negative) |
| **Unit** | Unit of measure (rolls, boxes, each, etc.) |
| **Cost/Unit** | Per-unit cost |

- **"+ Add Item"** to create new inventory items
- Edit any field inline
- Delete items with the trash button

### 9.3 Tracked Equipment

Switch to the **Equipment** tab to manage tools and machinery:
- **"+ Add Tool"** — create a new tracked equipment item
- Each item has a name and shows its last-known location (customer and date)
- Links to **Maintenance** and **Usage Map** (Equipment Tracker)

### 9.4 Automatic Deductions

When an estimate is marked as **Sold** (converted to Work Order):
- **Chemical sets** are deducted from warehouse stock
- **Inventory items** assigned to the job are deducted from warehouse quantities
- **Equipment** status is updated to "In Use"

These deductions are calculated intelligently:
- If a job is re-processed (e.g., materials changed), only the **delta** is applied
- Equipment tracks where it was last used and by which crew member

---

## 10. Material Orders & Purchase Orders

### 10.1 Shortage Detection

The Material Order screen automatically scans your warehouse for negative quantities:
- A red **Shortage Alert** panel lists every item with negative stock
- Click **"Add Shortages to Order"** to auto-fill the purchase order with needed quantities

### 10.2 Creating a Purchase Order

1. Navigate to **Material Order** from the Warehouse or Dashboard
2. Enter:
   - **Vendor Name**
   - **Order Date**
3. Add items using quick-add buttons:
   - **"+ Open Cell"** — adds open cell foam sets
   - **"+ Closed Cell"** — adds closed cell foam sets
   - **Dropdown** — select from warehouse inventory items
4. For each line item, set:
   - **Description**
   - **Quantity**
   - **Unit Cost**
   - Line **Total** is auto-calculated
5. Add **Internal Notes** (shipping instructions, PO references)
6. Click **"Save Order & Update Stock"**

### 10.3 Auto-Restocking Warehouse

When a PO is saved:
- Chemical sets are **added** to warehouse stock
- Inventory item quantities are **increased**
- A Purchase Order PDF is generated and saved to the cloud

---

## 11. Material Usage Report

### 11.1 Viewing the Ledger

The Material Report shows a chronological log of all material usage across your organization:

| Column | Description |
|--------|-------------|
| **Date** | When the material was used/logged |
| **Customer** | Which job consumed the material |
| **Material** | Material name (Open Cell, Closed Cell, or inventory item) |
| **Qty** | Amount used (with unit) |
| **Logged By** | Who recorded the usage (admin username or crew member) |

### 11.2 Filtering by Period

- Use the **month picker** to filter logs by a specific month (YYYY-MM format)
- Stats cards show filtered totals:
  - **Open Cell Used** — total sets for the period
  - **Closed Cell Used** — total sets for the period

### 11.3 Exporting to PDF

Click **"Export Ledger"** to generate a professional PDF report of the filtered usage data — useful for accounting, tax records, or supplier negotiations.

---

## 12. Equipment Tracker

### 12.1 Last-Known Location

The Equipment Tracker shows where each piece of tracked equipment was last used:

- **Tool name and ID**
- **Last-Known Location:**
  - Customer name (which job site)
  - Date (when it was last seen)
  - Crew member (who used it)
- Items are sorted with the **most recently used** first
- Items with no usage history show a "No usage history" placeholder

> **Use Case:** Quickly find a tool by checking which job site it was last dispatched to.

---

## 13. Equipment Maintenance

The Maintenance module provides interval-based maintenance tracking for your spray foam equipment — triggered by chemical sets sprayed and operating hours.

### 13.1 Adding Equipment

1. Click **"Add Equipment"**
2. Enter:
   - **Name** (e.g., "Graco E-30")
   - **Description** (optional details)
   - **Category**: Proportioner, Compressor, Generator, Hose, Gun, Rig, Vehicle, Safety Equipment, or Other
   - **Status**: Active, Inactive, or Retired

### 13.2 Service Items & Intervals

Each equipment item can have multiple service items (maintenance tasks):

1. Expand an equipment card
2. Click **"Add Service Item"**
3. Define:
   - **Name** (e.g., "Filter Change", "O-Ring Replacement")
   - **Description** (what the service entails)
   - **Interval in Sets** — service every X sets sprayed
   - **Interval in Hours** — service every X operating hours

The service is triggered by **whichever threshold is reached first** — sets or hours.

**Progress bars** show how close each service item is to its next due date:
- **Green** — plenty of capacity remaining
- **Amber** — approaching service interval
- **Red** — overdue for service

### 13.3 Logging Service

When maintenance is performed:
1. Click **"Service Done"** on the service item
2. Enter:
   - **Performed By** — technician name
   - **Notes** — what was done
3. Click submit
4. The service counter **resets to zero** and equipment's last service date is updated

### 13.4 Job Usage Sync

The **Job Usage Log** tab shows material usage from completed jobs:

- Each entry shows: customer, date, total sets (OC + CC), operating hours
- Status: **Applied** (counted toward maintenance intervals) or **Pending** (awaiting application)
- **"Sync Jobs"** button imports completed estimates and applies pending usage to all equipment counters
- **Manual Entry** — log usage from jobs tracked outside the app

### 13.5 Service History

The **Service History** tab shows a chronological record of all services performed:
- Equipment name, service item, date
- Technician who performed the service
- Sets and hours at the time of service
- Notes from the service

### Stats Cards (Dashboard)

Four overview metrics at the top:
- **Total Sets Sprayed** — across all equipment
- **Equipment Tracked** — number of active equipment items
- **Services Due Soon** — approaching service intervals
- **Overdue Services** — past due (needs immediate attention)

---

## 14. Crew Dashboard (Field Technician View)

The Crew Dashboard is a **mobile-first, touch-optimized** interface designed for field technicians working on the rig.

### 14.1 Logging In as Crew

1. On the login page, select the **"Crew Login"** tab
2. Enter the **Company Name** and **Crew Access PIN** (provided by your admin)
3. Tap **"Access Jobs"**
4. The Crew Dashboard opens with your assigned work orders

> **Important:** Crew members **cannot see pricing** — all costs, totals, and financial data are hidden.

### 14.2 Viewing Work Orders

The home screen shows a list of assigned work orders:
- **Work Order number**
- **Customer name**
- **City / State**
- **Scheduled date**
- **Status indicator** (active or completed)

Toggle the **"History"** button to see completed jobs.

The list **auto-syncs every 45 seconds** to pick up new assignments.

### 14.3 Starting a Job & Time Clock

Tap a work order to open the detail view:

#### Job Detail includes:
- **Client & Location** — customer name and full address
- **Install Specifications** — wall/roof foam type, thickness, and sqft
- **Truck Load List** — chemical sets (with stroke counts), inventory items, equipment
- **Job Notes** — highlighted instructions from the office (gate codes, hazards, etc.)

#### Quick Actions:
- **GPS Map** — opens Google Maps with the customer's address for turn-by-turn navigation
- **View Sheet** — opens the Work Order PDF

#### Time Clock:
1. Tap **"Start Job"** (green button) — starts the timer and notifies the office
2. Timer displays elapsed time in HH:MM:SS format
3. Tap **"Pause / End Day"** to pause the timer (resume next day)
4. Timer state **persists across app refreshes** (stored in localStorage)

> **Note:** While the timer is running, the back button is disabled to prevent accidentally leaving the job.

### 14.4 Completing a Job

1. Tap **"Complete Job"** (red button)
2. The **Completion Modal** appears:
   - **Total Labor Hours** — auto-filled from timer, editable
   - **Material Usage:**
     - Open Cell sets used (shows estimated amount for reference)
     - Closed Cell sets used (shows estimated amount for reference)
   - **Machine Counters:**
     - Open Cell strokes (shows estimated count for reference)
     - Closed Cell strokes (shows estimated count for reference)
   - **Inventory Used** — actual quantities used per item
   - **Crew Notes** — free-text field for observations, issues, or additional info
3. Tap **"Submit & Finish"**

The completion data is synced to the cloud and appears on the admin's Dashboard as **"Review Needed"**.

### 14.5 GPS Navigation

Tap **"GPS Map"** to open Google Maps with the customer's full address pre-filled for turn-by-turn directions.

---

## 15. Settings

### 15.1 Material Yields & Strokes

Configure your equipment's chemical performance:

| Setting | Default | Description |
|---------|---------|-------------|
| **Open Cell Yield** | 16,000 bdft | Board feet per set of open cell foam |
| **Closed Cell Yield** | 4,000 bdft | Board feet per set of closed cell foam |
| **OC Strokes per Set** | 6,600 | Machine stroke count per open cell set |
| **CC Strokes per Set** | 6,600 | Machine stroke count per closed cell set |

These values directly affect estimates — adjust them to match your specific equipment and chemical brand performance.

### 15.2 Unit Costs

| Setting | Default | Description |
|---------|---------|-------------|
| **Open Cell Cost/Set** | $2,000 | Your cost per set of open cell foam |
| **Closed Cell Cost/Set** | $2,600 | Your cost per set of closed cell foam |
| **Labor Rate** | $85/hr | Cost per labor hour (used in COGS calculations) |

Click **"Save Settings"** to apply changes. All existing estimates will use the new values for future calculations.

---

## 16. Company Profile

### 16.1 Company Branding & Logo

- **Logo Upload** — Drag and drop or click to upload your company logo (max 5MB)
  - Your logo appears on all generated PDF documents
  - Supports common image formats (PNG, JPG, SVG)
- **Company Name** — displayed on documents and in the app header
- **Business Address** — street address, city, state, ZIP
- **Phone** — business phone number
- **Email** — business contact email

### 16.2 Crew Access Credentials

Manage how your field crews access the app:

- **Company ID** — a unique, read-only identifier for your organization
  - Click the **copy button** to copy it to clipboard
  - Share this with crew members for their login
- **Crew Access PIN** — a numeric PIN that crew members use to log in
  - Click **"Update"** to change the PIN
  - The change takes effect immediately and syncs to the database

> **Security Note:** All crew members share the same PIN. Change it periodically or when crew membership changes.

### 16.3 Security — Password Change

- Enter your **Current Password**
- Enter a **New Password** (minimum 6 characters)
- Click **"Update Password"**

---

## 17. Cloud Sync & Offline Support

### 17.1 Real-Time Sync

RFE Foam Pro uses **Supabase Realtime** for live data synchronization:

- Changes sync automatically within seconds
- When another user (or crew member) updates data, your app receives the update in real-time
- The sync status indicator in the sidebar shows:
  - **Syncing…** — data is being pushed/pulled
  - **Synced** — everything is up to date
  - **Active** — realtime connection is live
  - **Offline** — no internet connection

### 17.2 Manual Sync

- Click **"Sync Updates"** on the Dashboard to force a full sync
- This pushes all local state to the cloud and pulls the latest data
- Useful if you suspect data is out of date

### 17.3 Offline Fallback

- All data is backed up to **localStorage** on every save
- If the cloud connection fails, the app loads from localStorage
- Changes made offline will sync when connectivity returns
- The app remains fully functional offline for viewing and editing

---

## 18. Subscription Plans

RFE Foam Pro offers tiered subscription plans:

| Plan | Price/mo | Estimates/mo | Customers | Users | Storage (MB) |
|------|----------|-------------|-----------|-------|-------------|
| **Free Trial** | $0 | 10 | 25 | 2 | 100 |
| **Starter** | $49 | 50 | 100 | 3 | 500 |
| **Pro** | $99 | 500 | 500 | 10 | 2,000 |
| **Enterprise** | $249 | Unlimited | Unlimited | 50 | 10,000 |

When you approach plan limits:
- A **trial/subscription banner** appears on the Dashboard
- Shows days remaining (trial), usage stats, and an "Upgrade Plan" button
- Creating estimates or customers beyond plan limits is blocked with a message

---

## 19. Tips & Best Practices

### Estimation Workflow
1. **Always create the customer first** — this links all documents and history
2. **Use the "Quick Add from Warehouse"** for inventory items — it keeps costs consistent
3. **Check the Projected Margin** before sending estimates — aim for 40%+
4. **Use Additional Sections** for complex buildings with multiple wings or additions

### Inventory Management
5. **Keep chemical sets updated** — the Dashboard warns you about shortages
6. **Review the Material Report monthly** — track usage trends and waste
7. **Use Purchase Orders** to restock — they automatically update warehouse quantities

### Job Execution
8. **Install the PWA on crew tablets** — better performance than the browser
9. **Add detailed job notes** — gate codes, hazards, and special instructions help crews
10. **Review crew actuals** promptly — the "Review Needed" filter on Dashboard highlights completed jobs

### Financial Tracking
11. **Mark jobs as Paid promptly** — keeps your P&L accurate
12. **Compare estimated vs. actual** on the Invoice Stage — crew actuals show real usage
13. **Use the Gross Margin metric** on the P&L tab as your key health indicator

### Equipment & Maintenance
14. **Track all proportioners and rigs** — maintenance intervals prevent costly breakdowns
15. **Use "Sync Jobs" regularly** in the Maintenance module to capture all chemical usage
16. **Log services immediately** — keeps maintenance counters accurate

---

## 20. Troubleshooting

### Can't log in?
- **Admin:** Verify email and password. Use "Forgot Password" if available. Password must be at least 6 characters.
- **Crew:** Confirm the Company Name and PIN with your administrator. Both are case-sensitive.

### Data not syncing?
- Check the sync status indicator in the sidebar
- Try clicking **"Sync Updates"** on the Dashboard
- Ensure you have an internet connection
- Data is always saved locally as a backup

### PDF not generating?
- Ensure all required fields are filled (customer, line items)
- Check that your company logo is under 5MB
- Try a different browser if issues persist

### Chemical sets showing negative?
- This means you've sold more than you have in stock
- Navigate to **Warehouse** and update your actual stock levels
- Or create a **Material Order** to restock (shortages are auto-detected)

### Crew can't see work orders?
- Ensure the job status is **"Work Order"** (not Draft)
- The crew member should tap **"Refresh List"** or wait for auto-sync (45 seconds)
- Verify the crew is using the correct Company Name and PIN

### Equipment not tracking location?
- Equipment must be **assigned to a job** in the Calculator's Equipment section
- Location updates happen when the job is converted to a Work Order

### App running slowly?
- Clear old/completed estimates by archiving paid jobs
- Use pagination to limit the number of visible items
- Ensure the PWA is installed for best performance

---

*© RFE Equipment — RFE Foam Pro Enterprise Suite*
*For support, visit [RFE Equipment](https://rfrequipment.com) or contact your account representative.*
