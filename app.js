const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const routes = require('./routes');
const chatController = require('./controllers/chatController');
const Chat = require('./models/Chat'); // Assuming Chat model is defined

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

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
  console.log('Bir kullanıcı bağlandı');

  // Kullanıcı bir chat odasına katılıyor
  socket.on('join chat', (chatId) => {
    socket.join(chatId);
  });

  // Yeni mesaj gönderildiğinde
  socket.on('new message', async (data) => {
    try {
      const { chatId, message, senderId } = data;
      
      // Mesajı veritabanına kaydet
      const chat = await Chat.findById(chatId);
      if (chat) {
        chat.messages.push({
          senderId,
          content: message,
          timestamp: new Date(),
          read: false
        });
        
        // Karşı tarafa unread count'u arttır
        chat.participants.forEach(participantId => {
          if (participantId.toString() !== senderId) {
            const currentCount = chat.unreadCounts.get(participantId.toString()) || 0;
            chat.unreadCounts.set(participantId.toString(), currentCount + 1);
          }
        });
        
        await chat.save();
        
        // Odadaki diğer kullanıcılara mesajı gönder
        io.to(chatId).emit('message received', {
          chatId,
          message: chat.messages[chat.messages.length - 1]
        });
      }
    } catch (error) {
      console.error('Mesaj gönderme hatası:', error);
    }
  });

  // Mesajların okundu olarak işaretlenmesi
  socket.on('mark as read', async (data) => {
    try {
      const { chatId, userId } = data;
      const chat = await Chat.findById(chatId);
      if (chat) {
        chat.unreadCounts.set(userId, 0);
        await chat.save();
        io.to(chatId).emit('messages read', { chatId, userId });
      }
    } catch (error) {
      console.error('Mesaj okundu işaretleme hatası:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Bir kullanıcı ayrıldı');
  });
});

// MongoDB Connection
const db = require('./db/mongooseConnection');
db.connectToMongoDb();

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
