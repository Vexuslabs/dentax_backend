import Campaign from '../model/Campaign.js';
import Patient from '../model/Patient.js';
import messagingService from '../utils/messagingService.js';
import { isValidObjectId } from '../utils/helpers.js';

// @desc    Create new campaign
// @route   POST /api/campaigns
// @access  Public / Protected
const createCampaign = async (req, res, next) => {
  try {
    const {
      campaignType,
      sendTo,
      category,
      title,
      emailSubject,
      header,
      subHeader,
      message,
      includePatientName,
      includeDoctorName,
      includePhone,
      includeClinicName,
      logo,
      status,
      scheduleDate
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Campaign title and message are required.'
      });
    }

    let logoPath = logo || '';
    if (req.file) {
      logoPath = `/uploads/${req.file.filename}`;
    }

    const resolvedStatus = status || 'Sent';

    const campaign = await Campaign.create({
      user: req.user ? req.user.id : null,
      campaignType: campaignType || 'SMS',
      sendTo: sendTo || 'All Patients',
      category: category || 'General',
      title: title.trim(),
      emailSubject: emailSubject ? emailSubject.trim() : '',
      header: header ? header.trim() : '',
      subHeader: subHeader ? subHeader.trim() : '',
      message: message.trim(),
      includePatientName: includePatientName !== undefined ? includePatientName : true,
      includeDoctorName: includeDoctorName !== undefined ? includeDoctorName : true,
      includePhone: includePhone !== undefined ? includePhone : true,
      includeClinicName: includeClinicName !== undefined ? includeClinicName : true,
      logo: logoPath,
      status: resolvedStatus,
      scheduleDate: scheduleDate ? new Date(scheduleDate) : null
    });

    // If campaign is marked as Sent, trigger live transmission
    if (resolvedStatus === 'Sent') {
      const recipientQuery = { mobileNumber: { $exists: true, $ne: '' } };
      if (sendTo && sendTo !== 'All Patients' && sendTo !== 'All') {
        recipientQuery.$or = [
          { 'preferences.group': sendTo },
          { 'preferences.membership': sendTo },
          { gender: sendTo }
        ];
      }

      const patients = await Patient.find(recipientQuery).select('name mobileNumber');

      let broadcastMessage = campaign.message;
      if (campaign.includeClinicName && req.user?.clinicName) {
        broadcastMessage += ` - ${req.user.clinicName}`;
      }

      const deliveryResult = await messagingService.broadcast({
        campaignType: campaign.campaignType,
        recipients: patients,
        message: broadcastMessage,
        mediaUrl: campaign.logo
      });

      campaign.deliveryStats = deliveryResult;
      await campaign.save();
    }

    res.status(201).json({
      success: true,
      message: `Campaign ${campaign.status === 'Sent' ? 'sent' : 'saved'} successfully`,
      data: campaign
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all campaigns
// @route   GET /api/campaigns
// @access  Public / Protected
const getAllCampaigns = async (req, res, next) => {
  try {
    const { type, status } = req.query;

    const filter = {};
    if (type) filter.campaignType = type;
    if (status) filter.status = status;

    const campaigns = await Campaign.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: campaigns.length,
      data: campaigns
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get campaign by ID
// @route   GET /api/campaigns/:id
// @access  Public / Protected
const getCampaignById = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    const campaign = await Campaign.findById(req.params.id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    res.status(200).json({
      success: true,
      data: campaign
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update campaign
// @route   PUT /api/campaigns/:id
// @access  Public / Protected
const updateCampaign = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    const campaign = await Campaign.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Campaign updated successfully',
      data: campaign
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete campaign
// @route   DELETE /api/campaigns/:id
// @access  Public / Protected
const deleteCampaign = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    const campaign = await Campaign.findByIdAndDelete(req.params.id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export {
  createCampaign,
  getAllCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign
};

export default {
  createCampaign,
  getAllCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign
};
