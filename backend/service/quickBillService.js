import Bill from '../model/Bill.js';
import Patient from '../model/Patient.js';
import { isValidObjectId, getDoctorFilter, isOwnerOrAdmin } from '../utils/helpers.js';

/**
 * Default treatments catalogue displayed on the Quick Bill mobile interface
 */
export const DEFAULT_QUICK_BILL_TREATMENTS = [
  {
    id: 'cleaning',
    name: 'Cleaning',
    subtitle: 'Teeth cleaning and polishing',
    price: 500.0,
    icon: 'tooth'
  },
  {
    id: 'filling',
    name: 'Filling',
    subtitle: 'Tooth filling for cavities',
    price: 1000.0,
    icon: 'tooth'
  },
  {
    id: 'root-canal',
    name: 'Root Canal',
    subtitle: 'Root canal treatment',
    price: 3000.0,
    icon: 'tooth'
  },
  {
    id: 'extraction',
    name: 'Extraction',
    subtitle: 'Tooth extraction',
    price: 800.0,
    icon: 'tooth'
  }
];

/**
 * Normalizes medicines array or string input into structured objects
 * Handles: ["Amoxicillin 500mg", "Paracetamol"] or [{ name, dosage, duration, timing }]
 */
export const normalizeMedicines = (medicines) => {
  if (!medicines) return [];
  if (typeof medicines === 'string') {
    medicines = medicines.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(medicines)) return [];

  return medicines.map((med) => {
    if (typeof med === 'string') {
      return {
        name: med.trim(),
        dosage: '500mg',
        duration: '5 days',
        timing: 'After Food',
        frequency: ''
      };
    }
    if (typeof med === 'object' && med !== null) {
      return {
        name: (med.name || med.medicineName || '').trim(),
        dosage: (med.dosage || '500mg').trim(),
        duration: (med.duration || '5 days').trim(),
        timing: (med.timing || 'After Food').trim(),
        frequency: (med.frequency || '').trim()
      };
    }
    return null;
  }).filter((m) => m && m.name);
};

/**
 * Normalizes selected teeth input
 * Filters out "none", empty strings, or nulls, converting numeric tooth numbers
 */
export const normalizeSelectedTeeth = (selectedTeeth) => {
  if (!selectedTeeth) return [];
  if (selectedTeeth === 'none' || selectedTeeth === 'Selected: none') return [];
  if (!Array.isArray(selectedTeeth)) {
    selectedTeeth = [selectedTeeth];
  }

  return selectedTeeth
    .map((tooth) => {
      if (typeof tooth === 'string') {
        const trimmed = tooth.trim();
        if (trimmed.toLowerCase() === 'none' || !trimmed) return null;
        const num = Number(trimmed);
        return !isNaN(num) ? num : trimmed;
      }
      return tooth;
    })
    .filter((t) => t !== null && t !== undefined);
};

/**
 * Normalizes treatment items and validates prices
 */
export const normalizeTreatments = (treatments) => {
  if (!Array.isArray(treatments)) return [];

  return treatments.map((item) => {
    if (typeof item === 'string') {
      const match = DEFAULT_QUICK_BILL_TREATMENTS.find(
        (t) => t.name.toLowerCase() === item.trim().toLowerCase()
      );
      return {
        name: item.trim(),
        price: match ? match.price : 0,
        cost: match ? match.price : 0,
        fees: match ? match.price : 0,
        subtitle: match ? match.subtitle : '',
        description: match ? match.subtitle : '',
        quantity: 1
      };
    }
    const unitPrice = Number(item.price !== undefined ? item.price : (item.cost !== undefined ? item.cost : (item.fees || 0)));
    const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
    return {
      name: (item.name || item.treatmentName || 'General Treatment').trim(),
      price: unitPrice,
      cost: unitPrice,
      fees: unitPrice,
      subtitle: (item.subtitle || item.description || '').trim(),
      description: (item.description || item.subtitle || '').trim(),
      quantity: qty
    };
  });
};

/**
 * Performs robust billing math for Quick Bill
 */
