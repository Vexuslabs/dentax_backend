import app from '../server.js';

const PORT = 5099;
const BASE_URL = `http://localhost:${PORT}`;

let server;

async function runTests() {
  console.log('[Test Runner]: Starting server for verification on port', PORT);
  server = app.listen(PORT);

  // Wait a brief moment for server to bind
  await new Promise((resolve) => setTimeout(resolve, 500));

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  let authToken = '';

  try {
    // 1. Root & Health Check
    await test('GET / returns 200 and system info', async () => {
      const res = await fetch(`${BASE_URL}/`);
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success || data.name !== 'MediBook / DentalBox Backend API') {
        throw new Error('Unexpected response body');
      }
    });

    await test('GET /api/health returns 200 and Healthy status', async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success || data.status !== 'Healthy') {
        throw new Error('Health check failed');
      }
    });

    // 2. Authentication
    await test('POST /api/auth/login logs in doctor user', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'doctor@dentalbox.com',
          password: 'password123'
        })
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success || !data.token) throw new Error('No token returned');
      authToken = data.token;
    });

    await test('GET /api/auth/me gets authenticated user', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success || data.user.email !== 'doctor@dentalbox.com') {
        throw new Error('User profile did not match');
      }
    });

    // 3. Dashboard
    await test('GET /api/dashboard/summary returns clinic statistics', async () => {
      const res = await fetch(`${BASE_URL}/api/dashboard/summary?filter=Today`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success || !data.data) throw new Error('No dashboard data');
    });

    await test('GET /api/dashboard/search searches patients across DB', async () => {
      const res = await fetch(`${BASE_URL}/api/dashboard/search?q=Sharma`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success || !Array.isArray(data.data)) throw new Error('Search failed');
    });

    // 4. Patients
    let testPatientId = '';
    await test('GET /api/patients returns patient list', async () => {
      const res = await fetch(`${BASE_URL}/api/patients`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success || !Array.isArray(data.data)) throw new Error('Patient list failed');
      if (data.data.length > 0) testPatientId = data.data[0]._id;
    });

    await test('POST /api/patients creates a new patient', async () => {
      const res = await fetch(`${BASE_URL}/api/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: 'Security Test Patient',
          phone: '+91 9999988888',
          gender: 'Female',
          age: 28
        })
      });
      if (res.status !== 201) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success || data.data.name !== 'Security Test Patient') {
        throw new Error('Failed to create patient');
      }
    });

    // 5. Appointments
    await test('GET /api/appointments returns appointments', async () => {
      const res = await fetch(`${BASE_URL}/api/appointments`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error('Appointments query failed');
    });

    await test('GET /api/appointments/today returns today appointments', async () => {
      const res = await fetch(`${BASE_URL}/api/appointments/today`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error('Todays appointments failed');
    });

    await test('GET /api/appointments/missed returns missed appointments', async () => {
      const res = await fetch(`${BASE_URL}/api/appointments/missed`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error('Missed appointments failed');
    });

    // 6. Patient Visits
    await test('GET /api/visits returns visits', async () => {
      const res = await fetch(`${BASE_URL}/api/visits`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error('Visits query failed');
    });

    // 7. Bills
    await test('GET /api/bills returns bills', async () => {
      const res = await fetch(`${BASE_URL}/api/bills`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error('Bills query failed');
    });

    await test('GET /api/bills/stats returns bill summary statistics', async () => {
      const res = await fetch(`${BASE_URL}/api/bills/stats`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success || !data.data) throw new Error('Bill stats failed');
    });

    // 8. Prescriptions
    await test('GET /api/prescriptions returns prescriptions', async () => {
      const res = await fetch(`${BASE_URL}/api/prescriptions`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error('Prescriptions query failed');
    });

    // 9. Accounts (Income & Expense)
    await test('GET /api/accounts returns accounting transactions', async () => {
      const res = await fetch(`${BASE_URL}/api/accounts`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error('Accounts query failed');
    });

    await test('GET /api/accounts/summary returns income/expense balance summary', async () => {
      const res = await fetch(`${BASE_URL}/api/accounts/summary`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success || data.data.totalIncome === undefined) throw new Error('Accounts summary failed');
    });

    // 10. Campaigns
    await test('GET /api/campaigns returns marketing campaigns', async () => {
      const res = await fetch(`${BASE_URL}/api/campaigns`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error('Campaigns query failed');
    });

    // 11. Inventory & Purchase Orders
    await test('GET /api/inventory returns inventory items', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error('Inventory items failed');
    });

    await test('GET /api/inventory/transactions returns stock movements', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/transactions`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error('Inventory transactions failed');
    });

    await test('GET /api/inventory/purchase-orders returns purchase orders', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/purchase-orders`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error('Purchase orders failed');
    });

    // 12. Lab Orders
    await test('GET /api/lab returns dental lab work orders', async () => {
      const res = await fetch(`${BASE_URL}/api/lab`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error('Lab orders query failed');
    });

    // 13. Reports
    await test('GET /api/reports/saved returns saved reports', async () => {
      const res = await fetch(`${BASE_URL}/api/reports/saved`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error('Saved reports query failed');
    });

    if (testPatientId) {
      await test('GET /api/reports/patient-dossier/:id returns patient medical history', async () => {
        const res = await fetch(`${BASE_URL}/api/reports/patient-dossier/${testPatientId}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        if (!data.success || !data.data) throw new Error('Patient dossier failed');
      });
    }

    // 14. Subscriptions
    await test('GET /api/subscriptions/plans returns subscription plans', async () => {
      const res = await fetch(`${BASE_URL}/api/subscriptions/plans`);
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error('Subscription plans query failed');
      }
    });

    await test('POST /api/subscriptions/activate activates plan', async () => {
      const res = await fetch(`${BASE_URL}/api/subscriptions/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          planId: 'razor_monthly',
          paymentId: 'pay_test_esm_12345'
        })
      });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success || data.data.planName !== 'monthly') {
        throw new Error('Subscription activation failed');
      }
    });

    // ================= SECURITY VERIFICATIONS =================
    
    // 15. Security Headers (Helmet)
    await test('SECURITY: Helmet applies X-Content-Type-Options: nosniff', async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      const nosniff = res.headers.get('x-content-type-options');
      if (nosniff !== 'nosniff') throw new Error(`Expected nosniff, got ${nosniff}`);
    });

    // 16. NoSQL Injection Prevention
    await test('SECURITY: NoSQL injection in body ($gt operator) is safely sanitized', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: { $gt: '' },
          password: { $gt: '' }
        })
      });
      // Should reject invalid credentials or bad input with 400 or 401, never allow bypass
      if (res.status !== 400 && res.status !== 401) {
        throw new Error(`Unexpected status ${res.status}`);
      }
    });

    // 17. ReDoS & Regex Injection Protection
    await test('SECURITY: Malformed RegExp in query (?q=[a-z) does not crash server', async () => {
      const res = await fetch(`${BASE_URL}/api/patients?q=[a-z(`);
      if (res.status !== 200) {
        throw new Error(`Expected 200 with escaped regex, got ${res.status}`);
      }
      const data = await res.json();
      if (!data.success) throw new Error('Request failed with escaped regex');
    });

    // 18. Invalid ObjectId Cast Protection
    await test('SECURITY: Malformed ObjectId (/api/patients/not-a-valid-id) returns 404', async () => {
      const res = await fetch(`${BASE_URL}/api/patients/not-a-valid-id`);
      if (res.status !== 404) {
        throw new Error(`Expected 404, got ${res.status}`);
      }
      const data = await res.json();
      if (data.success !== false) throw new Error('Expected success: false');
    });

    // 19. User Enumeration Protection
    await test('SECURITY: Non-existent email returns same 401 message as wrong password', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent_doctor_xyz@dentalbox.com',
          password: 'password123'
        })
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
      const data = await res.json();
      if (data.message !== 'Invalid email or password.') {
        throw new Error(`Expected generic message, got "${data.message}"`);
      }
    });

    console.log('\n===========================================');
    console.log(` VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED `);
    console.log('===========================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
  }
}

runTests();
