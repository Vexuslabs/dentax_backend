import User from '../model/User.js';

// Helper to return user token response
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = user.getSignedJwtToken();
  const userObj = user.toObject();
  delete userObj.password;

  res.status(statusCode).json({
    success: true,
    message,
    token,
    user: userObj
  });
};

// @desc    Register a new user / doctor
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { title, name, email, phone, password, role, clinicName, clinicContact, doctorType } = req.body;

    if (!email || !password || !name || typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid name, email, and password.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    const user = await User.create({
      title: title || 'Dr',
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone ? String(phone).trim() : '0000000000',
      password,
      role: role || 'Doctor',
      clinicName: clinicName ? String(clinicName).trim() : 'My Dental Clinic',
      clinicContact: clinicContact ? String(clinicContact).trim() : '',
      doctorType: doctorType || 'Doctor'
    });

    sendTokenResponse(user, 201, res, 'Account created successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Login user / doctor
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid email and password.'
      });
    }

    // Find user and include password
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    sendTokenResponse(user, 200, res, 'Login successful');
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile & clinic setup
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      clinicName,
      clinicContact,
      doctorType,
      occupation,
      licenseNo,
      avatar,
      clinicAddress,
      qualification,
      specialization,
      template
    } = req.body;

    const fieldsToUpdate = {};
    if (name) fieldsToUpdate.name = name.trim();
    if (phone) fieldsToUpdate.phone = phone.trim();
    if (clinicName) fieldsToUpdate.clinicName = clinicName.trim();
    if (clinicContact !== undefined) fieldsToUpdate.clinicContact = clinicContact.trim();
    if (doctorType) fieldsToUpdate.doctorType = doctorType;
    if (occupation) fieldsToUpdate.occupation = occupation;
    if (licenseNo !== undefined) fieldsToUpdate.licenseNo = licenseNo;
    if (avatar !== undefined) fieldsToUpdate.avatar = avatar;
    if (clinicAddress !== undefined) fieldsToUpdate.clinicAddress = clinicAddress.trim();
    if (qualification !== undefined) fieldsToUpdate.qualification = qualification.trim();
    if (specialization !== undefined) fieldsToUpdate.specialization = specialization.trim();

    // Handle template configuration (for prescription/bills)
    if (template) {
      let parsedTemplate = template;
      if (typeof template === 'string') {
        try {
          parsedTemplate = JSON.parse(template);
        } catch (_) {}
      }
      if (typeof parsedTemplate === 'object' && parsedTemplate !== null) {
        fieldsToUpdate.template = {
          ...(req.user.template ? req.user.template.toObject() : {}),
          ...parsedTemplate
        };
      }
    }

    // Handle uploaded file paths if provided by Multer
    if (req.files) {
      if (!fieldsToUpdate.template) {
        fieldsToUpdate.template = req.user.template ? req.user.template.toObject() : {};
      }
      if (req.files.logo && req.files.logo[0]) {
        fieldsToUpdate.template.logo = `/uploads/${req.files.logo[0].filename}`;
      }
      if (req.files.signature && req.files.signature[0]) {
        fieldsToUpdate.template.signature = `/uploads/${req.files.signature[0].filename}`;
      }
      if (req.files.avatar && req.files.avatar[0]) {
        fieldsToUpdate.avatar = `/uploads/${req.files.avatar[0].filename}`;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: fieldsToUpdate },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clinic Setup
// @route   POST /api/auth/setup-clinic
// @access  Private
const setupClinic = async (req, res, next) => {
  try {
    const { clinicName, clinicContact, doctorType } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        clinicName: clinicName || 'My Dental Clinic',
        clinicContact: clinicContact || '',
        doctorType: doctorType || 'Doctor'
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Clinic details saved successfully',
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public / Private
const logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};

export {
  register,
  login,
  getMe,
  updateProfile,
  setupClinic,
  logout
};

export default {
  register,
  login,
  getMe,
  updateProfile,
  setupClinic,
  logout
};

