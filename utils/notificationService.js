const axios = require('axios');
const User = require('../models/User');

// Expo push notification service
const sendPushNotification = async (targetUser, title, body, data = {}) => {
  try {
    if (!targetUser.expoPushToken) {
      console.log(`Push token bulunamadı: ${targetUser._id}`);
      return false;
    }

    console.log('Bildirim gönderiliyor:', {
      to: targetUser.expoPushToken,
      title,
      body,
      data
    });

    const message = {
      to: targetUser.expoPushToken,
      sound: 'default',
      title: title,
      body: body,
      data: data,
      priority: 'high',
    };

    const response = await axios.post('https://exp.host/--/api/v2/push/send', 
      message, 
      {
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Expo yanıtı:', response.data);

    return response.data;
  } catch (error) {
    console.error('Push bildirimi gönderilirken hata oluştu:', error?.response?.data || error.message);
    return false;
  }
};

// Mesaj bildirimlerini gönder
const sendMessageNotification = async (receiverId, senderName, messageContent, chatId) => {
  try {
    const receiver = await User.findById(receiverId);
    if (!receiver || !receiver.expoPushToken) return false;

    // Mesajın içeriği uzunsa kısalt
    const shortMessageContent = messageContent.length > 40 
      ? `${messageContent.substring(0, 40)}...` 
      : messageContent;

    return await sendPushNotification(
      receiver, 
      `${senderName}`,
      `${shortMessageContent}`, 
      { 
        type: 'message', 
        chatId: chatId.toString(),
        senderId: receiverId.toString()
      }
    );
  } catch (error) {
    console.error('Mesaj bildirimi gönderilirken hata oluştu:', error);
    return false;
  }
};

// Teklif bildirimlerini gönder
const sendBidNotification = async (ownerId, mechanicName, repairListingId, amount) => {
  try {
    const owner = await User.findById(ownerId);
    if (!owner) {
      console.log('İlan sahibi bulunamadı:', ownerId);
      return false;
    }
    console.log('Owner push token:', owner.expoPushToken);

    if (!owner.expoPushToken) return false;

    return await sendPushNotification(
      owner,
      'Yeni Teklif Geldi',
      `${mechanicName} aracınız için ${amount}₺ tutarında bir teklif verdi.`,
      { 
        type: 'bid', 
        repairListingId: repairListingId.toString() 
      }
    );
  } catch (error) {
    console.error('Teklif bildirimi gönderilirken hata oluştu:', error);
    return false;
  }
};

module.exports = {
  sendPushNotification,
  sendMessageNotification,
  sendBidNotification
};
