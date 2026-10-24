/**
 * Live SMS & WhatsApp Broadcast Service
 * Integrates Twilio, MSG91, and Meta WhatsApp Cloud API
 */

// Helper to sanitize international phone numbers (e.g. "+91 9999988888" -> "+919999988888")
const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  const cleaned = String(phone).replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  // If 10-digit Indian number without country code, add +91 by default
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  return `+${cleaned}`;
};

/**
 * Dispatch message via Twilio REST API
 */
const sendTwilio = async ({ to, message, isWhatsApp = false, mediaUrl = '' }) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = isWhatsApp
    ? (process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER)
    : process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromPhone) {
    throw new Error('Twilio credentials not fully configured');
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const formattedTo = isWhatsApp ? `whatsapp:${formatPhoneNumber(to)}` : formatPhoneNumber(to);
  const formattedFrom = isWhatsApp ? (fromPhone.startsWith('whatsapp:') ? fromPhone : `whatsapp:${fromPhone}`) : fromPhone;

  const params = new URLSearchParams();
  params.append('To', formattedTo);
  params.append('From', formattedFrom);
  params.append('Body', message);
  if (mediaUrl) {
    params.append('MediaUrl', mediaUrl);
  }

  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Twilio error: ${response.status}`);
  }

  return { success: true, provider: 'twilio', id: data.sid };
};

/**
 * Dispatch message via MSG91 REST API
 */
const sendMSG91 = async ({ to, message }) => {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID || 'DENTAX';
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey) {
    throw new Error('MSG91 auth key not configured');
  }

  const endpoint = templateId
    ? 'https://control.msg91.com/api/v5/flow/'
    : 'https://api.msg91.com/api/v2/sendsms';

  const cleanPhone = formatPhoneNumber(to).replace('+', '');

  let payload;
  if (templateId) {
    payload = {
      template_id: templateId,
      sender: senderId,
      short_url: '0',
      mobiles: cleanPhone,
      var: message
    };
  } else {
    payload = {
      sender: senderId,
      route: '4',
      country: '91',
      sms: [{ message, to: [cleanPhone] }]
    };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authkey: authKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `MSG91 error: ${response.status}`);
  }

  return { success: true, provider: 'msg91', id: data.request_id || data.type };
};

/**
 * Dispatch message via Meta WhatsApp Cloud API
 */
const sendWhatsAppCloud = async ({ to, message }) => {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error('Meta WhatsApp Cloud credentials not configured');
  }

  const endpoint = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  const cleanPhone = formatPhoneNumber(to).replace('+', '');

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'text',
    text: { preview_url: false, body: message }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `WhatsApp Cloud error: ${response.status}`);
  }

  return { success: true, provider: 'meta_whatsapp', id: data.messages?.[0]?.id };
};

/**
 * Send individual message using available configured provider
 */
const sendMessage = async ({ to, message, type = 'SMS', mediaUrl = '' }) => {
  const isWhatsApp = type.toLowerCase() === 'whatsapp';

  // 1. Try Meta WhatsApp Cloud API if WhatsApp requested
  if (isWhatsApp && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return await sendWhatsAppCloud({ to, message });
  }

  // 2. Try Twilio (supports both SMS and WhatsApp)
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    return await sendTwilio({ to, message, isWhatsApp, mediaUrl });
  }

  // 3. Try MSG91
  if (process.env.MSG91_AUTH_KEY) {
    return await sendMSG91({ to, message });
  }

  // 4. Fallback: Log and simulate in dev/sandbox
  return {
    success: true,
    provider: 'simulated',
    simulated: true,
    to: formatPhoneNumber(to),
    type
  };
};

/**
 * Broadcast message to multiple recipients
 */
const broadcast = async ({ campaignType = 'SMS', recipients = [], message = '', mediaUrl = '' }) => {
  let sentCount = 0;
  let failedCount = 0;
  let providerUsed = 'simulated';

  for (const item of recipients) {
    const to = typeof item === 'string' ? item : (item.mobileNumber || item.phone || item.to);
    const name = typeof item === 'object' ? (item.name || item.patientName || '') : '';

    if (!to) continue;

    // Personalize message if placeholder exists
    let personalizedMessage = message;
    if (name) {
      personalizedMessage = personalizedMessage.replace(/{name}|{patientName}/gi, name);
    }

    try {
      const res = await sendMessage({
        to,
        message: personalizedMessage,
        type: campaignType,
        mediaUrl
      });
      sentCount++;
      if (res.provider) providerUsed = res.provider;
    } catch (err) {
      console.error(`[Broadcast Error] Failed to send to ${to}:`, err.message);
      failedCount++;
    }
  }

  return {
    totalRecipients: recipients.length,
    sentCount,
    failedCount,
    provider: providerUsed
  };
};

export {
  sendMessage,
  broadcast,
  formatPhoneNumber
};

export default {
  sendMessage,
  broadcast,
  formatPhoneNumber
};
