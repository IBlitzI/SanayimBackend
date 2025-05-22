const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");
const fs = require("fs");
const GeminiChat = require("../models/GeminiChat");

const upload = multer({ dest: "uploads/" });
const genAI = new GoogleGenerativeAI("AIzaSyD-AB81nv2IUz1aEtSx-a2NevHzWoUx3vQ");

exports.chatWithGemini = [
  upload.single("image"),
  async (req, res) => {
    try {
      const { message } = req.body;
      const userId = req.user._id; // Auth middleware'den gelen kullanıcı ID'si
      const file = req.file;

      // Kullanıcının sohbet geçmişini bul veya yeni oluştur
      let chatHistory = await GeminiChat.findOne({ userId });
      if (!chatHistory) {
        chatHistory = new GeminiChat({ userId, history: [] });
      }

      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: {
          role: "user",
          parts: [{
            text: "SENİN ROLÜN: Sadece araba ve mekanik konularında uzman asistansın.\n" +
                  "KURALLAR:\n" +
                  "1. Konu dışı soruları kibarca reddet\n" +
                  "2. Tüm konuşma geçmişini dikkate al\n" +
                  "3. Bağlamı asla kaybetme\n" +
                  "4. Kullanıcının önceki mesajlarını hatırla"
          }]
        }
      });

      // Veritabanındaki geçmişi Gemini formatına dönüştür
      const fullHistory = chatHistory.history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));

      // Şimdiki mesajı hazırla
      const currentMessage = {
        role: "user",
        parts: [{ text: message }]
      };

      // Resim varsa ekle
      if (file) {
        const imageBuffer = fs.readFileSync(file.path);
        currentMessage.parts.push({
          inlineData: {
            mimeType: file.mimetype,
            data: imageBuffer.toString("base64"),
          }
        });
        fs.unlinkSync(file.path);
      }

      // Tüm geçmişi birleştir
      const completeHistory = [...fullHistory, currentMessage];

      // Sohbeti başlat
      const chat = model.startChat({
        history: completeHistory,
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 2048
        }
      });

      // Mesajı gönder
      const result = await chat.sendMessage(currentMessage.parts);
      const response = result.response.text();

      // Yeni mesajları veritabanına kaydet
      chatHistory.history.push(
        { role: "user", content: message },
        { role: "model", content: response }
      );
      await chatHistory.save();

      res.json({
        success: true,
        message: response,
        history: chatHistory.history
      });

    } catch (error) {
      console.error("Hata:", error);
      res.status(500).json({
        success: false,
        message: "API hatası: " + error.message,
        details: {
          error: error.toString(),
          stack: error.stack
        }
      });
    }
  }
];

exports.deleteHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Kullanıcının sohbet geçmişini bul ve sil
    const result = await GeminiChat.findOneAndUpdate(
      { userId },
      { $set: { history: [] } },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Sohbet geçmişi bulunamadı"
      });
    }

    res.json({
      success: true,
      message: "Sohbet geçmişi başarıyla silindi"
    });

  } catch (error) {
    console.error("Hata:", error);
    res.status(500).json({
      success: false,
      message: "Sohbet geçmişi silinirken bir hata oluştu",
      error: error.message
    });
  }
};