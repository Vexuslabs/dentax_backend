import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import User from '../model/User.js';
import Patient from '../model/Patient.js';
import PatientVisit from '../model/PatientVisit.js';
import Appointment from '../model/Appointment.js';
import Bill from '../model/Bill.js';
import Prescription from '../model/Prescription.js';
import Account from '../model/Account.js';
import Campaign from '../model/Campaign.js';
import Inventory from '../model/Inventory.js';
import InventoryTransaction from '../model/InventoryTransaction.js';
import PurchaseOrder from '../model/PurchaseOrder.js';
import Lab from '../model/Lab.js';
import Report from '../model/Report.js';
import { SubscriptionPlan } from '../model/Subscription.js';

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dentalbox';
    await mongoose.connect(mongoUri);
    console.log('[Seed]: Connected to MongoDB...');

    // Clear existing collections
    await Promise.all([
      User.deleteMany(),
      Patient.deleteMany(),
      PatientVisit.deleteMany(),
      Appointment.deleteMany(),
      Bill.deleteMany(),
      Prescription.deleteMany(),
      Account.deleteMany(),
      Campaign.deleteMany(),
      Inventory.deleteMany(),
      InventoryTransaction.deleteMany(),
      PurchaseOrder.deleteMany(),
      Lab.deleteMany(),
      Report.deleteMany(),
      SubscriptionPlan.deleteMany()
    ]);
    console.log('[Seed]: Cleared existing database collections.');

    // 1. Create Default Doctor User
    const doctor = await User.create({
      title: 'Dr',
      name: 'Dr. Prince Kumar',
      email: 'doctor@dentalbox.com',
      phone: '9876543210',
      password: 'password123',
      role: 'Doctor',
      clinicName: 'My Dental Clinic',
      clinicContact: '+91 9876543210',
      doctorType: 'Doctor',
      occupation: 'Senior Dental Surgeon',
      licenseNo: 'DENT-IN-2024-9872',
      template: {
        header: 'My Dental Clinic - Modern Dental Care',
        footer: 'Thank you for choosing us! Keep Smiling.',
        logo: '',
        signature: '',
        showPhone: true,
        showEmail: true,
        showAddress: true
      }
    });
    console.log(`[Seed]: Created default doctor user (${doctor.email}).`);

    // 2. Create Sample Patients
    const patients = await Patient.insertMany([
      {
        user: doctor._id,
        name: 'Rahul Sharma',
        mobileNumber: '9876543210',
        dob: '1992-05-14',
        gender: 'Male',
        age: 32,
        personalInfo: {
          anniversary: '2020-11-20',
          emergencyContact: { name: 'Sunita Sharma', phoneNumber: '9876543219' },
          address: { street: '42 MG Road, Sector 14' },
          adharNumber: '1234-5678-9012',
          notes: 'Sensitive to cold food and drinks'
        },
        medicalDetails: {
          conditions: [{ name: 'Diabetes' }, { name: 'BP' }]
        },
        preferences: { language: 'English', membership: 'Silver', group: 'Regular' }
      },
      {
        user: doctor._id,
        name: 'Priya Patel',
        mobileNumber: '9812345678',
        dob: '1996-08-22',
        gender: 'Female',
        age: 28,
        personalInfo: {
          emergencyContact: { name: 'Karan Patel', phoneNumber: '9812345679' },
          address: { street: 'Flat 302, Green Park' }
        },
        medicalDetails: {
          conditions: [{ name: 'Allergies' }]
        },
        preferences: { language: 'English', membership: 'Gold', group: 'VIP' }
      },
      {
        user: doctor._id,
        name: 'Amit Verma',
        mobileNumber: '9823456789',
        dob: '1988-12-05',
        gender: 'Male',
        age: 36,
        personalInfo: {
          address: { street: '12 Shivaji Nagar' }
        },
        medicalDetails: { conditions: [] },
        preferences: { language: 'English', membership: 'Silver', group: 'Regular' }
      },
      {
        user: doctor._id,
        name: 'Sneha Gupta',
        mobileNumber: '9834567890',
        dob: '2001-03-18',
        gender: 'Female',
        age: 23,
        medicalDetails: { conditions: [] },
        preferences: { language: 'English', membership: 'Silver', group: 'Regular' }
      },
      {
        user: doctor._id,
        name: 'Rohit Sharma',
        mobileNumber: '9876543211',
        dob: '1990-07-15',
        gender: 'Male',
        age: 34,
        medicalDetails: { conditions: [] },
        preferences: { language: 'English', membership: 'Silver', group: 'Regular' }
      }
    ]);
    console.log(`[Seed]: Created ${patients.length} patients.`);

    const todayStr = new Date().toISOString().split('T')[0];

    // 3. Create Sample Appointments
    await Appointment.insertMany([
      {
        user: doctor._id,
        patient: patients[0]._id,
        patientName: 'Rahul Sharma',
        phoneNumber: '9876543210',
        department: 'Dental',
        doctorName: 'Dr. Prince Kumar',
        visitType: 'Root Canal',
        appointmentDate: todayStr,
        appointmentTime: '10:30 AM',
        status: 'Scheduled',
        notes: 'Regular dental checkup',
        gender: 'M'
      },
      {
        user: doctor._id,
        patient: patients[1]._id,
        patientName: 'Priya Patel',
        phoneNumber: '9812345678',
        department: 'Orthodontics',
        doctorName: 'Dr. Prince Kumar',
        visitType: 'Braces Checkup',
        appointmentDate: todayStr,
        appointmentTime: '02:00 PM',
        status: 'Confirmed',
        notes: 'Braces wire check',
        gender: 'F'
      },
      {
        user: doctor._id,
        patient: patients[2]._id,
        patientName: 'Amit Verma',
        phoneNumber: '9823456789',
        department: 'Dental',
        doctorName: 'Dr. Prince Kumar',
        visitType: 'Scaling & Polish',
        appointmentDate: todayStr,
        appointmentTime: '04:15 PM',
        status: 'Scheduled',
        notes: 'Routine cleaning',
        gender: 'M'
      },
      {
        user: doctor._id,
        patient: patients[3]._id,
        patientName: 'Sneha Gupta',
        phoneNumber: '9834567890',
        department: 'Dental',
        doctorName: 'Dr. Prince Kumar',
        visitType: 'Consultation',
        appointmentDate: '2026-09-20',
        appointmentTime: '11:00 AM',
        status: 'Missed',
        notes: 'Follow-up missed appointment',
        gender: 'F'
      }
    ]);
    console.log('[Seed]: Created sample appointments.');

    // 4. Create Sample Patient Visits
    await PatientVisit.insertMany([
      {
        user: doctor._id,
        patient: patients[0]._id,
        patientName: 'Rahul Sharma',
        doctorName: 'Dr. Prince Kumar',
        mobileNumber: '9876543210',
        visitDate: new Date(),
        visitTime: '10:30',
        status: 'Completed',
        complaints: ['Severe toothache in upper molar', 'Sensitivity to hot water'],
        observations: [{ text: 'Deep carious lesion on tooth 16' }, { text: 'Mild gingivitis' }],
        diagnosis: [{ text: 'Acute Periapical Periodontitis' }],
        vitals: { bp: '120/80', pulse: '72', temp: '98.6' },
        actualTreatmentDone: 'Root Canal Access Cavity & Pulp Extirpation',
        treatmentSuggested: {
          fees: 3500,
          discount: 500,
          total: 3000,
          treatments: ['RCT', 'Crown'],
          medicines: [
            { name: 'Amoxicillin', dosage: '500 mg', duration: '5 days', timing: '2 times a day' },
            { name: 'Ibuprofen', dosage: '400 mg', duration: '3 days', timing: '2 times a day' }
          ]
        },
        advice: '• Warm salt water gargle 3 times a day.\n• Avoid chewing on right side.',
        followUpDate: '2026-10-30'
      },
      {
        user: doctor._id,
        patient: patients[1]._id,
        patientName: 'Priya Patel',
        doctorName: 'Dr. Prince Kumar',
        mobileNumber: '9812345678',
        visitDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        visitTime: '14:00',
        status: 'Completed',
        complaints: ['Routine checkup'],
        observations: [{ text: 'Plaque deposition on lower anterior' }],
        diagnosis: [{ text: 'Gingivitis' }],
        vitals: { bp: '110/70', pulse: '68', temp: '98.4' },
        actualTreatmentDone: 'Full Mouth Ultrasonic Scaling',
        treatmentSuggested: {
          fees: 1200,
          discount: 200,
          total: 1000,
          treatments: ['Cleaning'],
          medicines: [
            { name: 'Chlorhexidine Mouthwash', dosage: '10 ml', duration: '7 days', timing: 'Twice daily' }
          ]
        },
        advice: 'Brush twice daily with soft bristles.',
        followUpDate: '2026-11-15'
      }
    ]);
    console.log('[Seed]: Created sample patient visits.');

    // 5. Create Sample Bills (Standard & Quick Bill)
    await Bill.insertMany([
      {
        user: doctor._id,
        patient: patients[0]._id,
        invoiceNumber: '#INV-001',
        patientName: 'Rahul Sharma',
        phoneNumber: '9876543210',
        amount: 3500,
        discount: 500,
        totalAmount: 3000,
        status: 'Paid',
        paymentMethod: 'UPI',
        notes: 'Root canal treatment advance',
        isQuickBill: false
      },
      {
        user: doctor._id,
        patient: patients[1]._id,
        invoiceNumber: '#INV-002',
        patientName: 'Priya Patel',
        phoneNumber: '9812345678',
        amount: 1200,
        discount: 200,
        totalAmount: 1000,
        status: 'Pending',
        paymentMethod: 'Pending',
        notes: 'Full mouth cleaning',
        isQuickBill: false
      },
      {
        user: doctor._id,
        patient: patients[2]._id,
        invoiceNumber: '#INV-003',
        patientName: 'Amit Verma',
        phoneNumber: '9823456789',
        amount: 1500,
        discount: 0,
        totalAmount: 1500,
        status: 'Paid',
        paymentMethod: 'Cash',
        notes: 'Composite filling',
        isQuickBill: true,
        selectedTeeth: [14, 15],
        treatments: [{ name: 'Filling', price: 1500, subtitle: 'Tooth filling for cavities' }],
        medicines: [{ name: 'Paracetamol', dosage: '500mg', duration: '3 days', timing: 'After Food' }]
      }
    ]);
    console.log('[Seed]: Created sample bills.');

    // 6. Create Sample Prescriptions
    await Prescription.insertMany([
      {
        user: doctor._id,
        patient: patients[0]._id,
        patientName: 'Rahul Sharma',
        doctorName: 'Dr. Prince Kumar',
        diagnosis: 'Acute Periapical Periodontitis',
        tag: 'Acute Periapical Periodontitis',
        medicines: [
          { name: 'Amoxicillin', dosage: '500 mg', duration: '5 days', timing: '2 times a day' },
          { name: 'Ibuprofen', dosage: '400 mg', duration: '3 days', timing: '2 times a day' }
        ],
        instructions: '• Warm salt water gargle 3 times a day.\n• Avoid hard and sticky food.\n• Take medicines after food.',
        status: 'Completed'
      },
      {
        user: doctor._id,
        patient: patients[1]._id,
        patientName: 'Priya Patel',
        doctorName: 'Dr. Prince Kumar',
        diagnosis: 'Routine Checkup & Gingivitis',
        tag: 'Routine Checkup',
        medicines: [
          { name: 'Chlorhexidine Mouthwash', dosage: '10 ml', duration: '7 days', timing: 'Twice daily' },
          { name: 'Vitamin C', dosage: '500 mg', duration: '15 days', timing: 'Once daily' }
        ],
        instructions: '• Brush twice daily.\n• Floss regularly.',
        status: 'Active'
      }
    ]);
    console.log('[Seed]: Created sample prescriptions.');

    // 7. Create Accounts (Income & Expenses)
    await Account.insertMany([
      {
        user: doctor._id,
        type: 'income',
        title: 'John Doe Consultation',
        category: 'Consultation',
        amount: 5000,
        description: 'Patient consultation fee',
        date: new Date()
      },
      {
        user: doctor._id,
        type: 'income',
        title: 'Home Visit Consultation',
        category: 'Patient Visit',
        amount: 800,
        description: 'Home visit dental checkup',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        user: doctor._id,
        type: 'income',
        title: 'Online Video Consultation',
        category: 'Consultation',
        amount: 1200,
        description: 'Tele-consultation',
        date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      },
      {
        user: doctor._id,
        type: 'expense',
        title: 'Dental Consumables & Tools',
        category: 'Supplies',
        amount: 2000,
        description: 'Syringes, cotton rolls, masks',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      }
    ]);
    console.log('[Seed]: Created sample income/expense accounts.');

    // 8. Create Inventory Items
    await Inventory.insertMany([
      {
        user: doctor._id,
        productName: 'Paracetamol',
        category: 'Medicine',
        quantity: 150,
        price: 15,
        expireDate: 'Tablet 500mg',
        status: 'In Stock',
        warningLevel: 30,
        description: 'Painkiller tablet'
      },
      {
        user: doctor._id,
        productName: 'Amoxicillin',
        category: 'Antibiotic',
        quantity: 24,
        price: 45,
        expireDate: 'Capsule 500mg',
        status: 'Low Stock',
        warningLevel: 30,
        description: 'Antibiotic capsule'
      },
      {
        user: doctor._id,
        productName: 'Lidocaine',
        category: 'Injection',
        quantity: 0,
        price: 80,
        expireDate: 'Injection 2%',
        status: 'Out of Stock',
        warningLevel: 10,
        description: 'Local anesthetic injection'
      },
      {
        user: doctor._id,
        productName: 'Chlorhexidine',
        category: 'Dental Care',
        quantity: 85,
        price: 120,
        expireDate: 'Mouthwash 0.2%',
        status: 'In Stock',
        warningLevel: 20,
        description: 'Antiseptic mouthwash'
      },
      {
        user: doctor._id,
        productName: 'Surgical Gloves',
        category: 'Consumable',
        quantity: 12,
        price: 350,
        expireDate: 'Box (100 pcs)',
        status: 'Low Stock',
        warningLevel: 20,
        description: 'Sterile surgical gloves'
      },
      {
        user: doctor._id,
        productName: 'Face Mask',
        category: 'Consumable',
        quantity: 200,
        price: 150,
        expireDate: 'Box (50 pcs)',
        status: 'In Stock',
        warningLevel: 50,
        description: '3-ply protective face mask'
      },
      {
        user: doctor._id,
        productName: 'Dental Mirror',
        category: 'Instrument',
        quantity: 5,
        price: 250,
        expireDate: 'Standard',
        status: 'Low Stock',
        warningLevel: 10,
        description: 'Stainless steel dental mirror'
      },
      {
        user: doctor._id,
        productName: 'Cotton Rolls',
        category: 'Consumable',
        quantity: 0,
        price: 90,
        expireDate: 'Pack (100 pcs)',
        status: 'Out of Stock',
        warningLevel: 15,
        description: 'Absorbent dental cotton rolls'
      }
    ]);
    console.log('[Seed]: Created sample inventory items.');

    // 9. Create Purchase Orders
    await PurchaseOrder.insertMany([
      {
        user: doctor._id,
        orderNumber: '1001',
        title: 'Order #1001',
        subtitle: 'Vitamin C - 100 Qty',
        vendor: 'ABC Pharma',
        date: '12 Dec 2026',
        status: 'Pending',
        totalAmount: 1500
      },
      {
        user: doctor._id,
        orderNumber: '1002',
        title: 'Order #1002',
        subtitle: 'Antibiotics - 50 Qty',
        vendor: 'MediCare Supplies',
        date: '10 Dec 2026',
        status: 'Delivered',
        totalAmount: 2250
      },
      {
        user: doctor._id,
        orderNumber: '1003',
        title: 'Order #1003',
        subtitle: 'Syringe - 200 Qty',
        vendor: 'Dental Mart',
        date: '08 Dec 2026',
        status: 'Ordered',
        totalAmount: 3400
      }
    ]);
    console.log('[Seed]: Created sample purchase orders.');

    // 10. Create Lab Orders
    await Lab.insertMany([
      {
        user: doctor._id,
        patient: patients[0]._id,
        patientName: 'Rahul Sharma',
        doctorName: 'Dr. Prince Kumar',
        labName: 'City Dental Lab',
        date: '2026-09-23',
        time: '10:00 AM',
        selectedTeeth: ['11'],
        prosthesisType: ['Crown'],
        surfaceCluster: 'Glossy',
        ponticType: 'Modified Ridge Lap',
        implantType: 'Screw Retained',
        expectedDelivery: {
          metalTrial: '2026-09-24',
          bisqueTrial: '2026-09-25',
          final: '2026-09-26'
        },
        charges: { total: 1000, quantity: 1 },
        status: 'Pending',
        workStatus: 'In Progress'
      }
    ]);
    console.log('[Seed]: Created sample lab orders.');

    // 11. Create Marketing Campaigns
    await Campaign.insertMany([
      {
        user: doctor._id,
        title: 'Diwali Dental Offer',
        campaignType: 'SMS',
        sendTo: 'All Patients',
        message: 'Get 50% off on scaling this Diwali! Book your appointment today with My Dental Clinic.',
        status: 'Sent'
      },
      {
        user: doctor._id,
        title: 'Teeth Cleaning Week',
        campaignType: 'SMS',
        sendTo: 'Selected Patients',
        message: 'Keep your smile bright and healthy! Special cleaning slots available this week.',
        status: 'Sent'
      },
      {
        user: doctor._id,
        title: 'New Year Smile Checkup',
        campaignType: 'Email',
        sendTo: 'All Patients',
        message: 'Start the new year with confident healthy smiles. Schedule your checkup today!',
        status: 'Draft'
      }
    ]);
    console.log('[Seed]: Created sample campaigns.');

    // 12. Create Subscription Plans
    await SubscriptionPlan.insertMany([
      {
        planId: 'razor_monthly',
        name: 'monthly',
        price: 999,
        amount: 999,
        features: [
          'Unlimited Patient Records',
          'Cloud Backup & Sync',
          'Automated Appointment Reminders',
          'Digital E-Prescriptions',
          '24/7 Dedicated Support'
        ],
        popular: true
      },
      {
        planId: 'razor_quarterly',
        name: 'quarterly',
        price: 2499,
        amount: 2499,
        features: [
          'Everything in Monthly',
          'Custom Clinic Branding',
          'Multi-Doctor & Staff Access',
          'Advanced Financial Analytics'
        ],
        popular: false
      },
      {
        planId: 'razor_annual',
        name: 'yearly',
        price: 7999,
        amount: 7999,
        features: [
          'Everything in Quarterly',
          'Unlimited WhatsApp Notifications',
          'Priority VIP Support',
          'Dedicated Account Manager'
        ],
        popular: false
      }
    ]);
    console.log('[Seed]: Created subscription plans.');

    console.log('\n===========================================');
    console.log(' SEEDING COMPLETED SUCCESSFULLY! ');
    console.log(' Doctor Login: doctor@dentalbox.com / password123');
    console.log('===========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
};

seedData();
