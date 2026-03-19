rcmi-portal/
├── .github/
│ └── workflows/
│ └── deploy.yml # Vercel auto-deploy CI
│
├── public/
│ ├── favicon.ico
│ └── manifest.json # PWA config
│
├── src/
│ ├── assets/ # images, fonts, global css
│ │ └── main.css # Tailwind directives
│ │
│ ├── components/ # reusable UI components
│ │ ├── common/ # Button, Input, Modal, Badge
│ │ ├── attendance/ # AttendanceCard, QRScanner
│ │ ├── members/ # MemberCard, ApprovalBadge
│ │ └── dashboard/ # StatCard, ChartWidget
│ │
│ ├── composables/ # reusable logic (like hooks)
│ │ ├── useAuth.ts
│ │ ├── useAttendance.ts
│ │ ├── useMember.ts
│ │ ├── useExport.ts # SheetJS Excel export
│ │ └── useQR.ts # QR generation + scanning
│ │
│ ├── layouts/ # page shell components
│ │ ├── AuthLayout.vue # login, register pages
│ │ ├── AppLayout.vue # member-facing shell
│ │ └── AdminLayout.vue # admin shell + sidebar
│ │
│ ├── lib/ # third-party config
│ │ ├── supabase.ts # supabase client init
│ │ └── chartjs.ts # chart.js setup
│ │
│ ├── pages/ # route-level components
│ │ ├── auth/
│ │ │ ├── LoginPage.vue
│ │ │ ├── RegisterPage.vue
│ │ │ └── PendingPage.vue
│ │ │
│ │ ├── member/
│ │ │ ├── DashboardPage.vue
│ │ │ ├── ProfilePage.vue
│ │ │ ├── AttendancePage.vue
│ │ │ └── QRCodePage.vue
│ │ │
│ │ └── admin/
│ │ ├── DashboardPage.vue
│ │ ├── MembersPage.vue
│ │ ├── MemberDetailPage.vue
│ │ ├── EventsPage.vue
│ │ ├── AttendancePage.vue
│ │ └── ChurchesPage.vue
│ │
│ ├── router/
│ │ ├── index.ts # route definitions
│ │ ├── guards.ts # auth + role guards
│ │ └── routes/
│ │ ├── auth.routes.ts
│ │ ├── member.routes.ts
│ │ └── admin.routes.ts
│ │
│ ├── stores/ # Pinia stores
│ │ ├── auth.store.ts
│ │ ├── member.store.ts
│ │ ├── attendance.store.ts
│ │ └── church.store.ts
│ │
│ ├── types/ # TypeScript interfaces
│ │ ├── database.types.ts # auto-gen from Supabase
│ │ ├── member.types.ts
│ │ ├── attendance.types.ts
│ │ └── auth.types.ts
│ │
│ ├── utils/ # pure helper functions
│ │ ├── date.ts
│ │ ├── format.ts
│ │ └── validators.ts
│ │
│ ├── App.vue
│ └── main.ts
│
├── supabase/ # supabase local dev config
│ ├── migrations/ # SQL migration files
│ │ └── 001_initial_schema.sql
│ ├── functions/ # Edge Functions
│ │ ├── attendance-log/
│ │ └── approve-member/
│ └── seed.sql # dev seed data
│
├── .env # local env vars (gitignored)
├── .env.example # template for team
├── index.html
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
└── vercel.json
