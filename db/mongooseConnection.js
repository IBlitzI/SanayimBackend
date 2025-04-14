const mongoose = require('mongoose')
exports.connectToMongoDb = async() => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            compressors: "zlib",
            autoIndex: true,
            connectTimeoutMS: 5000
        })
       console.log("DB Bağlandı")
    } catch (error) {
        console.log('error', error)
        throw new Error(error)
    }
}