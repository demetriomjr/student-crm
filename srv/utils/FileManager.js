const fs = require('fs');
const path = require('path');
const fileConfig = require('../config/file-config');

const UPLOAD_DIR = path.join(__dirname, '../', fileConfig.UPLOAD_DIR);
const SUPPORTED_FILE_TYPES = fileConfig.SUPPORTED_FILE_TYPES;
const MAX_FILE_SIZE = fileConfig.MAX_FILE_SIZE;

const FileManager = {
  ensureUploadDirectory() {
    try {
      if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      }
      return true;
    } catch (error) {
      console.error('Failed to create upload directory:', error);
      return false;
    }
  },

  validateFile(fileName, content) {
    if (!fileName || !content) {
      return { isValid: false, error: 'File name and content are required' };
    }

    const extension = path.extname(fileName).toLowerCase();
    if (!SUPPORTED_FILE_TYPES[extension]) {
      return {
        isValid: false,
        error: `Unsupported file type: ${extension}. Supported types: ${Object.keys(SUPPORTED_FILE_TYPES).join(', ')}`
      };
    }

    const fileSize = (content.length * 3) / 4;
    if (fileSize > MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      };
    }

    return { isValid: true };
  },

  saveFile(fileName, content) {
    try {
      if (!this.ensureUploadDirectory()) {
        return { success: false, error: 'Failed to ensure upload directory exists' };
      }

      const filePath = path.join(UPLOAD_DIR, fileName);
      const buffer = Buffer.from(content, 'base64');
      
      fs.writeFileSync(filePath, buffer);
      
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File was not saved successfully. Seems the path is incorrect.' };
      }

      return { success: true, filePath };
    } catch (error) {
      console.error('Error saving file:', error.message, { fileName });
      return { success: false, error: error.message };
    }
  },

  generateFileName(originalName) {
    const timestamp = Date.now();
    const randomKey = Math.random().toString(36).substring(2, 8);
    const extension = path.extname(originalName);
    
    return `${timestamp}-${randomKey}${extension}`;
  },

  readFile(fileName) {
    try {
      const filePath = path.join(UPLOAD_DIR, fileName);
      
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File not found' };
      }

      const fileContent = fs.readFileSync(filePath);
      const base64Content = fileContent.toString('base64');
      const extension = path.extname(fileName).toLowerCase();
      const mimeType = SUPPORTED_FILE_TYPES[extension] || 'application/octet-stream';

      return {
        success: true,
        fileName,
        fileContent: base64Content,
        mimeType
      };
    } catch (error) {
      console.error('Error reading file:', error);
      return { success: false, error: error.message };
    }
  },

  deleteFile(fileName) {
    try {
      const filePath = path.join(UPLOAD_DIR, fileName);
      
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File not found' };
      }

      fs.unlinkSync(filePath);
      
      if (fs.existsSync(filePath)) {
        return { success: false, error: 'File was not deleted successfully' };
      }

      return { success: true, message: 'File deleted successfully' };
    } catch (error) {
      console.error('Error deleting file:', error);
      return { success: false, error: error.message };
    }
  }
};

module.exports = FileManager;
