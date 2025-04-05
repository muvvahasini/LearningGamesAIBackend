const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Make sure you have a User model
    required: true,
    unique: true,
  },
  bio: {
    type: String,
    default: '',
    maxlength: 300,
  },
  avatar: {
    type: String,
    default: 'https://tse3.mm.bing.net/th?id=OIP.Gc94mo4hbciYBDSJwWzsAAHaHa&pid=Api&P=0&h=180',
  },
  socialLinks: {
    website: { type: String, default: '' },
    twitter: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    github: { type: String, default: '' },
    instagram: { type: String, default: '' },
  },
  interests: {
    type: [String],
    default: [],
  },
  location: {
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: '' },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('Profile', ProfileSchema);
