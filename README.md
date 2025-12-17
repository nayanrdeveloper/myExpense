# MyExpense 💰 - Intelligent Offline Finance Tracker

**MyExpense** is a **privacy-first, offline-only** personal finance application built with **React Native Expo**. It is designed for speed, security, and smart automation, featuring **On-Device AI** for receipt scanning and spending insights.

---

## 🚀 Key Features

### 🧠 Offline AI & Automation
- **AI Receipt Scanner**: Instantly scan bills to auto-fill Amount, Date, Merchant, Line Items, and Tax. Works 100% offline using On-Device OCR (ML Kit).
- **Smart Category Prediction**: Automatically categorizes expenses based on merchant names and item keywords.
- **Spending Patterns**: Detects weekend splurges, small daily leaks (coffee/snacks), and high-frequency categories.

### 📊 Smart Financial Management
- **Daily Safe Spend**: Calculates how much you can safely spend today to stay within your monthly budget.
- **Zero-Spend Tracker**: Gamifies saving by tracking your streak of "No Spend" days.
- **Subscription Tracker**: Manages recurring payments with auto-renewal logic and reminders.
- **Bill Reminders**: Tracks upcoming bills with "Days Left" alerts.
- **Monthly Budgeting**: Set daily and monthly spending limits with real-time alerts.

### 📱 Premium User Experience
- **Infinite Scroll**: Smooth performance for thousands of transactions.
- **Dark/Light Mode**: Beautiful, modern UI with adaptive colors.
- **Haptics & Animations**: Tactile feedback for interactions.
- **Search & Filters**: Deep search through notes, locations, and amounts.
- **Calendar View**: Visual grid of daily spending intensity.

---

## 📸 Screenshots

| Home Screen | Add Expense (AI Scan) | Insights & Reports |
|:---:|:---:|:---:|
| ![Home](assets/images/screenshot_home_placeholder.png) | ![Scan](assets/images/screenshot_scan_placeholder.png) | ![Reports](assets/images/screenshot_reports_placeholder.png) |

*(Note: Screenshots to be added)*

---

## 🏗️ Architecture & Code Quality

### Tech Stack
- **Framework**: React Native (Expo SDK 52)
- **Language**: TypeScript (Strict Mode)
- **Database**: SQLite (Expo SQLite) - Local, relational data storage.
- **Navigation**: Expo Router (File-based routing).
- **AI/ML**: React Native ML Kit (Text Recognition).
- **Styling**: `StyleSheet` with consistent design tokens.

### Code Standards
- **Modular Database Layer**: All DB operations are isolated in `src/db/` (e.g., `expenses.ts`, `settings.ts`). No raw SQL in UI components.
- **Type Safety**: Full TypeScript coverage for all props, state, and database entities.
- **Performance**: Heavy lists use `FlatList` with pagination (`LIMIT/OFFSET`). Expensive calculations are memoized.
- **Offline-First**: No API calls or cloud dependencies. Data lives on the device.

---

## 📂 File Structure

```
myExpense/
├── app/                    # Expo Router Screens
│   ├── (tabs)/             # Main Tab Navigation (Home, Add, Reports, Settings)
│   ├── _layout.tsx         # Root Layout & Theme Provider
│   ├── calendar_view.tsx   # Calendar Modal
│   └── manage_categories.tsx
├── src/
│   ├── db/                 # Database Layer (SQLite)
│   │   ├── index.ts        # DB Initialization & Migrations
│   │   ├── expenses.ts     # CRUD for Expenses
│   │   └── reports.ts      # Aggregation Logic
│   ├── utils/
│   │   ├── ReceiptScanner.ts # AI/OCR Logic
│   │   └── format.ts       # Currency/Date formatters
│   └── components/         # Reusable UI Components (if broken out)
├── assets/                 # Images & Fonts
└── package.json            # Dependencies
```

---

## 📦 Key Packages

- `expo-sqlite`: High-performance local database.
- `@react-native-ml-kit/text-recognition`: On-device OCR for receipts.
- `expo-file-system`: For local backup/restore (upcoming).
- `react-native-gifted-charts`: Beautiful, animated charts for reports.
- `expo-haptics`: For tactile user feedback.

---

## 💡 Use Cases

1.  **Grocery Run**: Buy items -> Tap Scan -> Snap text -> App auto-fills "Walmart", Total $45.20, and categorizes as "Groceries".
2.  **Monthly Budget**: Set a limit of $2000. App tells you "You can spend $65/day". If you spend $100 today, tomorrow's safe spend drops to $63.
3.  **Subscription Audit**: Add Netflix ($15/mo). App shows it will renew in 4 days and includes it in your committed monthly costs.

---

## 🚀 Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Run Development Server**:
    ```bash
    npx expo start
    ```
3.  **Build for Android (Native Features)**:
    ```bash
    eas build -p android --profile preview
    ```

---

*Built with ❤️ by Nayan*
