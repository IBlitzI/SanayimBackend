const Chat = require('../models/Chat');
const User = require('../models/User');
const RepairListing = require('../models/RepairListing');
const { sendMessageNotification } = require('../utils/notificationService');

exports.getChatHistory = async (userId) => {
  try {
    return await Chat.find({
      participants: userId
    })
      .sort({ updatedAt: -1 })
      .populate('participants', 'fullName profileImage');
  } catch (error) {
    console.error('Error getting chat history:', error);
    return [];
  }
};

exports.saveMessage = async (chatId, message) => {
  try {
    const chat = await Chat.findById(chatId);
    if (!chat) return null;

    chat.messages.push(message);
    await chat.save();
    return chat;
  } catch (error) {
    console.error('Error saving message:', error);
    return null;
  }
};

// Create new chat
exports.createNewChat = async (participants, repairListingId) => {
  try {
    const newChat = new Chat({
      participants,
      repairListingId,
      messages: []
    });
    await newChat.save();
    return newChat;
  } catch (error) {
    console.error('Error creating chat:', error);
    return null;
  }
};

// Yeni bir sohbet başlat
exports.createChat = async (req, res) => {
  try {
    const { mechanicId } = req.body;
    const currentUserId = req.user.id;

    if (!mechanicId) {
      return res.status(400).json({
        success: false,
        message: 'Tamirci ID\'si gereklidir'
      });
    }

    // Check if mechanic exists and is actually a mechanic
    const mechanic = await User.findOne({ _id: mechanicId });
    if (!mechanic) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Check for existing chat
    const existingChat = await Chat.findOne({
      participants: { $all: [currentUserId, mechanicId] }
    });

    if (existingChat) {
      await existingChat.populate('participants', 'fullName profileImage location userType');

      return res.status(200).json({
        success: true,
        data: existingChat
      });
    }

    const newChat = await Chat.create({
      participants: [currentUserId, mechanicId],
      messages: [],
      unreadCounts: new Map([
        [currentUserId.toString(), 0],
        [mechanicId.toString(), 0]
      ])
    });

    await newChat.populate('participants', 'fullName profileImage location userType');

    res.status(201).json({
      success: true,
      data: newChat
    });
  } catch (error) {
    console.error('Sohbet oluşturma hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sohbet oluşturulurken bir hata oluştu'
    });
  }
};

