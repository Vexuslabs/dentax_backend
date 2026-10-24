# MediBook / DentalBox Backend API

Enterprise-grade, clean, and maintainable Node.js & Express REST API backend for the DentalBox / MediBook Clinical Management System. Built to serve the Flutter frontend with strong business logic, validation, error handling, and robust data persistence via MongoDB and Mongoose.

---

## 🛠️ Tech Stack & Architecture

- **Runtime & Framework:** Node.js (v22+) & Express.js (Native ES Modules / ESM)
- **Database & ODM:** MongoDB & Mongoose
- **Authentication & Security:** JWT (JSON Web Tokens), bcryptjs password hashing, CORS
- **File Uploads:** Multer (with disk storage and mimetype verification)
- **Architecture Pattern:** Clean MVC (Model-View-Controller) with modular routes, services, and middlewares:
  - `DB/` - Mongoose database connection
  - `model/` - Mongoose data schemas and business models
  - `controller/` - Request handling and business logic
  - `Route/` - RESTful route declarations
  - `model/` - Mongoose data schemas and business models
  - `controller/` - Request handling and business logic
  - `Route/` - RESTful route declarations
  - `middleware/` - JWT protection, file uploads, 404 & centralized error handling

---

## 🚀 Quick Start Guide

### 1. Prerequisites
Ensure MongoDB is running locally on default port `27017` or prepare a MongoDB Atlas connection URI.

### 2. Environment Configuration
Create or edit `.env` in the `backend/` directory:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/dentalbox
JWT_SECRET=dentalbox_super_secret_jwt_key_2026_secure
JWT_EXPIRES_IN=30d
CLIENT_URL=*
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start the Server
- **Development (Live Reload):**
  ```bash
  npm run dev
  ```
- **Production:**
  ```bash
  npm start
  ```
Server will be accessible at: `http://localhost:5000`

---

## 📚 Complete REST API Reference

### 1. Authentication & Clinic Profile (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register a new doctor / user account | Public |
| `POST` | `/api/auth/login` | Login with email and password | Public |
| `GET` | `/api/auth/me` | Retrieve profile of the logged-in doctor | Bearer Token |
| `PUT` | `/api/auth/profile` | Update profile, clinic info, logo, signature | Bearer Token |
| `POST` | `/api/auth/setup-clinic`| Quick clinic setup (clinicName, contact, doctorType) | Bearer Token |

### 2. Patients Management (`/api/patients`)
| Method | Endpoint | Description | Query Parameters |
|---|---|---|---|
| `POST` | `/api/patients` | Register new patient (demographics, medical conditions, preferences) | - |
| `GET` | `/api/patients` | List patients with filtering & sorting | `q`, `gender`, `startDate`, `endDate`, `sort`, `order` |
| `GET` | `/api/patients/:id` | Get patient by ID with full clinical dossier (visits, bills, appts) | - |
| `PUT` | `/api/patients/:id` | Update patient records | - |
| `DELETE` | `/api/patients/:id` | Delete patient | - |

### 3. Patient Clinical Visits (`/api/visits`)
| Method | Endpoint | Description | Query Parameters |
|---|---|---|---|
| `POST` | `/api/visits` | Record clinical visit (vitals, complaints, diagnosis, treatments) | - |
| `GET` | `/api/visits` | List visits with date and doctor filters | `patientId`, `patientName`, `doctorName`, `date`, `startDate`, `endDate` |
| `GET` | `/api/visits/:id` | Get single visit details | - |
| `PUT` | `/api/visits/:id` | Update clinical visit | - |
| `DELETE` | `/api/visits/:id` | Delete clinical visit | - |

### 4. Appointments & Scheduling (`/api/appointments`)
| Method | Endpoint | Description | Query Parameters |
|---|---|---|---|
| `POST` | `/api/appointments` | Book appointment (auto-links/creates patient if new) | - |
| `GET` | `/api/appointments` | List appointments | `date`, `status`, `department`, `doctorName`, `q` |
| `GET` | `/api/appointments/today`| Get all appointments scheduled for today | - |
| `GET` | `/api/appointments/missed`| Get past appointments marked as Missed | - |
| `PATCH` | `/api/appointments/:id/status`| Update status (`Scheduled`, `Confirmed`, `Checked In`, `Engaged`, `Completed`, `Missed`, `Cancelled`) | - |
| `GET` | `/api/appointments/:id` | Get single appointment | - |
| `DELETE` | `/api/appointments/:id` | Cancel/delete appointment | - |

### 5. Billing & Invoices (`/api/bills`)
| Method | Endpoint | Description | Query Parameters |
|---|---|---|---|
| `POST` | `/api/bills` | Create bill (Standard or Quick Bill with teeth selection) | - |
| `GET` | `/api/bills` | List bills with search and status filter | `status`, `q`, `startDate`, `endDate`, `isQuickBill` |
| `GET` | `/api/bills/stats` | Financial revenue statistics (Billed, Paid, Pending) | - |
| `GET` | `/api/bills/:id` | Get single bill details | - |
| `PUT` | `/api/bills/:id` | Update bill payment status or amount | - |
| `DELETE` | `/api/bills/:id` | Delete bill | - |

