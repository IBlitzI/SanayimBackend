const Chat = require('../models/Chat');
const User = require('../models/User');

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
    const { participantId, repairListingId } = req.body;
    const currentUserId = req.user.id;

    // Validate participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    // Check for existing chat
    const existingChat = await Chat.findOne({
      participants: { $all: [currentUserId, participantId] },
      repairListingId: repairListingId
    });

    if (existingChat) {
      await existingChat.populate('participants', 'fullName profileImage');
      return res.status(200).json(existingChat);
    }

    const newChat = await Chat.create({
      participants: [currentUserId, participantId],
      repairListingId,
      messages: [],
      unreadCounts: new Map([[participantId, 0], [currentUserId, 0]])
    });

    await newChat.populate('participants', 'fullName profileImage');

    res.status(201).json(newChat);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
      .populate('participants', 'fullName profileImage')
      .populate('repairListingId', 'description images location')
      .sort({ lastMessage: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Chat.countDocuments({ participants: userId });

    res.json({
      chats,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalChats: total
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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

// Yeni mesaj gönderme
exports.sendMessage = async (req, res) => {
  try {
    const { chatId } = req.body;
    const { content } = req.body;
    const userId = req.user.id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Kullanıcının bu sohbete katılımcı olup olmadığını kontrol et
    if (!chat.participants.includes(userId)) {
      return res.status(403).json({ message: 'You are not a participant in this chat' });
    }

    // Yeni mesajı oluştur
    const newMessage = {
      senderId: userId,
      content,
      timestamp: new Date(),
      read: false
    };

    // Mesajı sohbete ekle
    chat.messages.push(newMessage);

    // Diğer katılımcıların okunmamış mesaj sayısını güncelle
    chat.participants.forEach(participantId => {
      if (participantId.toString() !== userId) {
        const currentCount = chat.unreadCounts.get(participantId.toString()) || 0;
        chat.unreadCounts.set(participantId.toString(), currentCount + 1);
      }
    });

    await chat.save();

    // Mesaj socket.io ile gönderileceği için burada sadece başarı mesajı dönüyoruz
    res.status(201).json({
      success: true,
      message: newMessage
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