// Kullanıcının tüm sohbetlerini getir
exports.getUserChats = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const chats = await Chat.find({ participants: userId })
      .populate('participants', 'fullName profileImage location userType')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Chat.countDocuments({ participants: userId });

    // Format each chat to include last message and unread count
    const formattedChats = chats.map(chat => ({
      ...chat.toObject(),
      lastMessage: chat.messages[chat.messages.length - 1] || null,
      unreadCount: chat.unreadCounts.get(userId.toString()) || 0,
      otherParticipant: chat.participants.find(p => p._id.toString() !== userId)
    }));

    res.json({
      success: true,
      data: {
        chats: formattedChats,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalChats: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPreviousPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get user chats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Belirli bir sohbetin mesajlarını getir
exports.getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findById(chatId)
      .populate('participants', 'fullName profileImage')
      .populate('messages.senderId', 'fullName profileImage');

    if (!chat) {
      return res.status(404).json({ message: 'Sohbet bulunamadı' });
    }

    if (!chat.participants.some(p => p._id.toString() === userId)) {
      return res.status(403).json({ message: 'Bu sohbete erişim izniniz yok' });
    }

    // Mesajları okundu olarak işaretle
    chat.unreadCounts.set(userId.toString(), 0);
    await chat.save();

    res.json(chat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Okunmamış mesaj sayısını getir
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const chats = await Chat.find({ participants: userId });

    const totalUnread = chats.reduce((total, chat) => {
      return total + (chat.unreadCounts.get(userId.toString()) || 0);
    }, 0);

    res.json({ unreadCount: totalUnread });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Ortak kullanılabilecek mesajı okundu işaretleme fonksiyonu
exports.processMarkAsRead = async (chatId, userId) => {
  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return { success: false, error: 'Chat not found' };
    }

    if (!chat.participants.some(p => p.toString() === userId)) {
      return { success: false, error: 'User is not a participant in this chat' };
    }

    // Set unread count to 0 for current user
    chat.unreadCounts.set(userId.toString(), 0);
    await chat.save();

    return { success: true, chat };
  } catch (error) {
    console.error('Mark as read processing error:', error);
    return { success: false, error: error.message };
  }
};

// Mark all messages in a chat as read - HTTP endpoint
exports.markChatAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const result = await this.processMarkAsRead(chatId, userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    // Socket.IO olayını global olarak tetikle
    const io = req.app.get('io');
    if (io) {
      io.to(chatId).emit('messages read', { chatId, userId });
    }

    res.json({
      success: true,
      unreadCount: chat.unreadCounts.get(userId.toString()) || 0,
      message: 'Chat marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Mesaj güncelleme
exports.updateMessage = async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    const message = chat.messages.id(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.senderId.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to edit this message' });
    }

    message.content = content;
    message.edited = true;
    await chat.save();

    res.json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Mesaj silme
exports.deleteMessage = async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    const message = chat.messages.id(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.senderId.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    message.remove();
    await chat.save();

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Yeni mesaj işleme yardımcı fonksiyonu - HTTP ve Socket.IO tarafından ortak kullanılabilir
exports.processNewMessage = async (chatId, senderId, content) => {
  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return { success: false, error: 'Chat not found' };
    }

    // Kullanıcının bu sohbete katılımcı olup olmadığını kontrol et
    if (!chat.participants.includes(senderId)) {
      return { success: false, error: 'User is not a participant in this chat' };
    }

    // Gönderen kullanıcıyı bul
    const sender = await User.findById(senderId);
    if (!sender) {
      return { success: false, error: 'Sender not found' };
    }

    // Yeni mesajı oluştur
    const newMessage = {
      senderId,
      content,
      timestamp: new Date(),
      read: false
    };

    // Mesajı sohbete ekle
    chat.messages.push(newMessage);

    // Diğer katılımcıların okunmamış mesaj sayısını güncelle ve bildirim gönder
    for (const participantId of chat.participants) {
      if (participantId.toString() !== senderId) {
        // Okunmamış mesaj sayısını güncelle
        const currentCount = chat.unreadCounts.get(participantId.toString()) || 0;
        chat.unreadCounts.set(participantId.toString(), currentCount + 1);

        // Push bildirim gönder
        await sendMessageNotification(
          participantId,
          sender.fullName,
          content,
          chatId
        );
      }
    }

    await chat.save();
    return { success: true, chat, newMessage };
  } catch (error) {
    console.error('Message processing error:', error);
    return { success: false, error: error.message };
  }
};

// Yeni mesaj gönderme - HTTP endpoint
exports.sendMessage = async (req, res) => {
  try {
    const { chatId, content } = req.body;
    const userId = req.user.id;

    const result = await this.processNewMessage(chatId, userId, content);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    // Socket.IO olayını global olarak tetikle
    const io = req.app.get('io');
    if (io) {
      io.to(chatId).emit('message received', {
        chatId,
        message: result.chat.messages[result.chat.messages.length - 1]
      });
    }

    res.status(201).json({
      success: true,
      message: result.newMessage
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Find a chat between the current user and a mechanic, or create a new one if it doesn't exist
exports.findChatByMechanicId = async (req, res) => {
  try {
    const { otherUserId } = req.body;
    const currentUserId = req.user._id;

    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        message: 'Diğer kullanıcının ID\'si gereklidir'
      });
    }

    // Check if the other user exists
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Check for existing chat between the two users
    const existingChat = await Chat.findOne({
      participants: { $all: [currentUserId, otherUserId] }
    });

    if (existingChat) {
      // Chat exists, populate participant details and return it
      await existingChat.populate('participants', 'fullName profileImage location userType');

      return res.status(200).json({
        success: true,
        data: existingChat
      });
    }

    // No existing chat, create a new one
    const newChat = await Chat.create({
      participants: [currentUserId, otherUserId],
      messages: [],
      unreadCounts: new Map([
        [currentUserId.toString(), 0],
        [otherUserId.toString(), 0]
      ])
    });

    await newChat.populate('participants', 'fullName profileImage location userType');

    res.status(201).json({
      success: true,
      data: newChat
    });
  } catch (error) {
    console.error('Chat işlemi hatası:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
