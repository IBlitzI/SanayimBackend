const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const routes = require('./routes');
const chatController = require('./controllers/chatController');
const Chat = require('./models/Chat');
const User = require('./models/User');
const { sendMessageNotification } = require('./utils/notificationService');

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.IO'yu Express uygulamasına ekle (kontroller tarafından kullanılabilmesi için)
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());

// Ana API route'u
app.use('/api', routes);

// Socket.IO Authentication Middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Socket.IO bağlantı yönetimi
io.on('connection', (socket) => {
  console.log('A user connected');

  // Kullanıcı kendi userId odasına katılıyor (chat listesi için)
  if (socket.userId) {
    socket.join(socket.userId);
  }

  // Kullanıcı bir chat odasına katılıyor
  socket.on('join chat', (chatId) => {
    socket.join(chatId);
  });  // Yeni mesaj gönderildiğinde - chatController metodunu kullanarak
  socket.on('new message', async (data) => {
    try {
      const { chatId, message, senderId } = data;
      
      // Chat Controller'daki ortak fonksiyonu kullan
      const result = await chatController.processNewMessage(chatId, senderId, message);
      
      if (!result.success) {
        console.error('Message processing error:', result.error);
        return;
      }
      
      // Odadaki tüm kullanıcılara mesaj gönderildi bildirimini yayınla
      io.to(chatId).emit('message received', {
        chatId,
        message: result.chat.messages[result.chat.messages.length - 1]
      });
      // Diğer katılımcıların userId odasına da emit et (chat listesi için)
      const chat = result.chat;
      chat.participants.forEach((participantId) => {
        if (participantId.toString() !== senderId.toString()) {
          io.to(participantId.toString()).emit('message received', {
            chatId,
            message: result.chat.messages[result.chat.messages.length - 1]
          });
        }
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });  // Mesajların okundu olarak işaretlenmesi
  socket.on('mark as read', async (data) => {
    try {
      const { chatId, userId } = data;
      
      // Chat Controller'daki ortak fonksiyonu kullan
      const result = await chatController.processMarkAsRead(chatId, userId);
      
      if (!result.success) {
        console.error('Mark as read error:', result.error);
        return;
      }
      
      // Odadaki tüm kullanıcılara okundu bilgisini yayınla
      io.to(chatId).emit('messages read', { chatId, userId });
    } catch (error) {
      console.error('Mesaj okundu işaretleme hatası:', error);
    }
  });
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// MongoDB Connection
const db = require('./db/mongooseConnection');
db.connectToMongoDb();

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