export const calculateTotals = ({
  treatments = [],
  amount,
  fees,
  grossFees,
  discount = 0,
  tax = 0,
  paidAmount = 0,
  status
}) => {
  const normTreatments = normalizeTreatments(treatments);
  const treatmentsSum = normTreatments.reduce(
    (sum, t) => sum + (Number(t.price) || 0) * (Number(t.quantity) || 1),
    0
  );

  let finalGross = 0;
  if (grossFees !== undefined && grossFees !== null) {
    finalGross = Number(grossFees);
  } else if (amount !== undefined && amount !== null) {
    finalGross = Number(amount);
  } else if (fees !== undefined && fees !== null) {
    finalGross = Number(fees);
  } else {
    finalGross = treatmentsSum;
  }

  if (isNaN(finalGross) || finalGross < 0) {
    finalGross = 0;
  }

  const finalDiscount = Number(discount) > 0 ? Number(discount) : 0;
  const finalTax = Number(tax) > 0 ? Number(tax) : 0;
  const finalTotal = Math.max(0, finalGross - finalDiscount + finalTax);

  let finalPaid = Number(paidAmount);
  if (isNaN(finalPaid) || finalPaid < 0) {
    finalPaid = 0;
  }

  // If status is explicitly 'Paid' but paidAmount was omitted, auto-set paidAmount to total
  if (status === 'Paid' && paidAmount === undefined && finalTotal > 0) {
    finalPaid = finalTotal;
  }

  const finalDue = Math.max(0, finalTotal - finalPaid);

  let resolvedStatus = status;
  if (!resolvedStatus) {
    if (finalPaid >= finalTotal && finalTotal > 0) {
      resolvedStatus = 'Paid';
    } else if (finalPaid > 0 && finalPaid < finalTotal) {
      resolvedStatus = 'Partially Paid';
    } else {
      resolvedStatus = 'Pending';
    }
  }

  return {
    treatments: normTreatments,
    grossFees: finalGross,
    amount: finalGross,
    discount: finalDiscount,
    tax: finalTax,
    totalAmount: finalTotal,
    paidAmount: finalPaid,
    dueAmount: finalDue,
    status: resolvedStatus
  };
};

/**
 * Dynamically resolves or creates patient record for Quick Bill
 */
export const resolvePatientForBill = async (req, body) => {
  const {
    patientId,
    patient: patientInputId,
    patientName,
    name,
    phoneNumber,
    phone,
    gender,
    age,
    dob
  } = body;

  const targetPatientId = patientId || patientInputId;
  let resolvedPatient = null;
  let resolvedPatientName = (patientName || name || '').trim();
  let resolvedPhone = (phoneNumber || phone || '').trim();

  if (targetPatientId) {
    if (!isValidObjectId(targetPatientId)) {
      const err = new Error(`Invalid patient ID format: ${targetPatientId}`);
      err.statusCode = 400;
      throw err;
    }

    resolvedPatient = await Patient.findById(targetPatientId);
    if (!resolvedPatient || !isOwnerOrAdmin(req, resolvedPatient)) {
      const err = new Error('Patient not found or not authorized to access this patient.');
      err.statusCode = 404;
      throw err;
    }

    // Dynamic fetch from DB record to eliminate hardcoded details
    resolvedPatientName = resolvedPatient.name;
    resolvedPhone = resolvedPatient.mobileNumber;
  } else {
    if (!resolvedPatientName) {
      const err = new Error('Patient name or valid patientId is required.');
      err.statusCode = 400;
      throw err;
    }

    const doctorQuery = getDoctorFilter(req);
    resolvedPatient = await Patient.findOne({
      ...doctorQuery,
      $or: [
        { name: resolvedPatientName },
        ...(resolvedPhone ? [{ mobileNumber: resolvedPhone }] : [])
      ]
    });

    if (!resolvedPatient) {
      const incomingGender = gender ? String(gender).trim().toLowerCase() : '';
      const resolvedGender = incomingGender === 'female' || incomingGender === 'f'
        ? 'Female'
        : incomingGender === 'male' || incomingGender === 'm'
        ? 'Male'
        : 'Other';

      const resolvedDob = dob ? String(dob).trim() : (age && Number(age) > 0 ? `${new Date().getFullYear() - Number(age)}-01-01` : '');

      resolvedPatient = await Patient.create({
        user: req.user ? req.user.id : null,
        name: resolvedPatientName,
        mobileNumber: resolvedPhone || '',
        dob: resolvedDob,
        gender: resolvedGender,
        age: Number(age) || 0
      });
    }
  }

  return {
    patient: resolvedPatient,
    patientName: resolvedPatientName,
    phoneNumber: resolvedPhone
  };
};

export default {
  DEFAULT_QUICK_BILL_TREATMENTS,
  normalizeMedicines,
  normalizeSelectedTeeth,
  normalizeTreatments,
  calculateTotals,
  resolvePatientForBill
};