### 6. E-Prescriptions (`/api/prescriptions`)
| Method | Endpoint | Description | Query Parameters |
|---|---|---|---|
| `POST` | `/api/prescriptions` | Create prescription with medicines schedule and diagnosis | - |
| `GET` | `/api/prescriptions` | List prescriptions with search and timeframe filters | `q`, `filter` (`Today`, `This Week`, `This Month`), `status` |
| `GET` | `/api/prescriptions/:id` | Get single prescription | - |
| `PUT` | `/api/prescriptions/:id` | Update prescription | - |
| `DELETE` | `/api/prescriptions/:id` | Delete prescription | - |

### 7. Accounts & Financials (`/api/accounts`)
| Method | Endpoint | Description | Query Parameters |
|---|---|---|---|
| `POST` | `/api/accounts` | Record transaction (`income` or `expense`) | - |
| `GET` | `/api/accounts` | List transactions | `type`, `category`, `startDate`, `endDate`, `q` |
| `GET` | `/api/accounts/summary` | Total income, expenses, net balance, category breakdown | `startDate`, `endDate` |
| `DELETE` | `/api/accounts/:id` | Delete transaction | - |

### 8. Campaigns & Marketing (`/api/campaigns`)
| Method | Endpoint | Description | Query Parameters |
|---|---|---|---|
| `POST` | `/api/campaigns` | Create & send/schedule campaign (SMS, Email, WhatsApp) | Multipart logo supported |
| `GET` | `/api/campaigns` | List past campaigns | `type`, `status` |
| `GET` | `/api/campaigns/:id` | Get campaign details | - |
| `PUT` | `/api/campaigns/:id` | Update campaign | - |
| `DELETE` | `/api/campaigns/:id` | Delete campaign | - |

### 9. Inventory & Stock Management (`/api/inventory`)
| Method | Endpoint | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/api/inventory` | List items with category, status, and summary metrics | `category`, `status`, `q` |
| `POST` | `/api/inventory` | Add item with warning level and quantity | - |
| `PUT` | `/api/inventory/:id` | Update stock quantity, price, warning level | - |
| `DELETE` | `/api/inventory/:id` | Delete inventory item | - |
| `POST` | `/api/inventory/transactions` | Record Stock In / Stock Out (automatically adjusts inventory qty) | - |
| `GET` | `/api/inventory/transactions` | Audit trail of all stock transactions | `type`, `q` |
| `GET` | `/api/inventory/purchase-orders` | List supplier purchase orders | `status`, `vendor` |
| `POST` | `/api/inventory/purchase-orders` | Create purchase order | - |
| `PATCH` | `/api/inventory/purchase-orders/:id/status` | Update purchase order status | - |

### 10. Dental Lab Work (`/api/lab`)
| Method | Endpoint | Description | Query Parameters |
|---|---|---|---|
| `POST` | `/api/lab` | Create lab work order (teeth chart, prosthesis, delivery dates) | - |
| `GET` | `/api/lab` | List lab orders | `q`, `status`, `labName` |
| `GET` | `/api/lab/:id` | Get single lab order | - |
| `PUT` | `/api/lab/:id` | Update lab order status & trial dates | - |
| `DELETE` | `/api/lab/:id` | Delete lab order | - |

### 11. Reports & Analytics (`/api/reports`)
| Method | Endpoint | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/api/reports/generate` | Generate on-the-fly analytics (Payment Summary, Treatment Wise, Doctor Wise, Birthday Report, Follow-up Due) | `title`, `fromDate`, `toDate` |
| `GET` | `/api/reports/saved` | List all saved reports | - |
| `POST` | `/api/reports/save` | Save a generated analytical report | - |
| `GET` | `/api/reports/patient-dossier/:patientId` | Generate complete dossier (history, visits, treatments, bills) | - |

### 12. Dashboard Summary (`/api/dashboard`)
| Method | Endpoint | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/api/dashboard/summary` | Aggregate metrics (new patients, visits, appointments, missed, today's appts, revenue) | `range` (`Today`, `Last 7 Days`, `Last 30 Days`, `This Month`, etc.), `startDate`, `endDate` |
| `GET` | `/api/dashboard/search` | Instant patient search for top search bar | `q` |

### 13. Subscriptions & Plans (`/api/subscriptions`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/subscriptions/plans` | List available subscription tiers (Monthly, Quarterly, Yearly) |
| `POST` | `/api/subscriptions/activate` | Activate/renew clinic subscription |

---

## 🛡️ Validation & Error Handling
- All endpoints return consistent JSON structures:
  ```json
  {
    "success": true,
    "message": "Operation successful",
    "data": { ... }
  }
  ```
- Errors return standard HTTP status codes (400, 401, 403, 404, 500) with descriptive messages:
  ```json
  {
    "success": false,
    "message": "Resource not found with id: ..."
  }
  ```
