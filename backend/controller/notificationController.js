import Notification from '../model/Notification.js';
import { isValidObjectId, getDoctorFilter, isOwnerOrAdmin } from '../utils/helpers.js';

// @desc    Get all notifications for current doctor/user (doctor-isolated)
// @route   GET /api/notifications
// @access  Protected
const getNotifications = async (req, res, next) => {
  try {
    const { unreadOnly, type } = req.query;

    const filter = getDoctorFilter(req);

    if (unreadOnly === 'true' || unreadOnly === true) {
      filter.isRead = false;
    }

    if (type && typeof type === 'string' && type.trim()) {
      filter.type = type.trim();
    }

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }),
      Notification.countDocuments({
        ...getDoctorFilter(req),
        isRead: false
      })
    ]);

    res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark single notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Protected
const markAsRead = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    const notification = await Notification.findById(req.params.id);

    if (!notification || !isOwnerOrAdmin(req, notification)) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read (doctor-isolated)
// @route   PATCH /api/notifications/read-all
// @access  Protected
const markAllAsRead = async (req, res, next) => {
  try {
    const filter = getDoctorFilter(req);
    await Notification.updateMany(filter, { $set: { isRead: true } });

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear all notifications (doctor-isolated)
// @route   DELETE /api/notifications
// @access  Protected
const clearAllNotifications = async (req, res, next) => {
  try {
    const filter = getDoctorFilter(req);
    await Notification.deleteMany(filter);

    res.status(200).json({
      success: true,
      message: 'All notifications cleared successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete single notification
// @route   DELETE /api/notifications/:id
// @access  Protected
const deleteNotification = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    const notification = await Notification.findById(req.params.id);

    if (!notification || !isOwnerOrAdmin(req, notification)) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a notification
// @route   POST /api/notifications
// @access  Protected
const createNotification = async (req, res, next) => {
  try {
    const { title, message, type, metadata } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Notification title and message are required.'
      });
    }

    const notification = await Notification.create({
      user: req.user ? req.user.id : null,
      title: title.trim(),
      message: message.trim(),
      type: type || 'System',
      metadata: metadata || {}
    });

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: notification
    });
  } catch (error) {
    next(error);
  }
};

export {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearAllNotifications,
  deleteNotification,
  createNotification
};

export default {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearAllNotifications,
  deleteNotification,
  createNotification
};
