module.exports = {
  UPLOAD_DIR: '../uploads/receipts',
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  SUPPORTED_FILE_TYPES: {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png'
  }
};
